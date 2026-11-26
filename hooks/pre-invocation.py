#!/usr/bin/env python3
"""Enterprise Code Factory v3.0.0 PreInvocation feedback, context-hygiene & loop-breaker hook.

Runs synchronously before each model call (< 30 ms) and atomically evaluates:
  1. Runaway Loop-Breaker (`CF_LOOP_BREAKER_MAX`, default 5): terminates execution
     when consecutive identical tool failures reach the threshold, resetting the
     counter so the user can adjust guidance and resume cleanly.
  2. Pending `PostToolUse` Feedback Drain: injects capped (<= 3 KB) single-file
     syntax/lint errors via Antigravity's nested `systemMessage` contract.
  3. Once-Per-Threshold Context-Hygiene Warnings (`CF_CONTEXT_WARN_TURN`, default
     15, thresholds [N, 2*N]): recommends `/compact` or `cf-handover`.

Fails open (`{}` exit 0) on malformed stdin or unreadable state.
"""

from __future__ import annotations

import json
import os
import pathlib
import sys
from typing import Any

HOOKS_DIR = str(pathlib.Path(__file__).resolve().parent)
if HOOKS_DIR not in sys.path:
    sys.path.insert(0, HOOKS_DIR)

import hook_state  # noqa: E402

DEFAULT_LOOP_BREAKER_MAX = 5
DEFAULT_CONTEXT_WARN_TURN = 15
MAX_FEEDBACK_MESSAGE_BYTES = 3072


def _parse_optional_threshold(env_var: str, default: int) -> int:
    """Parse a positive integer threshold env var; '0' or 'off' disables (returns 0)."""
    raw = os.environ.get(env_var, "").strip().lower()
    if not raw:
        return default
    if raw in ("0", "off", "false", "disabled"):
        return 0
    try:
        val = int(raw)
    except ValueError:
        return default
    return val if val > 0 else 0


def _truncate_utf8_bytes(text: str, max_bytes: int, notice: str = "\n...[truncated]") -> str:
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


def _format_pending_feedback(items: list[dict[str, Any]]) -> str:
    lines: list[str] = ["[Code Factory PostToolUse Feedback]"]
    for item in items:
        if not isinstance(item, dict):
            continue
        checker = hook_state.sanitize_text(item.get("checker", "check"), max_chars=64) or "check"
        file_path = hook_state.sanitize_text(item.get("filePath", "<file>"), max_chars=260) or "<file>"
        summary = hook_state.sanitize_text(
            item.get("summary", ""), max_chars=hook_state.MAX_FEEDBACK_SUMMARY_CHARS
        )
        if not summary:
            continue
        lines.append(f"- [{checker}] {file_path}: {summary}")
    if len(lines) == 1:
        return ""
    body = "\n".join(lines)
    return _truncate_utf8_bytes(body, MAX_FEEDBACK_MESSAGE_BYTES, "\n...[feedback truncated to 3 KB]")


def evaluate_pre_invocation(payload: dict[str, Any]) -> dict[str, Any]:
    """Evaluate PreInvocation rules atomically against conversation state."""
    conversation_id = payload.get("conversationId")
    raw_inv = payload.get("invocationNum", 0)
    invocation_num = (
        raw_inv if isinstance(raw_inv, int) and not isinstance(raw_inv, bool) else 0
    )

    max_failures = _parse_optional_threshold("CF_LOOP_BREAKER_MAX", DEFAULT_LOOP_BREAKER_MAX)
    warn_turn = _parse_optional_threshold("CF_CONTEXT_WARN_TURN", DEFAULT_CONTEXT_WARN_TURN)
    thresholds = [warn_turn, warn_turn * 2] if warn_turn > 0 else []

    # Fast read-only check so idle turns avoid unnecessary lock/write overhead.
    snapshot = hook_state.load_state(conversation_id)
    needs_loop_break = max_failures > 0 and int(snapshot.get("consecutiveFailures", 0)) >= max_failures
    has_feedback = bool(snapshot.get("pendingFeedback"))
    warned_snapshot = snapshot.get("contextWarnedThresholds") or []
    needs_warn = bool(
        thresholds
        and invocation_num > 0
        and any(invocation_num >= t and t not in warned_snapshot for t in thresholds)
    )
    if not (needs_loop_break or has_feedback or needs_warn):
        return {}

    def _mutate(state: dict[str, Any]) -> dict[str, Any]:
        # 1. Runaway Loop-Breaker (highest priority).
        failures = int(state.get("consecutiveFailures", 0))
        if max_failures > 0 and failures >= max_failures:
            sig = hook_state.sanitize_text(
                state.get("lastFailureSignature", ""), max_chars=256
            ) or "unknown"
            state["consecutiveFailures"] = 0
            state["lastFailureSignature"] = ""
            state["pendingFeedback"] = []
            return {
                "injectSteps": [
                    {
                        "errorMessage": {
                            "userMessage": (
                                f"Enterprise Code Factory Loop-Breaker: terminated execution after "
                                f"{failures} consecutive identical tool failures ({sig}). "
                                f"Inspect the error and adjust guidance before resuming."
                            )
                        }
                    }
                ],
                "terminationBehavior": "terminate",
            }

        steps: list[dict[str, Any]] = []

        # 2. Drain and inject pending PostToolUse diagnostics.
        pending = state.get("pendingFeedback") or []
        if pending:
            state["pendingFeedback"] = []
            formatted = _format_pending_feedback(pending)
            if formatted:
                steps.append({"systemMessage": {"systemMessage": formatted}})

        # 3. Once-per-threshold context-hygiene warning.
        if thresholds and invocation_num > 0:
            warned = list(state.get("contextWarnedThresholds") or [])
            newly_crossed = [
                t for t in thresholds if invocation_num >= t and t not in warned
            ]
            if newly_crossed:
                for t in newly_crossed:
                    warned.append(t)
                state["contextWarnedThresholds"] = sorted(set(warned))
                warning_msg = (
                    f"[Code Factory Context Hygiene — Turn {invocation_num}] "
                    f"Conversation reached {invocation_num} model invocations. "
                    f"Recommend /compact or cf-handover (<= 3 KB .memory/handover.md) "
                    f"before context saturation degrades quality."
                )
                steps.append({"systemMessage": {"systemMessage": warning_msg}})

        return {"injectSteps": steps} if steps else {}

    _, response = hook_state.update_state(conversation_id, _mutate)
    return response if isinstance(response, dict) else {}


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
        response = evaluate_pre_invocation(payload)
        print(json.dumps(response))
    except Exception:
        print("{}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
