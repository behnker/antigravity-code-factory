#!/usr/bin/env python3
"""Pure Python 3 stdlib validator for Enterprise Code Factory workflows/.

Verifies each bundled workflow's workflow.json schema structure and compiles
entry workflow.py scripts using ast.PyCF_ALLOW_TOP_LEVEL_AWAIT while ensuring
zero non-stdlib local module imports.
"""

from __future__ import annotations

import argparse
import ast
import json
import pathlib
import re
import sys
from typing import Any

WORKFLOWS_ROOT = pathlib.Path(__file__).resolve().parent
EXPECTED_WORKFLOWS = ("cf-qa-gate", "cf-implement-spec")
NAME_RE = re.compile(r"\A[a-z0-9-]+\Z")


def _check_stdlib_imports(tree: ast.AST) -> list[str]:
    errors: list[str] = []
    stdlib_names = sys.stdlib_module_names
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root_pkg = alias.name.split(".", 1)[0]
                if root_pkg not in stdlib_names:
                    errors.append(
                        f"Non-stdlib import '{alias.name}' forbidden in run_workflow scripts"
                    )
        elif isinstance(node, ast.ImportFrom):
            if node.level and node.level > 0:
                errors.append("Relative imports forbidden in run_workflow scripts")
                continue
            mod = node.module or ""
            root_pkg = mod.split(".", 1)[0]
            if root_pkg not in stdlib_names:
                errors.append(
                    f"Non-stdlib import 'from {mod}' forbidden in run_workflow scripts"
                )
    return errors


def _validate_args_schema(schema: Any, workflow_name: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(schema, dict):
        return ["'args' must be a JSON Schema object"]
    if schema.get("type") != "object":
        errors.append("'args.type' must be 'object'")
    props = schema.get("properties")
    if not isinstance(props, dict) or not props:
        errors.append("'args.properties' must be a non-empty object")
    req = schema.get("required")
    if not isinstance(req, list) or not all(isinstance(r, str) for r in req):
        errors.append("'args.required' must be an array of strings")
    elif isinstance(props, dict):
        missing_props = [r for r in req if r not in props]
        if missing_props:
            errors.append(
                f"'args.required' references missing properties: {missing_props}"
            )
    if not isinstance(schema.get("additionalProperties"), bool):
        errors.append("'args.additionalProperties' must be a boolean")

    if workflow_name == "cf-implement-spec" and isinstance(props, dict):
        parts = props.get("partitions")
        if not isinstance(parts, dict) or parts.get("maxItems", 99) > 5:
            errors.append("'cf-implement-spec' args.properties.partitions.maxItems must be <= 5")

    return errors


def validate_workflow_dir(wf_dir: pathlib.Path) -> dict[str, Any]:
    """Validate a single workflow directory (workflow.json + entry workflow.py)."""
    errors: list[str] = []
    manifest_path = wf_dir / "workflow.json"
    if not manifest_path.exists() or manifest_path.is_symlink() or not manifest_path.is_file():
        return {
            "name": wf_dir.name,
            "ok": False,
            "errors": [f"Missing or invalid workflow.json in {wf_dir}"],
        }

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {
            "name": wf_dir.name,
            "ok": False,
            "errors": [f"Failed to parse workflow.json: {exc}"],
        }

    if not isinstance(manifest, dict):
        return {
            "name": wf_dir.name,
            "ok": False,
            "errors": ["workflow.json root must be a JSON object"],
        }

    for field in ("name", "displayName", "version", "description", "entry", "args"):
        if field not in manifest:
            errors.append(f"Missing required manifest field: {field!r}")

    wf_name = manifest.get("name")
    if not isinstance(wf_name, str) or not NAME_RE.match(wf_name):
        errors.append(f"Invalid workflow name: {wf_name!r}")
    elif wf_name != wf_dir.name:
        errors.append(
            f"Manifest name {wf_name!r} does not match directory {wf_dir.name!r}"
        )

    errors.extend(_validate_args_schema(manifest.get("args"), str(wf_name or "")))

    if wf_name == "cf-qa-gate":
        out_schema = manifest.get("outputSchema")
        if not isinstance(out_schema, dict) or out_schema.get("type") != "object":
            errors.append("'cf-qa-gate' requires an object outputSchema")
        elif "verdict" not in (out_schema.get("required") or []):
            errors.append("'cf-qa-gate' outputSchema.required must include 'verdict'")

    entry_rel = manifest.get("entry")
    if not isinstance(entry_rel, str) or not entry_rel.endswith(".py"):
        errors.append(f"Invalid entry script: {entry_rel!r}")
        return {"name": wf_dir.name, "ok": False, "errors": errors}

    entry_path = wf_dir / entry_rel
    try:
        if (
            not entry_path.exists()
            or entry_path.is_symlink()
            or not entry_path.is_file()
            or entry_path.resolve().parent != wf_dir.resolve()
        ):
            errors.append(f"Entry script missing or escaped workflow dir: {entry_path}")
            return {"name": wf_dir.name, "ok": False, "errors": errors}
        source = entry_path.read_text(encoding="utf-8")
    except OSError as exc:
        errors.append(f"Failed to read entry script {entry_path}: {exc}")
        return {"name": wf_dir.name, "ok": False, "errors": errors}

    try:
        compile(source, str(entry_path), "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
        tree = ast.parse(source, filename=str(entry_path))
    except SyntaxError as exc:
        errors.append(f"SyntaxError in {entry_rel} line {exc.lineno}: {exc.msg}")
        return {"name": wf_dir.name, "ok": False, "errors": errors}

    errors.extend(_check_stdlib_imports(tree))

    has_top_level_await = any(
        isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Await)
        for stmt in tree.body
    )
    if not has_top_level_await:
        errors.append(f"{entry_rel} must end with a top-level await invocation")

    return {
        "name": wf_dir.name,
        "entry": str(entry_path),
        "ok": len(errors) == 0,
        "errors": errors,
    }


def validate_all(workflows_root: pathlib.Path = WORKFLOWS_ROOT) -> dict[str, Any]:
    """Validate all bundled workflows under workflows_root."""
    results: list[dict[str, Any]] = []
    discovered: set[str] = set()

    if not workflows_root.exists() or not workflows_root.is_dir():
        return {
            "ok": False,
            "workflows": [],
            "errors": [f"Workflows root not found: {workflows_root}"],
        }

    for entry in sorted(workflows_root.iterdir()):
        if entry.is_dir() and not entry.name.startswith((".", "_")):
            discovered.add(entry.name)
            results.append(validate_workflow_dir(entry))

    missing_expected = [name for name in EXPECTED_WORKFLOWS if name not in discovered]
    root_errors = [f"Missing expected bundled workflow: {name}" for name in missing_expected]
    all_ok = (not root_errors) and bool(results) and all(r["ok"] for r in results)
    return {"ok": all_ok, "workflows": results, "errors": root_errors}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate bundled Enterprise Code Factory run_workflow pipelines"
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON summary")
    parser.add_argument(
        "--root",
        default=str(WORKFLOWS_ROOT),
        help="Workflows directory root to validate",
    )
    args = parser.parse_args(argv)
    report = validate_all(pathlib.Path(args.root))
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        for wf in report["workflows"]:
            status = "PASS" if wf["ok"] else "FAIL"
            print(f"[{status}] {wf['name']}")
            for err in wf["errors"]:
                print(f"  - {err}")
        for err in report["errors"]:
            print(f"[FAIL] {err}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
