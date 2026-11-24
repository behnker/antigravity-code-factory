# ADR-0002: Next.js App Router, Direct Three.js Islands, MIT Motion & Live Repo Ingestion for Antigravity Academy

**Status:** Accepted (2026-11-24)  
**Date:** 2026-11-24

## Context
We are building **Antigravity Academy**, an extensible interactive glassmorphic learning platform inside the `antigravity-code-factory` plugin repository (`~/.gemini/config/plugins/code-factory` symlink). The platform must:
1. Never interfere with Antigravity's plugin discovery at the repository root.
2. Automatically reflect live repository assets (`rules/`, `skills/`, `agents/`, `hooks/`, `.memory/`, `plans/`) and allow future conversations to add new courses cleanly.
3. Deliver futuristic glassmorphic UI, cutting-edge Three.js 3D visualizations, explainer animations, diagrams, copyable prompts, and video chapters while complying strictly with Code Factory invariants (MIT/Apache-2.0/BSD/ISC dependencies, Zod boundary validation, WCAG 2.1 AA, zero CLS, Vercel deployment).
4. Support future evolution to backend APIs, user accounts, and database-backed progress tracking without a platform rewrite.

## Decision
1. **Isolated Next.js App Router Sub-Project (`academy/`):** Place the web application in `academy/` with its own `package.json`, TypeScript config, and Vercel deployment root, keeping the root Antigravity plugin clean.
2. **Build-Time Allowlisted Repo Ingestion (`scripts/sync-resources.ts`):** Read only allowlisted repository directories and `academy/content/courses/*/course.json`, validate every record via Zod at build time, and emit a strongly typed manifest consumed by RSC pages and Route Handlers (`/api/courses`, `/api/resources`).
3. **Direct Three.js (`three`, MIT) Client Islands:** Mount interactive 3D scenes (`HarnessConstellationScene`, `SdlcOrbitalScene`) via imperative `useEffect` wrappers loaded with `next/dynamic({ ssr: false })`, DPR capped at 2, `IntersectionObserver` pausing, `prefers-reduced-motion` compliance, and a crisp SVG fallback when WebGL is unavailable.
4. **MIT `motion` over Proprietary GSAP:** Reject GSAP due to its proprietary Webflow Standard License (violating our MIT/Apache-2.0/BSD dependency invariant) and standardize on `motion` (MIT core) + CSS hardware-accelerated animations.
5. **Stateless v1 Client Persistence (`localStorage` + Zod):** Persist learner progress and prompt variables client-side in v1 with strict Zod hydration validation and JSON export/import, deferring Supabase Auth + Postgres RLS to v2.
6. **Pure TypeScript HITL Evaluator (`POST /api/hitl/simulate`):** Replicate `hooks/hitl-gate.py` regex & segment rules purely in TypeScript—never spawning child shell processes from a web API route.

## Alternatives Considered
1. **Single Self-Contained HTML File (CDN scripts):**
   - *Pros:* Zero build step; opens via `file://`.
   - *Cons:* Fragile external CDNs, no TypeScript/Zod compile-time safety, unmaintainable across expanding courses, poor Vitest testability, no backend API extensibility.
2. **Vite Static SPA (`academy/`):**
   - *Pros:* Lightweight static output.
   - *Cons:* Requires migration to Next.js or separate backend later when adding authenticated progress, server APIs, or AI-powered lab endpoints.
3. **React Three Fiber (`@react-three/fiber`):**
   - *Pros:* Declarative JSX 3D scene graph.
   - *Cons:* Adds heavier dependency tree and React major-version peer-dependency coupling compared to a clean imperative `three` wrapper.

## Consequences
- **Positive:** Future-proof Vercel-native full-stack architecture; 100% MIT/ISC/Apache-2.0 dependency hygiene; zero drift between plugin files and Academy docs; clean non-overlapping Swarm partitions for Stage 3 implementation.
- **Negative / Trade-offs:** Requires running `pnpm run sync:resources` (chained automatically into `dev`/`build`) and configuring Vercel's root directory to `academy/`.
- **Follow-up Actions:** Add `academy/.next/` and `academy/node_modules/` to root `.gitignore` during Stage 3 Task 0; consider adding a `cf-add-course` skill in a future milestone to automate new course scaffolding.
