#!/usr/bin/env python3
"""Enterprise Code Factory v3.0.0 PostToolUse state & <2s single-file lint bridge.

Per Antigravity's PostToolUse contract, this hook ALWAYS prints `{}` and exits 0.
On every matched tool completion (`write_file`, `edit_file`, `write_to_file`,
`replace_file_content`, `multi_replace_file_content`, `run_command`), it:
  1. Tracks consecutive identical tool failures for the PreInvocation loop-breaker.
  2. Tracks unverified source file edits vs. green verification commands for the
     bounded Stop gate.
  3. Runs a strictly bounded (<2s) single-file syntax/lint check on edited files
     and queues sanitized diagnostics into `$PLUGIN_DATA/conversations/<cid>.json`
     for PreInvocation injection (or clears stale diagnostics once fixed).
"""

from __future__ import annotations

import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import time
from typing import Any

HOOKS_DIR = str(pathlib.Path(__file__).resolve().parent)
if HOOKS_DIR not in sys.path:
    sys.path.insert(0, HOOKS_DIR)

import hook_state  # noqa: E402

WRITE_EDIT_TOOLS = {
    "write_file",
    "edit_file",
    "write_to_file",
    "replace_file_content",
    "multi_replace_file_content",
}

TRACKED_SOURCE_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".rb",
    ".php",
    ".cs",
    ".vue",
    ".svelte",
    ".sh",
}

EXCLUDED_DIRS = {
    ".memory",
    "plans",
    "docs",
    ".tmp",
    "node_modules",
    ".next",
}

JS_TS_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
NODE_CHECK_EXTENSIONS = {".js", ".mjs", ".cjs"}

DEFAULT_TIMEOUT_MS = 1800
MIN_TIMEOUT_MS = 200
MAX_TIMEOUT_MS = 2000
MAX_IN_PROCESS_FILE_BYTES = 1_048_576  # 1 MiB safety cap

ENV_ASSIGN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=\S*\s*")

# Matched strictly against unquoted, comment-stripped segment heads after
# removing leading VAR=VALUE assignments.
VERIFICATION_COMMAND_RE = re.compile(
    r"^(?:"
    r"(?:python3?|uv\s+run\s+python3?)\s+-m\s+(?:unittest|pytest|mypy|pyright|flake8|ruff)\b"
    r"|(?:uv\s+run\s+)?(?:pytest|ruff|mypy|pyright|flake8)\b"
    r"|(?:npx\s+|pnpm\s+(?:exec\s+)?|yarn\s+|bunx\s+|(?:\./)?node_modules/\.bin/)?(?:vitest|jest|mocha|tsc|eslint)\b"
    r"|node\s+--test\b"
    r"|(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:test|lint|typecheck|check|build|verify|arch:check|verify:map)(?::[\w-]+)?\b"
    r"|cargo\s+(?:test|check|clippy)\b"
    r"|go\s+test\b"
    r"|(?:(?:ba)?sh\s+)?(?:\S*/)?verify-stack\.sh\b"
    r"|(?:node\s+)?(?:\S*/)?(?:run-verify-map|audit-threejs|audit-geo-seo|validate-tokens)\.mjs\b"
    r")",
    re.IGNORECASE,
)


def _get_timeout_seconds() -> float:
    raw = os.environ.get("CF_POST_TOOL_TIMEOUT_MS", "").strip()
    if not raw:
        ms = DEFAULT_TIMEOUT_MS
    else:
        try:
            ms = int(raw)
        except ValueError:
            ms = DEFAULT_TIMEOUT_MS
    ms = max(MIN_TIMEOUT_MS, min(MAX_TIMEOUT_MS, ms))
    return ms / 1000.0


def _lint_disabled() -> bool:
    return os.environ.get("CF_POST_TOOL_LINT", "").strip().lower() == "off"


def _extract_file_path(args: dict[str, Any]) -> str:
    for key in ("Path", "TargetFile", "path", "target_file", "file_path", "FilePath"):
        val = args.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""


def _extract_command_line(args: dict[str, Any]) -> str:
    for key in ("CommandLine", "commandLine", "command_line"):
        val = args.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""


