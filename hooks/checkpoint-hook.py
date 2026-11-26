#!/usr/bin/env python3
"""Enterprise Code Factory v3.1.0 PreToolUse git-shadow checkpoint hook.

Captures a non-destructive pre-turn snapshot (`git stash create`, clean `HEAD`
baseline, or `unborn` marker) at most once per turn (`turnEpoch` dedup) within
a strict <= 150 ms latency budget, persisting metadata to `$PLUGIN_DATA/checkpoints/`.

Fail-closed on malformed/empty stdin (`{"decision": "ask", ...}`), and
always explicit `{"decision": "allow"}` on all valid payloads—even on non-git
workspaces, unborn `HEAD`, size-guard skips, or git timeouts.
"""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import time
import uuid
from typing import Any

HOOKS_DIR = str(pathlib.Path(__file__).resolve().parent)
if HOOKS_DIR not in sys.path:
    sys.path.insert(0, HOOKS_DIR)

import hook_state  # noqa: E402

ALLOW_RESPONSE: dict[str, str] = {"decision": "allow"}
ASK_PARSE_ERROR: dict[str, str] = {
    "decision": "ask",
    "reason": "Enterprise Code Factory Checkpoint Hook: unable to parse hook payload.",
}

DEFAULT_TIMEOUT_MS = 120
MIN_TIMEOUT_MS = 30
MAX_TIMEOUT_MS = 140
DEFAULT_MAX_INDEX_BYTES = 4_194_304  # 4 MiB
DEFAULT_MAX_PACK_MB = 512
MIN_REMAINING_FOR_GIT_S = 0.005
MIN_REMAINING_FOR_UNTRACKED_S = 0.008


def _checkpoints_disabled() -> bool:
    raw = os.environ.get("CF_DISABLE_CHECKPOINTS", "").strip().lower()
    return raw in {"1", "true", "off", "yes"}


def _parse_int_env(name: str, default: int, minimum: int, maximum: int | None = None) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        val = default
    else:
        try:
            val = int(raw)
        except ValueError:
            val = default
    if val < minimum:
        val = minimum
    if maximum is not None and val > maximum:
        val = maximum
    return val


def _find_git_repo(project_dir: pathlib.Path) -> tuple[pathlib.Path, pathlib.Path | None] | None:
    """Locate the enclosing git repository root and .git directory without following symlinks."""
    current = project_dir
    while True:
        git_entry = current / ".git"
        try:
            if git_entry.is_symlink():
                return None
            if git_entry.is_dir():
                return current, git_entry
            if git_entry.is_file():
                # Support worktree gitfiles (`gitdir: <path>`) cleanly.
                raw_text = git_entry.read_text(encoding="utf-8", errors="replace")
                first_line = raw_text.splitlines()[0].strip() if raw_text else ""
                if first_line.lower().startswith("gitdir:"):
                    rel_or_abs = first_line.split(":", 1)[1].strip()
                    git_dir = pathlib.Path(rel_or_abs)
                    if not git_dir.is_absolute():
                        git_dir = (current / git_dir).resolve()
                    if not git_dir.is_symlink() and git_dir.is_dir():
                        return current, git_dir
                return current, None
        except OSError:
            return None

        if current.parent == current:
            return None
        current = current.parent


def _exceeds_size_guards(
    git_dir: pathlib.Path | None, max_index_bytes: int, max_pack_bytes: int
) -> bool:
    """Check .git/index and .git/objects/pack/*.pack sizes using pure Python stat()."""
    if git_dir is None:
        return False

    index_path = git_dir / "index"
    try:
        if index_path.is_symlink():
            return True
        if index_path.exists() and index_path.is_file():
            if index_path.stat().st_size > max_index_bytes:
                return True
    except OSError:
        return True

    pack_dir = git_dir / "objects" / "pack"
    try:
        if pack_dir.is_symlink():
            return True
        if pack_dir.exists() and pack_dir.is_dir():
            total_pack_bytes = 0
            with os.scandir(pack_dir) as pack_entries:
                for entry in pack_entries:
                    if entry.is_symlink() or not entry.is_file(follow_symlinks=False):
                        continue
                    if not entry.name.endswith(".pack"):
                        continue
                    total_pack_bytes += entry.stat(follow_symlinks=False).st_size
                    if total_pack_bytes > max_pack_bytes:
                        return True
    except OSError:
        return True

    return False


def _run_git(
    args: list[str], repo_root: pathlib.Path, deadline: float
) -> tuple[str, int, str, str]:
    """Run git with shell=False strictly inside the remaining deadline."""
    remaining = deadline - time.perf_counter()
    if remaining <= MIN_REMAINING_FOR_GIT_S:
        return "timeout", -1, "", ""
    try:
        proc = subprocess.run(
            ["git", "--no-pager", *args],
            cwd=str(repo_root),
            shell=False,
            capture_output=True,
            text=True,
            timeout=remaining,
        )
        return "ok", proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return "timeout", -1, "", ""
    except (FileNotFoundError, OSError):
        return "error", -1, "", ""


