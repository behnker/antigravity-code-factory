# Active Milestone Tasks

## Current Milestone
- **Goal:** Evolve the globally installed **Enterprise Code Factory (`code-factory`)** plugin (`v2.3.0` → `v3.0.0`) alongside the live **Antigravity Academy** (`academy/`) 4-course platform.
- **Repository:** https://github.com/behnker/antigravity-code-factory

## In Progress
- [ ] **Commit, Push & Optional Staging Re-Deploy (`v2.3.0`):** Review local `v2.2.0` + `v2.3.0` Lit Software Factory & 4-course integration changes, commit/push to `origin/main`, and re-deploy `academy/` to Vercel when approved.

## Up Next
- [ ] **Next Milestone (`code-factory` v3.0 Phase 1–3 from `.memory/research.md`):**
  - Implement two-stage `PostToolUse` → `PreInvocation` single-file lint/feedback bridge and `SessionStart` `.memory/` auto-injection.
  - Add bundled `run_workflow` Python orchestration scripts and optional `sidecar.json` / LSP MCP integration.
- [ ] Add video recordings (`mp4` / YouTube / Loom URLs) into `academy/content/courses/*/course.json` as episodes are recorded.

## Completed
- [x] **`code-factory` v2.3.0 Lit Software Factory, Practical Loop Engineering & 4-Course Integration:**
  - Synthesized Google/Kaggle 5-Day Vibe Coding Whitepapers + Addy Osmani's *The New Software Lifecycle* & Fall 2026 O'Reilly Radar arc into `.memory/research-vibe-coding-lit-factory.md`.
  - Upgraded `rules/AGENTS.md` (Section 8: Lit Factory, Selective Autonomy, Dual-Axis Verification, Context Economics, Goals vs. Loops, 8.5 KB), `cf-plan`, `cf-qa-review`, `orchestration.md`, and `plugin.json` (`v2.3.0`).
  - Created `skills/cf-loop-engineer/` (`SKILL.md` + `references/project-examples.md`) and `skills/cf-eval/` (`SKILL.md` + `references/eval-rubric.md`) with concrete `Project_Antigravity` recipes and rubrics.
  - Enriched Courses 01 (`harness-mastery`), 02 (`code-factory-sdlc`), and 03 (`pro-setup-playbook`), added Course 04 (`lit-software-factory`), synced 37 live repo resources & 4 courses (`generated-repo-manifest.json`), and passed `tsc`, `eslint`, `27/27` Vitest, `next build`, `0` High/Critical CVEs, and `12/12` Python hook tests.
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
