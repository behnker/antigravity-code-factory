#!/usr/bin/env python3
"""Enterprise Code Factory PreToolUse secret & client-bundle leak guard.

Fast (<20ms) pure-stdlib Python guard for file write/edit tool calls.
Blocks writes ("deny") when content contains:
  1. Hardcoded live credentials or private key blocks (AWS, GitHub, Stripe,
     Anthropic, Google API, Slack, PEM private keys, or non-local DB URLs with
     inline passwords).
  2. Next.js / Vite public client env variables exposing secret-named values
     (e.g. NEXT_PUBLIC_*SECRET*, NEXT_PUBLIC_*SERVICE_ROLE*,
     NEXT_PUBLIC_*PRIVATE_KEY*, NEXT_PUBLIC_*DATABASE_URL*).
  3. Supabase `service_role` / `SUPABASE_SERVICE_ROLE_KEY` references inside
     client-side/browser code ('use client' modules or client UI directories).

Benign edits return {"decision": "allow"} with minimal latency. Malformed or
unparseable stdin payloads fail closed to {"decision": "ask"}.
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
from typing import Any

# Extensions treated as executable source/config where client-leak checks apply.
CODE_AND_ENV_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".vue",
    ".svelte",
    ".json",
    ".toml",
    ".yaml",
    ".yml",
    ".py",
    ".sh",
}

CLIENT_CODE_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".vue",
    ".svelte",
}

CLIENT_DIR_MARKERS = {
    "components",
    "client",
    "public",
    "browser",
    "ui",
}

ENV_EXAMPLE_MARKERS = (".example", ".sample", ".template", ".dist")

# 1. Hardcoded live credential patterns (blocked in ALL file types, including docs).
CREDENTIAL_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "private key block",
        re.compile(
            r"-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+|PGP\s+)?PRIVATE\s+KEY-----"
        ),
    ),
    ("AWS access key ID", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("GitHub personal/OAuth token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b")),
    ("GitHub fine-grained PAT", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{22,}\b")),
    ("Stripe live secret key", re.compile(r"\b[sr]k_live_[A-Za-z0-9]{20,}\b")),
    ("Anthropic API key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("Slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    (
        "hardcoded remote database URL with credentials",
        re.compile(
            r"\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?)://"
            r"[^:\s\"'`/]+:[^@\s\"'`${}<>]{8,}@"
            r"(?!localhost\b|127\.0\.0\.1\b|0\.0\.0\.0\b|example\.com\b|db\.example\b|host\b)"
            r"[A-Za-z0-9._-]+",
            re.IGNORECASE,
        ),
    ),
]

# 2. Next.js / Vite public env variable names that must never carry server secrets.
PUBLIC_SECRET_ENV_RE = re.compile(
    r"\b(?:NEXT_PUBLIC_|VITE_)[A-Z0-9_]*(?:"
    r"SECRET|PRIVATE_KEY|SERVICE_ROLE|DATABASE_URL|DB_PASSWORD|"
    r"ADMIN_KEY|SIGNING_KEY|WEBHOOK_SECRET|ACCESS_TOKEN"
    r")[A-Z0-9_]*\b"
)

# 3. Supabase service_role references (forbidden in browser/client bundles).
USE_CLIENT_RE = re.compile(r"""^\s*['"]use client['"]\s*;?""", re.MULTILINE)
SERVICE_ROLE_RE = re.compile(
    r"\b(?:SUPABASE_SERVICE_ROLE_KEY|service_role)\b",
    re.IGNORECASE,
)


def _is_env_file(path_obj: pathlib.Path) -> bool:
    name = path_obj.name.lower()
    return name == ".env" or name.startswith(".env.")


def _is_env_example(path_obj: pathlib.Path) -> bool:
    name = path_obj.name.lower()
    return _is_env_file(path_obj) and any(marker in name for marker in ENV_EXAMPLE_MARKERS)


def _is_self_hook_file(path_obj: pathlib.Path) -> bool:
    """Allow edits to secret-guard.py itself (contains pattern definitions, not live secrets)."""
    parts = [p.lower() for p in path_obj.parts]
    return path_obj.name.lower() == "secret-guard.py" and "hooks" in parts


