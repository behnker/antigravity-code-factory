#!/usr/bin/env python3
"""Comprehensive tests for Phase 2 Git-shadow checkpoints, hook bridges & cf-rewind.

Covers Spec §5 Row 2:
  - hooks/checkpoint-hook.py (fail-closed stdin, CF_DISABLE_CHECKPOINTS, non-git,
    unborn HEAD, clean HEAD, dirty tracked stash-create, per-turn dedup, index/pack
    size guards, timeout skip, <= 150 ms budget, 0o700/0o600 perms, symlink rejection)
  - Hook bridges: pre-invocation.py (initialNumSteps turnEpoch advance + loop-breaker event),
    stop-gate.py (turnEpoch advance on allow + continue event + read-only no state),
    post-tool-feedback.py (PyCF_ALLOW_TOP_LEVEL_AWAIT for workflows/, sidecar events),
    session-start.py (session_start sidecar event)
  - skills/cf-rewind/scripts/rewind.py (symlink-safe CLI, list, diff + flag-injection
    rejection, restore --dry-run default, restore --apply safety snapshot + preserves
    untracked/post-checkpoint files, prune)
"""

from __future__ import annotations

import importlib.util
import itertools
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
REPO_ROOT = HOOKS_DIR.parent
REWIND_SCRIPT = REPO_ROOT / "skills" / "cf-rewind" / "scripts" / "rewind.py"

if str(HOOKS_DIR) not in sys.path:
    sys.path.insert(0, str(HOOKS_DIR))

import hook_state  # noqa: E402


def _load_module(name: str, path: pathlib.Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


checkpoint_hook = _load_module("checkpoint_hook_p2", HOOKS_DIR / "checkpoint-hook.py")
pre_invocation = _load_module("pre_invocation_p2", HOOKS_DIR / "pre-invocation.py")
stop_gate = _load_module("stop_gate_p2", HOOKS_DIR / "stop-gate.py")
post_tool_feedback = _load_module(
    "post_tool_feedback_p2", HOOKS_DIR / "post-tool-feedback.py"
)
session_start = _load_module("session_start_p2", HOOKS_DIR / "session-start.py")


def _run_cli(
    script_path: pathlib.Path,
    argv: list[str] | None = None,
    stdin_data: str | None = None,
    env_overrides: dict[str, str] | None = None,
    cwd: pathlib.Path | None = None,
) -> tuple[subprocess.CompletedProcess[str], float]:
    env = os.environ.copy()
    if env_overrides:
        env.update(env_overrides)
    cmd = [sys.executable, str(script_path), *(argv or [])]
    t0 = time.perf_counter()
    proc = subprocess.run(
        cmd,
        input=stdin_data,
        cwd=str(cwd) if cwd else None,
        text=True,
        capture_output=True,
        env=env,
        timeout=10.0,
    )
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    return proc, elapsed_ms


def _git(repo: pathlib.Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "--no-pager", *args],
        cwd=str(repo),
        shell=False,
        text=True,
        capture_output=True,
        check=True,
        timeout=5.0,
    )


def _init_git_repo(repo: pathlib.Path, with_commit: bool = True) -> str:
    repo.mkdir(parents=True, exist_ok=True)
    _git(repo, "init")
    _git(repo, "config", "user.email", "test@example.com")
    _git(repo, "config", "user.name", "Code Factory Test")
    if not with_commit:
        return ""
    app = repo / "app.py"
    app.write_text("VALUE = 1\n", encoding="utf-8")
    _git(repo, "add", "app.py")
    _git(repo, "commit", "-m", "initial commit")
    return _git(repo, "rev-parse", "--verify", "HEAD").stdout.strip()


def _read_spool(plugin_data: pathlib.Path) -> list[dict[str, Any]]:
    spool = plugin_data / "telemetry-spool.jsonl"
    if not spool.exists():
        return []
    events: list[dict[str, Any]] = []
    for line in spool.read_text(encoding="utf-8").splitlines():
        if line.strip():
            events.append(json.loads(line))
    return events


