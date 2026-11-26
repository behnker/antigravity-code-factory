#!/usr/bin/env python3
"""Unit, security, IPC, and async workflow tests for Code Factory v3.1.0 Phase 2.

Covers Spec §5 Row 3 (Partition 2):
  - sidecars/telemetry-memory/sidecar.json schema & sidecar.py 0600 AF_UNIX bind
  - macOS 104-byte sun_path fallback via cf-sidecar.endpoint.json
  - NDJSON wire validation (invalid_json, invalid_event, payload_too_large)
  - Secret redaction & telemetry-audit.jsonl rotation (.1, .2, .3)
  - Sidecar-down <10ms fail-open spooling + sidecar.py flush drain
  - Bounded <=200-line / <=3KB .memory/auto-memory.md distillation preserving user notes
  - Symlink rejection on .memory/ and .memory/auto-memory.md
  - Opt-in local webhook forwarding (CF_ALLOW_INSECURE_LOCAL_WEBHOOK=1) + http:// rejection
  - workflows/validate_workflows.py schema & ast.PyCF_ALLOW_TOP_LEVEL_AWAIT checks
  - IsolatedAsyncioTestCase end-to-end execution of cf-qa-gate & cf-implement-spec

All synthetic secrets are constructed dynamically so secret-guard.py never sees
literal credential strings in source code.
"""

from __future__ import annotations

import ast
import http.server
import importlib.util
import json
import os
import pathlib
import socket
import stat
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from typing import Any
from unittest import mock

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
HOOKS_DIR = REPO_ROOT / "hooks"
SIDECAR_DIR = REPO_ROOT / "sidecars" / "telemetry-memory"
WORKFLOWS_DIR = REPO_ROOT / "workflows"

for p in (str(HOOKS_DIR), str(SIDECAR_DIR), str(WORKFLOWS_DIR)):
    if p not in sys.path:
        sys.path.insert(0, p)

import hook_state  # noqa: E402
import sidecar  # noqa: E402
import validate_workflows  # noqa: E402


def _make_synthetic_secrets() -> dict[str, str]:
    """Construct synthetic secret tokens dynamically without literal triggers."""
    return {
        "openai": "sk-" + "testPhase2_" + "0123456789abcdef123456",
        "github": "ghp_" + "A" * 36,
        "aws": "AKIA" + "1234567890ABCDEF",
        "bearer": "Bearer " + "tok_" + "0123456789abcdef1234",
    }


def _send_unix_ndjson(sock_path: pathlib.Path, line_bytes: bytes) -> dict[str, Any]:
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
        client.settimeout(2.0)
        client.connect(str(sock_path))
        client.sendall(line_bytes)
        client.shutdown(socket.SHUT_WR)
        chunks: list[bytes] = []
        while True:
            data = client.recv(4096)
            if not data:
                break
            chunks.append(data)
    raw = b"".join(chunks).decode("utf-8").strip()
    return json.loads(raw)


class _MockToolError(Exception):
    def __init__(self, tool: str, message: str, denied: bool = False) -> None:
        super().__init__(message)
        self.tool = tool
        self.message = message
        self.denied = denied


