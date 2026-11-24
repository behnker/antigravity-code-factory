# Stage 1 Research: Antigravity Academy — Interactive Glassmorphic Learning & Showcase Platform

**Date:** 2026-11-24  
**Stage:** 1 (`cf-research`) — Platform Architecture, Design System, 3D Engine & Dependency Discovery  
**Workspace:** `antigravity-code-factory` (`/Users/ralphb/Projects_Personal/Project_Antigravity`)  
**Companion Research:** [research.md](./research.md) (Course 1 Subject Matter: Antigravity vs. Claude Code Harness Appraisal)  
**Status:** Ready for Stage 1 Sign-Off & Stage 2A (`cf-grill-me`)

---

## 1. Problem Statement & Constraints

### Vision & Objectives
Build an interactive, futuristic, glassmorphic HTML learning platform (**Antigravity Academy**) inside this repository that:
1. Surfaces **all resources in this repo** (`rules/AGENTS.md`, 11 `skills/cf-*`, 4 `agents/cf-*`, `hooks/hitl-gate.py`, `.memory/*`, `plans/*`) in a structured, step-by-step engineering curriculum for both beginners and senior engineers.
2. Features **one-click copyable prompts** (with customizable parameters), **interactive visualizers**, **Mermaid architecture diagrams**, **explainer animations**, **cutting-edge Three.js 3D visualizations**, and **native video support** (chapters, embeds/MP4, synchronized notes).
3. Uses an **extensible, schema-validated multi-course content architecture** so every future conversation in this repo can cleanly add a new course, module, lesson, video, or SDLC case study without rewriting core platform code.
4. Serves as the **ultimate meta-showcase of Antigravity building tools to teach and extend itself**, documenting every stage of the Enterprise Code Factory SDLC (`Research → Grill-Me/Spec → Architecture → Build → Test/QA → Deploy → User Feedback → Optimise`) live inside the repository and on the platform.

### Hard Constraints
- **Plugin Root Isolation:** The repo root is symlinked to `~/.gemini/config/plugins/code-factory`. Platform code MUST live in an isolated subdirectory (e.g., `academy/`) so Antigravity's plugin discovery (`plugin.json`, `hooks.json`, `rules/`, `skills/`, `agents/`) remains 100% clean and unaffected.
- **Code Factory Invariants (`rules/AGENTS.md`):**
  - Strictly permissive dependencies (**MIT / Apache-2.0 / ISC / BSD** preferred; flag proprietary licenses).
  - Runtime schema validation (**Zod**) for all course manifests, repo-ingested resources, and learner state.
  - Design-token-driven styling (zero arbitrary inline hex colors or magic spacing), **WCAG 2.1 AA** (≥ 4.5:1 text contrast even over glassmorphic layers, keyboard navigation, `:focus-visible`, `prefers-reduced-motion` support), explicit **Loading / Error / Empty** states, and zero **CLS**.
  - Responsive across **Mobile (375px)**, **Tablet (768px)**, and **Desktop (1440px)**.
  - Deterministic unit tests (Vitest) + Stage 4 live `browser` subagent visual/console audit.

---

## 2. Codebase Findings & Integration Points

### Local Toolchain Verified
- `node v26.3.0`, `npm 11.16.0`, `pnpm 11.9.0`, `python3 3.14.6`, `vercel 58.4.4` (CLI installed and ready for Stage 5 staging preview deploys).
- `wrangler` is not globally installed (`npx wrangler` available if Cloudflare is chosen).

### Live Repository Assets Available for Auto-Ingestion
A build-time generator script (`academy/scripts/sync-resources.ts`) can read and validate the live repo files directly into typed JSON data (`academy/src/data/generated-repo-manifest.json`), ensuring the platform never drifts from the actual plugin:
- **Manifest & Governance:** `plugin.json`, `rules/AGENTS.md`
- **11 SDLC Skills:** `skills/cf-{bootstrap,start,handover,research,grill-me,plan,implement,qa-review,deploy-staging,triage,learn}/SKILL.md` + `orchestration.md` + bootstrap templates
- **4 Agent Personas:** `agents/cf-{architect,backend,frontend,reviewer}.md`
- **Safety Hook Engine:** `hooks.json`, `hooks/hitl-gate.py`, `hooks/test_hitl_gate.py` (can power an interactive in-browser HITL Command Sandbox!)
- **Living SDLC Artifacts (Course 1 & Meta-Build Case Study):** `.memory/research.md`, `.memory/research-academy-platform.md`, `.memory/architecture.md`, `.memory/decisions/*.md`, `plans/*-spec.md`, `.memory/qa-report.md`, `.memory/handover.md`, `.memory/tasks.md`

---

## 3. Technical Feasibility & Architectural Trade-Offs

### 3.1 Frontend Architecture Options

