#!/usr/bin/env python3
"""Comprehensive unit, security, concurrency, and latency tests for v3.0.0 Phase 1 hooks.

Covers:
  - hooks/hook_state.py (0600/0700 perms, conversationId traversal/hashing, corrupt JSON
    recovery, atomic concurrent updates, secret redaction, 24h TTL + 1h .tmp pruning)
  - hooks/session-start.py (handover + auto-memory + git status hydration, 3 KB / 8 KB caps,
    symlink rejection, fail-open without .memory/)
  - hooks/post-tool-feedback.py (syntax/lint checks, clear on fix, verification commands,
    doc edits excluded, timeout handling, failure streak tracking)
  - hooks/pre-invocation.py (feedback drain, loop-breaker termination & reset, turn 15/30
    context-hygiene warnings once-per-threshold)
  - hooks/stop-gate.py (all 4 loop-safety guards, single-shot anti-infinite-loop, doc-only
    allow, verified allow, kill switch)
  - Latency budgets (<50ms for hitl-gate, pre-invocation, stop-gate; <2s for post-tool-feedback)

All synthetic test secrets are constructed dynamically so secret-guard.py never sees
literal credential tokens in source code.
"""

from __future__ import annotations

import concurrent.futures
import importlib.util
import json
import os
import pathlib
import stat
import subprocess
import sys
import tempfile
import time
import unittest
from typing import Any
from unittest import mock

HOOKS_DIR = pathlib.Path(__file__).resolve().parent
if str(HOOKS_DIR) not in sys.path:
    sys.path.insert(0, str(HOOKS_DIR))

import hook_state  # noqa: E402


def _load_module(name: str, filename: str) -> Any:
    script = HOOKS_DIR / filename
    spec = importlib.util.spec_from_file_location(name, script)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


hitl_gate = _load_module("hitl_gate_v3", "hitl-gate.py")
session_start = _load_module("session_start_v3", "session-start.py")
post_tool_feedback = _load_module("post_tool_feedback_v3", "post-tool-feedback.py")
pre_invocation = _load_module("pre_invocation_v3", "pre-invocation.py")
stop_gate = _load_module("stop_gate_v3", "stop-gate.py")


def _run_hook_cli(
    script_name: str,
    payload: Any,
    env_overrides: dict[str, str] | None = None,
    raw_input: str | None = None,
) -> tuple[subprocess.CompletedProcess[str], float]:
    env = os.environ.copy()
    if env_overrides:
        env.update(env_overrides)
    stdin_text = raw_input if raw_input is not None else json.dumps(payload)
    start = time.perf_counter()
    proc = subprocess.run(
        [sys.executable, str(HOOKS_DIR / script_name)],
        input=stdin_text,
        text=True,
        capture_output=True,
        env=env,
        timeout=5.0,
        check=True,
    )
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    return proc, elapsed_ms


