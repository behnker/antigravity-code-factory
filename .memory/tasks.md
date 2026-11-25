# Active Milestone Tasks

## Current Milestone
- **Goal:** Evolve the globally installed **Enterprise Code Factory (`code-factory`)** plugin (`v2.4.0` → `v3.0.0`) alongside the live **Antigravity Academy** (`academy/`) multi-course platform.
- **Repository:** https://github.com/behnker/antigravity-code-factory

## In Progress
- [ ] **Commit `.memory/` Handover Sync (Optional):** Only `.memory/handover.md` and `.memory/tasks.md` have uncommitted updates after `4423c54` pushed Course 05 & Course 06 to `origin/main`.

## Up Next
- [ ] **Next Milestone (`code-factory` v3.0 Phase 1–3 from `.memory/research.md`):**
  - Implement two-stage `PostToolUse` → `PreInvocation` single-file lint/feedback bridge and `SessionStart` `.memory/` auto-injection.
  - Add bundled `run_workflow` Python orchestration scripts and optional `sidecar.json` / LSP MCP integration.
- [ ] Add video recordings (`mp4` / YouTube / Loom URLs) into Courses 01–05 (`academy/content/courses/*/course.json`) following the Course 06 `/media/*.mp4` pattern.
- [ ] Optional: Generate a Spanish (`ES`) launch cut or voiceover version of *Herd of Ibiza — GT-Alpaca Edition* inside `/Users/ralphb/Projects_Personal/product-video-studio`.

## Completed
- [x] **`code-factory` v2.4.0 Feature Map Verification & Architectural Boundary Gates (Scope C — `SHIP` Verdict):**
  - Authored locked spec (`plans/cf-verify-map-spec.md`) and ADR (`0004-feature-map-and-architecture-boundary-verification.md`) integrating and hardening `project-antigravity-verification-kit.zip` as a zero-dependency global plugin capability.
  - Created `skills/cf-verify-map/` (`SKILL.md`, hardened `scripts/run-verify-map.mjs` with direct Markdown contract parsing, project-local Playwright resolution, same-origin SSRF guard, multi-viewport overflow check, preserved failure screenshots, and `15/15` `node:test` unit tests; credential-free `feature-map-template.md`; TS-aware `dependency-cruiser.template.cjs`).
  - Wired non-destructive scaffolding into `skills/cf-bootstrap/scripts/bootstrap.sh`, added automatic Step 4b `depcruise` boundary check to `skills/cf-next-verify/scripts/verify-stack.sh`, and synced `cf-plan`, `cf-qa-review`, `cf-eval`, `agents/cf-tester.md`, `rules/AGENTS.md` (`8,842` B `<= 10 KB`), `plugin.json` (`2.4.0`, 15 skills), and `README.md`.
  - Dogfooded in `academy/` (`.memory/feature-map.md`, `academy/.dependency-cruiser.cjs`, `academy/scripts/sync-resources.ts`, `.gitignore`, plus HITL-approved `dependency-cruiser` [MIT] & `playwright` [Apache-2.0] + Chromium with `0` High/Critical CVEs).
  - Passed independent `cf-reviewer` Dual-Axis Eval (`SHIP` after closing B1 SSRF path bypass & B2 template `tsConfig` resolution): `12/12` Python hooks, `15/15` `node:test`, `5/5` `verify-stack.sh` (`tsc`, `eslint`, `61/61` Vitest, `0` secret leaks, `depcruise` `44 modules / 113 deps / 0 violations`), and `9/9` live 3-viewport `pnpm run verify:map` checks.
- [x] **Course 03 Parity, Mermaid Strict-SVG Fix & Production Deploy (`4423c54` → `https://antigravity-academy-ten.vercel.app`):**
  - Fixed Mermaid v11 XML `parsererror` on multiline flowcharts (`htmlLabels: false` + `flowchart.htmlLabels: false` in `academy/src/components/MermaidDiagram.tsx`) and added strict-SVG regression test in `academy/tests/components.test.tsx`.
  - Added optional `additionalCodeSnippets` schema/UI support (`academy/src/lib/schemas.ts`, `academy/src/components/CourseCurriculumStudio.tsx`), itemized all 7 Day-1 onboarding checklist items in Course 03 Step 07, added `Browser Allowlist` & `git log` to Step 02, and embedded copyable starter `AGENTS.md` (Engineering & Content) and `mcp_config.json` templates in Steps 04–06.
  - Committed & pushed `4423c54` (including Course 06 `enterprise-product-video-studio` + `gt-alpaca-teaser-16x9.mp4`), deployed to Vercel (`https://antigravity-academy-8ed0qum86-nexite-os.vercel.app`, aliased to `https://antigravity-academy-ten.vercel.app`), and verified `12/12` Python hooks, `29/29` Vitest, `0` Vercel runtime errors, and live browser SVG rendering across all 6 courses (`0/41` steps).
