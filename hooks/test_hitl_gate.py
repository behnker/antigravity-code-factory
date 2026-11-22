#!/usr/bin/env python3
"""Unit tests for the Enterprise Code Factory HITL PreToolUse safety gate."""

import importlib.util
import json
import pathlib
import subprocess
import sys
import unittest

SCRIPT_PATH = pathlib.Path(__file__).resolve().parent / "hitl-gate.py"
SPEC = importlib.util.spec_from_file_location("hitl_gate", SCRIPT_PATH)
assert SPEC and SPEC.loader
hitl_gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(hitl_gate)


class TestHitlGate(unittest.TestCase):
    def test_benign_commands_pass_through(self) -> None:
        benign = [
            "git status -s",
            "git diff --stat",
            "npm test -- --coverage",
            "pytest -q",
            "npx eslint src/",
            "cargo check",
            "rm -f /tmp/temp.txt",
            "git commit -m 'prepare push fix'",
            "",
        ]
        for cmd in benign:
            with self.subTest(cmd=cmd):
                self.assertEqual(hitl_gate.evaluate_command(cmd), {"decision": "allow"})

    def test_bypass_sandbox_benign_command_asks(self) -> None:
        res = hitl_gate.evaluate_command("curl https://example.com", bypass_sandbox=True)
        self.assertEqual(res.get("decision"), "ask")

    def test_high_impact_commands_require_force_ask(self) -> None:
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
            ("db migration execute --env staging", "database migration"),
            ("npx prisma migrate deploy", "database migration"),
            ("alembic upgrade head", "database migration"),
        ]
        for cmd, expected_label in dangerous:
            with self.subTest(cmd=cmd):
                res = hitl_gate.evaluate_command(cmd)
                self.assertEqual(res.get("decision"), "force_ask")
                self.assertIn(expected_label, res.get("reason", ""))

    def test_cli_stdin_stdout_contract(self) -> None:
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

    def test_invalid_json_fails_closed_to_ask(self) -> None:
        proc = subprocess.run(
            [sys.executable, str(SCRIPT_PATH)],
            input="{not valid json",
            text=True,
            capture_output=True,
            check=True,
        )
        out = json.loads(proc.stdout)
        self.assertEqual(out["decision"], "ask")


if __name__ == "__main__":
    unittest.main()