def compute_failure_signature(tool_name: str, target: str, error: str) -> str:
    """Build deterministic failure signature `f'{tool_name}:{sha256[:16]}'`."""
    normalized_tool = (tool_name or "unknown").strip()
    normalized_error = re.sub(r"\s+", " ", error.strip())[:80]
    raw_key = f"{normalized_tool}\n{target.strip()}\n{normalized_error}"
    digest = hashlib.sha256(raw_key.encode("utf-8", "replace")).hexdigest()[:16]
    return f"{normalized_tool}:{digest}"


def _extract_unquoted_segments(command_line: str) -> list[str]:
    """Split shell command into segments while stripping quoted literals and comments."""
    segments: list[str] = []
    buf: list[str] = []
    in_single = False
    in_double = False
    i = 0
    n = len(command_line)

    while i < n:
        ch = command_line[i]
        if in_single:
            if ch == "'":
                in_single = False
            i += 1
            continue
        if in_double:
            if ch == "\\" and i + 1 < n:
                i += 2
                continue
            if ch == '"':
                in_double = False
            i += 1
            continue

        if ch == "\\" and i + 1 < n:
            buf.append(command_line[i + 1])
            i += 2
            continue
        if ch == "'":
            in_single = True
            buf.append(" ")
            i += 1
            continue
        if ch == '"':
            in_double = True
            buf.append(" ")
            i += 1
            continue
        if ch == "#" and (not buf or buf[-1].isspace()):
            # Comment runs until newline.
            while i < n and command_line[i] != "\n":
                i += 1
            continue
        if command_line[i : i + 2] in ("&&", "||"):
            segments.append("".join(buf))
            buf = []
            i += 2
            continue
        if ch in (";", "|", "\n"):
            segments.append("".join(buf))
            buf = []
            i += 1
            continue

        buf.append(ch)
        i += 1

    if buf:
        segments.append("".join(buf))
    return segments


def is_verification_command(command_line: str) -> bool:
    """Return True iff any unquoted segment head is a recognized verification command."""
    if not command_line or not command_line.strip():
        return False

    for segment in _extract_unquoted_segments(command_line):
        head = segment.strip()
        while head:
            m = ENV_ASSIGN_RE.match(head)
            if not m:
                break
            head = head[m.end() :].lstrip()
        if not head:
            continue
        if VERIFICATION_COMMAND_RE.match(head):
            return True
    return False


def _resolve_target_file(
    file_path: str, project_dir: pathlib.Path | None
) -> tuple[pathlib.Path | None, str]:
    """Resolve target file inside project_dir, returning (resolved_path, rel_display)."""
    if not file_path:
        return None, ""
    raw_path = pathlib.Path(file_path).expanduser()
    if project_dir is not None:
        candidate = raw_path if raw_path.is_absolute() else (project_dir / raw_path)
        try:
            if candidate.is_symlink():
                return None, ""
            if not hook_state.is_within_directory(candidate, project_dir):
                return None, ""
            resolved = candidate.resolve()
            rel = resolved.relative_to(project_dir.resolve()).as_posix()
            return resolved, rel
        except (OSError, ValueError):
            return None, ""

    # Without project_dir we cannot guarantee canonical containment for lint,
    # but we still return a clean relative display string for source tracking.
    return None, raw_path.as_posix()


def _is_tracked_source_file(rel_path: str) -> bool:
    if not rel_path:
        return False
    p = pathlib.PurePosixPath(rel_path)
    if p.suffix.lower() not in TRACKED_SOURCE_EXTENSIONS:
        return False
    parent_parts = [part.lower() for part in p.parts[:-1]]
    if any(part in EXCLUDED_DIRS for part in parent_parts):
        return False
    return True


def _find_local_eslint(
    target_dir: pathlib.Path, project_dir: pathlib.Path
) -> tuple[pathlib.Path, pathlib.Path] | None:
    """Walk up from target_dir to project_dir looking for local node_modules/.bin/eslint."""
    resolved_root = project_dir.resolve()
    current = target_dir.resolve()
    while True:
        eslint_bin = current / "node_modules" / ".bin" / "eslint"
        try:
            if eslint_bin.exists() and eslint_bin.is_file() and os.access(eslint_bin, os.X_OK):
                return current, eslint_bin
        except OSError:
            pass
        if current == resolved_root or current.parent == current:
            break
        if not hook_state.is_within_directory(current.parent, resolved_root):
            break
        current = current.parent
    return None


