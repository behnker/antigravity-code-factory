"""Enterprise Code Factory Stage 4 QA Gate (run_workflow pipeline).

Self-contained top-level-await workflow script (zero local repo imports).
Orchestrates parallel decoupled cf-reviewer, cf-tester, and optional 3-viewport
browser audit (<= 3 concurrent agents), producing a strict SHIP/BLOCK verdict.
"""
# ruff: noqa: F821

from __future__ import annotations

import json
import pathlib
import re
from typing import Any

_ALLOWED_ARG_KEYS = frozenset(
    {"target_dir", "spec_path", "verify_cmd", "preview_url", "run_browser_audit"}
)
_PREVIEW_URL_RE = re.compile(r"\Ahttps?://[A-Za-z0-9._-]+(:[0-9]+)?(/.*)?\Z")
_REQUIRED_VIEWPORTS = (375, 768, 1440)


def _validate_rel_path(value: str, field_name: str) -> str:
    if "\x00" in value or not value.strip():
        raise ValueError(f"{field_name} must be a non-empty path")
    parts = pathlib.PurePosixPath(value.replace("\\", "/")).parts
    if ".." in parts:
        raise ValueError(f"{field_name} must not contain '..' traversal")
    return value.strip()


def validate_qa_args(raw_args: Any) -> dict[str, Any]:
    """Fail-closed validation matching workflows/cf-qa-gate/workflow.json."""
    if not isinstance(raw_args, dict):
        raise ValueError("args must be a JSON object")

    unknown = sorted(set(raw_args.keys()) - _ALLOWED_ARG_KEYS)
    if unknown:
        raise ValueError(f"Unsupported arg(s): {', '.join(unknown)}")

    verify_cmd = raw_args.get("verify_cmd")
    if (
        not isinstance(verify_cmd, str)
        or not verify_cmd.strip()
        or len(verify_cmd) > 400
    ):
        raise ValueError("verify_cmd must be a non-empty string (<= 400 chars)")

    target_dir_raw = raw_args.get("target_dir", ".")
    if not isinstance(target_dir_raw, str):
        raise ValueError("target_dir must be a string")
    target_dir = _validate_rel_path(target_dir_raw, "target_dir")

    spec_path: str | None = None
    if "spec_path" in raw_args and raw_args["spec_path"] is not None:
        raw_spec = raw_args["spec_path"]
        if not isinstance(raw_spec, str):
            raise ValueError("spec_path must be a string")
        spec_path = _validate_rel_path(raw_spec, "spec_path")

    preview_url: str | None = None
    if "preview_url" in raw_args and raw_args["preview_url"] is not None:
        raw_url = raw_args["preview_url"]
        if not isinstance(raw_url, str) or not _PREVIEW_URL_RE.match(raw_url):
            raise ValueError("preview_url must match ^https?://[host](:port)?(/...)?$")
        preview_url = raw_url

    run_browser_audit = raw_args.get("run_browser_audit", False)
    if not isinstance(run_browser_audit, bool):
        raise ValueError("run_browser_audit must be a boolean")

    return {
        "target_dir": target_dir,
        "spec_path": spec_path,
        "verify_cmd": verify_cmd.strip(),
        "preview_url": preview_url,
        "run_browser_audit": run_browser_audit,
    }


