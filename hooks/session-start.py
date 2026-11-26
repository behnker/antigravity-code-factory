#!/usr/bin/env python3
"""Enterprise Code Factory v3.0.0 SessionStart auto-hydration hook.

Reads bounded workspace memory (`.memory/handover.md` <= 3 KB, optional
`.memory/auto-memory.md` <= 200 lines & <= 3 KB) and current short Git status
(`git --no-pager status --short --branch` with a 1.0s timeout), then injects a
compact `[Code Factory SessionStart]` systemMessage (<= 8192 bytes).

Fails open (`{}` exit 0) on malformed stdin or repositories without `.memory/`.
"""

from __future__ import annotations

import json
import pathlib
import subprocess
import sys
from typing import Any

HOOKS_DIR = str(pathlib.Path(__file__).resolve().parent)
if HOOKS_DIR not in sys.path:
    sys.path.insert(0, HOOKS_DIR)

import hook_state  # noqa: E402

MAX_HANDOVER_BYTES = 3072
MAX_AUTO_MEMORY_BYTES = 3072
MAX_AUTO_MEMORY_LINES = 200
MAX_GIT_STATUS_LINES = 30
MAX_GIT_STATUS_CHARS = 1200
MAX_TOTAL_MESSAGE_BYTES = 8192
MAX_READ_BYTES = 65536
GIT_STATUS_TIMEOUT_S = 1.0


def _truncate_utf8_bytes(text: str, max_bytes: int, notice: str = "") -> str:
    """Truncate text so its UTF-8 encoding does not exceed max_bytes."""
    raw = text.encode("utf-8", "replace")
    if len(raw) <= max_bytes:
        return text
    notice_bytes = notice.encode("utf-8", "replace")
    budget = max(0, max_bytes - len(notice_bytes))
    clipped = raw[:budget].decode("utf-8", "ignore").rstrip()
    result = clipped + notice
    while len(result.encode("utf-8", "replace")) > max_bytes and len(clipped) > 0:
        clipped = clipped[:-1]
        result = clipped + notice
    if len(result.encode("utf-8", "replace")) > max_bytes:
        return notice_bytes[:max_bytes].decode("utf-8", "ignore")
    return result


def _read_bounded_memory_file(
    file_path: pathlib.Path,
    project_dir: pathlib.Path,
    max_bytes: int,
    max_lines: int | None = None,
    truncation_notice: str = "\n...[truncated]",
) -> str:
    """Safely read a regular non-symlink file inside project_dir with strict caps."""
    try:
        if not file_path.exists() or file_path.is_symlink() or not file_path.is_file():
            return ""
        if not hook_state.is_within_directory(file_path, project_dir):
            return ""
        with file_path.open("rb") as fh:
            raw_bytes = fh.read(MAX_READ_BYTES + 1)
    except OSError:
        return ""

    if not raw_bytes:
        return ""

    truncated = len(raw_bytes) > MAX_READ_BYTES
    text = raw_bytes[:MAX_READ_BYTES].decode("utf-8", "replace")
    sanitized = hook_state.sanitize_text(text, max_chars=0)
    if not sanitized:
        return ""

    if max_lines is not None:
        lines = sanitized.splitlines()
        if len(lines) > max_lines:
            sanitized = "\n".join(lines[:max_lines]).rstrip()
            truncated = True

    if len(sanitized.encode("utf-8", "replace")) > max_bytes:
        return _truncate_utf8_bytes(sanitized, max_bytes, truncation_notice)

    if truncated:
        return _truncate_utf8_bytes(
            sanitized + truncation_notice, max_bytes, truncation_notice
        )

    return sanitized


def _collect_git_status(project_dir: pathlib.Path) -> str:
    """Run `git --no-pager status --short --branch` with a 1.0s cap."""
    try:
        proc = subprocess.run(
            ["git", "--no-pager", "status", "--short", "--branch"],
            cwd=str(project_dir),
            shell=False,
            capture_output=True,
            text=True,
            timeout=GIT_STATUS_TIMEOUT_S,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return ""

    if proc.returncode != 0 or not proc.stdout:
        return ""

    sanitized = hook_state.sanitize_text(proc.stdout, max_chars=MAX_GIT_STATUS_CHARS * 2)
    if not sanitized:
        return ""

    lines = sanitized.splitlines()
    if len(lines) > MAX_GIT_STATUS_LINES:
        lines = lines[:MAX_GIT_STATUS_LINES] + [
            f"...({len(lines) - MAX_GIT_STATUS_LINES} more lines truncated)"
        ]
    joined = "\n".join(lines)
    if len(joined) > MAX_GIT_STATUS_CHARS:
        joined = joined[: MAX_GIT_STATUS_CHARS - 3].rstrip() + "..."
    return joined


def build_session_start_response(payload: dict[str, Any]) -> dict[str, Any]:
    """Build the SessionStart hook response dict from a parsed payload."""
    try:
        hook_state.prune_stale_states()
    except OSError:
        pass

    project_dir = hook_state.resolve_project_dir(payload)
    if project_dir is None:
        return {}

    memory_dir = project_dir / ".memory"
    try:
        if (
            not memory_dir.exists()
            or memory_dir.is_symlink()
            or not memory_dir.is_dir()
            or not hook_state.is_within_directory(memory_dir, project_dir)
        ):
            return {}
    except OSError:
        return {}

    handover = _read_bounded_memory_file(
        memory_dir / "handover.md",
        project_dir=project_dir,
        max_bytes=MAX_HANDOVER_BYTES,
        max_lines=None,
        truncation_notice="\n...[truncated to 3 KB]",
    )
    auto_memory = _read_bounded_memory_file(
        memory_dir / "auto-memory.md",
        project_dir=project_dir,
        max_bytes=MAX_AUTO_MEMORY_BYTES,
        max_lines=MAX_AUTO_MEMORY_LINES,
        truncation_notice="\n...[truncated]",
    )
    git_status = _collect_git_status(project_dir)

    sections: list[str] = []
    if handover:
        sections.append(f"## Handover (.memory/handover.md)\n{handover}")
    if auto_memory:
        sections.append(f"## Auto-Memory (.memory/auto-memory.md)\n{auto_memory}")
    if git_status:
        sections.append(f"## Git Status\n{git_status}")

    if not sections:
        return {}

    message = "[Code Factory SessionStart]\n" + "\n\n".join(sections)
    message = _truncate_utf8_bytes(
        message, MAX_TOTAL_MESSAGE_BYTES, "\n...[session context truncated to 8 KB]"
    )
    return {
        "injectSteps": [
            {
                "systemMessage": {
                    "systemMessage": message,
                }
            }
        ]
    }


def main() -> int:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print("{}")
            return 0
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            print("{}")
            return 0
        response = build_session_start_response(payload)
        print(json.dumps(response))
    except Exception:
        print("{}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
