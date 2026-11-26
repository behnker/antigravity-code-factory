#!/usr/bin/env python3
"""Enterprise Code Factory v3.1.0 cf-rewind CLI (pure Python 3 stdlib).

Manages pre-turn and pre-restore-safety Git-shadow checkpoints:
  - list:    List checkpoints newest-first (limit clamped [1, 100])
  - diff:    Preview git diff against a validated SHA or checkpoint ID
  - restore: Non-mutating --dry-run by default; --apply takes a mandatory
             pre-restore-safety snapshot and runs `git checkout <sha> -- .`
             without ever running `git reset --hard` or deleting untracked files
  - prune:   Dry-run or apply TTL/count pruning on checkpoint JSONL logs
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import pathlib
import re
import subprocess
import sys
import time
import uuid
from typing import Any

# Symlink-safe plugin root resolution so invoking via ~/.gemini/config/plugins/code-factory/... works.
REAL_SCRIPT_PATH = pathlib.Path(os.path.realpath(__file__))
PLUGIN_ROOT = REAL_SCRIPT_PATH.parents[3]
HOOKS_DIR = str(PLUGIN_ROOT / "hooks")
if HOOKS_DIR not in sys.path:
    sys.path.insert(0, HOOKS_DIR)

import hook_state  # noqa: E402

SHA_RE = hook_state.SHA_RE
CHECKPOINT_ID_RE = re.compile(r"\A[A-Za-z0-9._-]{1,64}\Z")
GIT_TIMEOUT_S = 5.0


class RewindError(Exception):
    """Structured error carrying an explicit exit code."""

    def __init__(self, message: str, exit_code: int = 1) -> None:
        super().__init__(message)
        self.exit_code = exit_code


def _run_git(
    args: list[str], repo_root: pathlib.Path, timeout_s: float = GIT_TIMEOUT_S
) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["git", "--no-pager", *args],
            cwd=str(repo_root),
            shell=False,
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
    except subprocess.TimeoutExpired as exc:
        raise RewindError(f"Git command timed out after {timeout_s}s: git {' '.join(args)}", 1) from exc
    except (FileNotFoundError, OSError) as exc:
        raise RewindError(f"Failed to run git: {exc}", 1) from exc


def _resolve_repo_root(cwd_arg: str | None) -> pathlib.Path:
    """Locate the enclosing git repository root, rejecting non-git dirs and symlinks."""
    raw_cwd = pathlib.Path(cwd_arg).expanduser() if cwd_arg else pathlib.Path.cwd()
    if raw_cwd.is_symlink():
        raise RewindError(f"Refusing symlinked working directory: {raw_cwd}", 2)
    if not raw_cwd.exists() or not raw_cwd.is_dir():
        raise RewindError(f"Working directory does not exist: {raw_cwd}", 2)

    current = raw_cwd
    while True:
        if current.is_symlink():
            raise RewindError(f"Refusing symlinked repository root: {current}", 2)
        git_entry = current / ".git"
        if git_entry.is_symlink():
            raise RewindError(f"Refusing symlinked .git entry: {git_entry}", 2)
        if git_entry.is_dir() or git_entry.is_file():
            return current.resolve()
        if current.parent == current:
            break
        current = current.parent

    raise RewindError(f"Not a git repository (missing .git): {raw_cwd}", 2)


def _validate_sha(sha: str) -> str:
    if not isinstance(sha, str) or not SHA_RE.match(sha):
        raise RewindError(
            f"Invalid git SHA {sha!r}: must match ^[0-9a-f]{{7,40}}$ without flags.",
            2,
        )
    return sha


def _validate_checkpoint_id(ckpt_id: str) -> str:
    if not isinstance(ckpt_id, str) or ckpt_id.startswith("-") or not CHECKPOINT_ID_RE.match(ckpt_id):
        raise RewindError(f"Invalid checkpoint ID: {ckpt_id!r}", 2)
    return ckpt_id


def _validate_commit_object(sha: str, repo_root: pathlib.Path) -> None:
    _validate_sha(sha)
    proc = _run_git(["cat-file", "-t", sha], repo_root)
    if proc.returncode != 0 or proc.stdout.strip() != "commit":
        detail = (proc.stderr or proc.stdout or "").strip() or "not a commit object"
        raise RewindError(f"SHA {sha} is not a valid git commit: {detail}", 2)


def _collect_records(
    conversation_id: str | None = None,
    cwd: str | None = None,
) -> list[dict[str, Any]]:
    """Collect checkpoint records newest-first, optionally filtered by conversationId and cwd."""
    records: list[dict[str, Any]] = []
    if conversation_id:
        raw = hook_state.read_checkpoint_records(
            conversation_id, limit=hook_state.MAX_CHECKPOINTS_PER_CONV
        )
        records.extend(reversed(raw))
    else:
        for log_file in hook_state.list_checkpoint_files():
            raw = hook_state.read_checkpoint_records(
                log_file.stem, limit=hook_state.MAX_CHECKPOINTS_PER_CONV
            )
            records.extend(raw)
        records.sort(key=lambda r: float(r.get("timestamp", 0.0)), reverse=True)

    if cwd:
        try:
            cwd_resolved = str(pathlib.Path(cwd).expanduser().resolve())
        except OSError:
            cwd_resolved = cwd
        filtered: list[dict[str, Any]] = []
        for rec in records:
            proj = rec.get("projectDir", "")
            if not proj:
                continue
            try:
                proj_resolved = str(pathlib.Path(proj).resolve())
            except OSError:
                proj_resolved = proj
            if proj_resolved == cwd_resolved:
                filtered.append(rec)
        return filtered

    return records


def _resolve_target(
    sha_arg: str | None,
    id_arg: str | None,
    latest_flag: bool,
    conversation_id: str | None,
    cwd: str | None,
) -> tuple[str, dict[str, Any] | None]:
    if sha_arg is not None:
        return _validate_sha(sha_arg), None

    records = _collect_records(conversation_id=conversation_id, cwd=cwd)
    if id_arg is not None:
        ckpt_id = _validate_checkpoint_id(id_arg)
        # Fallback to unfiltered by cwd if not found under cwd.
        match = next((r for r in records if r.get("checkpointId") == ckpt_id), None)
        if match is None and cwd is not None:
            all_records = _collect_records(conversation_id=conversation_id, cwd=None)
            match = next((r for r in all_records if r.get("checkpointId") == ckpt_id), None)
        if match is None:
            raise RewindError(f"Checkpoint ID not found: {ckpt_id}", 2)
        snap_sha = match.get("snapshotSha", "")
        if not isinstance(snap_sha, str) or not SHA_RE.match(snap_sha):
            raise RewindError(
                f"Checkpoint {ckpt_id} has no restorable snapshotSha "
                f"(snapshotType={match.get('snapshotType', 'unknown')}).",
                2,
            )
        return snap_sha, match

    # --latest or default
    _ = latest_flag
    for rec in records:
        snap_sha = rec.get("snapshotSha", "")
        if isinstance(snap_sha, str) and SHA_RE.match(snap_sha):
            return snap_sha, rec
    raise RewindError("No restorable checkpoints found.", 2)


def _split_nul(stdout: str) -> list[str]:
    return [entry for entry in stdout.split("\x00") if entry]


def _capture_safety_snapshot(
    repo_root: pathlib.Path,
    conversation_id: str,
    target_ckpt_id: str,
    target_sha: str,
) -> tuple[str, str, str]:
    """Create a mandatory pre-restore-safety snapshot before mutating tracked files."""
    head_proc = _run_git(["rev-parse", "--verify", "HEAD"], repo_root)
    head_sha = head_proc.stdout.strip() if head_proc.returncode == 0 else ""
    if not SHA_RE.match(head_sha):
        head_sha = ""

    br_proc = _run_git(["rev-parse", "--abbrev-ref", "HEAD"], repo_root)
    branch = br_proc.stdout.strip() if br_proc.returncode == 0 else ""

    stash_proc = _run_git(["stash", "create"], repo_root)
    stash_sha = stash_proc.stdout.strip() if stash_proc.returncode == 0 else ""

    if stash_sha and SHA_RE.match(stash_sha):
        safety_sha = stash_sha
        safety_type = "stash-create"
    elif head_sha:
        safety_sha = head_sha
        safety_type = "head"
    else:
        safety_sha = ""
        safety_type = "unborn"

    ls_proc = _run_git(["ls-files", "--others", "--exclude-standard", "-z"], repo_root)
    untracked = _split_nul(ls_proc.stdout) if ls_proc.returncode == 0 else []

    safety_id = f"chk-safety-{uuid.uuid4().hex[:8]}"
    now_ts = time.time()
    record = {
        "schemaVersion": hook_state.SCHEMA_VERSION,
        "checkpointId": safety_id,
        "conversationId": hook_state.sanitize_conversation_id(conversation_id),
        "kind": "pre-restore-safety",
        "turnEpoch": 0,
        "stepIdx": 0,
        "timestamp": now_ts,
        "projectDir": str(repo_root),
        "branch": branch,
        "headSha": head_sha,
        "snapshotSha": safety_sha,
        "snapshotType": safety_type,
        "toolName": "cf-rewind",
        "targetSummary": f"before restore -> {target_ckpt_id or target_sha[:12]}",
        "untrackedSample": untracked[: hook_state.MAX_UNTRACKED_SAMPLE],
        "untrackedCount": len(untracked),
    }
    hook_state.append_checkpoint_record(conversation_id, record)
    return safety_id, safety_sha, safety_type


def cmd_list(args: argparse.Namespace) -> dict[str, Any]:
    limit = max(1, min(int(args.limit), 100))
    records = _collect_records(conversation_id=args.conversation_id, cwd=args.cwd)[:limit]
    return {
        "ok": True,
        "command": "list",
        "count": len(records),
        "limit": limit,
        "checkpoints": records,
    }


def cmd_diff(args: argparse.Namespace) -> dict[str, Any]:
    repo_root = _resolve_repo_root(args.cwd)
    sha, rec = _resolve_target(
        args.sha, args.id, args.latest, args.conversation_id, str(repo_root)
    )
    _validate_commit_object(sha, repo_root)
    git_args = ["diff", "--stat", sha] if args.stat else ["diff", sha]
    proc = _run_git(git_args, repo_root)
    if proc.returncode != 0:
        raise RewindError(f"git diff failed: {proc.stderr.strip()}", 1)
    return {
        "ok": True,
        "command": "diff",
        "sha": sha,
        "checkpointId": rec.get("checkpointId", "") if rec else "",
        "stat": bool(args.stat),
        "hasChanges": bool(proc.stdout.strip()),
        "diff": proc.stdout,
    }


def cmd_restore(args: argparse.Namespace) -> dict[str, Any]:
    repo_root = _resolve_repo_root(args.cwd)
    sha, rec = _resolve_target(
        args.sha, args.id, args.latest, args.conversation_id, str(repo_root)
    )
    _validate_commit_object(sha, repo_root)

    diff_proc = _run_git(["diff", "--name-only", "-z", sha], repo_root)
    if diff_proc.returncode != 0:
        raise RewindError(f"git diff failed: {diff_proc.stderr.strip()}", 1)
    changed_files = sorted(_split_nul(diff_proc.stdout))

    untracked_proc = _run_git(
        ["ls-files", "--others", "--exclude-standard", "-z"], repo_root
    )
    untracked = set(_split_nul(untracked_proc.stdout)) if untracked_proc.returncode == 0 else set()

    tracked_now_proc = _run_git(["ls-files", "-z"], repo_root)
    tracked_now = (
        set(_split_nul(tracked_now_proc.stdout)) if tracked_now_proc.returncode == 0 else set()
    )

    tracked_sha_proc = _run_git(["ls-tree", "-r", "--name-only", "-z", sha], repo_root)
    tracked_at_sha = (
        set(_split_nul(tracked_sha_proc.stdout)) if tracked_sha_proc.returncode == 0 else set()
    )

    post_checkpoint_tracked = tracked_now - tracked_at_sha
    untouched_files = sorted(untracked | post_checkpoint_tracked)

    if not args.apply:
        return {
            "ok": True,
            "command": "restore",
            "mode": "dry-run",
            "applied": False,
            "targetSha": sha,
            "checkpointId": rec.get("checkpointId", "") if rec else "",
            "wouldRestoreFiles": changed_files,
            "untouchedFiles": untouched_files,
        }

    safety_cid = (
        args.conversation_id
        or (rec.get("conversationId") if rec else None)
        or "default"
    )
    ckpt_id = rec.get("checkpointId", "") if rec else ""
    safety_id, safety_sha, safety_type = _capture_safety_snapshot(
        repo_root, safety_cid, ckpt_id, sha
    )

    # Restore tracked files present in <sha> without running git reset --hard or deleting untracked files.
    checkout_proc = _run_git(["checkout", sha, "--", "."], repo_root)
    if checkout_proc.returncode != 0:
        raise RewindError(
            f"git checkout failed: {checkout_proc.stderr.strip() or checkout_proc.stdout.strip()}",
            1,
        )

    try:
        hook_state.emit_sidecar_event(
            event_name="checkpoint_restored",
            conversation_id=safety_cid,
            project_dir=str(repo_root),
            hook="cf-rewind",
            tool_name="cf-rewind",
            status="ok",
            summary=f"Restored tracked files to {ckpt_id or sha[:12]} (safety={safety_id})",
            metadata={
                "targetSha": sha,
                "checkpointId": ckpt_id,
                "safetyCheckpointId": safety_id,
                "safetySnapshotSha": safety_sha,
                "restoredCount": len(changed_files),
                "untouchedCount": len(untouched_files),
            },
        )
    except Exception:
        pass

    return {
        "ok": True,
        "command": "restore",
        "mode": "apply",
        "applied": True,
        "targetSha": sha,
        "checkpointId": ckpt_id,
        "safetyCheckpointId": safety_id,
        "safetySnapshotSha": safety_sha,
        "safetySnapshotType": safety_type,
        "restoredFiles": changed_files,
        "untouchedFiles": untouched_files,
    }


def cmd_prune(args: argparse.Namespace) -> dict[str, Any]:
    dry_run = not bool(args.apply)
    summary = hook_state.prune_checkpoint_logs(
        max_age_hours=float(args.max_age_hours),
        max_per_conv=int(args.max_per_conv),
        dry_run=dry_run,
    )
    return {
        "ok": True,
        "command": "prune",
        **summary,
    }


def _format_human(result: dict[str, Any]) -> str:
    cmd = result.get("command")
    if cmd == "list":
        rows = result.get("checkpoints") or []
        if not rows:
            return "No checkpoints found."
        lines = [f"Checkpoints ({len(rows)}):"]
        for r in rows:
            ts = float(r.get("timestamp", 0.0))
            iso = datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).strftime(
                "%Y-%m-%d %H:%M:%SZ"
            )
            sha = (r.get("snapshotSha") or "")[:10] or "-"
            lines.append(
                f"  {r.get('checkpointId', '?')} | {r.get('kind', 'pre-turn')} | "
                f"{r.get('snapshotType', '?')} | {sha} | {iso} | {r.get('targetSummary', '')}"
            )
        return "\n".join(lines)

    if cmd == "diff":
        body = result.get("diff", "")
        if not body.strip():
            return f"No tracked differences against {result.get('sha', '')}."
        return body.rstrip("\n")

    if cmd == "restore":
        mode = result.get("mode", "dry-run")
        lines = [
            f"Restore ({mode}) -> targetSha={result.get('targetSha', '')} "
            f"checkpointId={result.get('checkpointId', '') or '-'}"
        ]
        if result.get("applied"):
            lines.append(
                f"  Safety snapshot: {result.get('safetyCheckpointId')} "
                f"({result.get('safetySnapshotType')}: {result.get('safetySnapshotSha') or '-'})"
            )
            lines.append(f"  Restored files: {len(result.get('restoredFiles') or [])}")
        else:
            lines.append(f"  Would restore files: {len(result.get('wouldRestoreFiles') or [])}")
        untouched = result.get("untouchedFiles") or []
        lines.append(f"  Untouched untracked/post-checkpoint files: {len(untouched)}")
        for f in untouched[:25]:
            lines.append(f"    - {f}")
        return "\n".join(lines)

    if cmd == "prune":
        return (
            f"Prune (dryRun={result.get('dryRun')}): scanned={result.get('scannedFiles')}, "
            f"removed={result.get('removedFiles')}, trimmedFiles={result.get('trimmedFiles')}, "
            f"trimmedRecords={result.get('trimmedRecords')}, kept={result.get('keptFiles')}"
        )

    return json.dumps(result, indent=2)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="rewind.py",
        description="Enterprise Code Factory cf-rewind git-shadow checkpoint CLI",
    )
    sub = parser.add_subparsers(dest="subcommand", required=True)

    p_list = sub.add_parser("list", help="List checkpoints newest-first")
    p_list.add_argument("--conversation-id", dest="conversation_id", default=None)
    p_list.add_argument("--cwd", default=None)
    p_list.add_argument("--limit", type=int, default=20)
    p_list.add_argument("--json", action="store_true")

    p_diff = sub.add_parser("diff", help="Diff working tree against a checkpoint")
    diff_sel = p_diff.add_mutually_exclusive_group()
    diff_sel.add_argument("--id", default=None)
    diff_sel.add_argument("--sha", default=None)
    diff_sel.add_argument("--latest", action="store_true")
    p_diff.add_argument("--conversation-id", dest="conversation_id", default=None)
    p_diff.add_argument("--cwd", default=None)
    p_diff.add_argument("--stat", action="store_true")
    p_diff.add_argument("--json", action="store_true")

    p_restore = sub.add_parser("restore", help="Restore tracked files from a checkpoint")
    res_sel = p_restore.add_mutually_exclusive_group()
    res_sel.add_argument("--id", default=None)
    res_sel.add_argument("--sha", default=None)
    res_sel.add_argument("--latest", action="store_true")
    res_mode = p_restore.add_mutually_exclusive_group()
    res_mode.add_argument("--dry-run", dest="dry_run", action="store_true")
    res_mode.add_argument("--apply", action="store_true")
    p_restore.add_argument("--conversation-id", dest="conversation_id", default=None)
    p_restore.add_argument("--cwd", default=None)
    p_restore.add_argument("--json", action="store_true")

    p_prune = sub.add_parser("prune", help="Prune stale or oversized checkpoint logs")
    p_prune.add_argument("--max-age-hours", dest="max_age_hours", type=float, default=168.0)
    p_prune.add_argument("--max-per-conv", dest="max_per_conv", type=int, default=200)
    prune_mode = p_prune.add_mutually_exclusive_group()
    prune_mode.add_argument("--dry-run", dest="dry_run", action="store_true")
    prune_mode.add_argument("--apply", action="store_true")
    p_prune.add_argument("--json", action="store_true")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    as_json = bool(getattr(args, "json", False))

    try:
        if args.subcommand == "list":
            result = cmd_list(args)
        elif args.subcommand == "diff":
            result = cmd_diff(args)
        elif args.subcommand == "restore":
            result = cmd_restore(args)
        elif args.subcommand == "prune":
            result = cmd_prune(args)
        else:
            raise RewindError(f"Unknown subcommand: {args.subcommand}", 2)
    except RewindError as exc:
        if as_json:
            print(json.dumps({"ok": False, "error": str(exc)}))
        else:
            print(f"Error: {exc}", file=sys.stderr)
        return exc.exit_code

    if as_json:
        print(json.dumps(result, indent=2))
    else:
        print(_format_human(result))
    return 0


def is_direct_execution() -> bool:
    """Symlink-safe direct execution check."""
    if __name__ != "__main__":
        return False
    if not sys.argv or not sys.argv[0]:
        return True
    try:
        return os.path.realpath(sys.argv[0]) == os.path.realpath(__file__)
    except OSError:
        return True


if is_direct_execution():
    raise SystemExit(main())