def _extract_target_summary(
    payload: dict[str, Any], repo_root: pathlib.Path
) -> tuple[str, str, int]:
    tool_call = payload.get("toolCall") or payload.get("tool_call") or {}
    if not isinstance(tool_call, dict):
        tool_call = {}
    tool_name = str(tool_call.get("name") or "").strip()
    args = tool_call.get("args") or {}
    if not isinstance(args, dict):
        args = {}

    raw_target = ""
    if tool_name == "run_command":
        for key in ("CommandLine", "commandLine", "command_line"):
            val = args.get(key)
            if isinstance(val, str) and val.strip():
                raw_target = val.strip()
                break
    else:
        for key in ("Path", "TargetFile", "path", "target_file", "file_path", "FilePath"):
            val = args.get(key)
            if isinstance(val, str) and val.strip():
                raw_target = val.strip()
                break
        if raw_target:
            try:
                p = pathlib.Path(raw_target).expanduser()
                if p.is_absolute() and hook_state.is_within_directory(p, repo_root):
                    raw_target = p.resolve().relative_to(repo_root.resolve()).as_posix()
            except (OSError, ValueError):
                pass

    raw_step = (
        payload.get("stepIdx")
        if payload.get("stepIdx") is not None
        else payload.get("stepIndex", payload.get("invocationNum", 0))
    )
    step_idx = (
        raw_step
        if isinstance(raw_step, int) and not isinstance(raw_step, bool) and raw_step >= 0
        else 0
    )

    return (
        hook_state.sanitize_text(tool_name, max_chars=64),
        hook_state.sanitize_text(raw_target, max_chars=hook_state.MAX_UNTRACKED_PATH_CHARS),
        step_idx,
    )