- [x] **Commits `2e31d5d` & `4423c54` Pushed to `origin/main`:** Pushed Course 05 (`notebooklm-antigravity`), Course 06 (`enterprise-product-video-studio` + `gt-alpaca-teaser-16x9.mp4`), Mermaid strict-SVG rendering fix, and Course 03 Day-1 checklist & templates cleanly to `origin/main`; verified `12/12` Python hook tests and `29/29` Vitest tests.
- [x] **Reusable Code-as-Video Studio + *Herd of Ibiza: GT-Alpaca Edition* 45s Launch Teasers + Course 06 Live Publish (`https://antigravity-academy-ten.vercel.app`):**
  - Built reusable `/Users/ralphb/Projects_Personal/product-video-studio` (Remotion + 60 fps Apple Silicon Metal GPU Playwright + FFmpeg `-14 LUFS` mastering) and rendered pro-played, beat-synced (`"HEY!"` double-jump lock) `16:9` (`24 MB`) and `9:16` (`22 MB`) masters for `herd_and_co`.
  - Authored Course 06 (`academy/content/courses/enterprise-product-video-studio/course.json` — 7 steps, Mermaid flowchart, 5 Prompt Vault cards) + live playable `/media/gt-alpaca-teaser-16x9.mp4` (`12 MB`, 6 chapter markers).
  - Passed `sync:resources` (37 resources, 6 courses), `tsc`, `eslint`, `29/29` Vitest, `12/12` Python hook tests, `next build`, Vercel production deploy (`https://antigravity-academy-8rs1tfgpi-nexite-os.vercel.app` aliased to `https://antigravity-academy-ten.vercel.app`), and live browser verification (Course 06 playback, chapter seek to `0:26`, Mermaid SVG, and 35/35 Prompt Vault cards).
- [x] **Course 05 (`notebooklm-antigravity`) & Live Production Publish (`https://antigravity-academy-ten.vercel.app`):**
  - Authored `academy/content/courses/notebooklm-antigravity/course.json` (6 steps, 2 Mermaid diagrams, 5 interactive prompt cards covering Drive/Docs/Slides bridges, Studio media export/handoff, reverse-sync, and drift audits) and added `/api/courses` assertions in `academy/tests/api-routes.test.ts`.
  - Passed `pnpm run sync:resources`, `pnpm audit --audit-level=high` (`0` high/critical), `tsc --noEmit`, `next lint`, `27/27` Vitest, and `next build`.
  - Deployed to Vercel production (`https://antigravity-academy-4we717co8-nexite-os.vercel.app`, aliased to `https://antigravity-academy-ten.vercel.app`) with HITL approval and passed all 5 live smoke tests.
- [x] **`code-factory` v2.3.0 Lit Software Factory, Practical Loop Engineering & 4-Course Integration (`0a4cda9` + Live Vercel Deploy):**
  - Synthesized Google/Kaggle 5-Day Vibe Coding Whitepapers + Addy Osmani's *The New Software Lifecycle* & Fall 2026 O'Reilly Radar arc into `.memory/research-vibe-coding-lit-factory.md`.
  - Upgraded `rules/AGENTS.md` (Section 8: Lit Factory, Selective Autonomy, Dual-Axis Verification, Context Economics, Goals vs. Loops, 8.5 KB), `cf-plan`, `cf-qa-review`, `orchestration.md`, and `plugin.json` (`v2.3.0`).
  - Created `skills/cf-loop-engineer/` (`SKILL.md` + `references/project-examples.md`) and `skills/cf-eval/` (`SKILL.md` + `references/eval-rubric.md`) with concrete `Project_Antigravity` recipes and rubrics.
  - Enriched Courses 01–03, added Course 04 (`lit-software-factory`), synced 37 live repo resources & 6 courses, pushed `0a4cda9` to `origin/main`, deployed to Vercel (`https://antigravity-academy-iai5pp4q4-nexite-os.vercel.app` aliased to `https://antigravity-academy-ten.vercel.app`), and verified 5/5 live smoke tests + `29/29` Vitest + `12/12` Python hook tests.
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
