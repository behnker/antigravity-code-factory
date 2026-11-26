# ADR-0008: Git-Shadow Checkpoints (`cf-rewind`), `0600` Unix-Socket Sidecar & Self-Contained `run_workflow` Pipelines (`v3.1.0` Phase 2)

**Date:** 2026-11-26  
**Status:** Accepted  
**Related Spec:** [`plans/code-factory-v3-1-phase2-spec.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plans/code-factory-v3-1-phase2-spec.md)  
**Research Input:** [`.memory/research.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/research.md)  
**Extends:** [`0006-code-factory-v3-phase1-hook-bridge.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/decisions/0006-code-factory-v3-phase1-hook-bridge.md)  
**Verified Platform Contracts:** [`hooks.md`](file:///Users/ralphb/.gemini/antigravity/builtin/skills/agy-customizations/docs/hooks.md), [`plugins.md`](file:///Users/ralphb/.gemini/antigravity/builtin/skills/agy-customizations/docs/plugins.md), [`run-workflow/SKILL.md`](file:///Users/ralphb/.gemini/antigravity/builtin/skills/run-workflow/SKILL.md), `https://antigravity.google/docs/sidecars.md`

---

## Context

`code-factory` (`v3.0.1`, `19` skills) ships 5 synchronous lifecycle hooks via `hooks/hook_state.py`, yet lacks:
1. Pre-turn rollback coverage across both file edits and `run_command` shell mutations.
2. Non-blocking async telemetry, optional webhook egress, and bounded `.memory/auto-memory.md` distillation.
3. Reusable typed `run_workflow` Python orchestration scripts replacing prose-only Stage 3/4 delegation.

Primary-source verification of Antigravity's customization system also uncovered four concrete platform constraints that dictate this architecture:
- `PreToolUse` hooks merge sequentially and fail closed on `{}` (every `PreToolUse` handler must emit an explicit `decision`).
- `sidecar.json` is documented at `https://antigravity.google/docs/sidecars.md` (not in local `agy-customizations/docs/plugins.md`), requires explicit opt-in enablement in `~/.gemini/config/config.json`, exposes `ANTIGRAVITY_EXECUTABLE_DATA_DIR` rather than guaranteed `$PLUGIN_DATA`, and runs alongside macOS's 104-byte `AF_UNIX` `sun_path` kernel cap.
- `run_workflow` scripts execute with injected globals (`agent`, `parallel`, `pipeline`, `phase`, `log`, `trajectory`, `call_tool`), top-level `await`, **no local module imports**, and **zero interactive user approval prompts** (`ToolError.denied = True`), while `agy-customizations/docs/plugins.md` does not auto-register `workflows/` as slash commands.

---

## Decisions & Trade-Off Analysis

### 1. Per-Turn Deduplicated `PreToolUse` `git stash create` + Clean-`HEAD` Baseline vs. `PostToolUse` Snapshots or `git reset --hard`
- **Decision:** Add `hooks/checkpoint-hook.py` after the security gates in `hooks.json` (`PreToolUse`, `<= 150 ms` total budget, `.git/index` / pack size guards, `turnEpoch` deduplication advanced on `Stop` and `initialNumSteps`), recording non-destructive `git stash create` SHAs—or clean `HEAD` SHAs when no tracked diffs exist yet—to `$PLUGIN_DATA/checkpoints/<cid>.jsonl`, paired with `skills/cf-rewind/scripts/rewind.py` (`--dry-run` default, mandatory `pre-restore-safety` snapshot before `--apply` file-level `git checkout <sha> -- .`).
- **Rejected Alternative:** Snapshotting in `PostToolUse` (too late—mutations already happened), running `git stash push -u` (mutates working tree during `PreToolUse`), or using `git reset --hard` in `rewind.py` (risks destroying post-checkpoint commits or user files).
- **Consequences:** Captures arbitrary shell and file mutations once per turn with zero working-tree side effects and reversible restores, while skipping cleanly in `< 5 ms` on oversized/non-git repos.

### 2. Pure Python 3 Stdlib `0600` `AF_UNIX` Sidecar (`sidecar.json`) with `sun_path` Indirection & `< 10 ms` Fail-Open Spool vs. TCP Server or Sync Hook HTTP
- **Decision:** Ship `sidecars/telemetry-memory/{sidecar.json,sidecar.py}` binding strictly to a `0600` `AF_UNIX` socket (`$PLUGIN_DATA/cf-sidecar.sock`, falling back to a short UID-scoped `0700` socket + `cf-sidecar.endpoint.json` when path exceeds `100` bytes), paired with a `< 10 ms` fail-open client in `hooks/hook_state.py` that spools redacted NDJSON to `telemetry-spool.jsonl` whenever the sidecar is disabled in `config.json` or absent in headless runs. Persist auto-distilled lessons strictly inside `<!-- code-factory:auto-memory:start/end -->` markers in `.memory/auto-memory.md` (`<= 200` lines, `<= 3 KB`), never altering user notes outside markers.
- **Rejected Alternative:** Binding TCP `127.0.0.1` / `0.0.0.0`, running synchronous `urllib` inside hooks, or overwriting `.memory/auto-memory.md` wholesale. TCP listeners widen local attack surfaces; sync HTTP adds seconds to every turn; blind overwrites erase human notes.
- **Consequences:** Zero loop latency even when sidecars are disabled, zero unauthenticated TCP ports, macOS/Linux socket portability, and safe non-destructive cross-session auto-memory.

### 3. Self-Contained `workflows/*/workflow.py` + `workflow.json` + `PyCF_ALLOW_TOP_LEVEL_AWAIT` Hook Support vs. Shared Library Imports
- **Decision:** Package `workflows/cf-qa-gate/` and `workflows/cf-implement-spec/` with JSON Schema Draft-07 `workflow.json` manifests AND 100% self-contained `workflow.py` scripts using only verified `run_workflow` globals, redundant in-script `validate_*_args()`, disjoint partition assertions (`<= 5` workers, `workspace="share"`), and `ToolError.denied` handling. Update `hooks/post-tool-feedback.py` to syntax-check `workflows/*.py` using `ast.PyCF_ALLOW_TOP_LEVEL_AWAIT`.
- **Rejected Alternative:** Importing shared helpers from `hooks/` inside `workflow.py` (breaks `run_workflow`'s `"Local modules are not importable"` rule) or keeping Course 01's fictional `from antigravity_workflow import finish` syntax.
- **Consequences:** Workflows execute identically via `run_workflow(ScriptPath=...)` in live Antigravity and via `eval(compile(..., ast.PyCF_ALLOW_TOP_LEVEL_AWAIT))` in `unittest.IsolatedAsyncioTestCase` with zero false-positive `PostToolUse` syntax alerts.

### 4. Dedicated `sidecar` / `workflow` Categories & Lockstep `20`-Skill Academy Sync (`v3.1.0`) vs. Deferring Sync
- **Decision:** Bump `plugin.json` and `README.md` to `3.1.0`, add `"sidecar"` and `"workflow"` categories (with `.default(0)` counts in `schemas.ts` + `RepoResourceExplorer.tsx` tabs), sync `sync-resources.ts` (`20` skills, `9` hooks, `sidecars/`, `workflows/`), fix Course 01 Step 5's `workflow.py` snippet, and add Course 02 Step 11 + `cf-prompt-rewind` (`skillRef: "cf-rewind"`).
- **Rejected Alternative:** Overloading `"hook"` for sidecars/workflows or leaving Academy at `19` skills (which breaks `schemas-and-prompts.test.ts`'s filesystem-backed Skill Traceability test).
- **Consequences:** `academy/` remains 100% stateless with zero new dependencies while enforcing `20/20` skill traceability and zero doc-vs-runtime drift.

---

## Verification & Rollback Summary

- **Verification Oracles:** `python3 -m unittest discover -s hooks -p "test_*.py" -v` (`37` Phase 1 + Phase 2 checkpoint/sidecar/workflow suites), `ruff check`, `wc -c rules/AGENTS.md <= 10240`, `node --test skills/cf-*/scripts/*.mjs` (`38/38`), `cd academy && pnpm run sync:resources && bash ../skills/cf-next-verify/scripts/verify-stack.sh . --coverage` (`20/20` Skill Traceability), `pnpm audit --audit-level=high`, `pnpm run verify:map`, and decoupled `cf-reviewer` (`cf-eval`) `SHIP`.
- **Rollback:** Runtime kill switches (`CF_DISABLE_CHECKPOINTS=1`, `CF_DISABLE_SIDECAR=1`, `CF_AUTO_MEMORY=off`, `"enabled": false` in `hooks.json`) or `git revert <commit-sha>` + `pnpm run sync:resources`.