def _is_client_path(path_obj: pathlib.Path) -> bool:
    parts = [p.lower() for p in path_obj.parts]
    # Server-only route handlers or API paths are not browser bundles.
    if "api" in parts or "server" in parts:
        return False
    return any(marker in parts for marker in CLIENT_DIR_MARKERS)


def evaluate_write(file_path: str, content: str) -> dict[str, Any]:
    """Evaluate a proposed file write/edit and return a PreToolUse decision dict."""
    if not content:
        return {"decision": "allow"}

    path_obj = pathlib.Path(file_path) if file_path else pathlib.Path("")
    if file_path and _is_self_hook_file(path_obj):
        return {"decision": "allow"}

    # Check 1: Hardcoded live credentials / private keys (always blocked).
    for label, pattern in CREDENTIAL_PATTERNS:
        if pattern.search(content):
            return {
                "decision": "deny",
                "reason": (
                    f"Enterprise Code Factory Secret Guard: blocked write to '{file_path or '<unknown>'}' "
                    f"because content matches '{label}'. Move credentials to environment variables "
                    f"(or construct synthetic test tokens dynamically in unit tests)."
                ),
            }

    suffix = path_obj.suffix.lower()
    is_code_or_env = suffix in CODE_AND_ENV_EXTENSIONS or _is_env_file(path_obj)
    if not is_code_or_env:
        return {"decision": "allow"}

    # Check 2: NEXT_PUBLIC_* / VITE_* secret-named env vars in code or non-example .env files.
    if not _is_env_example(path_obj):
        pub_match = PUBLIC_SECRET_ENV_RE.search(content)
        if pub_match:
            return {
                "decision": "deny",
                "reason": (
                    f"Enterprise Code Factory Secret Guard: blocked write to '{file_path or '<unknown>'}' "
                    f"because '{pub_match.group(0)}' exposes a server-only secret to client bundles. "
                    f"Remove the NEXT_PUBLIC_/VITE_ prefix and access it strictly on the server."
                ),
            }

    # Check 3: Supabase service_role usage in client-side code.
    if suffix in CLIENT_CODE_EXTENSIONS:
        is_client = bool(USE_CLIENT_RE.search(content)) or _is_client_path(path_obj)
        if is_client:
            sr_match = SERVICE_ROLE_RE.search(content)
            if sr_match:
                return {
                    "decision": "deny",
                    "reason": (
                        f"Enterprise Code Factory Secret Guard: blocked write to client module "
                        f"'{file_path or '<unknown>'}' referencing '{sr_match.group(0)}'. "
                        f"Supabase service_role keys must never enter client/browser code."
                    ),
                }

    return {"decision": "allow"}


def extract_write_args(payload: dict[str, Any]) -> tuple[str, str]:
    """Extract (file_path, combined_written_content) across Antigravity write/edit tool schemas."""
    tool_call = payload.get("toolCall") or payload.get("tool_call") or {}
    args = tool_call.get("args") or {}
    if not isinstance(args, dict):
        return "", ""

    file_path = (
        args.get("Path")
        or args.get("TargetFile")
        or args.get("path")
        or args.get("target_file")
        or ""
    )
    if not isinstance(file_path, str):
        file_path = ""

    chunks: list[str] = []
    for key in ("Content", "Replacement", "CodeContent", "ReplacementContent", "content", "replacement"):
        val = args.get(key)
        if isinstance(val, str) and val:
            chunks.append(val)

    rep_chunks = args.get("ReplacementChunks") or args.get("replacement_chunks")
    if isinstance(rep_chunks, list):
        for chunk in rep_chunks:
            if isinstance(chunk, dict):
                rc = chunk.get("ReplacementContent") or chunk.get("replacement_content")
                if isinstance(rc, str) and rc:
                    chunks.append(rc)

    return file_path, "\n".join(chunks)


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print(json.dumps({"decision": "ask", "reason": "Empty PreToolUse secret-guard payload."}))
        return 0

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        print(
            json.dumps(
                {
                    "decision": "ask",
                    "reason": "Enterprise Code Factory Secret Guard: unable to parse hook payload; requesting confirmation.",
                }
            )
        )
        return 0

    if not isinstance(payload, dict):
        print(json.dumps({"decision": "ask", "reason": "Unexpected PreToolUse secret-guard payload type."}))
        return 0

    file_path, content = extract_write_args(payload)
    result = evaluate_write(file_path, content)
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
