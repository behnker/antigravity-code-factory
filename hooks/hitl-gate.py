#!/usr/bin/env python3
"""Enterprise Code Factory HITL PreToolUse safety gate for run_command.

Forces explicit human confirmation (force_ask) whenever a shell command matches
high-impact operations defined in Blueprint Section 4.5 (git push, package
publish, recursive force delete, container push, cluster apply, or database
migrations). Benign commands pass through with {} so Antigravity's normal
sandbox and permission policies remain in control.
"""

from __future__ import annotations

import json
import re
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


def evaluate_command(command_line: str, bypass_sandbox: bool = False) -> dict[str, Any]:
    """Return a PreToolUse hook decision dict for the given command line.

    Antigravity's PreToolUse contract requires an explicit `decision`
    ("allow", "deny", "ask", or "force_ask"); an empty dict fails closed.
    """
    if command_line and command_line.strip():
        for label, pattern in HIGH_IMPACT_PATTERNS:
            if pattern.search(command_line):
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

    return {"decision": "allow"}


def extract_tool_args(payload: dict[str, Any]) -> tuple[str, bool]:
    """Extract (command_line, bypass_sandbox) from a PreToolUse hook stdin payload."""
    tool_call = payload.get("toolCall") or payload.get("tool_call") or {}
    args = tool_call.get("args") or {}
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
    result = evaluate_command(cmd, bypass_sandbox=bypass_sandbox)
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
