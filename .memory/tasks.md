# Active Milestone Tasks

## Current Milestone
- **Goal:** Evolve the globally installed **Enterprise Code Factory (`code-factory`)** plugin (`v2.2.0` → `v3.0.0`) alongside the live **Antigravity Academy** (`academy/`) platform.
- **Repository:** https://github.com/behnker/antigravity-code-factory

## In Progress
- [ ] **Push `v2.2.0` Plugin Release:** Push local `v2.2.0` commit (`cf-next-verify`, `hooks/secret-guard.py`, tightened `agents/cf-*.md`, `cf-tester`, and updated `.memory/`) to `origin/main` when approved.

## Up Next
- [ ] **Next Milestone (`code-factory` v3.0 Phase 1–3 from `.memory/research.md`):**
  - Implement two-stage `PostToolUse` → `PreInvocation` single-file lint/feedback bridge and `SessionStart` `.memory/` auto-injection.
  - Add bundled `run_workflow` Python orchestration scripts and optional `sidecar.json` / LSP MCP integration.
- [ ] Sync `academy/` resource manifest (`pnpm run sync:resources`) if you want `v2.2.0` plugin files (`cf-next-verify`, `secret-guard.py`, `cf-tester`) reflected on the live Vercel site.
- [ ] Add video recordings (`mp4` / YouTube / Loom URLs) into `academy/content/courses/*/course.json` as episodes are recorded.

## Completed
- [x] **`code-factory` v2.2.0 Stack Verification, Secret Guard & Agent Hardening:**
  - Authored `skills/cf-next-verify/` (`SKILL.md`, `references/stack-checklist.md`, `scripts/verify-stack.sh` — verified live on `academy/`: `tsc`, `eslint`, `27/27` Vitest, `0` boundary leaks).
  - Built & registered <20ms `PreToolUse` `hooks/secret-guard.py` (`hooks.json` + `hooks/test_secret_guard.py`; `12/12` Python hook tests passing).
  - Fixed missing `tools:`, `subagent: true`, and `mainAgent: false` frontmatter across `agents/cf-architect.md`, `cf-backend.md`, `cf-frontend.md`, `cf-reviewer.md`, and added `agents/cf-tester.md`.
  - Updated `plugin.json` (`v2.2.0`), `README.md`, and verified live discovery via `GetAllPlugins` (12 skills, 5 agents, rules, dual `PreToolUse` hooks).
- [x] **Stage 5 & Stage 6 Commit/Push (`37cc6cd`):** Committed & pushed CVE patches, Course 03 (`pro-setup-playbook`), Vercel config (`.vercelignore`), `.agents/rules/academy-invariants.md`, and `.memory/` records to `origin/main`.
- [x] **Stage 6 (`cf-learn` / `cf-handover`):** Distilled permanent project invariants into `.agents/rules/academy-invariants.md` and updated `.memory/handover.md` (≤ 3 KB).
- [x] **Stage 5 (`cf-deploy-staging`):** Deployed to Vercel (`https://antigravity-academy-ten.vercel.app`) and passed all 5 live smoke tests (`/`, `/api/courses`, `/api/resources`, `/api/hitl/simulate` valid + 400).
- [x] **Security Patching & Course 03:** Remediated all 3 High/Critical CVEs (`zod@4.6.7`, `tinypool >= 2.1.2`, `postcss >= 8.5.18` → 0 high/critical) and added Course 03 (`pro-setup-playbook`).
- [x] **Stage 1–4 (`academy/`):** Researched, specced (`plans/antigravity-academy-spec.md`, ADR-0002), implemented via Swarm (`27/27` Vitest, `next build` clean), and QA-audited (`cf-reviewer` + live `browser` at 1440/768/375px).
- [x] **Plugin v2.0–v2.1 Foundation:** Built plugin scaffold (`plugin.json`, `rules/AGENTS.md`, 11 `cf-*` skills, 4 `cf-*` agents, `hooks/hitl-gate.py`), symlinked to `~/.gemini/config/plugins/code-factory`, and pushed `behnker/antigravity-code-factory`.