class TestSidecarManifestAndCLI(unittest.TestCase):
    def test_sidecar_json_matches_contract(self) -> None:
        manifest_path = SIDECAR_DIR / "sidecar.json"
        self.assertTrue(manifest_path.is_file())
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(
            set(data.keys()),
            {"display_name", "description", "command", "args", "restart_policy", "env"},
        )
        self.assertEqual(data["command"], "python3")
        self.assertEqual(data["args"], ["sidecar.py", "serve"])
        self.assertEqual(data["restart_policy"], "on-failure")
        self.assertEqual(data["env"], {"PYTHONUNBUFFERED": "1"})

    def test_long_path_macos_sun_path_fallback_and_subprocess_lifecycle(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            long_plugin_data = (
                pathlib.Path(tmp)
                / ("very_long_segment_" * 6)
                / "plugin_data"
            )
            self.assertGreater(len(str(long_plugin_data / "cf-sidecar.sock").encode()), 100)

            env = os.environ.copy()
            env["PLUGIN_DATA"] = str(long_plugin_data)
            env.pop("CF_SIDECAR_SOCKET", None)

            proc = subprocess.Popen(
                [sys.executable, str(SIDECAR_DIR / "sidecar.py"), "serve"],
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            short_sock: pathlib.Path | None = None
            try:
                endpoint_file = long_plugin_data / "cf-sidecar.endpoint.json"
                pid_file = long_plugin_data / "cf-sidecar.pid"
                deadline = time.monotonic() + 5.0
                while time.monotonic() < deadline:
                    if endpoint_file.exists() and pid_file.exists():
                        break
                    time.sleep(0.05)

                self.assertTrue(endpoint_file.exists(), "endpoint.json was not created")
                self.assertTrue(pid_file.exists(), "pid file was not created")
                self.assertEqual(stat.S_IMODE(endpoint_file.stat().st_mode), 0o600)
                self.assertEqual(stat.S_IMODE(pid_file.stat().st_mode), 0o600)

                endpoint_data = json.loads(endpoint_file.read_text(encoding="utf-8"))
                short_sock = pathlib.Path(endpoint_data["socketPath"])
                self.assertLessEqual(len(str(short_sock).encode("utf-8")), 100)
                self.assertTrue(short_sock.exists())
                self.assertTrue(stat.S_ISSOCK(os.lstat(short_sock).st_mode))
                self.assertEqual(stat.S_IMODE(os.lstat(short_sock).st_mode), 0o600)
                self.assertEqual(
                    stat.S_IMODE(os.lstat(short_sock.parent).st_mode), 0o700
                )

                # Verify status CLI
                status_proc = subprocess.run(
                    [sys.executable, str(SIDECAR_DIR / "sidecar.py"), "status", "--json"],
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=5.0,
                    check=True,
                )
                status_data = json.loads(status_proc.stdout)
                self.assertTrue(status_data["running"])
                self.assertTrue(status_data["usesShortSocket"])
                self.assertEqual(status_data["socketPath"], str(short_sock))

                # Emit event over the discovered short socket via hook_state
                secrets = _make_synthetic_secrets()
                with mock.patch.dict(os.environ, {"PLUGIN_DATA": str(long_plugin_data)}):
                    sent = hook_state.emit_sidecar_event(
                        event_name="post_tool_lint_resolved",
                        conversation_id="conv-long-sock-01",
                        hook="post-tool-feedback",
                        summary=f"Fixed lint near {secrets['openai']}",
                    )
                self.assertTrue(sent)

                # Give server thread a brief moment to write audit log
                audit_file = long_plugin_data / "telemetry-audit.jsonl"
                deadline = time.monotonic() + 2.0
                while time.monotonic() < deadline and not audit_file.exists():
                    time.sleep(0.02)
                self.assertTrue(audit_file.exists())
                audit_text = audit_file.read_text(encoding="utf-8")
                self.assertIn("[REDACTED_SECRET]", audit_text)
                self.assertNotIn(secrets["openai"], audit_text)

                # Stop via CLI
                stop_proc = subprocess.run(
                    [sys.executable, str(SIDECAR_DIR / "sidecar.py"), "stop", "--json"],
                    env=env,
                    capture_output=True,
                    text=True,
                    timeout=5.0,
                    check=True,
                )
                stop_data = json.loads(stop_proc.stdout)
                self.assertTrue(stop_data["stopped"])
                proc.wait(timeout=3.0)
            finally:
                if proc.poll() is None:
                    proc.terminate()
                    proc.wait(timeout=3.0)
                if proc.stdout:
                    proc.stdout.close()
                if proc.stderr:
                    proc.stderr.close()
                if short_sock and short_sock.exists():
                    short_sock.unlink(missing_ok=True)


class TestSidecarProtocolRotationAndSpool(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.plugin_data = pathlib.Path(self._tmp.name) / "pd"
        self.plugin_data.mkdir(mode=0o700)
        self._env = mock.patch.dict(
            os.environ,
            {
                "PLUGIN_DATA": str(self.plugin_data),
                "CF_DISABLE_SIDECAR": "",
                "CF_TELEMETRY_WEBHOOK_URL": "",
            },
        )
        self._env.start()

    def tearDown(self) -> None:
        self._env.stop()
        self._tmp.cleanup()

    def test_ipc_validation_redaction_and_rotation(self) -> None:
        with mock.patch.dict(os.environ, {"CF_TELEMETRY_MAX_BYTES": "450"}):
            srv = sidecar.SidecarServer()
            srv.start()
            thread = threading.Thread(target=srv.serve_forever, daemon=True)
            thread.start()
            try:
                sock_path = srv._bind_sock_path
                self.assertEqual(stat.S_IMODE(os.lstat(sock_path).st_mode), 0o600)

                # 1. Malformed JSON
                resp_bad_json = _send_unix_ndjson(sock_path, b"{not-json\n")
                self.assertEqual(resp_bad_json, {"ok": False, "error": "invalid_json"})

                # 2. Invalid eventType
                bad_type = json.dumps(
                    {
                        "schemaVersion": 1,
                        "eventType": "unexpected_type",
                        "eventName": "session_start",
                        "conversationId": "conv-1",
                    }
                ).encode() + b"\n"
                self.assertEqual(
                    _send_unix_ndjson(sock_path, bad_type),
                    {"ok": False, "error": "invalid_event"},
                )

                # 3. Payload too large (> 16384 bytes)
                huge = b'{"x":"' + (b"a" * 17000) + b'"}\n'
                self.assertEqual(
                    _send_unix_ndjson(sock_path, huge),
                    {"ok": False, "error": "payload_too_large"},
                )

                # 4. Valid events with secrets + log rotation (.1, .2, .3)
                secrets = _make_synthetic_secrets()
                for idx in range(10):
                    ev = hook_state.build_sidecar_event(
                        event_name="post_tool_lint_error",
                        conversation_id=f"conv-rot-{idx}",
                        hook="post-tool-feedback",
                        tool_name="edit_file",
                        summary=f"Error #{idx} token={secrets['github']} aws={secrets['aws']}",
                    )
                    resp = _send_unix_ndjson(
                        sock_path, (json.dumps(ev) + "\n").encode("utf-8")
                    )
                    self.assertEqual(resp, {"ok": True})

                audit_path = self.plugin_data / "telemetry-audit.jsonl"
                self.assertTrue(audit_path.exists())
                self.assertEqual(stat.S_IMODE(audit_path.stat().st_mode), 0o600)
                self.assertTrue((self.plugin_data / "telemetry-audit.jsonl.1").exists())
                self.assertTrue((self.plugin_data / "telemetry-audit.jsonl.2").exists())
                self.assertTrue((self.plugin_data / "telemetry-audit.jsonl.3").exists())
                self.assertFalse((self.plugin_data / "telemetry-audit.jsonl.4").exists())

                for suffix in ("", ".1", ".2", ".3"):
                    text = (self.plugin_data / f"telemetry-audit.jsonl{suffix}").read_text(
                        encoding="utf-8"
                    )
                    self.assertNotIn(secrets["github"], text)
                    self.assertNotIn(secrets["aws"], text)
            finally:
                srv.close()
                thread.join(timeout=2.0)

    def test_fail_open_spool_under_10ms_and_flush_drain(self) -> None:
        workspace = pathlib.Path(self._tmp.name) / "ws"
        (workspace / ".memory").mkdir(parents=True)
        secrets = _make_synthetic_secrets()

        # Warm path resolution once, then verify < 10 ms fail-open emission
        _ = hook_state.resolve_sidecar_paths()
        t0 = time.perf_counter()
        sent = hook_state.emit_sidecar_event(
            event_name="verification_passed",
            conversation_id="conv-spool-01",
            project_dir=str(workspace),
            hook="post-tool-feedback",
            summary=f"Verified tests cleanly ({secrets['bearer']})",
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        self.assertFalse(sent)
        self.assertLess(elapsed_ms, 10.0)

        spool_path = self.plugin_data / "telemetry-spool.jsonl"
        self.assertTrue(spool_path.exists())
        self.assertEqual(stat.S_IMODE(spool_path.stat().st_mode), 0o600)
        spool_text = spool_path.read_text(encoding="utf-8")
        self.assertIn("[REDACTED_SECRET]", spool_text)
        self.assertNotIn(secrets["bearer"], spool_text)

        # Flush spool via CLI
        flush_proc = subprocess.run(
            [sys.executable, str(SIDECAR_DIR / "sidecar.py"), "flush", "--json"],
            env=os.environ.copy(),
            capture_output=True,
            text=True,
            timeout=5.0,
            check=True,
        )
        flush_res = json.loads(flush_proc.stdout)
        self.assertEqual(flush_res["flushed"], 1)
        self.assertEqual(flush_res["distilled"], 1)
        self.assertEqual(spool_path.read_text(encoding="utf-8").strip(), "")

        audit_text = (self.plugin_data / "telemetry-audit.jsonl").read_text(
            encoding="utf-8"
        )
        self.assertIn("verification_passed", audit_text)

        auto_mem = workspace / ".memory" / "auto-memory.md"
        self.assertTrue(auto_mem.exists())
        mem_text = auto_mem.read_text(encoding="utf-8")
        self.assertIn("Verified tests cleanly", mem_text)
        self.assertNotIn(secrets["bearer"], mem_text)


class TestAutoMemoryAndWebhook(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.plugin_data = pathlib.Path(self._tmp.name) / "pd"
        self.plugin_data.mkdir(mode=0o700)
        self.workspace = pathlib.Path(self._tmp.name) / "repo"
        self.mem_dir = self.workspace / ".memory"
        self.mem_dir.mkdir(parents=True)
        self._env = mock.patch.dict(
            os.environ,
            {
                "PLUGIN_DATA": str(self.plugin_data),
                "CF_AUTO_MEMORY": "on",
            },
        )
        self._env.start()

    def tearDown(self) -> None:
        self._env.stop()
        self._tmp.cleanup()

    def test_distill_preserves_user_notes_bounds_3kb_200lines_and_dedups(self) -> None:
        auto_mem = self.mem_dir / "auto-memory.md"
        user_header = "# Team Notes (Do Not Touch)\n- Keep Postgres RLS strict.\n"
        user_footer = "\n## Manual Runbook\n- Run pnpm audit before release.\n"
        auto_mem.write_text(
            user_header
            + f"{sidecar.AUTO_MEMORY_START}\n{sidecar.AUTO_MEMORY_END}"
            + user_footer,
            encoding="utf-8",
        )

        secrets = _make_synthetic_secrets()
        # Distill duplicate + secret note
        res1 = sidecar.distill_auto_memory(
            self.workspace, f"Lesson zero with secret {secrets['openai']}", timestamp=1764141000.0
        )
        res2 = sidecar.distill_auto_memory(
            self.workspace, f"Lesson zero with secret {secrets['openai']}", timestamp=1764141005.0
        )
        self.assertTrue(res1["ok"])
        self.assertTrue(res2["ok"])
        self.assertEqual(res2["managedBullets"], 1)

        # Flood 80 long bullets to trigger FIFO eviction under 200 lines & 3072 bytes
        for idx in range(80):
            res = sidecar.distill_auto_memory(
                self.workspace,
                f"Invariant #{idx:03d}: always validate boundaries and avoid N+1 queries ({'x' * 70})",
                timestamp=1764141100.0 + idx,
            )
            self.assertTrue(res["ok"])

        final_text = auto_mem.read_text(encoding="utf-8")
        self.assertLessEqual(len(final_text.splitlines()), 200)
        self.assertLessEqual(len(final_text.encode("utf-8")), 3072)
        self.assertEqual(stat.S_IMODE(auto_mem.stat().st_mode), 0o600)
        self.assertIn("# Team Notes (Do Not Touch)", final_text)
        self.assertIn("- Keep Postgres RLS strict.", final_text)
        self.assertIn("## Manual Runbook", final_text)
        self.assertIn("- Run pnpm audit before release.", final_text)
        self.assertNotIn(secrets["openai"], final_text)
        # Oldest bullet evicted, newest bullet kept
        self.assertIn("Invariant #079:", final_text)
        self.assertNotIn("Invariant #000:", final_text)

    def test_symlink_rejection_on_auto_memory_and_memory_dir(self) -> None:
        outside_file = pathlib.Path(self._tmp.name) / "outside.txt"
        outside_file.write_text("DO_NOT_OVERWRITE", encoding="utf-8")

        auto_mem = self.mem_dir / "auto-memory.md"
        auto_mem.symlink_to(outside_file)
        res = sidecar.distill_auto_memory(self.workspace, "Should be rejected")
        self.assertFalse(res["ok"])
        self.assertEqual(res["reason"], "symlink_rejected")
        self.assertEqual(outside_file.read_text(encoding="utf-8"), "DO_NOT_OVERWRITE")

        # Symlinked .memory dir
        ws2 = pathlib.Path(self._tmp.name) / "repo_sym"
        ws2.mkdir()
        (ws2 / ".memory").symlink_to(self.mem_dir)
        res_dir = sidecar.distill_auto_memory(ws2, "Should also reject")
        self.assertFalse(res_dir["ok"])

    def test_webhook_url_validation_and_local_opt_in_delivery(self) -> None:
        # Reject insecure http:// by default and embedded credentials always
        with mock.patch.dict(os.environ, {"CF_ALLOW_INSECURE_LOCAL_WEBHOOK": ""}):
            ok_http, _ = sidecar.validate_webhook_url("http://127.0.0.1:8080/hook")
            self.assertFalse(ok_http)
            ok_creds, _ = sidecar.validate_webhook_url("https://user:pass@example.com/hook")
            self.assertFalse(ok_creds)
            ok_https, _ = sidecar.validate_webhook_url("https://example.com/hook")
            self.assertTrue(ok_https)

        received: list[dict[str, Any]] = []
        recv_event = threading.Event()

        class _Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self) -> None:  # noqa: N802
                length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(length).decode("utf-8")
                received.append(json.loads(body))
                self.send_response(200)
                self.end_headers()
                recv_event.set()

            def log_message(self, _fmt: str, *_args: Any) -> None:
                return

        httpd = http.server.HTTPServer(("127.0.0.1", 0), _Handler)
        port = httpd.server_address[1]
        http_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        http_thread.start()

        secrets = _make_synthetic_secrets()
        try:
            with mock.patch.dict(
                os.environ,
                {
                    "CF_ALLOW_INSECURE_LOCAL_WEBHOOK": "1",
                    "CF_TELEMETRY_WEBHOOK_URL": f"http://127.0.0.1:{port}/hook",
                },
            ):
                dispatcher = sidecar.WebhookDispatcher(
                    f"http://127.0.0.1:{port}/hook"
                )
                self.assertTrue(dispatcher.enabled)
                ev = hook_state.build_sidecar_event(
                    event_name="loop_breaker_triggered",
                    conversation_id="conv-wh-1",
                    summary=f"Tripped with secret {secrets['aws']}",
                )
                sidecar.process_valid_event(ev, webhook=dispatcher)
                self.assertTrue(recv_event.wait(timeout=3.0))
                dispatcher.flush_and_stop(timeout_s=2.0)

            self.assertEqual(len(received), 1)
            self.assertIn("[REDACTED_SECRET]", received[0]["summary"])
            self.assertNotIn(secrets["aws"], received[0]["summary"])
        finally:
            httpd.shutdown()
            httpd.server_close()


class TestWorkflowValidator(unittest.TestCase):
    def test_bundled_workflows_validate_cleanly(self) -> None:
        report = validate_workflows.validate_all(WORKFLOWS_DIR)
        self.assertTrue(report["ok"], msg=f"Validation failed: {report}")
        names = {wf["name"] for wf in report["workflows"]}
        self.assertEqual(names, {"cf-qa-gate", "cf-implement-spec"})

        cli_proc = subprocess.run(
            [sys.executable, str(WORKFLOWS_DIR / "validate_workflows.py"), "--json"],
            capture_output=True,
            text=True,
            timeout=5.0,
            check=True,
        )
        cli_json = json.loads(cli_proc.stdout)
        self.assertTrue(cli_json["ok"])

    def test_validator_rejects_local_imports_and_bad_schemas(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            bad_wf = pathlib.Path(tmp) / "cf-qa-gate"
            bad_wf.mkdir()
            (bad_wf / "workflow.json").write_text(
                json.dumps(
                    {
                        "name": "cf-qa-gate",
                        "displayName": "Bad",
                        "version": "1.0.0",
                        "description": "Bad",
                        "entry": "workflow.py",
                        "args": {
                            "type": "object",
                            "required": ["verify_cmd"],
                            "additionalProperties": False,
                            "properties": {"verify_cmd": {"type": "string"}},
                        },
                    }
                ),
                encoding="utf-8",
            )
            (bad_wf / "workflow.py").write_text(
                "import my_local_helper\nawait run_it()\n", encoding="utf-8"
            )
            res = validate_workflows.validate_workflow_dir(bad_wf)
            self.assertFalse(res["ok"])
            joined = "\n".join(res["errors"])
            self.assertIn("outputSchema", joined)
            self.assertIn("my_local_helper", joined)

    def test_post_tool_feedback_allows_top_level_await_under_workflows(self) -> None:
        ptf_path = HOOKS_DIR / "post-tool-feedback.py"
        ptf_src = ptf_path.read_text(encoding="utf-8")
        if "PyCF_ALLOW_TOP_LEVEL_AWAIT" not in ptf_src:
            self.skipTest(
                "post-tool-feedback.py PyCF_ALLOW_TOP_LEVEL_AWAIT edit belongs to Partition 1"
            )
        spec = importlib.util.spec_from_file_location("post_tool_feedback_p2", ptf_path)
        assert spec and spec.loader
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        status, checker, summary = mod.run_single_file_check(
            WORKFLOWS_DIR / "cf-qa-gate" / "workflow.py",
            REPO_ROOT,
            timeout_s=2.0,
        )
        self.assertEqual(status, "ok", msg=f"checker={checker} summary={summary}")


class TestWorkflowExecution(unittest.IsolatedAsyncioTestCase):
    async def _exec_workflow(
        self,
        workflow_name: str,
        raw_args: dict[str, Any],
        agent_fn: Any,
        call_tool_fn: Any = None,
        trajectory_fn: Any = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        script_path = WORKFLOWS_DIR / workflow_name / "workflow.py"
        source = script_path.read_text(encoding="utf-8")
        code_obj = compile(
            source, str(script_path), "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT
        )

        logs: list[str] = []
        phases: list[str] = []

        async def _parallel(items: list[Any], fn: Any) -> list[Any]:
            results = []
            for item in items:
                results.append(await fn(item))
            return results

        async def _default_trajectory(**_kwargs: Any) -> list[dict[str, Any]]:
            return []

        async def _default_call_tool(_name: str, **_kwargs: Any) -> str:
            return "ok"

        ns: dict[str, Any] = {
            "__name__": f"workflow_{workflow_name.replace('-', '_')}",
            "args": raw_args,
            "WORKSPACES": (str(REPO_ROOT),),
            "phase": lambda name: phases.append(name),
            "log": lambda *parts: logs.append(" ".join(str(p) for p in parts)),
            "parallel": _parallel,
            "agent": agent_fn,
            "trajectory": trajectory_fn or _default_trajectory,
            "call_tool": call_tool_fn or _default_call_tool,
            "ToolError": _MockToolError,
        }
        coro = eval(code_obj, ns)
        await coro
        return ns, {"logs": logs, "phases": phases}

    async def test_cf_qa_gate_ship_and_block_paths(self) -> None:
        async def _ship_agent(**kwargs: Any) -> dict[str, Any]:
            role = kwargs.get("role", "")
            if "cf-reviewer" in role:
                return {
                    "status": "SHIP",
                    "blocking_defects": [],
                    "non_blocking": ["Consider extra docstring"],
                    "summary": "All invariants verified",
                }
            if "cf-tester" in role:
                return {
                    "passed": True,
                    "failures": [],
                    "command_summary": "37/37 tests passed",
                }
            return {
                "passed": True,
                "viewports_verified": [375, 768, 1440],
                "console_errors": [],
                "overflow_viewports": [],
                "summary": "0 overflow, 0 console errors",
            }

        ns, meta = await self._exec_workflow(
            "cf-qa-gate",
            {
                "target_dir": "academy",
                "verify_cmd": "pnpm test",
                "preview_url": "http://127.0.0.1:3000",
                "run_browser_audit": True,
            },
            agent_fn=_ship_agent,
            trajectory_fn=lambda **_kw: _async_val(
                [{"index": 1, "status": "ERROR", "output": "initial lint error"}]
            ),
        )
        verdict = json.loads(meta["logs"][-1])
        self.assertEqual(verdict["verdict"], "SHIP")
        self.assertTrue(verdict["checks_passed"])
        self.assertEqual(verdict["viewports_verified"], [375, 768, 1440])
        self.assertEqual(verdict["blocking_defects"], [])

        # Block path when tests fail
        async def _block_agent(**kwargs: Any) -> dict[str, Any]:
            role = kwargs.get("role", "")
            if "cf-tester" in role:
                return {
                    "passed": False,
                    "failures": ["test_auth_rls failed"],
                    "command_summary": "1 failure",
                }
            return {
                "status": "SHIP",
                "blocking_defects": [],
                "non_blocking": [],
                "summary": "OK",
            }

        _, block_meta = await self._exec_workflow(
            "cf-qa-gate",
            {"verify_cmd": "pytest"},
            agent_fn=_block_agent,
        )
        block_verdict = json.loads(block_meta["logs"][-1])
        self.assertEqual(block_verdict["verdict"], "BLOCK")
        self.assertIn("test_auth_rls failed", block_verdict["blocking_defects"])

        # Arg validation errors
        with self.assertRaises(ValueError):
            ns["validate_qa_args"]({"verify_cmd": "pytest", "extra": 1})
        with self.assertRaises(ValueError):
            ns["validate_qa_args"]({"verify_cmd": "pytest", "preview_url": "ftp://bad"})

    async def test_cf_implement_spec_disjoint_out_of_scope_and_tool_denied(self) -> None:
        async def _worker_agent(**kwargs: Any) -> dict[str, Any]:
            role = kwargs.get("role", "")
            if role.startswith("backend:"):
                return {
                    "status": "done",
                    "modified_files": ["src/api.py"],
                    "summary": "Implemented API",
                }
            return {
                "status": "done",
                "modified_files": ["tests/test_api.py"],
                "summary": "Added tests",
            }

        valid_args = {
            "spec_path": "plans/feature-spec.md",
            "verify_cmd": "python3 -m unittest",
            "worker_workspace": "share",
            "partitions": [
                {
                    "id": "backend",
                    "role": "API Builder",
                    "type_name": "cf-backend",
                    "model": "pro",
                    "owned_files": ["src/api.py"],
                    "instructions": "Build API endpoint",
                },
                {
                    "id": "tests",
                    "role": "Test Builder",
                    "type_name": "cf-tester",
                    "model": "flash",
                    "owned_files": ["tests/test_api.py"],
                    "instructions": "Write unit tests",
                },
            ],
        }

        ns, ok_meta = await self._exec_workflow(
            "cf-implement-spec", valid_args, agent_fn=_worker_agent
        )
        ok_summary = json.loads(ok_meta["logs"][-1])
        self.assertEqual(ok_summary["status"], "ok")
        self.assertEqual(ok_summary["out_of_scope_files"], [])
        self.assertTrue(ok_summary["verification_passed"])

        # Overlapping partitions, traversal, absolute path, >5 partitions rejected
        with self.assertRaises(ValueError):
            ns["assert_disjoint_partitions"](
                [
                    {"id": "p1", "owned_files": ["src/*"]},
                    {"id": "p2", "owned_files": ["src/api.py"]},
                ]
            )
        with self.assertRaises(ValueError):
            ns["assert_disjoint_partitions"](
                [{"id": "p1", "owned_files": ["../secret.txt"]}]
            )
        with self.assertRaises(ValueError):
            ns["assert_disjoint_partitions"](
                [{"id": "p1", "owned_files": ["/etc/passwd"]}]
            )
        with self.assertRaises(ValueError):
            ns["assert_disjoint_partitions"](
                [{"id": f"p{i}", "owned_files": [f"f{i}.py"]} for i in range(6)]
            )

        # Out-of-scope edit detection
        violations = ns["detect_out_of_scope_edits"](
            valid_args["partitions"],
            [
                {"status": "done", "modified_files": ["src/api.py", "README.md"]},
                {"status": "done", "modified_files": ["tests/test_api.py"]},
            ],
        )
        self.assertEqual(violations, ["backend:README.md"])

        # Defect 1 regression: trailing-slash directory ownership preserved and checked
        dir_validated = ns["validate_implement_args"](
            {
                "spec_path": "plans/feature-spec.md",
                "verify_cmd": "pytest",
                "partitions": [
                    {
                        "id": "docs-worker",
                        "role": "Docs Builder",
                        "owned_files": ["./docs//"],
                        "instructions": "Update docs",
                    },
                    {
                        "id": "src-worker",
                        "role": "Src Builder",
                        "owned_files": ["src/"],
                        "instructions": "Update src",
                    },
                ],
            }
        )
        self.assertEqual(dir_validated["partitions"][0]["owned_files"], ["docs/"])
        self.assertEqual(dir_validated["partitions"][1]["owned_files"], ["src/"])
        self.assertEqual(
            ns["detect_out_of_scope_edits"](
                dir_validated["partitions"],
                [
                    {"status": "done", "modified_files": ["docs/guide.md"]},
                    {"status": "done", "modified_files": ["src/app.py"]},
                ],
            ),
            [],
        )
        for overlapping_pair in (
            (["docs/"], ["docs/readme.md"]),
            (["src/"], ["src/a.py"]),
            (["src/"], ["src/**/*.py"]),
            # Defect 2 regression: cross-glob intersections
            (["src/**/*.ts"], ["src/sub/*"]),
            (["src/*.ts"], ["src/a*"]),
            (["a/*/c.py"], ["a/b/*"]),
            (["src/**/*.ts"], ["src/*"]),
            (["src/*[0-9].py"], ["src/test_?.py"]),
        ):
            with self.subTest(overlapping_pair=overlapping_pair):
                with self.assertRaises(ValueError):
                    ns["assert_disjoint_partitions"](
                        [
                            {"id": "p1", "owned_files": overlapping_pair[0]},
                            {"id": "p2", "owned_files": overlapping_pair[1]},
                        ]
                    )

        # Truly disjoint glob and directory pairs MUST be allowed
        for disjoint_pair in (
            (["src/*.ts"], ["src/*.py"]),
            (["src/a/**"], ["src/b/**"]),
            (["docs/a.md"], ["docs/b.md"]),
            (["a/*/c.py"], ["a/*/d.py"]),
            (["docs/"], ["docs2/guide.md"]),
        ):
            with self.subTest(disjoint_pair=disjoint_pair):
                ns["assert_disjoint_partitions"](
                    [
                        {"id": "p1", "owned_files": disjoint_pair[0]},
                        {"id": "p2", "owned_files": disjoint_pair[1]},
                    ]
                )

        # ToolError(denied=True) handled gracefully (both call_tool and parallel)
        async def _denied_call_tool(_name: str, **_kwargs: Any) -> str:
            raise _MockToolError("run_command", "Permission denied in workflow", denied=True)

        _, denied_meta = await self._exec_workflow(
            "cf-implement-spec",
            valid_args,
            agent_fn=_worker_agent,
            call_tool_fn=_denied_call_tool,
        )
        denied_summary = json.loads(denied_meta["logs"][-1])
        self.assertEqual(denied_summary["status"], "verification_denied")
        self.assertTrue(denied_summary["verification_denied"])
        self.assertFalse(denied_summary["verification_passed"])

        async def _denied_agent(**_kwargs: Any) -> dict[str, Any]:
            raise _MockToolError("agent", "Agent permission denied", denied=True)

        _, p_denied_meta = await self._exec_workflow(
            "cf-implement-spec",
            valid_args,
            agent_fn=_denied_agent,
        )
        p_denied_summary = json.loads(p_denied_meta["logs"][-1])
        self.assertEqual(p_denied_summary["status"], "verification_denied")
        self.assertTrue(p_denied_summary["verification_denied"])
        self.assertFalse(p_denied_summary["verification_passed"])


async def _async_val(val: Any) -> Any:
    return val


if __name__ == "__main__":
    unittest.main()