def evaluate_checkpoint(payload: dict[str, Any], now: float | None = None) -> dict[str, str]:
    """Capture a pre-turn git-shadow checkpoint once per turnEpoch and return allow."""
    if _checkpoints_disabled():
        return dict(ALLOW_RESPONSE)

    start_perf = time.perf_counter()
    conversation_id = payload.get("conversationId")

    # Per-turn deduplication (< 5 ms fast-path).
    snapshot = hook_state.load_state(conversation_id)
    turn_epoch = int(snapshot.get("turnEpoch", 0))
    if turn_epoch == int(snapshot.get("checkpointedTurnEpoch", -1)):
        return dict(ALLOW_RESPONSE)

    project_dir = hook_state.resolve_project_dir(payload)
    if project_dir is None:
        return dict(ALLOW_RESPONSE)

    repo_info = _find_git_repo(project_dir)
    if repo_info is None:
        return dict(ALLOW_RESPONSE)
    repo_root, git_dir = repo_info

    timeout_ms = _parse_int_env(
        "CF_CHECKPOINT_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS
    )
    deadline = start_perf + (timeout_ms / 1000.0)

    max_index_bytes = _parse_int_env(
        "CF_CHECKPOINT_MAX_INDEX_BYTES", DEFAULT_MAX_INDEX_BYTES, 0
    )
    max_pack_mb = _parse_int_env("CF_CHECKPOINT_MAX_PACK_MB", DEFAULT_MAX_PACK_MB, 0)
    max_pack_bytes = max_pack_mb * 1024 * 1024

    head_sha = ""
    branch = ""
    snapshot_sha = ""
    snapshot_type = "unborn"
    untracked_sample: list[str] = []
    untracked_count = 0

    if _exceeds_size_guards(git_dir, max_index_bytes, max_pack_bytes):
        snapshot_type = "skipped-size-guard"
    else:
        status, rc, out, _ = _run_git(
            ["rev-parse", "HEAD", "--abbrev-ref", "HEAD"], repo_root, deadline
        )
        if status == "timeout":
            snapshot_type = "skipped-timeout"
        elif status == "error":
            return dict(ALLOW_RESPONSE)
        elif rc != 0:
            snapshot_type = "unborn"
            if (deadline - time.perf_counter()) > MIN_REMAINING_FOR_UNTRACKED_S:
                sym_status, sym_rc, sym_out, _ = _run_git(
                    ["symbolic-ref", "--short", "HEAD"], repo_root, deadline
                )
                if sym_status == "ok" and sym_rc == 0:
                    branch = sym_out.strip()
        else:
            lines = [ln.strip() for ln in out.splitlines() if ln.strip()]
            candidate_head = lines[0] if lines else ""
            if hook_state.SHA_RE.match(candidate_head):
                head_sha = candidate_head
            if len(lines) >= 2:
                branch = lines[1]

            st_status, st_rc, st_out, _ = _run_git(
                ["stash", "create"], repo_root, deadline
            )
            if st_status == "timeout":
                snapshot_type = "skipped-timeout"
            elif st_status == "ok" and st_rc == 0:
                stash_sha = st_out.strip()
                if stash_sha and hook_state.SHA_RE.match(stash_sha):
                    snapshot_type = "stash-create"
                    snapshot_sha = stash_sha
                elif head_sha:
                    snapshot_type = "head"
                    snapshot_sha = head_sha
                else:
                    snapshot_type = "unborn"
            elif head_sha:
                snapshot_type = "head"
                snapshot_sha = head_sha
            else:
                snapshot_type = "unborn"

        if (
            snapshot_type not in ("skipped-timeout", "skipped-size-guard")
            and (deadline - time.perf_counter()) > MIN_REMAINING_FOR_UNTRACKED_S
        ):
            ls_status, ls_rc, ls_out, _ = _run_git(
                ["ls-files", "--others", "--exclude-standard", "-z"], repo_root, deadline
            )
            if ls_status == "ok" and ls_rc == 0 and ls_out:
                paths = [p for p in ls_out.split("\x00") if p]
                untracked_count = len(paths)
                for p in paths[: hook_state.MAX_UNTRACKED_SAMPLE]:
                    cleaned = hook_state.sanitize_text(
                        p, max_chars=hook_state.MAX_UNTRACKED_PATH_CHARS
                    )
                    if cleaned:
                        untracked_sample.append(cleaned)

    now_ts = float(time.time() if now is None else now)
    checkpoint_id = f"chk-{turn_epoch:05d}-{uuid.uuid4().hex[:6]}"
    tool_name, target_summary, step_idx = _extract_target_summary(payload, repo_root)

    def _mutate(state: dict[str, Any]) -> tuple[bool, int]:
        cur_epoch = int(state.get("turnEpoch", 0))
        if cur_epoch == int(state.get("checkpointedTurnEpoch", -1)):
            return False, cur_epoch
        state["checkpointedTurnEpoch"] = cur_epoch
        state["lastCheckpointId"] = checkpoint_id
        state["lastCheckpointSha"] = snapshot_sha
        state["lastCheckpointAt"] = now_ts
        return True, cur_epoch

    _, (recorded, actual_epoch) = hook_state.update_state(
        conversation_id, _mutate, now=now_ts
    )
    if not recorded:
        return dict(ALLOW_RESPONSE)

    record = {
        "schemaVersion": hook_state.SCHEMA_VERSION,
        "checkpointId": checkpoint_id,
        "conversationId": hook_state.sanitize_conversation_id(conversation_id),
        "kind": "pre-turn",
        "turnEpoch": actual_epoch,
        "stepIdx": step_idx,
        "timestamp": now_ts,
        "projectDir": str(repo_root),
        "branch": branch,
        "headSha": head_sha,
        "snapshotSha": snapshot_sha,
        "snapshotType": snapshot_type,
        "toolName": tool_name,
        "targetSummary": target_summary,
        "untrackedSample": untracked_sample,
        "untrackedCount": untracked_count,
    }
    try:
        hook_state.append_checkpoint_record(conversation_id, record)
    except (OSError, ValueError):
        pass

    emit_status = "ok" if snapshot_type in ("stash-create", "head", "unborn") else "skipped"
    try:
        hook_state.emit_sidecar_event(
            event_name="checkpoint_created",
            conversation_id=conversation_id,
            project_dir=str(repo_root),
            hook="checkpoint-hook",
            tool_name=tool_name,
            status=emit_status,
            summary=f"{checkpoint_id} ({snapshot_type})",
            metadata={
                "checkpointId": checkpoint_id,
                "snapshotType": snapshot_type,
                "snapshotSha": snapshot_sha,
                "turnEpoch": actual_epoch,
            },
            timeout_s=0.005,
        )
    except Exception:
        pass

    return dict(ALLOW_RESPONSE)


def main() -> int:
    try:
        raw = sys.stdin.read()
    except Exception:
        print(json.dumps(ASK_PARSE_ERROR))
        return 0

    if not raw.strip():
        print(json.dumps(ASK_PARSE_ERROR))
        return 0

    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        print(json.dumps(ASK_PARSE_ERROR))
        return 0

    if not isinstance(payload, dict):
        print(json.dumps(ASK_PARSE_ERROR))
        return 0

    try:
        response = evaluate_checkpoint(payload)
        if not isinstance(response, dict) or response.get("decision") != "allow":
            response = dict(ALLOW_RESPONSE)
        print(json.dumps(response))
    except Exception:
        print(json.dumps(ALLOW_RESPONSE))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
