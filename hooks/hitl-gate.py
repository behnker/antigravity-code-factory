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


def evaluate_command(command_line: str) -> dict[str, Any]:
    """Return a PreToolUse hook decision dict for the given command line."""
    if not command_line or not command_line.strip():
        return {}

    for label, pattern in HIGH_IMPACT_PATTERNS:
        if pattern.search(command_line):
            return {
                "decision": "force_ask",
                "reason": (
                    f"Enterprise Code Factory HITL Safety Gate: command matches "
                    f"'{label}', which always requires explicit human confirmation."
                ),
            }

    return {}


def extract_command_line(payload: dict[str, Any]) -> str:
    """Extract the command line from a PreToolUse hook stdin payload."""
    tool_call = payload.get("toolCall") or payload.get("tool_call") or {}
    args = tool_call.get("args") or {}
    cmd = args.get("CommandLine") or args.get("commandLine") or args.get("command_line") or ""
    return cmd if isinstance(cmd, str) else ""


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print("{}")
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
        print("{}")
        return 0

    result = evaluate_command(extract_command_line(payload))
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