| Option | Stack | Pros | Cons | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Option A: Single Raw HTML File (CDN scripts)** | Vanilla HTML/CSS/JS + esm.sh CDN imports | Zero build step; opens directly via `file://` or static server. | Fragile CDN dependencies; no TypeScript/Zod compile-time guarantees; poor maintainability as courses grow; hard to unit-test with Vitest; messy Three.js bundling. | Reject for long-term multi-course platform |
| **Option B: Vite + React 19 + TypeScript + Tailwind v4 + Three.js (Static SPA / SSG output)** | Vite 6, React 19, TypeScript, Tailwind CSS v4, Zod, Three.js, Motion, Mermaid, Lucide, Vitest | Lightning-fast builds; strict TypeScript + Zod schema validation for extensible multi-course JSON/MD content; clean modular component architecture for parallel Swarm implementation; builds to a static `dist/` deployable anywhere (Vercel, Cloudflare Pages, GitHub Pages) OR single-file bundle; first-class Vitest unit testing. | Requires `pnpm install && pnpm build` step (trivial with Node v26/pnpm already installed). | **Recommended** |
| **Option C: Next.js App Router (Full-Stack)** | Next.js + React + Tailwind + Three.js | Native SSR, API routes, and Vercel integration. | Overkill if there is no backend database/auth in v1; adds RSC vs. Client boundary complexity around Three.js/WebGL and larger repo footprint inside a plugin repo. | Only if user wants server-side auth/DB progress tracking in v1 |

### 3.2 3D & Animation Engine Trade-Offs

| Capability | Candidate A | Candidate B | Recommended Choice |
| :--- | :--- | :--- | :--- |
| **3D Engine** | **Three.js (`three`)** directly via clean imperative React canvas wrapper (MIT) | `@react-three/fiber` + `@react-three/drei` (MIT) | **Direct `three` (MIT) inside a dedicated `ThreeSceneCanvas` module** — zero React 19 peer-dependency friction, full control over WebGLRenderer / EffectComposer bloom / custom GLSL shaders / particle splines / ResizeObserver / `prefers-reduced-motion` / instant WebGL fallback card, and tiny bundle footprint. |
| **UI Motion & Explainer Animations** | **Motion (`motion`)** (MIT core) + CSS `@keyframes` + View Transitions | **GSAP** (Proprietary Standard "No Charge" EULA — non-MIT) | **Motion (`motion`, MIT) + CSS hardware-accelerated transforms** — 100% MIT-compliant per `AGENTS.md` Section 3.4, avoiding GSAP's proprietary EULA while delivering spring physics, staggered reveals, layout animations, and interactive SVG explainer paths. |
| **Diagrams** | **Mermaid (`mermaid`, MIT)** pre-configured with custom futuristic dark glass theme | Custom static SVGs only | **Mermaid (MIT)** with lazy dynamic import + interactive pan/zoom wrapper AND custom animated SVG explainer diagrams for key harness concepts. |
| **Video Architecture** | Unified **`VideoStage`** component supporting MP4/WebM (`<video>`), YouTube/Vimeo/Loom privacy-enhanced iframes, clickable timestamp chapters, transcript accordion, and rich glassmorphic placeholder state | Raw iframe embeds only | **Unified `VideoStage`** validated by Zod (`provider: 'mp4' | 'youtube' | 'vimeo' | 'loom' | 'coming_soon'`), guaranteeing 16:9 aspect-ratio CLS lock and WCAG captions/controls. |

### 3.3 Extensible Multi-Course Architecture ("Every Conversation Adds a Course")
To guarantee that every future conversation in this repo can expand the platform cleanly without touching core UI code:
- **Content-as-Data Directory:** `academy/content/courses/<course-slug>/course.json` (plus optional `lessons/*.md` and `media/`).
- **Strict Zod Contract:** `CourseSchema` defines `id`, `slug`, `title`, `level` (`beginner | intermediate | senior`), `track`, `estimatedMinutes`, `threeScenePreset` (`harness-constellation | sdlc-orbital | hook-pipeline | swarm-topology`), `video` (optional URL + chapters), `concepts[]`, `steps[]`, `prompts[]` (with `variables[]` for interactive interpolation), `diagrams[]` (Mermaid), `sdlcArtifacts[]` (linked to live `.memory/` & `plans/` files), and `quiz/checkpoint[]`.
- **Auto-Discovery:** `academy/scripts/sync-resources.ts` automatically scans `academy/content/courses/*/course.json` AND the root plugin files (`rules/`, `skills/`, `agents/`, `hooks/`, `.memory/`, `plans/`), validates every entry against Zod (failing the build on invalid schema!), and emits a typed bundle.
- **Future Authoring Skill:** We can later add a `cf-add-course` skill so future sessions execute a 1-command pipeline to package any conversation's Research/Spec/Build/QA work into a new course module.

---

## 4. Dependency Evaluation (License & Security Compliance)

