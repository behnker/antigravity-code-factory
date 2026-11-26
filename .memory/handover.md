# Session Handover Record

**Timestamp:** 2026-11-26 02:45 UTC  
**Active Model:** Gemini 4 Neon (High)  
**Git Branch & Commit:** `main` (`v2.5.0` release ready for commit/push on top of `a7c501c`; Academy live at `https://antigravity-academy-ten.vercel.app`)

## 1. Executive Summary
Released **`code-factory` `v2.5.0` — Vibe Website Factory Pipeline** (`19` skills total: added zero-dependency `cf-design-tokens`, `cf-threejs-craft`, `cf-geo-seo`, and `cf-website-factory`, backed by `plans/cf-website-factory-spec.md`, ADR `0005`, and independent `cf-reviewer` `SHIP` clearance in `.memory/qa-report.md`). Next milestone locked via `cf-grill-me`: **`code-factory` `v3.0` Phase 1 Core Hooks + Academy Sync** (pure Python stdlib hooks + stateless Academy update, executed via `/teamwork`).

## 2. Production & Verification Baseline
- **Live Academy URL:** `https://antigravity-academy-ten.vercel.app` (`antigravity-academy-1s60sh98i-nexite-os.vercel.app`)
- **Rollback Command:** `cd academy && vercel rollback https://antigravity-academy-fzng4yn22-nexite-os.vercel.app --yes --scope nexite-os`
- **Automated Verification:** `31/31` Node plugin tests (`16` v2.5.0 + `15` `cf-verify-map`), `12/12` Python hooks, `61/61` Academy Vitest, `depcruise` (`0` violations across `44` modules / `113` deps), `9/9` live 3-viewport `verify:map`, `0` High/Critical CVEs, `rules/AGENTS.md` at `8,842` B (`<= 10 KB`).

## 3. Permanent Invariants Distilled
- `.agents/rules/academy-invariants.md`: Never wrap multi-screen sections (`CourseCurriculumStudio`, `PromptVault`, `repo-hitl`) in `motion` `initial={{ opacity: 0 }}` + numeric `viewport={{ amount: 0.05 }}`.
- `rules/AGENTS.md` (§6 #5): Keep `.memory/feature-map.md` updated in the same commit as route/API/selector edits and pass `cf-verify-map` + `depcruise`.
- All plugin scripts (`hooks/`, `skills/*/scripts/`) remain zero-dependency stdlib (Python 3 / Node ESM `>= 20`), fail-closed, with no shell string concatenation.

## 4. Active Milestone (`code-factory` v3.0 Phase 1 + Academy Sync)
- **Scope:** Two-stage `PostToolUse` → `PreInvocation` single-file lint feedback bridge (`<2s`), `SessionStart` `.memory/` auto-injection, `PreToolUse` `overwrite` (`--no-pager`, `--max-time 5`) + context-saturation/loop-breaker guardrails, `Stop` verification gate, and Academy `15 → 19` skills + v3.0 hooks curriculum/explorer sync.
- **Next Step:** Commit & push `v2.5.0` → lock `plans/code-factory-v3-phase1-spec.md` + ADR `0006` via `cf-architect` → user sign-off & `/teamwork` launch.
