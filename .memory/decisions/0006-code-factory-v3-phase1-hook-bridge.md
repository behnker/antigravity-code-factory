# ADR-0006: Two-Stage Hook Feedback Bridge, Python Stdlib Per-Conversation State, Conservative `overwrite`, Bounded `Stop` Gate & Stateless Academy Sync (`v3.0.0` Phase 1)

**Date:** 2026-11-26  
**Status:** Accepted  
**Related Spec:** [`plans/code-factory-v3-phase1-spec.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plans/code-factory-v3-phase1-spec.md)  
**Research Input:** [`.memory/research.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/research.md)  
**Hook Contract:** [`agy-customizations/docs/hooks.md`](file:///Users/ralphb/.gemini/antigravity/builtin/skills/agy-customizations/docs/hooks.md)

---

## Context

`antigravity-code-factory` (`v2.5.0`, `e562472`, 19 skills) enforces `PreToolUse` shell safety (`hooks/hitl-gate.py`) and secret-write blocking (`hooks/secret-guard.py`), but leaves Antigravity's remaining lifecycle hooks (`SessionStart`, `PostToolUse`, `PreInvocation`, `Stop`) unused. Additionally, Antigravity's official hook contract enforces two critical constraints:
1. `PostToolUse` expects `{}` on `stdout` and **cannot return context directly to the model**.
2. All hooks execute **synchronously** and block the agent loop; `PreToolUse` fails closed on `{}`, while `Stop` can loop if `continuationActive` is ignored.

At the same time, Antigravity Academy (`academy/`) remains stale at `15` (and `11`) skills in its contracts, comparison data, and course JSONs, and lacks live ingestion of the new `v3.0.0` lifecycle hooks.

---

## Decisions & Trade-Off Analysis

### 1. Two-Stage `$PLUGIN_DATA` `PostToolUse` → `PreInvocation` Bridge vs. Prompt-Only Lint Reminders
- **Decision:** Implement a deterministic two-stage bridge where `PostToolUse` (`hooks/post-tool-feedback.py`) runs `<2s` single-file syntax/lint checks (`shell=False`) and persists sanitized diagnostics to `$PLUGIN_DATA/conversations/<cid>.json`, and `PreInvocation` (`hooks/pre-invocation.py`) drains and injects them via `injectSteps: [{"systemMessage": {"systemMessage": "..."}}]`.
- **Rejected Alternative:** Prompt-only instructions in `rules/AGENTS.md` telling the model to run `eslint`/`ruff`/`tsc` after every edit. Models skip manual checks under long-context load and consume extra turns even when files are clean.
- **Consequences:** 100% deterministic self-correction on the very next model invocation without waiting for a full-repo build, while adding `<50ms` on clean JS/PY/JSON edits without a local linter and `<1.8s` max when invoking local `eslint`/`ruff`.

### 2. Pure Python 3 Stdlib + Atomic `0600` Per-Conversation JSON State vs. SQLite or External Daemons in Phase 1
- **Decision:** Build `hooks/hook_state.py` using zero-dependency Python 3 stdlib (`json`, `fcntl`, `tempfile`, `os.chmod(0o600)`, `os.replace`) storing isolated per-conversation files with strict `conversationId` regex/SHA-256 sanitization and `24h` TTL pruning.
- **Rejected Alternative:** Bundling SQLite WAL or launching a persistent `sidecar.json` background daemon in Phase 1. Sidecar process supervision, socket lifecycle management, and cross-platform IPC add operational surface area better suited to Phase 2 async telemetry/webhooks.
- **Consequences:** Zero supply-chain risk, zero daemon startup latency, `<5ms` state read/write per hook, and strict isolation across parallel conversations via `0700` dirs / `0600` files and symlink checks.

### 3. Safe, Conservative `PreToolUse` `overwrite` Rules vs. Opaque Command Mutation
- **Decision:** Add strictly scoped `PreToolUse` `overwrite` augmentation in `hooks/hitl-gate.py` (`--no-pager` on `git`, `--max-time 5` on `curl`) ONLY when `decision == "allow"`, when the executable is an unquoted top-level command token, when equivalent flags are absent, and when no subshells/command substitutions/heredocs/unbalanced quotes exist.
- **Rejected Alternative:** Broad regex rewriting across arbitrary strings, or mutating commands classified as `force_ask`/`ask`. Opaque or aggressive rewriting risks corrupting quoted arguments (e.g., `echo` / `python3 -c`) or confusing reviewers on high-impact commands.
- **Consequences:** Eliminates hanging `git` pagers and unbounded `curl` network calls transparently (Antigravity surfaces the exact `overwrite` notice to the agent) while preserving zero false-positive mangling and untouched `force_ask`/`ask` safety gates.

### 4. Bounded `Stop` Verification Gate vs. Unconditional Blocking
- **Decision:** Implement `hooks/stop-gate.py` with four strict preconditions (`CF_STOP_GATE_MODE != "off"`, `terminationReason == "NO_TOOL_CALL"`, `continuationActive == false`, `fullyIdle == true`) plus a single-shot state reset (`needsVerification = False`, `stopContinuationCount += 1`) before emitting `{"decision": "continue", ...}`, triggered only when tracked source code files (excluding `.memory/`, `plans/`, `docs/`) were edited without a subsequent green verification command.
- **Rejected Alternative:** Unconditionally returning `continue` whenever tests haven't passed in a session, or checking `Stop` during `ERROR`/`USER_CANCELED`/`TERMINAL_CUSTOM_HOOK` terminations. Unconditional `Stop` checks cause infinite continuation loops and trap users during doc-only sessions or cancelled turns.
- **Consequences:** Mathematically guarantees at most one verification prompt per unverified source-edit cycle while preserving instant exits on cancellations, errors, loop-breaker terminations, and doc/spec tasks.

### 5. Stateless `academy/` Curriculum Sync in Lockstep vs. Deferring Sync or Adding Auth/DB
- **Decision:** Keep `academy/` 100% stateless (`localStorage` + Zod) and update `sync-resources.ts`, `contracts.ts`, `harness-comparison.ts`, optional non-breaking `HitlSimulateResponseSchema.overwrite`, and Courses `00–02` & `04` in the same milestone.
- **Rejected Alternative:** Shipping `v3.0.0` plugin hooks without syncing `academy/` (leaving Academy teaching `15` skills and invalid hook snippets) or coupling Supabase Auth/DB changes into Phase 1.
- **Consequences:** Zero drift between live plugin artifacts (`19` skills, `8` hook resources, `pluginVersion: 3.0.0`) and Academy interactive labs, zero new dependencies, and zero database/auth blast radius.

---

## Verification & Rollback Summary

- **Verification Oracles:** `python3 -m unittest` (`hooks/test_*.py`), `wc -c rules/AGENTS.md <= 10240`, `node --test` (`31/31`), `pnpm run sync:resources`, `verify-stack.sh academy --coverage`, `pnpm audit --audit-level=high` (`0` High/Critical), `pnpm run verify:map` (`375/768/1440px`), and independent `cf-reviewer` `cf-eval` (`SHIP`).
- **Rollback:** Instant runtime kill switches (`"enabled": false` in `hooks.json` or `CF_*` env flags) or clean `git revert` back to `v2.5.0` (`e562472`).