| Package | Purpose | License | Security / Health Assessment | Decision |
| :--- | :--- | :--- | :--- | :--- |
| `react`, `react-dom` | Modular component UI | MIT | Industry standard, actively maintained | **Approve** |
| `vite`, `@vitejs/plugin-react`, `typescript` | Fast ESM build & static type checking | MIT / Apache-2.0 | Industry standard | **Approve** |
| `tailwindcss`, `@tailwindcss/vite` | Token-driven utility styling & glassmorphic theme (`@theme`) | MIT | Official Tailwind v4 CSS-first token system | **Approve** |
| `three`, `@types/three` | Interactive 3D WebGL scenes, post-processing bloom, particle flows | MIT | Gold standard 3D web engine; zero proprietary restrictions | **Approve** |
| `motion` | Spring physics, explainer animations, micro-interactions | MIT (core) | Clean MIT alternative to proprietary GSAP | **Approve** |
| `mermaid` | Live architectural & sequence diagrams | MIT | Standard Markdown-native diagram engine; sanitize via `securityLevel: 'strict'` | **Approve** |
| `lucide-react` | Crisp vector iconography | ISC | Lightweight tree-shakable icons | **Approve** |
| `zod` | Runtime validation for courses, repo manifest, prompt templates, learner state | MIT | Required by Code Factory Security Invariant #2 | **Approve** |
| `vitest`, `@testing-library/react`, `jsdom` | Deterministic unit & component testing | MIT | Native Vite test runner | **Approve** |
| ~~`gsap`~~ | ~~Animations~~ | **Proprietary EULA** | **Flagged** — non-MIT license restricted from competing visual editors | **Reject (use `motion` MIT)** |

---

## 5. Security & Performance Impact Assessment

### Security
1. **XSS Prevention in Dynamic Content & Diagrams:** Configure Mermaid with `securityLevel: 'strict'`. Render Markdown/code blocks strictly via safe React AST/escaped text (never raw `dangerouslySetInnerHTML` on untrusted strings). Validate all external video embed URLs against a strict Zod domain allowlist (`youtube-nocookie.com`, `player.vimeo.com`, `loom.com`, or relative `/media/*.mp4`).
2. **Zero Secret Exposure:** Build-time repo sync (`sync-resources.ts`) MUST explicitly allowlist safe paths (`plugin.json`, `rules/`, `skills/`, `agents/`, `hooks/`, `.memory/`, `plans/`) and NEVER bundle `.env*`, `.git/`, or credentials.
3. **Stateless Client State:** Learner progress and custom prompt variables are stored safely in `localStorage` validated through Zod on hydration (corrupted JSON gracefully resets to default empty state).

### Performance & Visual Quality
1. **Three.js GPU & Battery Hygiene:** Cap `devicePixelRatio` at `Math.min(window.devicePixelRatio, 2)`, pause `requestAnimationFrame` when the canvas is scrolled out of viewport (`IntersectionObserver`) or tab is hidden (`document.visibilityState`), respect `prefers-reduced-motion: reduce`, and provide a crisp high-tech SVG/CSS fallback if WebGL is unavailable.
2. **Code Splitting:** Lazy-load `three` and `mermaid` chunks via dynamic `import()` so initial First Contentful Paint stays fast and main bundle stays lean.
3. **Glassmorphism + WCAG 2.1 AA Contrast:** Translucent glass panels over animated 3D canvases can easily fail 4.5:1 contrast if unmanaged. Enforce dark tinted glass backdrops (`rgba(10, 15, 30, 0.76)` with `backdrop-filter: blur(20px)`), crisp 1px luminous borders (`rgba(148, 163, 184, 0.18)`), and high-contrast foreground text tokens (`#F8FAFC` primary, `#CBD5E1` secondary) audited across all 3 viewports during Stage 4.
4. **Zero CLS:** Pre-allocate fixed aspect ratios (`aspect-video` for `VideoStage`, explicit min-heights for Three.js canvases and Mermaid containers) with smooth glassmorphic skeletons during lazy hydration.

---

## 6. Recommended Direction

Build **`Antigravity Academy`** under `academy/` using **Option B (Vite + React 19 + TypeScript + Tailwind v4 + Three.js + Motion + Mermaid + Zod + Vitest)** with:
1. **Course 1 pre-loaded from live repo research:** *"Mastering the Agent Harness: Antigravity vs. Claude Code & Plugging the Gaps"* (interactive 12-dimension scorecard, Raw vs. Code Factory v3.0 toggle, copyable engineering prompts, HITL hook simulator, and architecture diagrams).
2. **Course 2 pre-loaded from the live repo plugin:** *"The Enterprise Code Factory SDLC Reference Model"* (walking step-by-step through all 8 stages — Research, Spec, Architecture, Build, Test, Deploy, User Feedback, Optimise — with every real `cf-*` skill, persona, rule, and live `.memory/` artifact from this exact build exposed as an interactive textbook!).
3. **Interactive 3D Three.js Hero & Concept Visualizers** (Neural Agent Harness Constellation + 3D Orbital SDLC Pipeline + Hook Interception Particle Flow).
4. **Unified Video Stage** ready for course walkthroughs & chaptered explainers.
5. **Full Code Factory SDLC Execution** (Steps: Stage 2A `cf-grill-me` → Stage 2B `cf-plan` locked spec + ADR → Stage 3 `cf-implement` Swarm parallel build → Stage 4 `cf-qa-review` + `browser` subagent visual audit at 375/768/1440px → Stage 5 `cf-deploy-staging` preview deploy → Stage 6 `cf-triage` / `cf-learn` / `cf-handover`).