class TestHookState(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.plugin_data = pathlib.Path(self._tmp.name) / "plugin-data"
        self._env_patch = mock.patch.dict(
            os.environ, {"PLUGIN_DATA": str(self.plugin_data)}
        )
        self._env_patch.start()

    def tearDown(self) -> None:
        self._env_patch.stop()
        self._tmp.cleanup()

    def test_permissions_0700_dir_and_0600_file(self) -> None:
        cid = "conv-perms-01"
        hook_state.save_state(cid, hook_state.default_state(cid, now=1000.0), now=1000.0)
        conv_dir = hook_state.get_conversations_dir()
        _, state_path = hook_state.get_state_path(cid)

        if os.name == "posix":
            dir_mode = stat.S_IMODE(conv_dir.stat().st_mode)
            file_mode = stat.S_IMODE(state_path.stat().st_mode)
            self.assertEqual(dir_mode, 0o700)
            self.assertEqual(file_mode, 0o600)

    def test_conversation_id_sanitization_and_traversal_defense(self) -> None:
        self.assertEqual(hook_state.sanitize_conversation_id(None), "default")
        self.assertEqual(hook_state.sanitize_conversation_id(""), "default")
        self.assertEqual(hook_state.sanitize_conversation_id("   "), "default")
        self.assertEqual(
            hook_state.sanitize_conversation_id("abc_123-XYZ"), "abc_123-XYZ"
        )

        traversals = [
            "../../../etc/passwd",
            "a/b/c",
            r"a\b\c",
            "has spaces",
            "null\x00byte",
            "x" * 200,
        ]
        conv_dir = hook_state.get_conversations_dir().resolve()
        for raw_cid in traversals:
            with self.subTest(raw_cid=raw_cid):
                safe, target = hook_state.get_state_path(raw_cid)
                self.assertTrue(safe.startswith("cid-"))
                self.assertEqual(len(safe), 36)
                self.assertEqual(target.resolve().parent, conv_dir)

    def test_corrupt_json_recovers_to_default_state(self) -> None:
        cid = "corrupt-cid"
        _, target = hook_state.get_state_path(cid)
        target.write_text("{corrupt json!!!", encoding="utf-8")
        loaded = hook_state.load_state(cid, now=2000.0)
        self.assertEqual(loaded["schemaVersion"], 1)
        self.assertEqual(loaded["conversationId"], cid)
        self.assertEqual(loaded["pendingFeedback"], [])
        self.assertEqual(loaded["consecutiveFailures"], 0)

    def test_atomic_concurrent_updates_preserve_all_increments(self) -> None:
        cid = "concurrent-cid"
        workers = 8
        increments_per_worker = 10

        def _worker() -> None:
            for _ in range(increments_per_worker):
                def _inc(state: dict[str, Any]) -> None:
                    state["consecutiveFailures"] = int(state.get("consecutiveFailures", 0)) + 1

                hook_state.update_state(cid, _inc)

        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            futs = [pool.submit(_worker) for _ in range(workers)]
            for fut in futs:
                fut.result()

        final = hook_state.load_state(cid)
        self.assertEqual(final["consecutiveFailures"], workers * increments_per_worker)

    def test_secret_redaction_and_ansi_stripping(self) -> None:
        # Dynamically construct synthetic secrets so secret-guard.py never matches literals.
        aws_key = "AKIA" + "IOSFODNN7EXAMPLE"
        gh_tok = "ghp_" + ("a" * 36)
        ant_key = "sk-ant-" + ("x" * 24)
        pem_hdr = "-----BEGIN " + "PRIVATE KEY-----"
        pem_ftr = "-----END " + "PRIVATE KEY-----"
        db_uri = "postgres://" + "admin:" + "SuperSecret99@" + "db.internal:5432/prod"
        bearer = "Bearer " + ("eyJhbGciOiJIUzI1NiJ9." + "payload12345")

        raw = (
            f"\x1b[31mError\x1b[0m: {aws_key} {gh_tok} {ant_key}\n"
            f"{pem_hdr}\nABC\n{pem_ftr}\n"
            f"{db_uri} {bearer}\x00"
        )
        cleaned = hook_state.sanitize_text(raw, max_chars=2000)
        for secret in (aws_key, gh_tok, ant_key, pem_hdr, "SuperSecret99", "eyJhbGciOiJIUzI1NiJ9"):
            self.assertNotIn(secret, cleaned)
        self.assertNotIn("\x1b", cleaned)
        self.assertNotIn("\x00", cleaned)
        self.assertIn("[REDACTED_SECRET]", cleaned)

    def test_ttl_pruning_24h_json_lock_and_1h_tmp(self) -> None:
        conv_dir = hook_state.get_conversations_dir()
        now = 1_700_100_000.0

        old_json = conv_dir / "old.json"
        fresh_json = conv_dir / "fresh.json"
        old_lock = conv_dir / "old.lock"
        old_tmp = conv_dir / ".orphan.123.tmp"
        fresh_tmp = conv_dir / ".active.456.tmp"

        for p in (old_json, fresh_json, old_lock, old_tmp, fresh_tmp):
            p.write_text("{}", encoding="utf-8")

        os.utime(old_json, (now - 90000, now - 90000))  # > 24h
        os.utime(old_lock, (now - 90000, now - 90000))  # > 24h
        os.utime(fresh_json, (now - 1000, now - 1000))  # < 24h
        os.utime(old_tmp, (now - 4000, now - 4000))  # > 1h
        os.utime(fresh_tmp, (now - 600, now - 600))  # < 1h

        removed = hook_state.prune_stale_states(max_age_seconds=86400, now=now)
        self.assertEqual(removed, 3)
        self.assertFalse(old_json.exists())
        self.assertFalse(old_lock.exists())
        self.assertFalse(old_tmp.exists())
        self.assertTrue(fresh_json.exists())
        self.assertTrue(fresh_tmp.exists())


class TestSessionStartHook(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self._tmp.name)
        self.plugin_data = self.root / "plugin-data"
        self.workspace = self.root / "workspace"
        self.workspace.mkdir()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_missing_memory_dir_emits_empty_object(self) -> None:
        proc, _ = _run_hook_cli(
            "session-start.py",
            {"conversationId": "ss-1", "cwd": str(self.workspace)},
            env_overrides={"PLUGIN_DATA": str(self.plugin_data)},
        )
        self.assertEqual(json.loads(proc.stdout), {})

    def test_malformed_stdin_fails_open(self) -> None:
        proc, _ = _run_hook_cli(
            "session-start.py",
            None,
            env_overrides={"PLUGIN_DATA": str(self.plugin_data)},
            raw_input="{not-json",
        )
        self.assertEqual(json.loads(proc.stdout), {})

    def test_hydrates_handover_auto_memory_and_caps_sizes_and_redacts(self) -> None:
        mem = self.workspace / ".memory"
        mem.mkdir()
        fake_key = "AKIA" + "IOSFODNN7EXAMPLE"
        # Oversized handover (> 3072 bytes) containing a synthetic secret.
        (mem / "handover.md").write_text(
            f"Key={fake_key}\n" + ("H" * 5000), encoding="utf-8"
        )
        # Auto-memory with > 200 lines.
        (mem / "auto-memory.md").write_text(
            "\n".join(f"line-{i}" for i in range(260)), encoding="utf-8"
        )

        proc, _ = _run_hook_cli(
            "session-start.py",
            {"conversationId": "ss-2", "cwd": str(self.workspace)},
            env_overrides={"PLUGIN_DATA": str(self.plugin_data)},
        )
        out = json.loads(proc.stdout)
        self.assertIn("injectSteps", out)
        msg = out["injectSteps"][0]["systemMessage"]["systemMessage"]
        self.assertTrue(msg.startswith("[Code Factory SessionStart]"))
        self.assertLessEqual(len(msg.encode("utf-8")), 8192)
        self.assertNotIn(fake_key, msg)
        self.assertIn("[REDACTED_SECRET]", msg)
        self.assertIn("truncated to 3 KB", msg)
        self.assertIn("line-0", msg)
        self.assertNotIn("line-250", msg)

    def test_rejects_symlinked_memory_dir(self) -> None:
        outside = self.root / "outside-mem"
        outside.mkdir()
        (outside / "handover.md").write_text("should not be read", encoding="utf-8")
        (self.workspace / ".memory").symlink_to(outside, target_is_directory=True)

        proc, _ = _run_hook_cli(
            "session-start.py",
            {"conversationId": "ss-3", "cwd": str(self.workspace)},
            env_overrides={"PLUGIN_DATA": str(self.plugin_data)},
        )
        self.assertEqual(json.loads(proc.stdout), {})

    def test_git_status_hydration_and_cwd_independent_import(self) -> None:
        mem = self.workspace / ".memory"
        mem.mkdir()
        (mem / "handover.md").write_text("Active milestone: v3.0.0", encoding="utf-8")
        subprocess.run(
            ["git", "init", "-q"],
            cwd=str(self.workspace),
            check=True,
            capture_output=True,
        )
        (self.workspace / "untracked.txt").write_text("hello\n", encoding="utf-8")

        env = os.environ.copy()
        env["PLUGIN_DATA"] = str(self.plugin_data)
        # Run from a completely different working directory to verify sys.path handling.
        proc = subprocess.run(
            [sys.executable, str(HOOKS_DIR / "session-start.py")],
            input=json.dumps({"conversationId": "ss-4", "cwd": str(self.workspace)}),
            cwd=tempfile.gettempdir(),
            text=True,
            capture_output=True,
            env=env,
            timeout=5.0,
            check=True,
        )
        out = json.loads(proc.stdout)
        msg = out["injectSteps"][0]["systemMessage"]["systemMessage"]
        self.assertIn("Active milestone: v3.0.0", msg)
        self.assertIn("## Git Status", msg)
        self.assertIn("untracked.txt", msg)


class TestPostToolAndPreInvocationAndStopGate(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self._tmp.name)
        self.plugin_data = self.root / "plugin-data"
        self.workspace = self.root / "workspace"
        self.workspace.mkdir()
        self.env = {"PLUGIN_DATA": str(self.plugin_data)}

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def test_post_tool_syntax_error_queued_then_drained_then_cleared_on_fix(self) -> None:
        cid = "conv-lint-1"
        bad_py = self.workspace / "app.py"
        bad_py.write_text("def broken(:\n    pass\n", encoding="utf-8")

        proc, elapsed = _run_hook_cli(
            "post-tool-feedback.py",
            {
                "conversationId": cid,
                "cwd": str(self.workspace),
                "toolCall": {
                    "name": "write_file",
                    "args": {"Path": str(bad_py)},
                },
            },
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(proc.stdout), {})
        self.assertLess(elapsed, 2000.0)

        # Verify state recorded syntax error and edited source file.
        with mock.patch.dict(os.environ, self.env):
            state = hook_state.load_state(cid)
        self.assertEqual(len(state["pendingFeedback"]), 1)
        self.assertEqual(state["pendingFeedback"][0]["checker"], "python-syntax")
        self.assertEqual(state["editedSourceFiles"], ["app.py"])
        self.assertTrue(state["needsVerification"])

        # PreInvocation drains feedback once.
        proc_pre, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid, "invocationNum": 2},
            env_overrides=self.env,
        )
        out_pre = json.loads(proc_pre.stdout)
        self.assertIn("injectSteps", out_pre)
        msg = out_pre["injectSteps"][0]["systemMessage"]["systemMessage"]
        self.assertIn("[Code Factory PostToolUse Feedback]", msg)
        self.assertIn("app.py", msg)

        # Second PreInvocation has nothing left to inject.
        proc_pre2, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid, "invocationNum": 3},
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(proc_pre2.stdout), {})

        # Re-introduce broken JSON, then fix it before PreInvocation and confirm stale entry clears.
        bad_json = self.workspace / "data.json"
        bad_json.write_text("{bad json", encoding="utf-8")
        _run_hook_cli(
            "post-tool-feedback.py",
            {
                "conversationId": cid,
                "cwd": str(self.workspace),
                "toolCall": {"name": "write_file", "args": {"Path": str(bad_json)}},
            },
            env_overrides=self.env,
        )
        with mock.patch.dict(os.environ, self.env):
            self.assertEqual(len(hook_state.load_state(cid)["pendingFeedback"]), 1)

        bad_json.write_text('{"ok": true}\n', encoding="utf-8")
        _run_hook_cli(
            "post-tool-feedback.py",
            {
                "conversationId": cid,
                "cwd": str(self.workspace),
                "toolCall": {"name": "write_file", "args": {"Path": str(bad_json)}},
            },
            env_overrides=self.env,
        )
        with mock.patch.dict(os.environ, self.env):
            self.assertEqual(hook_state.load_state(cid)["pendingFeedback"], [])

    def test_post_tool_doc_edits_excluded_from_verification_tracking(self) -> None:
        cid = "conv-docs-only"
        docs_dir = self.workspace / "docs"
        docs_dir.mkdir()
        doc_py = docs_dir / "example.py"
        doc_py.write_text("x = 1\n", encoding="utf-8")
        md_file = self.workspace / "README.md"
        md_file.write_text("# Hello\n", encoding="utf-8")

        for p in (doc_py, md_file):
            _run_hook_cli(
                "post-tool-feedback.py",
                {
                    "conversationId": cid,
                    "cwd": str(self.workspace),
                    "toolCall": {"name": "edit_file", "args": {"Path": str(p)}},
                },
                env_overrides=self.env,
            )

        with mock.patch.dict(os.environ, self.env):
            st = hook_state.load_state(cid)
        self.assertEqual(st["editedSourceFiles"], [])
        self.assertFalse(st["needsVerification"])

        # Stop gate allows immediately on doc-only edits.
        proc_stop, _ = _run_hook_cli(
            "stop-gate.py",
            {
                "conversationId": cid,
                "terminationReason": "NO_TOOL_CALL",
                "continuationActive": False,
                "fullyIdle": True,
            },
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(proc_stop.stdout), {"decision": "allow"})

    def test_verification_command_clears_needs_verification_and_ignores_quoted_strings(self) -> None:
        self.assertTrue(post_tool_feedback.is_verification_command("pytest -q"))
        self.assertTrue(
            post_tool_feedback.is_verification_command(
                'python3 -m unittest discover -s hooks -p "test_*.py" -v'
            )
        )
        self.assertTrue(
            post_tool_feedback.is_verification_command("cd academy && pnpm run verify:map")
        )
        self.assertTrue(
            post_tool_feedback.is_verification_command(
                "bash skills/cf-next-verify/scripts/verify-stack.sh academy --coverage"
            )
        )
        self.assertFalse(post_tool_feedback.is_verification_command('echo "pytest -q"'))
        self.assertFalse(
            post_tool_feedback.is_verification_command("git commit -m 'npm test'")
        )
        self.assertFalse(post_tool_feedback.is_verification_command("# pytest"))

        cid = "conv-verify-clear"
        src = self.workspace / "main.py"
        src.write_text("print('ok')\n", encoding="utf-8")
        _run_hook_cli(
            "post-tool-feedback.py",
            {
                "conversationId": cid,
                "cwd": str(self.workspace),
                "toolCall": {"name": "write_file", "args": {"Path": str(src)}},
            },
            env_overrides=self.env,
        )
        # Quoted echo must NOT clear needsVerification.
        _run_hook_cli(
            "post-tool-feedback.py",
            {
                "conversationId": cid,
                "cwd": str(self.workspace),
                "toolCall": {"name": "run_command", "args": {"CommandLine": 'echo "pytest"'}},
            },
            env_overrides=self.env,
        )
        with mock.patch.dict(os.environ, self.env):
            self.assertTrue(hook_state.load_state(cid)["needsVerification"])

        # Real verification command clears it.
        _run_hook_cli(
            "post-tool-feedback.py",
            {
                "conversationId": cid,
                "cwd": str(self.workspace),
                "toolCall": {
                    "name": "run_command",
                    "args": {"CommandLine": "python3 -m unittest"},
                },
            },
            env_overrides=self.env,
        )
        with mock.patch.dict(os.environ, self.env):
            st = hook_state.load_state(cid)
        self.assertFalse(st["needsVerification"])
        self.assertEqual(st["editedSourceFiles"], [])
        self.assertIsNotNone(st["lastVerifiedAt"])
        self.assertEqual(st["lastVerificationCommand"], "python3 -m unittest")

    def test_post_tool_timeout_skips_quietly(self) -> None:
        cid = "conv-timeout"
        js_file = self.workspace / "slow.js"
        js_file.write_text("export const x = 1;\n", encoding="utf-8")

        with mock.patch.dict(
            os.environ, {**self.env, "CF_POST_TOOL_TIMEOUT_MS": "200"}
        ), mock.patch.object(
            subprocess,
            "run",
            side_effect=subprocess.TimeoutExpired(cmd=["node"], timeout=0.2),
        ):
            post_tool_feedback.process_post_tool(
                {
                    "conversationId": cid,
                    "cwd": str(self.workspace),
                    "toolCall": {"name": "write_file", "args": {"Path": str(js_file)}},
                }
            )
            st = hook_state.load_state(cid)
        self.assertEqual(st["pendingFeedback"], [])
        self.assertTrue(st["needsVerification"])

    def test_loop_breaker_triggers_after_5_identical_failures_and_resets(self) -> None:
        cid = "conv-loop-break"
        fail_payload = {
            "conversationId": cid,
            "cwd": str(self.workspace),
            "toolCall": {
                "name": "run_command",
                "args": {"CommandLine": "npm test"},
            },
            "error": "exit status 1: failing test suite",
        }
        for _ in range(4):
            _run_hook_cli("post-tool-feedback.py", fail_payload, env_overrides=self.env)

        # At 4 failures: does not terminate yet.
        proc4, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid, "invocationNum": 4},
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(proc4.stdout), {})

        # 5th identical failure -> loop-breaker terminates.
        _run_hook_cli("post-tool-feedback.py", fail_payload, env_overrides=self.env)
        proc5, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid, "invocationNum": 5},
            env_overrides=self.env,
        )
        out5 = json.loads(proc5.stdout)
        self.assertEqual(out5.get("terminationBehavior"), "terminate")
        user_msg = out5["injectSteps"][0]["errorMessage"]["userMessage"]
        self.assertIn("Enterprise Code Factory Loop-Breaker", user_msg)
        self.assertIn("5 consecutive identical tool failures", user_msg)

        # Counter was reset so user can resume cleanly.
        proc6, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid, "invocationNum": 6},
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(proc6.stdout), {})

    def test_context_hygiene_warnings_once_per_threshold(self) -> None:
        cid = "conv-turns"
        # Turn 14 -> no warning.
        p14, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid, "invocationNum": 14},
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(p14.stdout), {})

        # Turn 15 -> warns once.
        p15, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid, "invocationNum": 15},
            env_overrides=self.env,
        )
        out15 = json.loads(p15.stdout)
        self.assertIn("Turn 15", out15["injectSteps"][0]["systemMessage"]["systemMessage"])

        # Turn 16 -> does NOT repeat Turn 15 warning.
        p16, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid, "invocationNum": 16},
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(p16.stdout), {})

        # Turn 30 -> warns once at second threshold.
        p30, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid, "invocationNum": 30},
            env_overrides=self.env,
        )
        out30 = json.loads(p30.stdout)
        self.assertIn("Turn 30", out30["injectSteps"][0]["systemMessage"]["systemMessage"])

        # Turn 31 -> silent.
        p31, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid, "invocationNum": 31},
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(p31.stdout), {})

    def test_stop_gate_all_4_guards_and_single_shot_anti_infinite_loop(self) -> None:
        cid = "conv-stop"
        src = self.workspace / "service.ts"
        src.write_text("export const ok = true;\n", encoding="utf-8")
        _run_hook_cli(
            "post-tool-feedback.py",
            {
                "conversationId": cid,
                "cwd": str(self.workspace),
                "toolCall": {"name": "edit_file", "args": {"Path": str(src)}},
            },
            env_overrides=self.env,
        )

        # Guard 1: Kill switch CF_STOP_GATE_MODE=off.
        p_off, _ = _run_hook_cli(
            "stop-gate.py",
            {
                "conversationId": cid,
                "terminationReason": "NO_TOOL_CALL",
                "continuationActive": False,
                "fullyIdle": True,
            },
            env_overrides={**self.env, "CF_STOP_GATE_MODE": "off"},
        )
        self.assertEqual(json.loads(p_off.stdout), {"decision": "allow"})

        # Guard 2: Non-NO_TOOL_CALL reasons must always allow.
        for reason in ("USER_CANCELED", "ERROR", "MAX_INVOCATIONS", "TERMINAL_CUSTOM_HOOK"):
            p_r, _ = _run_hook_cli(
                "stop-gate.py",
                {
                    "conversationId": cid,
                    "terminationReason": reason,
                    "continuationActive": False,
                    "fullyIdle": True,
                },
                env_overrides=self.env,
            )
            self.assertEqual(json.loads(p_r.stdout), {"decision": "allow"})

        # Guard 3: continuationActive=True must always allow.
        p_cont, _ = _run_hook_cli(
            "stop-gate.py",
            {
                "conversationId": cid,
                "terminationReason": "NO_TOOL_CALL",
                "continuationActive": True,
                "fullyIdle": True,
            },
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(p_cont.stdout), {"decision": "allow"})

        # Guard 4: fullyIdle=False must always allow.
        p_busy, _ = _run_hook_cli(
            "stop-gate.py",
            {
                "conversationId": cid,
                "terminationReason": "NO_TOOL_CALL",
                "continuationActive": False,
                "fullyIdle": False,
            },
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(p_busy.stdout), {"decision": "allow"})

        # All 4 guards satisfied -> triggers continue ONCE and flips state.
        p_fire, _ = _run_hook_cli(
            "stop-gate.py",
            {
                "conversationId": cid,
                "terminationReason": "NO_TOOL_CALL",
                "continuationActive": False,
                "fullyIdle": True,
            },
            env_overrides=self.env,
        )
        out_fire = json.loads(p_fire.stdout)
        self.assertEqual(out_fire["decision"], "continue")
        self.assertIn("service.ts", out_fire["reason"])

        # Calling Stop again immediately with identical guards MUST allow (single-shot).
        p_again, _ = _run_hook_cli(
            "stop-gate.py",
            {
                "conversationId": cid,
                "terminationReason": "NO_TOOL_CALL",
                "continuationActive": False,
                "fullyIdle": True,
            },
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(p_again.stdout), {"decision": "allow"})

    def test_in_process_latency_budgets(self) -> None:
        cid = "conv-latency"
        with mock.patch.dict(os.environ, self.env):
            t0 = time.perf_counter()
            hitl_gate.evaluate_command("git status && curl -s https://example.com")
            hitl_ms = (time.perf_counter() - t0) * 1000.0
            self.assertLess(hitl_ms, 50.0)

            t1 = time.perf_counter()
            pre_invocation.evaluate_pre_invocation(
                {"conversationId": cid, "invocationNum": 3}
            )
            pre_ms = (time.perf_counter() - t1) * 1000.0
            self.assertLess(pre_ms, 50.0)

            t2 = time.perf_counter()
            stop_gate.evaluate_stop(
                {
                    "conversationId": cid,
                    "terminationReason": "NO_TOOL_CALL",
                    "continuationActive": False,
                    "fullyIdle": True,
                }
            )
            stop_ms = (time.perf_counter() - t2) * 1000.0
            self.assertLess(stop_ms, 50.0)

            py_file = self.workspace / "fast.py"
            py_file.write_text("VALUE = 42\n", encoding="utf-8")
            t3 = time.perf_counter()
            post_tool_feedback.process_post_tool(
                {
                    "conversationId": cid,
                    "cwd": str(self.workspace),
                    "toolCall": {"name": "write_file", "args": {"Path": str(py_file)}},
                }
            )
            post_ms = (time.perf_counter() - t3) * 1000.0
            self.assertLess(post_ms, 2000.0)

    def test_post_tool_bash_lint_eslint_walkup_lint_off_and_symlink_escape(self) -> None:
        cid = "conv-extra-lint"
        # 1. Broken shell script triggers bash -n diagnostic.
        bad_sh = self.workspace / "broken.sh"
        bad_sh.write_text("if true; then\n  echo missing fi\n", encoding="utf-8")
        _run_hook_cli(
            "post-tool-feedback.py",
            {
                "conversationId": cid,
                "cwd": str(self.workspace),
                "toolCall": {"name": "write_file", "args": {"Path": str(bad_sh)}},
            },
            env_overrides=self.env,
        )
        with mock.patch.dict(os.environ, self.env):
            fb = hook_state.load_state(cid)["pendingFeedback"]
        self.assertEqual(len(fb), 1)
        self.assertEqual(fb[0]["checker"], "bash-syntax")

        # 2. Local node_modules/.bin/eslint walk-up from nested directory
        #    and regression guard: must use ESLint v9 core formatter (`stylish`), never removed `compact`.
        pkg_dir = self.workspace / "app"
        eslint_bin = pkg_dir / "node_modules" / ".bin" / "eslint"
        eslint_bin.parent.mkdir(parents=True)
        eslint_args_log = pkg_dir / "eslint-args.txt"
        eslint_bin.write_text(
            f"#!/bin/sh\nprintf '%s\\n' \"$*\" > '{eslint_args_log}'\n"
            "echo 'line 1: Unexpected any (no-explicit-any)'\nexit 1\n",
            encoding="utf-8",
        )
        os.chmod(eslint_bin, 0o755)
        nested_ts = pkg_dir / "src" / "index.ts"
        nested_ts.parent.mkdir(parents=True)
        nested_ts.write_text("export const v: any = 1;\n", encoding="utf-8")
        _run_hook_cli(
            "post-tool-feedback.py",
            {
                "conversationId": cid,
                "cwd": str(self.workspace),
                "toolCall": {"name": "edit_file", "args": {"Path": str(nested_ts)}},
            },
            env_overrides=self.env,
        )
        recorded_args = eslint_args_log.read_text(encoding="utf-8")
        self.assertIn("--format stylish", recorded_args)
        self.assertNotIn("--format compact", recorded_args)
        with mock.patch.dict(os.environ, self.env):
            fb2 = hook_state.load_state(cid)["pendingFeedback"]
        self.assertTrue(any(item["checker"] == "eslint" for item in fb2))

        # 3. CF_POST_TOOL_LINT=off skips linting while still tracking editedSourceFiles.
        cid_off = "conv-lint-off"
        bad_py = self.workspace / "skipped.py"
        bad_py.write_text("def broken(:\n", encoding="utf-8")
        _run_hook_cli(
            "post-tool-feedback.py",
            {
                "conversationId": cid_off,
                "cwd": str(self.workspace),
                "toolCall": {"name": "write_file", "args": {"Path": str(bad_py)}},
            },
            env_overrides={**self.env, "CF_POST_TOOL_LINT": "off"},
        )
        with mock.patch.dict(os.environ, self.env):
            st_off = hook_state.load_state(cid_off)
        self.assertEqual(st_off["pendingFeedback"], [])
        self.assertEqual(st_off["editedSourceFiles"], ["skipped.py"])

        # 4. Symlink escaping project_dir is ignored cleanly and hook still prints {}.
        outside_file = self.root / "outside.py"
        outside_file.write_text("def broken(:\n", encoding="utf-8")
        escape_link = self.workspace / "escape.py"
        escape_link.symlink_to(outside_file)
        proc_esc, _ = _run_hook_cli(
            "post-tool-feedback.py",
            {
                "conversationId": "conv-escape",
                "cwd": str(self.workspace),
                "toolCall": {"name": "write_file", "args": {"Path": str(escape_link)}},
            },
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(proc_esc.stdout), {})
        with mock.patch.dict(os.environ, self.env):
            self.assertEqual(hook_state.load_state("conv-escape")["pendingFeedback"], [])

        # 5. Malformed stdin on post-tool-feedback always prints {}.
        proc_bad, _ = _run_hook_cli(
            "post-tool-feedback.py",
            None,
            env_overrides=self.env,
            raw_input="{invalid json",
        )
        self.assertEqual(json.loads(proc_bad.stdout), {})

    def test_pre_invocation_priority_caps_env_toggles_and_fail_open(self) -> None:
        # 1. Priority: loop-breaker beats pending feedback and turn warning.
        cid = "conv-priority"
        with mock.patch.dict(os.environ, self.env):
            st = hook_state.default_state(cid)
            st["consecutiveFailures"] = 5
            st["lastFailureSignature"] = "run_command:abcdef0123456789"
            st["pendingFeedback"] = [
                {
                    "toolName": "edit_file",
                    "filePath": "a.py",
                    "status": "error",
                    "checker": "python-syntax",
                    "summary": "line 1: invalid syntax",
                    "timestamp": 100.0,
                }
            ]
            hook_state.save_state(cid, st)

        # Disabled via CF_LOOP_BREAKER_MAX=off -> does NOT terminate.
        p_disabled, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid, "invocationNum": 35},
            env_overrides={
                **self.env,
                "CF_LOOP_BREAKER_MAX": "off",
                "CF_CONTEXT_WARN_TURN": "off",
            },
        )
        out_dis = json.loads(p_disabled.stdout)
        self.assertNotIn("terminationBehavior", out_dis)
        self.assertEqual(len(out_dis["injectSteps"]), 1)

        # Re-seed and confirm loop-breaker takes top priority over turn 35 warning.
        with mock.patch.dict(os.environ, self.env):
            st["consecutiveFailures"] = 5
            hook_state.save_state(cid, st)
        p_term, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid, "invocationNum": 35},
            env_overrides=self.env,
        )
        out_term = json.loads(p_term.stdout)
        self.assertEqual(out_term["terminationBehavior"], "terminate")
        self.assertEqual(len(out_term["injectSteps"]), 1)

        # 2. Jumping directly past both thresholds (Turn 35) emits at most 1 warning and records [15, 30].
        cid_jump = "conv-jump"
        p_jump, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid_jump, "invocationNum": 35},
            env_overrides=self.env,
        )
        out_jump = json.loads(p_jump.stdout)
        self.assertEqual(len(out_jump["injectSteps"]), 1)
        with mock.patch.dict(os.environ, self.env):
            self.assertEqual(
                hook_state.load_state(cid_jump)["contextWarnedThresholds"], [15, 30]
            )
        p_jump2, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid_jump, "invocationNum": 36},
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(p_jump2.stdout), {})

        # 3. Pending feedback message is strictly capped at <= 3072 bytes.
        cid_cap = "conv-fb-cap"
        with mock.patch.dict(os.environ, self.env):
            st_cap = hook_state.default_state(cid_cap)
            st_cap["pendingFeedback"] = [
                {
                    "toolName": "write_file",
                    "filePath": f"src/file_{i}.py",
                    "status": "error",
                    "checker": "ruff",
                    "summary": "E" * 580,
                    "timestamp": 100.0 + i,
                }
                for i in range(8)
            ]
            hook_state.save_state(cid_cap, st_cap)
        p_cap, _ = _run_hook_cli(
            "pre-invocation.py",
            {"conversationId": cid_cap, "invocationNum": 2},
            env_overrides=self.env,
        )
        fb_msg = json.loads(p_cap.stdout)["injectSteps"][0]["systemMessage"]["systemMessage"]
        self.assertLessEqual(len(fb_msg.encode("utf-8")), 3072)

        # 4. Malformed stdin fails open on pre-invocation and allows on stop-gate.
        p_bad_pre, _ = _run_hook_cli(
            "pre-invocation.py", None, env_overrides=self.env, raw_input="{bad"
        )
        self.assertEqual(json.loads(p_bad_pre.stdout), {})

        p_bad_stop, _ = _run_hook_cli(
            "stop-gate.py", None, env_overrides=self.env, raw_input="{bad"
        )
        self.assertEqual(json.loads(p_bad_stop.stdout), {"decision": "allow"})

    def test_stop_gate_verified_edits_allow(self) -> None:
        cid = "conv-verified-stop"
        src = self.workspace / "util.py"
        src.write_text("x = 1\n", encoding="utf-8")
        _run_hook_cli(
            "post-tool-feedback.py",
            {
                "conversationId": cid,
                "cwd": str(self.workspace),
                "toolCall": {"name": "write_file", "args": {"Path": str(src)}},
            },
            env_overrides=self.env,
        )
        _run_hook_cli(
            "post-tool-feedback.py",
            {
                "conversationId": cid,
                "cwd": str(self.workspace),
                "toolCall": {"name": "run_command", "args": {"CommandLine": "pytest -q"}},
            },
            env_overrides=self.env,
        )
        p_stop, _ = _run_hook_cli(
            "stop-gate.py",
            {
                "conversationId": cid,
                "terminationReason": "NO_TOOL_CALL",
                "continuationActive": False,
                "fullyIdle": True,
            },
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(p_stop.stdout), {"decision": "allow"})


if __name__ == "__main__":
    unittest.main()
