#!/usr/bin/env python3
"""Enterprise Code Factory v3.0.0 bounded Stop verification gate.

Ensures modified source files receive a verification reminder at most once per
edit cycle while guaranteeing mathematical immunity to infinite stop loops via
4 mandatory precondition guards:
  1. `CF_STOP_GATE_MODE != "off"`
  2. `terminationReason == "NO_TOOL_CALL"`
  3. `continuationActive is False`
  4. `fullyIdle is True`

And atomic single-shot state flipping (`needsVerification = False`,
`stopContinuationCount += 1`) BEFORE returning `{"decision": "continue", ...}`.
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

ALLOW_RESPONSE: dict[str, str] = {"decision": "allow"}
MAX_LISTED_FILES = 5


def _format_file_list(files: list[str]) -> str:
    shown = [hook_state.sanitize_text(f, max_chars=120) for f in files[:MAX_LISTED_FILES]]
    shown = [f for f in shown if f]
    summary = ", ".join(shown) if shown else "source files"
    extra = len(files) - MAX_LISTED_FILES
    if extra > 0:
        summary += f" (+{extra} more)"
    return summary


def evaluate_stop(payload: dict[str, Any]) -> dict[str, Any]:
    """Evaluate all 4 loop-safety guards and single-shot verification state."""
    # Guard 1: Runtime kill switch.
    if os.environ.get("CF_STOP_GATE_MODE", "").strip().lower() == "off":
        return dict(ALLOW_RESPONSE)

    # Guard 2: Only gate normal NO_TOOL_CALL completion.
    if payload.get("terminationReason") != "NO_TOOL_CALL":
        return dict(ALLOW_RESPONSE)

    # Guard 3: Never continue again if Stop already triggered continuation this turn.
    if bool(payload.get("continuationActive", False)) is not False:
        return dict(ALLOW_RESPONSE)

    # Guard 4: Only gate when fully idle.
    if bool(payload.get("fullyIdle", True)) is not True:
        return dict(ALLOW_RESPONSE)

    conversation_id = payload.get("conversationId")

    # Fast read-only check to avoid creating state files on read-only chats.
    snapshot = hook_state.load_state(conversation_id)
    if (
        snapshot.get("needsVerification") is not True
        or not snapshot.get("editedSourceFiles")
        or int(snapshot.get("stopContinuationCount", 0)) >= 1
    ):
        return dict(ALLOW_RESPONSE)

    def _mutate(state: dict[str, Any]) -> dict[str, Any]:
        edited = state.get("editedSourceFiles") or []
        stop_count = int(state.get("stopContinuationCount", 0))
        if (
            state.get("needsVerification") is True
            and len(edited) > 0
            and stop_count < 1
        ):
            state["needsVerification"] = False
            state["stopContinuationCount"] = stop_count + 1
            file_list = _format_file_list(edited)
            return {
                "decision": "continue",
                "reason": (
                    f"[Code Factory Stop Gate] Modified source files remain unverified ({file_list}). "
                    f"Run relevant typecheck/lint/test commands before stopping, or state why verification was skipped."
                ),
            }
        return dict(ALLOW_RESPONSE)

    _, response = hook_state.update_state(conversation_id, _mutate)
    return response if isinstance(response, dict) else dict(ALLOW_RESPONSE)


def main() -> int:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            print(json.dumps(ALLOW_RESPONSE))
            return 0
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            print(json.dumps(ALLOW_RESPONSE))
            return 0
        response = evaluate_stop(payload)
        print(json.dumps(response))
    except Exception:
        print(json.dumps(ALLOW_RESPONSE))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
