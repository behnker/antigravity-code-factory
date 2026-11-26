---
name: cf-website-factory
description: >-
  End-to-end 6-stage Vibe Website Factory orchestrator integrating Enterprise
  Code Factory (cf-bootstrap -> cf-plan -> /swarm -> cf-next-verify ->
  cf-verify-map -> cf-eval) with Token-First Design Systems (cf-design-tokens),
  3D/Three.js Craft (cf-threejs-craft), Tri-Layer SEO/AEO/GEO (cf-geo-seo),
  and automated Proof Pack capture for engineering documentation and case studies.
---

# Skill: Vibe Website Factory Pipeline (`cf-website-factory`)

Orchestrate cutting-edge, accessible, 3D-enhanced, AI-search-citable websites end-to-end under strict Enterprise Code Factory governance.

## Reference Template
- Creative Brief, Vibe-Design Recipe & Proof Pack Manifest: [references/vibe-brief-template.md](./references/vibe-brief-template.md)

## The 6-Stage Website Factory Pipeline

1. **Stage 0 — Bootstrap & Workspace Hygiene (`cf-bootstrap`):**
   - Initialize `.memory/`, `plans/`, `.memory/feature-map.md`, and `.dependency-cruiser.cjs`.
   - Ensure `.tmp/` is in `.gitignore`. Capture **Proof #01** (bootstrap tree & git status).

2. **Stage 1 — Grounded Research & Creative Brief (`cf-research` + `cf-grill-me`):**
   - Ground facts from NotebookLM / existing product repos (zero fabricated testimonials or stats).
   - Complete the Vibe-Design Creative Brief (brand identity, real visual references, palette polarity, 50% Hero anchor, target routes, and commercial goals).
   - Verify all proposed npm licenses (MIT / ISC / Apache-2.0) and run `pnpm audit --audit-level=high` (`0` High/Critical).

3. **Stage 2 — Locked Spec, Token System & 3D Asset Prep (`cf-plan` + `cf-design-tokens` + `cf-threejs-craft`):**
   - Lock `plans/<site>-spec.md` and `.memory/feature-map.md` (routes, `data-testid` selectors, API contracts).
   - Author `design/tokens.json` and compile `src/styles/tokens.css` via `cf-design-tokens/scripts/generate-tokens.mjs` (enforcing **WCAG ≥ 4.5:1** contrast and emitting Tailwind CSS v4 `@theme inline`).
   - Compress hero `.glb` assets via `cf-threejs-craft/scripts/optimize-glb.mjs` (Meshopt + `KHR_mesh_quantization` + WebP default) and log exact before/after byte savings (**Proof #02**).

4. **Stage 3 — Partitioned Swarm Implementation (`cf-implement`):**
   - Partition write ownership cleanly across isolated directories (zero shared-file collisions):
     - **Worker A (3D & Media):** `src/components/three/*`, `src/lib/audio.ts` (R3F v9, `<PerformanceMonitor>`, `Timer`, dev-only dynamic `lil-gui`, reduced-motion + WebGL-loss static fallback).
     - **Worker B (Token UI & Interactive Flows):** `src/components/ui/*`, `src/components/sections/*`, interactive configurators/forms.
     - **Worker C (SSR Routes, GEO/AEO/SEO & APIs):** `src/app/**/page.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/lib/schema-graph.ts`, `src/app/api/**/route.ts`, Vitest unit tests.

5. **Stage 4 — Full Deterministic & Decoupled Verification (`cf-qa-review` + `cf-eval`):**
   - Run all automated gates:
     1. `cf-next-verify/scripts/verify-stack.sh` (`tsc`, `eslint`, `vitest`, secret scan, `depcruise`, `next build`)
     2. `cf-design-tokens/scripts/validate-tokens.mjs --dir src/`
     3. `cf-threejs-craft/scripts/audit-threejs.mjs --dir src/`
     4. `cf-geo-seo/scripts/audit-geo-seo.mjs --html <renderedHtmlDir> --robots <robots.txt>`
     5. `cf-verify-map/scripts/run-verify-map.mjs --map .memory/feature-map.md --all-viewports` (375px / 768px / 1440px, 0 console/page/network errors, 0 horizontal overflow)
   - Delegate independent `cf-reviewer` audit (`cf-eval`) for an explicit **`SHIP` / `BLOCK`** verdict.

6. **Stage 5 — Proof Pack, Staging Deploy & Handover (`cf-deploy-staging` + `cf-handover`):**
   - Capture final stage screenshots & walkthrough recording (`proof-pack/`).
   - Deploy under HITL approval (`vercel`) and run live post-deploy smoke tests (SSR HTML, `robots.txt`, JSON-LD, API validation, 3D render).
   - Update `.memory/handover.md` (`<= 3 KB`) and `.memory/tasks.md`.
