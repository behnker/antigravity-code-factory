#!/usr/bin/env python3
"""Enterprise Code Factory HITL PreToolUse safety gate for run_command.

Forces explicit human confirmation (force_ask) whenever a shell command matches
high-impact operations (git push, package publish, recursive force delete,
container push, cluster apply, cloud/DB mutations, or database migrations).
Requests confirmation (ask) when BypassSandbox is set or input is malformed.
For allowed commands, transparently injects non-blocking safety defaults via
Antigravity's PreToolUse `overwrite` contract (`--no-pager` on `git`,
`--max-time 5` on `curl`) unless disabled via `CF_HITL_OVERWRITE=off` or
excluded by conservative shell safety guards.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import sys
from typing import Any

# Each entry: (label, compiled regex)
HIGH_IMPACT_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "git push",
        re.compile(
            r"(?:^|[\s;&|()])git\s+(?:(?:-[cC]\s+\S+|--git-dir(?:=|\s+)\S+|--work-tree(?:=|\s+)\S+|-[^\s]+)\s+)*push(?:\s|$)",
            re.IGNORECASE,
        ),
    ),
    ("npm/yarn/pnpm publish", re.compile(r"(?:^|[\s;&|()])(?:npm|yarn|pnpm)\s+publish(?:\s|$)", re.IGNORECASE)),
    ("rm -rf", re.compile(r"(?:^|[\s;&|()])rm\s+(?:-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|--recursive\s+--force|--force\s+--recursive)(?:\s|$)")),
    ("docker/podman push", re.compile(r"(?:^|[\s;&|()])(?:docker|podman)\s+push(?:\s|$)", re.IGNORECASE)),
    ("kubectl apply/delete", re.compile(r"(?:^|[\s;&|()])kubectl\s+(?:apply|delete|replace|patch)(?:\s|$)", re.IGNORECASE)),
    (
        "cloudflare deploy/delete",
        re.compile(
            r"(?:^|[\s;&|()])(?:"
            r"(?:npx\s+)?wrangler\s+(?:deploy|publish|delete|d1\s+migrations\s+apply)|"
            r"cf\s+deploy"
            r")(?:\s|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "vercel production deploy/delete",
        re.compile(
            r"(?:^|[\s;&|()])(?:npx\s+)?vercel\s+(?:"
            r"(?:deploy\s+)?(?:[^\n;&|]*\s)?--prod\b|"
            r"(?:rm|remove)\b|"
            r"env\s+rm\b"
            r")",
            re.IGNORECASE,
        ),
    ),
    (
        "supabase deploy/db mutation",
        re.compile(
            r"(?:^|[\s;&|()])(?:npx\s+)?supabase\s+(?:"
            r"db\s+(?:push|reset)|"
            r"functions\s+deploy|"
            r"migration\s+up"
            r")(?:\s|$)",
            re.IGNORECASE,
        ),
    ),
    (
        "terraform apply/destroy",
        re.compile(r"(?:^|[\s;&|()])terraform\s+(?:apply|destroy)(?:\s|$)", re.IGNORECASE),
    ),
    (
        "github repo delete",
        re.compile(r"(?:^|[\s;&|()])gh\s+repo\s+delete(?:\s|$)", re.IGNORECASE),
    ),
    (
        "database migration",
        re.compile(
            r"(?:^|[\s;&|()])(?:"
            r"db\s+migration\s+execute|"
            r"(?:npx\s+)?prisma\s+migrate\s+(?:deploy|reset)|"
            r"alembic\s+(?:upgrade|downgrade)|"
            r"drizzle-kit\s+(?:push|migrate)|"
            r"knex\s+migrate:(?:latest|up|down|rollback)|"
            r"typeorm\s+migration:(?:run|revert)|"
            r"rails\s+db:migrate|"
            r"flyway\s+migrate|"
            r"liquibase\s+update"
            r")(?:\s|$)",
            re.IGNORECASE,
        ),
    ),
]


# Patterns where --dry-run on the same command segment makes the invocation read-only.
DRY_RUN_EXEMPT_LABELS = {
    "cloudflare deploy/delete",
    "supabase deploy/db mutation",
}

SEGMENT_SPLITTER = re.compile(r"(?:&&|\|\||[;\n|])")
DRY_RUN_FLAG = re.compile(r"(?:^|\s)--dry-run(?:\s|$)", re.IGNORECASE)

# Shell metacharacters / multiline constructs that disqualify automatic overwrite.
OVERWRITE_UNSAFE_TOKENS: tuple[str, ...] = (
    "$(",
    "`",
    "<<",
    "(",
    ")",
    "{",
    "}",
    "\n",
    "\r",
    "\x00",
)

ENV_ASSIGN_PREFIX_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")

GIT_SKIP_FLAGS = {
    "--no-pager",
    "-p",
    "--paginate",
    "--exec-path",
    "-h",
    "--help",
    "--version",
}

CURL_SKIP_FLAGS = {
    "--max-time",
    "-m",
    "-h",
    "--help",
    "-V",
    "--version",
}


def _split_top_level_segments(command_line: str) -> list[tuple[int, int]] | None:
    """Split command_line on unquoted &&, ||, ;, | returning (start, end) offsets.

    Returns None if single/double quotes or trailing escapes are unbalanced.
    """
    segments: list[tuple[int, int]] = []
    in_single = False
    in_double = False
    seg_start = 0
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
            if ch == "\\":
                if i + 1 >= n:
                    return None
                i += 2
                continue
            if ch == '"':
                in_double = False
            i += 1
            continue

        if ch == "\\":
            if i + 1 >= n:
                return None
            i += 2
            continue
        if ch == "'":
            in_single = True
            i += 1
            continue
        if ch == '"':
            in_double = True
            i += 1
            continue

        if command_line[i : i + 2] in ("&&", "||"):
            segments.append((seg_start, i))
            i += 2
            seg_start = i
            continue
        if ch in (";", "|"):
            segments.append((seg_start, i))
            i += 1
            seg_start = i
            continue

        i += 1

    if in_single or in_double:
        return None

    segments.append((seg_start, n))
    return segments


def _locate_command_token(segment: str) -> tuple[set[str], str, int] | None:
    """Skip leading whitespace and VAR=VALUE env assignments in a segment.

    Returns (env_var_names, raw_cmd_token, cmd_end_idx) or None if no command
    token is found or quoting is malformed.
    """
    env_vars: set[str] = set()
    i = 0
    n = len(segment)

    while i < n:
        while i < n and segment[i].isspace():
            i += 1
        if i >= n:
            return None

        tok_start = i
        in_single = False
        in_double = False
        while i < n:
            ch = segment[i]
            if in_single:
                if ch == "'":
                    in_single = False
                i += 1
                continue
            if in_double:
                if ch == "\\":
                    if i + 1 >= n:
                        return None
                    i += 2
                    continue
                if ch == '"':
                    in_double = False
                i += 1
                continue
            if ch == "\\":
                if i + 1 >= n:
                    return None
                i += 2
                continue
            if ch == "'":
                in_single = True
                i += 1
                continue
            if ch == '"':
                in_double = True
                i += 1
                continue
            if ch.isspace():
                break
            i += 1

        if in_single or in_double:
            return None

        raw_token = segment[tok_start:i]
        if ENV_ASSIGN_PREFIX_RE.match(raw_token):
            var_name = raw_token.split("=", 1)[0]
            env_vars.add(var_name)
            continue

        return env_vars, raw_token, i

    return None


def _match_target_executable(raw_cmd: str) -> str | None:
    """Match only unquoted git/curl commands (bare name or path ending in /git or /curl)."""
    if not raw_cmd or any(q in raw_cmd for q in ("'", '"', "\\")):
        return None
    if raw_cmd == "git" or (raw_cmd.endswith("/git") and not raw_cmd.startswith("-")):
        return "git"
    if raw_cmd == "curl" or (raw_cmd.endswith("/curl") and not raw_cmd.startswith("-")):
        return "curl"
    return None


def _should_skip_git(env_vars: set[str], args_before_dd: list[str]) -> bool:
    if "GIT_PAGER" in env_vars:
        return True
    for arg in args_before_dd:
        if arg in GIT_SKIP_FLAGS or arg.startswith("--exec-path="):
            return True
    return False


def _should_skip_curl(args_before_dd: list[str]) -> bool:
    for arg in args_before_dd:
        if arg in CURL_SKIP_FLAGS or arg.startswith("--max-time="):
            return True
        if arg.startswith("-") and not arg.startswith("--") and len(arg) > 1:
            if "m" in arg[1:]:
                return True
    return False


def compute_command_overwrite(command_line: str) -> str | None:
    """Return a transparently rewritten command line, or None if no rewrite applies.

    Injects `--no-pager` after `git` and `--max-time 5` after `curl` via exact
    character-offset splicing while leaving all other tokens, quoting, spacing,
    and redirects untouched.
    """
    if os.environ.get("CF_HITL_OVERWRITE", "").strip().lower() == "off":
        return None
    if not command_line or not command_line.strip():
        return None
    if any(tok in command_line for tok in OVERWRITE_UNSAFE_TOKENS):
        return None

    segments = _split_top_level_segments(command_line)
    if segments is None:
        return None

    splices: list[tuple[int, str]] = []
    for seg_start, seg_end in segments:
        segment = command_line[seg_start:seg_end]
        if not segment.strip():
            continue

        located = _locate_command_token(segment)
        if located is None:
            continue
        env_vars, raw_cmd, cmd_end_in_seg = located

        target = _match_target_executable(raw_cmd)
        if target is None:
            continue

        trailing = segment[cmd_end_in_seg:]
        try:
            trailing_tokens = shlex.split(trailing)
        except ValueError:
            return None

        args_before_dd: list[str] = []
        for tok in trailing_tokens:
            if tok == "--":
                break
            args_before_dd.append(tok)

        if target == "git":
            if _should_skip_git(env_vars, args_before_dd):
                continue
            splices.append((seg_start + cmd_end_in_seg, " --no-pager"))
        elif target == "curl":
            if _should_skip_curl(args_before_dd):
                continue
            splices.append((seg_start + cmd_end_in_seg, " --max-time 5"))

    if not splices:
        return None

    rewritten = command_line
    for offset, insertion in reversed(splices):
        rewritten = rewritten[:offset] + insertion + rewritten[offset:]

    return rewritten if rewritten != command_line else None


def evaluate_command(
    command_line: str,
    bypass_sandbox: bool = False,
    arg_key: str = "CommandLine",
) -> dict[str, Any]:
    """Return a PreToolUse hook decision dict for the given command line.

    Antigravity's PreToolUse contract requires an explicit `decision`
    ("allow", "deny", "ask", or "force_ask"); an empty dict fails closed.
    """
    if command_line and command_line.strip():
        for segment in SEGMENT_SPLITTER.split(command_line):
            seg = segment.strip()
            if not seg:
                continue
            is_dry_run = bool(DRY_RUN_FLAG.search(seg))
            for label, pattern in HIGH_IMPACT_PATTERNS:
                if pattern.search(seg):
                    if is_dry_run and label in DRY_RUN_EXEMPT_LABELS:
                        continue
                    return {
                        "decision": "force_ask",
                        "reason": (
                            f"Enterprise Code Factory HITL Safety Gate: command matches "
                            f"'{label}', which always requires explicit human confirmation."
                        ),
                    }

    if bypass_sandbox:
        return {
            "decision": "ask",
            "reason": "Command requested execution outside the sandbox.",
        }

    rewritten = compute_command_overwrite(command_line)
    if rewritten is not None:
        key = arg_key if arg_key in ("CommandLine", "commandLine", "command_line") else "CommandLine"
        return {
            "decision": "allow",
            "overwrite": {key: rewritten},
        }

    return {"decision": "allow"}


def extract_command_arg_key(payload: dict[str, Any]) -> str:
    """Return the original command argument key present in the toolCall args."""
    tool_call = payload.get("toolCall") or payload.get("tool_call") or {}
    args = tool_call.get("args") or {}
    if isinstance(args, dict):
        for key in ("CommandLine", "commandLine", "command_line"):
            if key in args and isinstance(args[key], str):
                return key
    return "CommandLine"


def extract_tool_args(payload: dict[str, Any]) -> tuple[str, bool]:
    """Extract (command_line, bypass_sandbox) from a PreToolUse hook stdin payload."""
    tool_call = payload.get("toolCall") or payload.get("tool_call") or {}
    args = tool_call.get("args") or {}
    if not isinstance(args, dict):
        return "", False
    cmd = args.get("CommandLine") or args.get("commandLine") or args.get("command_line") or ""
    bypass = bool(
        args.get("BypassSandbox")
        or args.get("bypassSandbox")
        or args.get("bypass_sandbox")
    )
    return (cmd if isinstance(cmd, str) else ""), bypass


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print(json.dumps({"decision": "ask", "reason": "Empty PreToolUse hook payload."}))
        return 0

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        # Fail closed to an explicit ask if payload cannot be parsed safely.
        print(
            json.dumps(
                {
                    "decision": "ask",
                    "reason": "Enterprise Code Factory HITL Safety Gate: unable to parse hook payload; requesting confirmation.",
                }
            )
        )
        return 0

    if not isinstance(payload, dict):
        print(json.dumps({"decision": "ask", "reason": "Unexpected PreToolUse hook payload type."}))
        return 0

    cmd, bypass_sandbox = extract_tool_args(payload)
    arg_key = extract_command_arg_key(payload)
    result = evaluate_command(cmd, bypass_sandbox=bypass_sandbox, arg_key=arg_key)
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
