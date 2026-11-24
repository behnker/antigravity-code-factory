# System Architecture

## 1. Overview
This repository serves two synergistic purposes:
1. **Antigravity Enterprise Code Factory Plugin (`/`):** A globally installed Antigravity plugin (`v2.1.0`, symlinked to `~/.gemini/config/plugins/code-factory`) providing always-on engineering invariants (`rules/AGENTS.md`), 11 SDLC workflow skills (`skills/cf-*`), 4 custom subagent personas (`agents/cf-*`), and a `PreToolUse` HITL safety gate (`hooks/hitl-gate.py`).
2. **Antigravity Academy (`/academy`):** A futuristic, glassmorphic Next.js App Router interactive learning & reference platform that ingests all live repository resources and packages each conversation's SDLC output into structured, expandable courses featuring Three.js 3D visualizers, Mermaid architecture diagrams, copyable parameterized prompts, an interactive HITL Hook Simulator, and chaptered video lessons.

## 2. Tech Stack
- **Plugin Runtime:** Markdown skills/rules/agents, JSON manifests (`plugin.json`, `hooks.json`), Python 3 stdlib (`hooks/hitl-gate.py` + `unittest`)
- **Academy Framework:** Next.js (App Router, React 19, TypeScript)
- **Styling & Design System:** Tailwind CSS v4 (`@theme` glassmorphic design tokens), `Space Grotesk` + `JetBrains Mono` (`next/font/google`)
- **3D & Motion Visualization:** Three.js (MIT) direct client islands, Motion (MIT), Mermaid (MIT, `securityLevel: 'strict'`), Lucide Icons (ISC)
- **Validation / Schema Library:** Zod (MIT) — build-time content validation, API boundary validation, and client `localStorage` hydration validation
- **Persistence:** v1 stateless client-side `localStorage` (Zod-validated w/ JSON export/import); structured for v2 Supabase Auth + Postgres RLS
- **Testing & Linting:** Python `unittest` (plugin hooks), Vitest + Testing Library + ESLint + `tsc --noEmit` (academy), Antigravity `browser` subagent visual QA (375px / 768px / 1440px)
- **Deployment / Infrastructure:** Vercel Preview & Production deployments (root directory `academy/`)

## 3. System Boundaries & Modules
- **Plugin Root (`plugin.json`, `hooks.json`, `rules/`, `skills/`, `agents/`, `hooks/`):** Discovered globally by Antigravity. Must remain isolated from web app build artifacts (`academy/node_modules`, `academy/.next`).
- **Workspace Memory & Specs (`.memory/`, `plans/`):** Ground-truth SDLC artifacts (Research, Architecture, ADRs, Locked Specs, QA Reports, Handovers, Tasks) that both drive development and are ingested live into Academy Course 2 as living SDLC case studies.
- **Academy Platform (`academy/`):**
  - `content/courses/<slug>/course.json` — Extensible multi-course registry (each conversation adds a validated course bundle).
  - `scripts/sync-resources.ts` — Allowlisted build-time ingestion scanning repo files + course bundles into Zod-validated JSON.
  - `src/app/api/*` — Stateless Next.js Route Handlers (`GET /api/courses`, `GET /api/resources`, `POST /api/hitl/simulate`) with explicit `maxDuration = 10`, pagination defaults/caps, and Zod validation.
  - `src/components/three/*` — Dynamically loaded (`ssr: false`) Three.js 3D WebGL visualizers with `IntersectionObserver` pausing, `prefers-reduced-motion` support, and SVG fallback.
  - `src/components/*` — Glassmorphic UI modules adhering strictly to design tokens and WCAG 2.1 AA.

## 4. Architecture Decision Records (ADRs)
See `.memory/decisions/` for numbered architectural decisions:
- [0002-academy-nextjs-glassmorphic-architecture.md](./decisions/0002-academy-nextjs-glassmorphic-architecture.md)