class TestPhase2Checkpoints(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self._tmp.name)
        self.plugin_data = self.root / "plugin-data"
        self.env = {
            "PLUGIN_DATA": str(self.plugin_data),
            "CF_DISABLE_SIDECAR": "",
            "ANTIGRAVITY_EXECUTABLE_DATA_DIR": "",
            "CF_SIDECAR_SOCKET": "",
        }
        self._env_patch = mock.patch.dict(os.environ, self.env)
        self._env_patch.start()

    def tearDown(self) -> None:
        self._env_patch.stop()
        self._tmp.cleanup()

    @staticmethod
    def _deterministic_checkpoint_clock(
        start: float = 100.0, step: float = 0.001
    ) -> Any:
        """Inject a deterministic monotonic perf_counter per AGENTS.md §6.3."""
        return mock.patch.object(
            checkpoint_hook.time,
            "perf_counter",
            side_effect=itertools.count(start, step),
        )

    def test_fail_closed_stdin_kill_switch_and_non_git_workspace(self) -> None:
        for raw_in in ("", "   ", "{bad json", "[]", "42"):
            with self.subTest(raw_in=raw_in):
                proc, _ = _run_cli(
                    HOOKS_DIR / "checkpoint-hook.py",
                    stdin_data=raw_in,
                    env_overrides=self.env,
                )
                self.assertEqual(proc.returncode, 0)
                parsed = json.loads(proc.stdout)
                self.assertEqual(parsed["decision"], "ask")
                self.assertIn("unable to parse", parsed["reason"].lower())

        non_git = self.root / "plain-dir"
        non_git.mkdir()
        payload = {
            "conversationId": "conv-nongit",
            "cwd": str(non_git),
            "toolCall": {"name": "edit_file", "args": {"Path": str(non_git / "a.py")}},
        }
        t0 = time.perf_counter()
        res = checkpoint_hook.evaluate_checkpoint(payload)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        self.assertEqual(res, {"decision": "allow"})
        self.assertLess(elapsed_ms, 10.0)
        self.assertEqual(hook_state.read_checkpoint_records("conv-nongit"), [])

        # Kill switch CF_DISABLE_CHECKPOINTS=1 exits allow in < 5ms without git work.
        repo = self.root / "disabled-repo"
        _init_git_repo(repo, with_commit=True)
        with mock.patch.dict(os.environ, {**self.env, "CF_DISABLE_CHECKPOINTS": "1"}):
            t1 = time.perf_counter()
            res_off = checkpoint_hook.evaluate_checkpoint(
                {
                    "conversationId": "conv-disabled",
                    "cwd": str(repo),
                    "toolCall": {"name": "run_command", "args": {"CommandLine": "ls"}},
                }
            )
            off_ms = (time.perf_counter() - t1) * 1000.0
        self.assertEqual(res_off, {"decision": "allow"})
        self.assertLess(off_ms, 5.0)
        self.assertEqual(hook_state.read_checkpoint_records("conv-disabled"), [])

    def test_unborn_clean_head_and_dirty_stash_create_snapshots(self) -> None:
        # 1. Unborn HEAD
        unborn_repo = self.root / "unborn-repo"
        _init_git_repo(unborn_repo, with_commit=False)
        with self._deterministic_checkpoint_clock(), mock.patch.dict(
            os.environ, {**self.env, "CF_CHECKPOINT_TIMEOUT_MS": "140"}
        ):
            res_unborn = checkpoint_hook.evaluate_checkpoint(
                {
                    "conversationId": "conv-unborn",
                    "cwd": str(unborn_repo),
                    "stepIdx": 1,
                    "toolCall": {"name": "write_file", "args": {"Path": "new.py"}},
                }
            )
        self.assertEqual(res_unborn, {"decision": "allow"})
        recs_unborn = hook_state.read_checkpoint_records("conv-unborn")
        self.assertEqual(len(recs_unborn), 1)
        self.assertEqual(recs_unborn[0]["snapshotType"], "unborn")
        self.assertEqual(recs_unborn[0]["snapshotSha"], "")
        self.assertEqual(recs_unborn[0]["kind"], "pre-turn")

        # 2. Clean HEAD baseline
        repo = self.root / "clean-dirty-repo"
        head_sha = _init_git_repo(repo, with_commit=True)
        cid = "conv-git-snaps"
        with self._deterministic_checkpoint_clock(), mock.patch.dict(
            os.environ, {**self.env, "CF_CHECKPOINT_TIMEOUT_MS": "140"}
        ):
            res_clean = checkpoint_hook.evaluate_checkpoint(
                {
                    "conversationId": cid,
                    "cwd": str(repo),
                    "stepIdx": 2,
                    "toolCall": {"name": "edit_file", "args": {"Path": str(repo / "app.py")}},
                }
            )
        self.assertEqual(res_clean, {"decision": "allow"})
        recs1 = hook_state.read_checkpoint_records(cid)
        self.assertEqual(len(recs1), 1)
        self.assertEqual(recs1[0]["snapshotType"], "head")
        self.assertEqual(recs1[0]["snapshotSha"], head_sha)
        self.assertEqual(recs1[0]["headSha"], head_sha)
        self.assertEqual(recs1[0]["targetSummary"], "app.py")

        # Advance turn via Stop -> allow, then dirty tracked file + add untracked file.
        stop_res = stop_gate.evaluate_stop(
            {
                "conversationId": cid,
                "terminationReason": "NO_TOOL_CALL",
                "continuationActive": False,
                "fullyIdle": True,
            }
        )
        self.assertEqual(stop_res, {"decision": "allow"})
        self.assertEqual(hook_state.load_state(cid)["turnEpoch"], 1)

        (repo / "app.py").write_text("VALUE = 2\n", encoding="utf-8")
        (repo / "scratch-note.md").write_text("untracked note\n", encoding="utf-8")
        # Inject deterministic perf_counter + 140ms budget so CPU load cannot skip
        # ls-files --others via the 8ms cutoff; real wall-clock <= 150ms budget is
        # verified unpatched in test_timeout_guard_and_latency_budget.
        with self._deterministic_checkpoint_clock(), mock.patch.dict(
            os.environ, {**self.env, "CF_CHECKPOINT_TIMEOUT_MS": "140"}
        ):
            res_dirty = checkpoint_hook.evaluate_checkpoint(
                {
                    "conversationId": cid,
                    "cwd": str(repo),
                    "stepIdx": 3,
                    "toolCall": {"name": "run_command", "args": {"CommandLine": "python3 app.py"}},
                }
            )
        self.assertEqual(res_dirty, {"decision": "allow"})

        recs2 = hook_state.read_checkpoint_records(cid)
        self.assertEqual(len(recs2), 2)
        self.assertEqual(recs2[1]["snapshotType"], "stash-create")
        self.assertRegex(recs2[1]["snapshotSha"], r"\A[0-9a-f]{40}\Z")
        self.assertNotEqual(recs2[1]["snapshotSha"], head_sha)
        self.assertEqual(recs2[1]["untrackedSample"], ["scratch-note.md"])
        self.assertEqual(recs2[1]["untrackedCount"], 1)
        # Non-destructive: dirty tracked edit remains intact in working tree.
        self.assertEqual((repo / "app.py").read_text(encoding="utf-8"), "VALUE = 2\n")

    def test_per_turn_dedup_stop_gate_and_pre_invocation_turn_epoch(self) -> None:
        repo = self.root / "dedup-repo"
        _init_git_repo(repo, with_commit=True)
        cid = "conv-dedup-epochs"

        # Turn 0: First PreToolUse creates checkpoint.
        checkpoint_hook.evaluate_checkpoint(
            {
                "conversationId": cid,
                "cwd": str(repo),
                "toolCall": {"name": "edit_file", "args": {"Path": "app.py"}},
            }
        )
        self.assertEqual(len(hook_state.read_checkpoint_records(cid)), 1)

        # Turn 0: Second PreToolUse in same turn hits fast dedup (< 5 ms).
        t0 = time.perf_counter()
        res_dup = checkpoint_hook.evaluate_checkpoint(
            {
                "conversationId": cid,
                "cwd": str(repo),
                "toolCall": {"name": "run_command", "args": {"CommandLine": "pytest"}},
            }
        )
        dedup_ms = (time.perf_counter() - t0) * 1000.0
        self.assertEqual(res_dup, {"decision": "allow"})
        self.assertLess(dedup_ms, 5.0)
        self.assertEqual(len(hook_state.read_checkpoint_records(cid)), 1)

        # Simulate unverified edit -> Stop Gate returns continue (must NOT advance turnEpoch).
        def _mark_unverified(st: dict[str, Any]) -> None:
            st["needsVerification"] = True
            st["editedSourceFiles"] = ["app.py"]

        hook_state.update_state(cid, _mark_unverified)
        cont_res = stop_gate.evaluate_stop(
            {
                "conversationId": cid,
                "cwd": str(repo),
                "terminationReason": "NO_TOOL_CALL",
                "continuationActive": False,
                "fullyIdle": True,
            }
        )
        self.assertEqual(cont_res["decision"], "continue")
        self.assertEqual(hook_state.load_state(cid)["turnEpoch"], 0)
        events = _read_spool(self.plugin_data)
        self.assertTrue(any(e["eventName"] == "stop_gate_continued" for e in events))

        # Next Stop -> allow -> advances turnEpoch from 0 to 1.
        allow_res = stop_gate.evaluate_stop(
            {
                "conversationId": cid,
                "cwd": str(repo),
                "terminationReason": "NO_TOOL_CALL",
                "continuationActive": False,
                "fullyIdle": True,
            }
        )
        self.assertEqual(allow_res, {"decision": "allow"})
        self.assertEqual(hook_state.load_state(cid)["turnEpoch"], 1)

        # Turn 1 checkpoint succeeds now that turnEpoch advanced.
        checkpoint_hook.evaluate_checkpoint(
            {
                "conversationId": cid,
                "cwd": str(repo),
                "toolCall": {"name": "edit_file", "args": {"Path": "app.py"}},
            }
        )
        self.assertEqual(len(hook_state.read_checkpoint_records(cid)), 2)

        # New user turn detected via initialNumSteps in PreInvocation (even when idle).
        pre_res = pre_invocation.evaluate_pre_invocation(
            {"conversationId": cid, "invocationNum": 2, "initialNumSteps": 42}
        )
        self.assertEqual(pre_res, {})
        st_after_pre = hook_state.load_state(cid)
        self.assertEqual(st_after_pre["lastInitialNumSteps"], 42)
        self.assertEqual(st_after_pre["turnEpoch"], 2)

        # Read-only chat without checkpoints must NOT create a state file on Stop.
        ro_cid = "conv-readonly-no-ckpt"
        ro_res = stop_gate.evaluate_stop(
            {
                "conversationId": ro_cid,
                "terminationReason": "NO_TOOL_CALL",
                "continuationActive": False,
                "fullyIdle": True,
            }
        )
        self.assertEqual(ro_res, {"decision": "allow"})
        _, ro_path = hook_state.get_state_path(ro_cid)
        self.assertFalse(ro_path.exists())

        # PreInvocation loop-breaker updates turnEpoch and emits loop_breaker_triggered.
        checkpoint_hook.evaluate_checkpoint(
            {
                "conversationId": cid,
                "cwd": str(repo),
                "toolCall": {"name": "edit_file", "args": {"Path": "app.py"}},
            }
        )
        hook_state.update_state(
            cid, lambda st: st.update({"consecutiveFailures": 5, "lastFailureSignature": "run_command:123"})
        )
        term_res = pre_invocation.evaluate_pre_invocation(
            {"conversationId": cid, "invocationNum": 3, "initialNumSteps": 55}
        )
        self.assertEqual(term_res.get("terminationBehavior"), "terminate")
        self.assertEqual(hook_state.load_state(cid)["turnEpoch"], 3)
        events_after = _read_spool(self.plugin_data)
        self.assertTrue(any(e["eventName"] == "loop_breaker_triggered" for e in events_after))

    def test_size_guards_and_timeout_skip(self) -> None:
        repo = self.root / "guard-repo"
        _init_git_repo(repo, with_commit=True)

        # 1. Index size guard skip
        with mock.patch.dict(
            os.environ, {**self.env, "CF_CHECKPOINT_MAX_INDEX_BYTES": "10"}
        ):
            res_idx = checkpoint_hook.evaluate_checkpoint(
                {
                    "conversationId": "conv-idx-guard",
                    "cwd": str(repo),
                    "toolCall": {"name": "edit_file", "args": {"Path": "app.py"}},
                }
            )
        self.assertEqual(res_idx, {"decision": "allow"})
        recs_idx = hook_state.read_checkpoint_records("conv-idx-guard")
        self.assertEqual(len(recs_idx), 1)
        self.assertEqual(recs_idx[0]["snapshotType"], "skipped-size-guard")

        # 2. Pack size guard skip
        pack_dir = repo / ".git" / "objects" / "pack"
        pack_dir.mkdir(parents=True, exist_ok=True)
        (pack_dir / "pack-test.pack").write_bytes(b"PACK" * 64)
        with mock.patch.dict(
            os.environ, {**self.env, "CF_CHECKPOINT_MAX_PACK_MB": "0"}
        ):
            res_pack = checkpoint_hook.evaluate_checkpoint(
                {
                    "conversationId": "conv-pack-guard",
                    "cwd": str(repo),
                    "toolCall": {"name": "edit_file", "args": {"Path": "app.py"}},
                }
            )
        self.assertEqual(res_pack, {"decision": "allow"})
        recs_pack = hook_state.read_checkpoint_records("conv-pack-guard")
        self.assertEqual(len(recs_pack), 1)
        self.assertEqual(recs_pack[0]["snapshotType"], "skipped-size-guard")

        # 3. Timeout skip
        (pack_dir / "pack-test.pack").unlink()
        with mock.patch.dict(
            os.environ, {**self.env, "CF_CHECKPOINT_TIMEOUT_MS": "30"}
        ), mock.patch.object(
            subprocess,
            "run",
            side_effect=subprocess.TimeoutExpired(cmd=["git"], timeout=0.03),
        ):
            res_to = checkpoint_hook.evaluate_checkpoint(
                {
                    "conversationId": "conv-timeout-guard",
                    "cwd": str(repo),
                    "toolCall": {"name": "edit_file", "args": {"Path": "app.py"}},
                }
            )
        self.assertEqual(res_to, {"decision": "allow"})
        recs_to = hook_state.read_checkpoint_records("conv-timeout-guard")
        self.assertEqual(len(recs_to), 1)
        self.assertEqual(recs_to[0]["snapshotType"], "skipped-timeout")

        # 4. MIN_REMAINING_FOR_UNTRACKED_S (0.008s) cutoff skips ls-files deterministically
        (repo / "app.py").write_text("VALUE = 3\n", encoding="utf-8")
        (repo / "cutoff-untracked.md").write_text("skipped\n", encoding="utf-8")
        with mock.patch.dict(
            os.environ, {**self.env, "CF_CHECKPOINT_TIMEOUT_MS": "140"}
        ), mock.patch.object(
            checkpoint_hook.time,
            "perf_counter",
            side_effect=[100.0, 100.001, 100.002, 100.135],
        ):
            res_cutoff = checkpoint_hook.evaluate_checkpoint(
                {
                    "conversationId": "conv-untracked-cutoff",
                    "cwd": str(repo),
                    "toolCall": {"name": "edit_file", "args": {"Path": "app.py"}},
                }
            )
        self.assertEqual(res_cutoff, {"decision": "allow"})
        recs_cutoff = hook_state.read_checkpoint_records("conv-untracked-cutoff")
        self.assertEqual(len(recs_cutoff), 1)
        self.assertEqual(recs_cutoff[0]["snapshotType"], "stash-create")
        self.assertEqual(recs_cutoff[0]["untrackedSample"], [])
        self.assertEqual(recs_cutoff[0]["untrackedCount"], 0)

    def test_timeout_guard_and_latency_budget(self) -> None:
        clean_repo = self.root / "latency-budget-clean-repo"
        _init_git_repo(clean_repo, with_commit=True)

        repo = self.root / "latency-budget-repo"
        _init_git_repo(repo, with_commit=True)
        (repo / "app.py").write_text("VALUE = 9\n", encoding="utf-8")
        (repo / "note.md").write_text("untracked\n", encoding="utf-8")

        env_default = {k: v for k, v in self.env.items() if k != "CF_CHECKPOINT_TIMEOUT_MS"}
        with mock.patch.dict(os.environ, env_default, clear=False):
            os.environ.pop("CF_CHECKPOINT_TIMEOUT_MS", None)
            t_clean0 = time.perf_counter()
            res_clean = checkpoint_hook.evaluate_checkpoint(
                {
                    "conversationId": "conv-latency-budget-clean",
                    "cwd": str(clean_repo),
                    "toolCall": {"name": "edit_file", "args": {"Path": "app.py"}},
                }
            )
            clean_elapsed_ms = (time.perf_counter() - t_clean0) * 1000.0

            t0 = time.perf_counter()
            res = checkpoint_hook.evaluate_checkpoint(
                {
                    "conversationId": "conv-latency-budget",
                    "cwd": str(repo),
                    "toolCall": {"name": "edit_file", "args": {"Path": "app.py"}},
                }
            )
            elapsed_ms = (time.perf_counter() - t0) * 1000.0
        self.assertEqual(res_clean, {"decision": "allow"})
        self.assertLessEqual(clean_elapsed_ms, 150.0)
        recs_clean = hook_state.read_checkpoint_records("conv-latency-budget-clean")
        self.assertEqual(len(recs_clean), 1)
        self.assertIn(recs_clean[0]["snapshotType"], ("head", "skipped-timeout"))

        self.assertEqual(res, {"decision": "allow"})
        self.assertLessEqual(elapsed_ms, 150.0)
        recs = hook_state.read_checkpoint_records("conv-latency-budget")
        self.assertEqual(len(recs), 1)
        self.assertIn(recs[0]["snapshotType"], ("stash-create", "head", "skipped-timeout"))

    def test_permissions_0700_0600_and_symlink_rejection(self) -> None:
        repo = self.root / "perm-repo"
        _init_git_repo(repo, with_commit=True)
        cid = "conv-perms"
        checkpoint_hook.evaluate_checkpoint(
            {
                "conversationId": cid,
                "cwd": str(repo),
                "toolCall": {"name": "edit_file", "args": {"Path": "app.py"}},
            }
        )
        ckpt_dir = hook_state.get_checkpoints_dir()
        _, log_path = hook_state.get_checkpoint_log_path(cid)
        if os.name == "posix":
            self.assertEqual(stat.S_IMODE(ckpt_dir.stat().st_mode), 0o700)
            self.assertEqual(stat.S_IMODE(log_path.stat().st_mode), 0o600)

        # Symlinked checkpoint log file must be rejected by hook_state, while hook fails open allow.
        evil_target = self.root / "evil.txt"
        evil_target.write_text("do not overwrite\n", encoding="utf-8")
        sym_cid = "conv-symlink"
        sym_log = ckpt_dir / f"{sym_cid}.jsonl"
        sym_log.symlink_to(evil_target)
        res_sym = checkpoint_hook.evaluate_checkpoint(
            {
                "conversationId": sym_cid,
                "cwd": str(repo),
                "toolCall": {"name": "edit_file", "args": {"Path": "app.py"}},
            }
        )
        self.assertEqual(res_sym, {"decision": "allow"})
        self.assertEqual(evil_target.read_text(encoding="utf-8"), "do not overwrite\n")

        # Symlinked repo root must be rejected by rewind.py restore --apply.
        sym_repo = self.root / "sym-repo"
        sym_repo.symlink_to(repo)
        proc_sym, _ = _run_cli(
            REWIND_SCRIPT,
            ["restore", "--sha", _git(repo, "rev-parse", "HEAD").stdout.strip(), "--apply", "--cwd", str(sym_repo), "--json"],
            env_overrides=self.env,
        )
        self.assertNotEqual(proc_sym.returncode, 0)
        self.assertFalse(json.loads(proc_sym.stdout)["ok"])

    def test_post_tool_workflows_top_level_await_and_sidecar_events(self) -> None:
        ws = self.root / "wf-workspace"
        (ws / "workflows" / "cf-qa-gate").mkdir(parents=True)
        (ws / "src").mkdir(parents=True)
        wf_py = ws / "workflows" / "cf-qa-gate" / "workflow.py"
        wf_py.write_text(
            "async def run():\n    return 1\n\nresult = await run()\n",
            encoding="utf-8",
        )
        src_py = ws / "src" / "bad.py"
        src_py.write_text("x = await broken()\n", encoding="utf-8")

        cid = "conv-wf-await"
        # 1. workflows/*.py with top-level await MUST pass python-syntax check.
        post_tool_feedback.process_post_tool(
            {
                "conversationId": cid,
                "cwd": str(ws),
                "toolCall": {"name": "write_file", "args": {"Path": str(wf_py)}},
            }
        )
        st1 = hook_state.load_state(cid)
        self.assertEqual(st1["pendingFeedback"], [])

        # 2. Regular src/*.py with top-level await MUST fail python-syntax and emit post_tool_lint_error.
        post_tool_feedback.process_post_tool(
            {
                "conversationId": cid,
                "cwd": str(ws),
                "toolCall": {"name": "write_file", "args": {"Path": str(src_py)}},
            }
        )
        st2 = hook_state.load_state(cid)
        self.assertEqual(len(st2["pendingFeedback"]), 1)
        self.assertEqual(st2["pendingFeedback"][0]["checker"], "python-syntax")

        # 3. Fixing src/bad.py clears pendingFeedback and emits post_tool_lint_resolved.
        src_py.write_text("x = 1\n", encoding="utf-8")
        post_tool_feedback.process_post_tool(
            {
                "conversationId": cid,
                "cwd": str(ws),
                "toolCall": {"name": "edit_file", "args": {"Path": str(src_py)}},
            }
        )
        st3 = hook_state.load_state(cid)
        self.assertEqual(st3["pendingFeedback"], [])

        # 4. Verification command emits verification_passed.
        post_tool_feedback.process_post_tool(
            {
                "conversationId": cid,
                "cwd": str(ws),
                "toolCall": {"name": "run_command", "args": {"CommandLine": "pytest -q"}},
            }
        )

        # 5. SessionStart emits session_start ONLY when .memory/ is hydrated.
        session_start.build_session_start_response(
            {"conversationId": cid, "cwd": str(ws)}
        )
        names_before = [e["eventName"] for e in _read_spool(self.plugin_data)]
        self.assertNotIn("session_start", names_before)

        (ws / ".memory").mkdir()
        (ws / ".memory" / "handover.md").write_text("# Handover\nReady.\n", encoding="utf-8")
        ss_out = session_start.build_session_start_response(
            {"conversationId": cid, "cwd": str(ws)}
        )
        self.assertIn("injectSteps", ss_out)

        names = [e["eventName"] for e in _read_spool(self.plugin_data)]
        self.assertIn("post_tool_lint_error", names)
        self.assertIn("post_tool_lint_resolved", names)
        self.assertIn("verification_passed", names)
        self.assertIn("session_start", names)

    def test_rewind_cli_list_diff_restore_dry_run_apply_and_prune(self) -> None:
        repo = self.root / "rewind-repo"
        head_sha = _init_git_repo(repo, with_commit=True)
        cid = "conv-rewind-e2e"

        # Checkpoint 0: dirty tracked edit (VALUE = 2)
        (repo / "app.py").write_text("VALUE = 2\n", encoding="utf-8")
        with self._deterministic_checkpoint_clock(), mock.patch.dict(
            os.environ, {**self.env, "CF_CHECKPOINT_TIMEOUT_MS": "140"}
        ):
            checkpoint_hook.evaluate_checkpoint(
                {
                    "conversationId": cid,
                    "cwd": str(repo),
                    "stepIdx": 1,
                    "toolCall": {"name": "edit_file", "args": {"Path": "app.py"}},
                },
                now=1000.0,
            )
        recs = hook_state.read_checkpoint_records(cid)
        chk0_id = recs[0]["checkpointId"]
        chk0_sha = recs[0]["snapshotSha"]

        # Further mutate tracked file, commit a new tracked file, and add an untracked file.
        (repo / "app.py").write_text("VALUE = 999\n", encoding="utf-8")
        (repo / "later.py").write_text("LATER = True\n", encoding="utf-8")
        _git(repo, "add", "later.py")
        _git(repo, "commit", "-m", "add later.py")
        (repo / "untracked-notes.txt").write_text("keep me safe\n", encoding="utf-8")

        # Advance turn and capture second checkpoint.
        stop_gate.evaluate_stop(
            {
                "conversationId": cid,
                "terminationReason": "NO_TOOL_CALL",
                "continuationActive": False,
                "fullyIdle": True,
            }
        )
        with self._deterministic_checkpoint_clock(), mock.patch.dict(
            os.environ, {**self.env, "CF_CHECKPOINT_TIMEOUT_MS": "140"}
        ):
            checkpoint_hook.evaluate_checkpoint(
                {
                    "conversationId": cid,
                    "cwd": str(repo),
                    "stepIdx": 2,
                    "toolCall": {"name": "edit_file", "args": {"Path": "app.py"}},
                },
                now=2000.0,
            )

        # Invoke rewind.py through a symlink to verify symlink-safe entrypoint!
        symlink_cli = self.root / "cf-rewind-link.py"
        symlink_cli.symlink_to(REWIND_SCRIPT)

        # 1. list (newest-first, limit clamped)
        p_list, _ = _run_cli(
            symlink_cli,
            ["list", "--conversation-id", cid, "--limit", "1", "--json"],
            env_overrides=self.env,
        )
        self.assertEqual(p_list.returncode, 0, p_list.stderr)
        list_data = json.loads(p_list.stdout)
        self.assertEqual(list_data["count"], 1)
        self.assertEqual(list_data["checkpoints"][0]["turnEpoch"], 1)

        p_list_clamp, _ = _run_cli(
            symlink_cli,
            ["list", "--conversation-id", cid, "--limit", "500", "--json"],
            env_overrides=self.env,
        )
        self.assertEqual(json.loads(p_list_clamp.stdout)["limit"], 100)

        # 2. diff (--id + --stat + --sha + flag-injection rejection)
        p_diff, _ = _run_cli(
            symlink_cli,
            ["diff", "--id", chk0_id, "--cwd", str(repo), "--stat", "--json"],
            env_overrides=self.env,
        )
        self.assertEqual(p_diff.returncode, 0)
        diff_data = json.loads(p_diff.stdout)
        self.assertTrue(diff_data["hasChanges"])
        self.assertIn("app.py", diff_data["diff"])

        for bad_sha in ("--exec=id", "-p", "not-hex-sha", "abc123"):
            with self.subTest(bad_sha=bad_sha):
                p_bad, _ = _run_cli(
                    symlink_cli,
                    ["diff", f"--sha={bad_sha}", "--cwd", str(repo), "--json"],
                    env_overrides=self.env,
                )
                self.assertNotEqual(p_bad.returncode, 0)
                self.assertFalse(json.loads(p_bad.stdout)["ok"])

        # 3. restore default (--dry-run): non-mutating
        p_dry, _ = _run_cli(
            symlink_cli,
            ["restore", "--id", chk0_id, "--conversation-id", cid, "--cwd", str(repo), "--json"],
            env_overrides=self.env,
        )
        self.assertEqual(p_dry.returncode, 0, p_dry.stderr)
        dry_data = json.loads(p_dry.stdout)
        self.assertEqual(dry_data["mode"], "dry-run")
        self.assertFalse(dry_data["applied"])
        self.assertIn("app.py", dry_data["wouldRestoreFiles"])
        self.assertIn("untracked-notes.txt", dry_data["untouchedFiles"])
        self.assertIn("later.py", dry_data["untouchedFiles"])
        self.assertEqual((repo / "app.py").read_text(encoding="utf-8"), "VALUE = 999\n")

        # 4. restore --apply: creates pre-restore-safety snapshot, restores tracked files, preserves untracked/later
        p_apply, _ = _run_cli(
            symlink_cli,
            [
                "restore",
                "--id",
                chk0_id,
                "--apply",
                "--conversation-id",
                cid,
                "--cwd",
                str(repo),
                "--json",
            ],
            env_overrides=self.env,
        )
        self.assertEqual(p_apply.returncode, 0, p_apply.stderr)
        apply_data = json.loads(p_apply.stdout)
        self.assertEqual(apply_data["mode"], "apply")
        self.assertTrue(apply_data["applied"])
        self.assertEqual(apply_data["targetSha"], chk0_sha)
        self.assertNotEqual(chk0_sha, head_sha)
        self.assertTrue(apply_data["safetyCheckpointId"].startswith("chk-safety-"))
        self.assertIn("untracked-notes.txt", apply_data["untouchedFiles"])
        self.assertIn("later.py", apply_data["untouchedFiles"])

        # Tracked file restored to checkpoint value; untracked + post-checkpoint files untouched!
        self.assertEqual((repo / "app.py").read_text(encoding="utf-8"), "VALUE = 2\n")
        self.assertEqual(
            (repo / "untracked-notes.txt").read_text(encoding="utf-8"),
            "keep me safe\n",
        )
        self.assertEqual((repo / "later.py").read_text(encoding="utf-8"), "LATER = True\n")

        # Mandatory pre-restore-safety record exists in JSONL & checkpoint_restored event emitted.
        all_recs = hook_state.read_checkpoint_records(cid)
        self.assertEqual(all_recs[-1]["kind"], "pre-restore-safety")
        self.assertTrue(
            any(e["eventName"] == "checkpoint_restored" for e in _read_spool(self.plugin_data))
        )

        # 5. prune (--dry-run vs --apply)
        ckpt_dir = hook_state.get_checkpoints_dir()
        stale_log = ckpt_dir / "stale-conv.jsonl"
        stale_log.write_text('{"checkpointId":"old"}\n', encoding="utf-8")
        old_time = time.time() - (200 * 3600)
        os.utime(stale_log, (old_time, old_time))

        p_prune_dry, _ = _run_cli(
            symlink_cli,
            ["prune", "--max-age-hours", "168", "--json"],
            env_overrides=self.env,
        )
        self.assertEqual(p_prune_dry.returncode, 0)
        self.assertEqual(json.loads(p_prune_dry.stdout)["removedFiles"], 1)
        self.assertTrue(stale_log.exists())

        p_prune_apply, _ = _run_cli(
            symlink_cli,
            ["prune", "--max-age-hours", "168", "--apply", "--json"],
            env_overrides=self.env,
        )
        self.assertEqual(p_prune_apply.returncode, 0)
        self.assertEqual(json.loads(p_prune_apply.stdout)["removedFiles"], 1)
        self.assertFalse(stale_log.exists())


if __name__ == "__main__":
    unittest.main()
