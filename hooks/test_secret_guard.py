#!/usr/bin/env python3
"""Unit tests for the Enterprise Code Factory PreToolUse secret & leak guard."""

import importlib.util
import json
import pathlib
import subprocess
import sys
import time
import unittest

SCRIPT_PATH = pathlib.Path(__file__).resolve().parent / "secret-guard.py"
SPEC = importlib.util.spec_from_file_location("secret_guard", SCRIPT_PATH)
assert SPEC and SPEC.loader
secret_guard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(secret_guard)


class TestSecretGuard(unittest.TestCase):
    def test_benign_writes_are_allowed(self) -> None:
        benign_cases = [
            (
                "src/app/api/courses/route.ts",
                "const key = process.env.SUPABASE_SERVICE_ROLE_KEY;\nexport const maxDuration = 10;",
            ),
            (
                "src/components/Button.tsx",
                "'use client';\nconst url = process.env.NEXT_PUBLIC_SUPABASE_URL;\nexport function Button() { return null; }",
            ),
            (
                ".env.example",
                "NEXT_PUBLIC_SUPABASE_URL=\nSUPABASE_SERVICE_ROLE_KEY=\nNEXT_PUBLIC_WEBHOOK_SECRET=\n",
            ),
            (
                "docs/security.md",
                "Never put NEXT_PUBLIC_API_SECRET or SUPABASE_SERVICE_ROLE_KEY in browser bundles.",
            ),
            (
                "src/lib/db.ts",
                "const local = 'postgresql://postgres:localdevpass@localhost:5432/app';",
            ),
            (
                "src/lib/empty.ts",
                "",
            ),
        ]
        for path, content in benign_cases:
            with self.subTest(path=path):
                self.assertEqual(secret_guard.evaluate_write(path, content), {"decision": "allow"})

    def test_hardcoded_credentials_are_denied(self) -> None:
        # Synthesize test patterns dynamically so no static secret scanner flags this test file.
        pem_block = "-----BEGIN " + "RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"
        aws_key = "AKIA" + "IOSFODNN7EXAMPLE"
        gh_token = "ghp_" + ("A" * 36)
        stripe_key = "sk_" + "live_" + ("9" * 24)
        anthropic_key = "sk-" + "ant-" + ("x" * 24)
        google_key = "AIza" + ("B" * 35)
        slack_token = "xoxb-" + "1234567890-abcdef"
        remote_db = "postgresql://admin:" + "SuperSecret99" + "@prod-db.supabase.co:5432/postgres"

        cases = [
            ("src/config.ts", pem_block, "private key block"),
            ("src/aws.ts", f"export const KEY = '{aws_key}';", "AWS access key ID"),
            ("scripts/ci.sh", f"TOKEN={gh_token}", "GitHub personal/OAuth token"),
            ("src/billing.ts", f"const stripe = '{stripe_key}';", "Stripe live secret key"),
            ("src/ai.ts", f"const k = '{anthropic_key}';", "Anthropic API key"),
            ("src/maps.ts", f"const g = '{google_key}';", "Google API key"),
            ("src/notify.ts", f"const s = '{slack_token}';", "Slack token"),
            ("src/db.ts", f"const url = '{remote_db}';", "hardcoded remote database URL"),
            ("README.md", f"Accidental paste: {stripe_key}", "Stripe live secret key"),
        ]
        for path, content, expected in cases:
            with self.subTest(path=path, expected=expected):
                res = secret_guard.evaluate_write(path, content)
                self.assertEqual(res.get("decision"), "deny")
                self.assertIn(expected, res.get("reason", ""))

    def test_next_public_secret_env_leaks_are_denied(self) -> None:
        cases = [
            ("src/env.ts", "export const s = process.env.NEXT_PUBLIC_STRIPE_SECRET;"),
            ("src/client.tsx", "const k = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;"),
            (".env.local", "NEXT_PUBLIC_DATABASE_URL=postgres://user:pass@localhost/db"),
            ("src/config.ts", "const w = import.meta.env.VITE_WEBHOOK_SECRET;"),
        ]
        for path, content in cases:
            with self.subTest(path=path):
                res = secret_guard.evaluate_write(path, content)
                self.assertEqual(res.get("decision"), "deny")
                self.assertIn("client bundles", res.get("reason", ""))

    def test_supabase_service_role_in_client_code_is_denied(self) -> None:
        cases = [
            (
                "src/app/dashboard/Panel.tsx",
                "'use client';\nconst k = process.env.SUPABASE_SERVICE_ROLE_KEY;",
            ),
            (
                "src/components/AdminTable.tsx",
                "const role = process.env.SUPABASE_SERVICE_ROLE_KEY;",
            ),
            (
                "src/client/supabase.ts",
                "createClient(url, service_role);",
            ),
        ]
        for path, content in cases:
            with self.subTest(path=path):
                res = secret_guard.evaluate_write(path, content)
                self.assertEqual(res.get("decision"), "deny")
                self.assertIn("service_role", res.get("reason", "").lower())

    def test_extract_write_args_supports_all_tool_schemas(self) -> None:
        # write_file schema
        p1, c1 = secret_guard.extract_write_args(
            {"toolCall": {"name": "write_file", "args": {"Path": "a.ts", "Content": "hello"}}}
        )
        self.assertEqual((p1, c1), ("a.ts", "hello"))

        # edit_file schema
        p2, c2 = secret_guard.extract_write_args(
            {"toolCall": {"name": "edit_file", "args": {"Path": "b.ts", "Replacement": "world"}}}
        )
        self.assertEqual((p2, c2), ("b.ts", "world"))

        # multi_replace_file_content schema
        p3, c3 = secret_guard.extract_write_args(
            {
                "toolCall": {
                    "name": "multi_replace_file_content",
                    "args": {
                        "TargetFile": "c.tsx",
                        "ReplacementChunks": [
                            {"ReplacementContent": "'use client';"},
                            {"ReplacementContent": "const x = process.env.SUPABASE_SERVICE_ROLE_KEY;"},
                        ],
                    },
                }
            }
        )
        self.assertEqual(p3, "c.tsx")
        self.assertEqual(secret_guard.evaluate_write(p3, c3).get("decision"), "deny")

    def test_cli_stdin_stdout_contract_and_latency(self) -> None:
        payload = {
            "hookEventName": "PreToolUse",
            "toolCall": {
                "id": "toolu_secret_01",
                "name": "write_file",
                "args": {
                    "Path": "src/components/Auth.tsx",
                    "Content": "'use client';\nexport const s = process.env.NEXT_PUBLIC_JWT_SECRET;",
                },
            },
        }
        start = time.perf_counter()
        proc = subprocess.run(
            [sys.executable, str(SCRIPT_PATH)],
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            check=True,
        )
        elapsed_ms = (time.perf_counter() - start) * 1000
        out = json.loads(proc.stdout)
        self.assertEqual(out["decision"], "deny")
        # Pure in-process evaluation must be well under 20ms; full subprocess under 500ms.
        t0 = time.perf_counter()
        secret_guard.evaluate_write("src/components/Auth.tsx", payload["toolCall"]["args"]["Content"])
        eval_ms = (time.perf_counter() - t0) * 1000
        self.assertLess(eval_ms, 20.0, f"In-process eval took {eval_ms:.2f}ms")
        self.assertLess(elapsed_ms, 500.0, f"Subprocess took {elapsed_ms:.2f}ms")

    def test_invalid_json_fails_closed_to_ask(self) -> None:
        proc = subprocess.run(
            [sys.executable, str(SCRIPT_PATH)],
            input="{invalid json",
            text=True,
            capture_output=True,
            check=True,
        )
        out = json.loads(proc.stdout)
        self.assertEqual(out["decision"], "ask")


if __name__ == "__main__":
    unittest.main()
