# Active Milestone Tasks

## Current Milestone
- **Goal:** Build the **Antigravity Academy** futuristic glassmorphic interactive learning & showcase platform (`academy/`) using the full Enterprise Code Factory SDLC, featuring Course 1 (Antigravity vs. Claude Code Harness Appraisal) and Course 2 (Code Factory SDLC Reference Model) with Three.js 3D visualizers, video support, copyable prompts, and live repo resource ingestion.
- **Repository:** https://github.com/behnker/antigravity-code-factory

## In Progress
- [ ] **Stage 5 & Stage 6 Sign-Off:** Live Vercel deployment verified (`https://antigravity-academy-ten.vercel.app`, 3 courses, 29 resources, 0 high/critical CVEs); ready to commit/push final Stage 5–6 changes and collect user feedback.

## Up Next
- [ ] Commit & push CVE patches, Course 03 (`pro-setup-playbook`), Vercel config (`.vercelignore`), `.agents/rules/academy-invariants.md`, and updated `.memory/` records to `origin/main`.
- [ ] **Next Milestone (`code-factory` v3.0):** Fix missing `tools:` frontmatter in `agents/cf-*.md` and implement Phase 1–3 harness upgrades from `.memory/research.md`.
- [ ] Add video recordings (`mp4` / YouTube / Loom URLs) into `academy/content/courses/*/course.json` as episodes are recorded.

## Completed
- [x] **Stage 1 (`cf-research`):** Completed Antigravity vs. Claude Code Harness Appraisal (`.memory/research.md`) and Academy Platform Architecture & Dependency Research (`.memory/research-academy-platform.md`, flagging GSAP's proprietary EULA in favor of MIT `motion`).
- [x] **Stage 2A (`cf-grill-me`):** Locked 5 key architectural decisions (Next.js App Router, "Antigravity Academy" glassmorphic brand, unified `VideoStage`, Zod-validated `localStorage` in v1, Vercel staging preview).
- [x] **Stage 2B (`cf-plan`):** Locked `plans/antigravity-academy-spec.md`, ADR-0002, and `.memory/architecture.md`.
- [x] **Stage 3 (`cf-implement`):** Built `academy/` via Task 0 + 3 parallel non-overlapping Swarm workers + 27 deterministic Vitest tests (`next build` green, `5/5` Python hook tests green).
- [x] **Stage 4 (`cf-qa-review`):** Independent `cf-reviewer` + live `browser` audit (1440/768/375px); fixed all 3 blocking defects (Three.js negative-`dt` crash, WCAG contrast `5.70:1`, WAI-ARIA semantics) and re-verified 0 console errors & 0px overflow (`.memory/qa-report.md`).
- [x] **Security Patching & Course 03:** Remediated all 3 High/Critical CVEs (`zod@4.6.7`, `tinypool >= 2.1.2`, `postcss >= 8.5.18` -> 0 high/critical) and added Course 03 (`pro-setup-playbook` from `antigravity-pro-setup-guide.md`).
- [x] **Stage 5 (`cf-deploy-staging`):** Deployed to Vercel (`https://antigravity-academy-ten.vercel.app`) and passed all 5 live smoke tests (`/`, `/api/courses`, `/api/resources`, `/api/hitl/simulate` valid + 400).
- [x] **Stage 6 (`cf-learn` / `cf-handover`):** Distilled permanent project invariants into `.agents/rules/academy-invariants.md` and updated `.memory/handover.md` (<= 3 KB).
- [x] Downloaded and analyzed `Antigravity Enterprise Code Factory Blueprint.md` (v2.0.0) via Google Drive plugin.
- [x] Created plugin scaffold (`plugin.json`, `assets/logo.svg`, `README.md`) and consolidated global rules (`rules/AGENTS.md`, 6.3 KB, graceful `.memory/` mode + Cloudflare/Vercel/Supabase invariants).
- [x] Built all 11 `cf-*` SDLC & lifecycle skills (`cf-bootstrap` + script + 5 templates, `cf-start`, `cf-handover`, `cf-research`, `cf-grill-me`, `cf-plan`, `cf-implement` + orchestration playbook, `cf-qa-review`, `cf-deploy-staging`, `cf-triage`, `cf-learn`).
- [x] Built 4 custom Blueprint subagent personas (`cf-architect`, `cf-backend`, `cf-frontend`, `cf-reviewer`).
- [x] Built & unit-tested `PreToolUse` HITL safety gate (`hooks.json`, `hooks/hitl-gate.py`, `hooks/test_hitl_gate.py` — 5/5 suites passing).
- [x] Symlinked repo to `~/.gemini/config/plugins/code-factory` and verified live discovery via `GetAllPlugins`.
- [x] Created public GitHub repo `behnker/antigravity-code-factory` and pushed `main` through `2e89969`.
- [x] Installed official Marketplace plugins for Google Drive, Vercel, and Supabase alongside existing Cloudflare plugin.
