#!/usr/bin/env python3
"""Unit tests for the Enterprise Code Factory HITL PreToolUse safety gate."""

from __future__ import annotations

import importlib.util
import json
import os
import pathlib
import subprocess
import sys
import unittest
from unittest import mock

SCRIPT_PATH = pathlib.Path(__file__).resolve().parent / "hitl-gate.py"
SPEC = importlib.util.spec_from_file_location("hitl_gate", SCRIPT_PATH)
assert SPEC and SPEC.loader
hitl_gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(hitl_gate)


class TestHitlGate(unittest.TestCase):
    def test_benign_non_rewritten_commands_pass_through(self) -> None:
        benign = [
            "npm test -- --coverage",
            "pytest -q",
            "npx eslint src/",
            "cargo check",
            "rm -f /tmp/temp.txt",
            "wrangler dev",
            "npx wrangler types",
            "npx wrangler deploy --dry-run",
            "vercel dev",
            "npx vercel build",
            "vercel deploy",
            "supabase status",
            "supabase start",
            "npx supabase db diff",
            "npx supabase db push --dry-run",
            "terraform plan",
            "",
        ]
        for cmd in benign:
            with self.subTest(cmd=cmd):
                self.assertEqual(hitl_gate.evaluate_command(cmd), {"decision": "allow"})

    def test_benign_git_commands_allow_with_no_pager_overwrite(self) -> None:
        cases = [
            ("git status -s", "git --no-pager status -s"),
            ("git diff --stat", "git --no-pager diff --stat"),
            ("git commit -m 'prepare push fix'", "git --no-pager commit -m 'prepare push fix'"),
            ("/usr/bin/git log -n 5", "/usr/bin/git --no-pager log -n 5"),
            ("FOO=bar git status", "FOO=bar git --no-pager status"),
            ("git status -- --help", "git --no-pager status -- --help"),
        ]
        for cmd, expected in cases:
            with self.subTest(cmd=cmd):
                res = hitl_gate.evaluate_command(cmd)
                self.assertEqual(
                    res,
                    {
                        "decision": "allow",
                        "overwrite": {"CommandLine": expected},
                    },
                )

    def test_benign_curl_commands_allow_with_max_time_overwrite(self) -> None:
        cases = [
            ("curl https://example.com", "curl --max-time 5 https://example.com"),
            ("curl -sSL https://example.com/api", "curl --max-time 5 -sSL https://example.com/api"),
            ("/usr/bin/curl -I https://example.com", "/usr/bin/curl --max-time 5 -I https://example.com"),
            ("DEBUG=1 curl -s https://example.com", "DEBUG=1 curl --max-time 5 -s https://example.com"),
            (
                "git status && curl -s https://example.com | head -n 5",
                "git --no-pager status && curl --max-time 5 -s https://example.com | head -n 5",
            ),
        ]
        for cmd, expected in cases:
            with self.subTest(cmd=cmd):
                res = hitl_gate.evaluate_command(cmd)
                self.assertEqual(
                    res,
                    {
                        "decision": "allow",
                        "overwrite": {"CommandLine": expected},
                    },
                )

    def test_overwrite_exclusions_and_opt_out(self) -> None:
        # Already has paging / timeout / info flags, env overrides, subshells, or quoted commands.
        no_rewrite = [
            "git --no-pager status",
            "git -p log",
            "git --paginate diff",
            "git --exec-path",
            "git --exec-path=/tmp/bin status",
            "git -h",
            "git --help",
            "git --version",
            "GIT_PAGER=cat git log -n 3",
            "GIT_PAGER='less -FRX' git diff",
            "curl --max-time 10 https://example.com",
            "curl --max-time=10 https://example.com",
            "curl -m 3 https://example.com",
            "curl -m3 https://example.com",
            "curl -sSm 4 https://example.com",
            "curl -sSm4 https://example.com",
            "curl -h",
            "curl --help",
            "curl -V",
            "curl --version",
            'echo "curl https://example.com"',
            "python3 -c \"print('git status')\"",
            'echo "a | git status"',
            "echo $(git status)",
            "echo `curl https://example.com`",
            "(git status)",
            "{ git status; }",
            "git status\ncurl https://example.com",
            "cat <<EOF\ngit status\nEOF",
            'git commit -m "unbalanced quote',
        ]
        for cmd in no_rewrite:
            with self.subTest(cmd=cmd):
                res = hitl_gate.evaluate_command(cmd)
                self.assertEqual(res, {"decision": "allow"})
                self.assertNotIn("overwrite", res)

        # Opt-out via CF_HITL_OVERWRITE=off (case-insensitive).
        for env_val in ("off", "OFF", "Off"):
            with mock.patch.dict(os.environ, {"CF_HITL_OVERWRITE": env_val}):
                self.assertEqual(hitl_gate.evaluate_command("git status"), {"decision": "allow"})
                self.assertEqual(
                    hitl_gate.evaluate_command("curl https://example.com"),
                    {"decision": "allow"},
                )

    def test_bypass_sandbox_benign_command_asks_without_overwrite(self) -> None:
        res = hitl_gate.evaluate_command("curl https://example.com", bypass_sandbox=True)
        self.assertEqual(res.get("decision"), "ask")
        self.assertNotIn("overwrite", res)

        res_git = hitl_gate.evaluate_command("git status", bypass_sandbox=True)
        self.assertEqual(res_git.get("decision"), "ask")
        self.assertNotIn("overwrite", res_git)

    def test_high_impact_commands_require_force_ask_without_overwrite(self) -> None:
        dangerous = [
            ("git push origin main", "git push"),
            ("git -C repo push --force", "git push"),
            ("npm test && git push origin feat/x", "git push"),
            ("npm publish --access public", "npm/yarn/pnpm publish"),
            ("pnpm publish", "npm/yarn/pnpm publish"),
            ("rm -rf ./dist", "rm -rf"),
            ("rm -fr /tmp/build", "rm -rf"),
            ("docker push ghcr.io/org/app:latest", "docker/podman push"),
            ("kubectl apply -f k8s/prod.yaml", "kubectl apply/delete"),
            ("kubectl delete pod api-0", "kubectl apply/delete"),
            ("npx wrangler deploy", "cloudflare deploy/delete"),
            ("npx wrangler deploy --dry-run && npx wrangler deploy", "cloudflare deploy/delete"),
            ("wrangler d1 migrations apply prod-db --remote", "cloudflare deploy/delete"),
            ("cf deploy", "cloudflare deploy/delete"),
            ("vercel --prod", "vercel production deploy/delete"),
            ("npx vercel deploy --prod", "vercel production deploy/delete"),
            ("vercel env rm SECRET_KEY production", "vercel production deploy/delete"),
            ("supabase db push", "supabase deploy/db mutation"),
            ("supabase db reset", "supabase deploy/db mutation"),
            ("npx supabase functions deploy webhook-handler", "supabase deploy/db mutation"),
            ("terraform apply -auto-approve", "terraform apply/destroy"),
            ("terraform destroy", "terraform apply/destroy"),
            ("gh repo delete behnker/old-repo --yes", "github repo delete"),
            ("db migration execute --env staging", "database migration"),
            ("npx prisma migrate deploy", "database migration"),
            ("alembic upgrade head", "database migration"),
        ]
        for cmd, expected_label in dangerous:
            with self.subTest(cmd=cmd):
                res = hitl_gate.evaluate_command(cmd)
                self.assertEqual(res.get("decision"), "force_ask")
                self.assertIn(expected_label, res.get("reason", ""))
                self.assertNotIn("overwrite", res)

    def test_cli_stdin_stdout_contract_and_arg_key_preservation(self) -> None:
        payload = {
            "hookEventName": "PreToolUse",
            "toolCall": {
                "id": "toolu_01",
                "name": "run_command",
                "args": {"CommandLine": "git push origin main"},
            },
        }
        proc = subprocess.run(
            [sys.executable, str(SCRIPT_PATH)],
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            check=True,
        )
        out = json.loads(proc.stdout)
        self.assertEqual(out["decision"], "force_ask")
        self.assertNotIn("overwrite", out)

        for key in ("CommandLine", "commandLine", "command_line"):
            with self.subTest(arg_key=key):
                allow_payload = {
                    "hookEventName": "PreToolUse",
                    "toolCall": {
                        "id": "toolu_02",
                        "name": "run_command",
                        "args": {key: "curl -s https://example.com"},
                    },
                }
                proc2 = subprocess.run(
                    [sys.executable, str(SCRIPT_PATH)],
                    input=json.dumps(allow_payload),
                    text=True,
                    capture_output=True,
                    check=True,
                )
                out2 = json.loads(proc2.stdout)
                self.assertEqual(out2["decision"], "allow")
                self.assertEqual(
                    out2["overwrite"],
                    {key: "curl --max-time 5 -s https://example.com"},
                )

    def test_invalid_empty_and_non_dict_json_fails_closed_to_ask(self) -> None:
        for bad_input in ("{not valid json", "", "   ", '["not", "a", "dict"]'):
            with self.subTest(bad_input=bad_input):
                proc = subprocess.run(
                    [sys.executable, str(SCRIPT_PATH)],
                    input=bad_input,
                    text=True,
                    capture_output=True,
                    check=True,
                )
                out = json.loads(proc.stdout)
                self.assertEqual(out["decision"], "ask")
                self.assertNotIn("overwrite", out)


if __name__ == "__main__":
    unittest.main()