def _clean_str_list(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        if isinstance(item, str):
            text = item.strip()
            if text and text not in seen:
                seen.add(text)
                out.append(text)
    return out


def synthesize_qa_verdict(
    review: dict[str, Any] | None,
    tests: dict[str, Any] | None,
    browser_res: dict[str, Any] | None,
    validated_args: dict[str, Any],
) -> dict[str, Any]:
    """Synthesize reviewer, tester, and optional browser results into SHIP/BLOCK."""
    blocking: list[str] = []
    non_blocking: list[str] = []

    review_obj = review if isinstance(review, dict) else {}
    tests_obj = tests if isinstance(tests, dict) else {}

    review_status = str(review_obj.get("status", "BLOCK")).upper()
    blocking.extend(_clean_str_list(review_obj.get("blocking_defects")))
    non_blocking.extend(_clean_str_list(review_obj.get("non_blocking")))
    if review_status != "SHIP" and not blocking:
        blocking.append("cf-reviewer did not issue SHIP status")

    checks_passed = bool(tests_obj.get("passed", False))
    test_failures = _clean_str_list(tests_obj.get("failures"))
    blocking.extend(test_failures)
    if not checks_passed and not test_failures:
        blocking.append(f"Verification command failed: {validated_args['verify_cmd']}")

    viewports_verified: list[int] = []
    browser_ok = True
    if validated_args.get("run_browser_audit"):
        if not validated_args.get("preview_url"):
            browser_ok = False
            blocking.append("run_browser_audit enabled without preview_url")
        elif not isinstance(browser_res, dict):
            browser_ok = False
            blocking.append("Browser 3-viewport audit returned no result")
        else:
            raw_vps = browser_res.get("viewports_verified", [])
            if isinstance(raw_vps, list):
                for vp in raw_vps:
                    if isinstance(vp, int) and not isinstance(vp, bool):
                        if vp not in viewports_verified:
                            viewports_verified.append(vp)
            console_errors = _clean_str_list(browser_res.get("console_errors"))
            overflow_vps = browser_res.get("overflow_viewports", [])
            if console_errors:
                browser_ok = False
                blocking.extend(f"Console error: {e}" for e in console_errors)
            if isinstance(overflow_vps, list) and overflow_vps:
                browser_ok = False
                blocking.append(f"Viewport horizontal overflow detected: {overflow_vps}")
            if not bool(browser_res.get("passed", False)):
                browser_ok = False
                if not console_errors and not overflow_vps:
                    blocking.append("Browser visual audit reported failure")
            if set(_REQUIRED_VIEWPORTS) - set(viewports_verified):
                browser_ok = False
                blocking.append(
                    f"Missing required viewports in browser audit: "
                    f"{sorted(set(_REQUIRED_VIEWPORTS) - set(viewports_verified))}"
                )

    deduped_blocking = _clean_str_list(blocking)
    verdict = (
        "SHIP"
        if (
            review_status == "SHIP"
            and checks_passed
            and browser_ok
            and not deduped_blocking
        )
        else "BLOCK"
    )

    review_summary = str(review_obj.get("summary", "")).strip()
    test_summary = str(tests_obj.get("command_summary", "")).strip()
    answerability = (
        f"QA Gate {verdict} for target '{validated_args['target_dir']}'. "
        f"Verification '{validated_args['verify_cmd']}' passed={checks_passed}. "
        f"Blocking defects: {len(deduped_blocking)}. "
        + (f"Review: {review_summary} " if review_summary else "")
        + (f"Tests: {test_summary}" if test_summary else "")
    ).strip()

    return {
        "verdict": verdict,
        "blocking_defects": deduped_blocking,
        "non_blocking": _clean_str_list(non_blocking),
        "checks_passed": checks_passed,
        "viewports_verified": viewports_verified,
        "answerability_statement": answerability,
    }


async def run_qa_gate(raw_args: Any) -> dict[str, Any]:
    """Execute Stage 4 decoupled parallel QA gate."""
    validated = validate_qa_args(raw_args)

    phase("Trajectory & Context")
    recent_errors: list[str] = []
    try:
        steps = await trajectory(tools=["run_command"], last=15)
        for step in steps or []:
            status = step.get("status") if isinstance(step, dict) else getattr(step, "status", None)
            output = step.get("output") if isinstance(step, dict) else getattr(step, "output", None)
            if status == "ERROR" and isinstance(output, str) and output.strip():
                recent_errors.append(output.strip()[:400])
    except Exception as exc:
        if getattr(exc, "denied", False):
            log("trajectory() access denied; continuing without prior step history")
        else:
            raise

    workspace_hint = WORKSPACES[0] if WORKSPACES else validated["target_dir"]
    log(
        f"Starting Stage 4 QA Gate in {workspace_hint} "
        f"(recent_cmd_errors={len(recent_errors)}, browser={validated['run_browser_audit']})"
    )

    phase("Decoupled Parallel QA")
    review_schema = {
        "type": "object",
        "required": ["status", "blocking_defects", "non_blocking", "summary"],
        "properties": {
            "status": {"type": "string", "enum": ["SHIP", "BLOCK"]},
            "blocking_defects": {"type": "array", "items": {"type": "string"}},
            "non_blocking": {"type": "array", "items": {"type": "string"}},
            "summary": {"type": "string"},
        },
    }
    tester_schema = {
        "type": "object",
        "required": ["passed", "failures", "command_summary"],
        "properties": {
            "passed": {"type": "boolean"},
            "failures": {"type": "array", "items": {"type": "string"}},
            "command_summary": {"type": "string"},
        },
    }

    spec_note = f"Locked spec: {validated['spec_path']}. " if validated["spec_path"] else ""
    error_note = (
        f"Recent failed command snippets: {json.dumps(recent_errors[:3])}. "
        if recent_errors
        else ""
    )

    agent_specs: list[dict[str, Any]] = [
        {
            "role": "cf-reviewer (Dual-Axis Audit)",
            "type_name": "self",
            "model": "pro",
            "prompt": (
                f"Perform an independent decoupled cf-eval + invariant review of '{validated['target_dir']}'. "
                f"{spec_note}{error_note}"
                "Inspect git diff, security/performance invariants, and test honesty. "
                "Return strict JSON via finish."
            ),
            "schema": review_schema,
        },
        {
            "role": "cf-tester (Verification)",
            "type_name": "self",
            "model": "inherit",
            "prompt": (
                f"Run verification command `{validated['verify_cmd']}` in `{validated['target_dir']}` "
                "and report whether all checks pass plus any failure details via finish."
            ),
            "schema": tester_schema,
        },
    ]

    include_browser = bool(validated["run_browser_audit"] and validated["preview_url"])
    if include_browser:
        browser_schema = {
            "type": "object",
            "required": [
                "passed",
                "viewports_verified",
                "console_errors",
                "overflow_viewports",
                "summary",
            ],
            "properties": {
                "passed": {"type": "boolean"},
                "viewports_verified": {"type": "array", "items": {"type": "integer"}},
                "console_errors": {"type": "array", "items": {"type": "string"}},
                "overflow_viewports": {"type": "array", "items": {"type": "integer"}},
                "summary": {"type": "string"},
            },
        }
        agent_specs.append(
            {
                "role": "browser (375/768/1440px Audit)",
                "type_name": "self",
                "model": "flash",
                "prompt": (
                    f"Audit {validated['preview_url']} across 375px, 768px, and 1440px viewports. "
                    "Verify zero horizontal overflow, zero console/network errors, and WCAG 2.1 AA states. "
                    "Return JSON via finish."
                ),
                "schema": browser_schema,
            }
        )

    assert len(agent_specs) <= 3, "QA Gate concurrency capped at 3 agents"

    try:
        results = await parallel(agent_specs, lambda spec: agent(**spec))
    except Exception as exc:
        if getattr(exc, "denied", False):
            log(f"QA agent call denied by policy: {getattr(exc, 'message', exc)}")
            verdict = {
                "verdict": "BLOCK",
                "blocking_defects": [
                    f"Automated QA tool/agent denied: {getattr(exc, 'message', exc)}"
                ],
                "non_blocking": [],
                "checks_passed": False,
                "viewports_verified": [],
                "answerability_statement": "QA Gate BLOCKED because a required non-interactive permission was denied.",
            }
            print(json.dumps(verdict))
            return verdict
        raise

    review_res = results[0] if len(results) > 0 else {}
    tester_res = results[1] if len(results) > 1 else {}
    browser_res = results[2] if include_browser and len(results) > 2 else None

    phase("Verdict Synthesis")
    verdict_obj = synthesize_qa_verdict(review_res, tester_res, browser_res, validated)
    log(json.dumps(verdict_obj))
    print(json.dumps(verdict_obj))
    return verdict_obj


await run_qa_gate(args)  # noqa: F704