def _run_subprocess_check(
    argv: list[str], cwd: pathlib.Path, timeout_s: float
) -> tuple[str, str]:
    """Run a single-file checker subprocess. Returns ('ok'|'error'|'skip', output)."""
    try:
        proc = subprocess.run(
            argv,
            cwd=str(cwd),
            shell=False,
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return "skip", ""

    if proc.returncode == 0:
        return "ok", ""
    combined = "\n".join(part for part in (proc.stdout, proc.stderr) if part and part.strip())
    summary = hook_state.sanitize_text(combined, max_chars=hook_state.MAX_FEEDBACK_SUMMARY_CHARS)
    if not summary:
        summary = f"exit status {proc.returncode}"
    return "error", summary


def run_single_file_check(
    target_file: pathlib.Path,
    project_dir: pathlib.Path,
    timeout_s: float,
) -> tuple[str, str, str]:
    """Run a single-file syntax/lint check.

    Returns (status, checker_name, summary) where status is 'ok', 'error', or 'skip'.
    """
    try:
        if (
            not target_file.exists()
            or target_file.is_symlink()
            or not target_file.is_file()
            or not hook_state.is_within_directory(target_file, project_dir)
        ):
            return "skip", "", ""
    except OSError:
        return "skip", "", ""

    suffix = target_file.suffix.lower()

    if suffix == ".py":
        try:
            if target_file.stat().st_size > MAX_IN_PROCESS_FILE_BYTES:
                return "skip", "", ""
            source = target_file.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return "skip", "", ""
        try:
            compile(source, str(target_file), "exec")
        except SyntaxError as exc:
            lineno = exc.lineno or "?"
            detail = exc.msg or "syntax error"
            return (
                "error",
                "python-syntax",
                hook_state.sanitize_text(
                    f"line {lineno}: {detail}",
                    max_chars=hook_state.MAX_FEEDBACK_SUMMARY_CHARS,
                ),
            )
        ruff_bin = shutil.which("ruff")
        if ruff_bin:
            status, summary = _run_subprocess_check(
                [ruff_bin, "check", "--no-fix", "--quiet", str(target_file)],
                cwd=project_dir,
                timeout_s=timeout_s,
            )
            if status == "error":
                return "error", "ruff", summary
            if status == "skip":
                return "skip", "", ""
        return "ok", "python-syntax", ""

    if suffix in JS_TS_EXTENSIONS:
        found = _find_local_eslint(target_file.parent, project_dir)
        if found is not None:
            pkg_root, eslint_bin = found
            status, summary = _run_subprocess_check(
                [
                    str(eslint_bin),
                    "--no-warn-ignored",
                    "--max-warnings=0",
                    "--format",
                    "stylish",
                    str(target_file),
                ],
                cwd=pkg_root,
                timeout_s=timeout_s,
            )
            return status, "eslint", summary
        if suffix in NODE_CHECK_EXTENSIONS:
            node_bin = shutil.which("node")
            if node_bin:
                status, summary = _run_subprocess_check(
                    [node_bin, "--check", str(target_file)],
                    cwd=project_dir,
                    timeout_s=timeout_s,
                )
                return status, "node-syntax", summary
        return "skip", "", ""

    if suffix == ".json":
        try:
            if target_file.stat().st_size > MAX_IN_PROCESS_FILE_BYTES:
                return "skip", "", ""
            source = target_file.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return "skip", "", ""
        try:
            json.loads(source)
        except json.JSONDecodeError as exc:
            return (
                "error",
                "json-syntax",
                hook_state.sanitize_text(
                    f"line {exc.lineno}, col {exc.colno}: {exc.msg}",
                    max_chars=hook_state.MAX_FEEDBACK_SUMMARY_CHARS,
                ),
            )
        return "ok", "json-syntax", ""

    if suffix == ".sh":
        bash_bin = shutil.which("bash")
        if bash_bin:
            status, summary = _run_subprocess_check(
                [bash_bin, "-n", str(target_file)],
                cwd=project_dir,
                timeout_s=timeout_s,
            )
            return status, "bash-syntax", summary
        return "skip", "", ""

    return "skip", "", ""


def process_post_tool(payload: dict[str, Any], now: float | None = None) -> None:
    """Process a PostToolUse payload and persist updates atomically."""
    conversation_id = payload.get("conversationId")
    tool_call = payload.get("toolCall") or payload.get("tool_call") or {}
    if not isinstance(tool_call, dict):
        tool_call = {}
    tool_name = str(tool_call.get("name") or "").strip()
    args = tool_call.get("args") or {}
    if not isinstance(args, dict):
        args = {}

    raw_error = payload.get("error")
    error_str = raw_error.strip() if isinstance(raw_error, str) and raw_error.strip() else ""

    file_path = _extract_file_path(args) if tool_name in WRITE_EDIT_TOOLS else ""
    command_line = _extract_command_line(args) if tool_name == "run_command" else ""
    project_dir = hook_state.resolve_project_dir(payload)
    now_ts = float(time.time() if now is None else now)

    # Run bounded single-file check OUTSIDE the state file lock.
    resolved_file: pathlib.Path | None = None
    rel_file_path = ""
    check_status = "skip"
    checker_name = ""
    check_summary = ""

    if not error_str and tool_name in WRITE_EDIT_TOOLS and file_path:
        resolved_file, rel_file_path = _resolve_target_file(file_path, project_dir)
        if resolved_file is not None and project_dir is not None and not _lint_disabled():
            check_status, checker_name, check_summary = run_single_file_check(
                resolved_file, project_dir, _get_timeout_seconds()
            )

    verified_now = (
        not error_str
        and tool_name == "run_command"
        and is_verification_command(command_line)
    )
    failure_target = command_line if tool_name == "run_command" else file_path
    failure_sig = (
        compute_failure_signature(tool_name, failure_target, error_str) if error_str else ""
    )

    def _mutate(state: dict[str, Any]) -> None:
        # 1. Runaway failure streak tracking.
        if error_str:
            if state.get("lastFailureSignature") == failure_sig:
                state["consecutiveFailures"] = int(state.get("consecutiveFailures", 0)) + 1
            else:
                state["consecutiveFailures"] = 1
                state["lastFailureSignature"] = failure_sig
        else:
            state["consecutiveFailures"] = 0
            state["lastFailureSignature"] = ""

        # 2. Edited source file vs. green verification tracking.
        if not error_str and tool_name in WRITE_EDIT_TOOLS and rel_file_path:
            if _is_tracked_source_file(rel_file_path):
                edited = list(state.get("editedSourceFiles") or [])
                if rel_file_path not in edited:
                    edited.append(rel_file_path)
                state["editedSourceFiles"] = edited[-hook_state.MAX_EDITED_SOURCE_FILES :]
                state["needsVerification"] = True
                state["stopContinuationCount"] = 0
        elif verified_now:
            state["editedSourceFiles"] = []
            state["needsVerification"] = False
            state["stopContinuationCount"] = 0
            state["lastVerifiedAt"] = now_ts
            state["lastVerificationCommand"] = hook_state.sanitize_text(
                command_line, max_chars=256
            )

        # 3. Single-file syntax/lint diagnostic queue upsert or clear.
        if rel_file_path and check_status == "error":
            existing = [
                item
                for item in (state.get("pendingFeedback") or [])
                if isinstance(item, dict) and item.get("filePath") != rel_file_path
            ]
            existing.append(
                {
                    "toolName": tool_name,
                    "filePath": rel_file_path,
                    "status": "error",
                    "checker": checker_name,
                    "summary": check_summary,
                    "timestamp": now_ts,
                }
            )
            state["pendingFeedback"] = existing[-hook_state.MAX_PENDING_FEEDBACK :]
        elif rel_file_path and check_status == "ok":
            state["pendingFeedback"] = [
                item
                for item in (state.get("pendingFeedback") or [])
                if isinstance(item, dict) and item.get("filePath") != rel_file_path
            ]

    hook_state.update_state(conversation_id, _mutate, now=now_ts)


def main() -> int:
    try:
        raw = sys.stdin.read()
        if raw.strip():
            payload = json.loads(raw)
            if isinstance(payload, dict):
                process_post_tool(payload)
    except Exception:
        pass
    print("{}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
