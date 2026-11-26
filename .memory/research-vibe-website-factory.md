# Stage 1 Research Dossier: Vibe Website Factory, *Herd of Ibiza: GT Alpaca* Website & Academy Course 07

**Date:** 2026-11-25  
**Stage:** Stage 1 (`cf-research`) — Awaiting Senior Engineer Sign-Off  
**Primary Sources:**
- NotebookLM (`Vibe Design: Building Premium Websites with Gemini 3`, 37 active sources)
- `/Users/ralphb/Projects_Personal/herd_and_co` (live game, 3D assets, 22 Blender renders, music, monetisation spec)
- `/Users/ralphb/Projects_Personal/Project_herd_and_co` (Herd & Co. platform strategy & B2B offer ladder)
- `/Users/ralphb/Projects_Personal/product-video-studio` (45s *GT-Alpaca* launch teasers)
- `/Users/ralphb/Projects_Personal/Project_Antigravity` (Enterprise Code Factory `v2.4.0` + Antigravity Academy)

---

## 1. Problem Statement & Multi-Output Constraints

We are executing a **four-in-one flagship showcase** with strict engineering discipline:

1. **Product Deliverable — The *Herd of Ibiza: GT Alpaca* & *Herd & Co. Platform* Website:**
   - **Audience A (Players & Families):** Showcase and drive plays to the live free web & mobile game (*The Herd of Ibiza — GT Alpaca*, `https://www.alpacas-ibiza.app`), highlighting its 22 real Ibiza alpacas, 7 real Ibiza routes, 22 original character tracks, bilingual EN/ES educational quiz (*Herd Home Adventure*), live Herd Race leaderboard, and 45s launch trailer.
   - **Audience B (Local & Brand Sponsors):** Present child-safe, cookie-free, first-party in-game sponsorship & phygital merch opportunities (22 Adopt-an-Alpaca cards, Route/Landmark Presenting Sponsors with 3D wooden roadside signs, Herd Race Monthly Cup banner, QR calendar/merch unlockable scarves, and live zero-PII Media Kit telemetry).
   - **Audience C (Alpaca Farms, Petting Zoos & Smallholdings — UK, Europe, USA, Australia, Canada):** Introduce *GT Alpaca* as a **regional white-label game platform** where any alpaca farm, petting zoo, or smallholding can launch their *own* edition featuring their own real animals (alpacas, zebras, emus, ostriches, llamas, donkeys, goats), local roads & landmarks, local sponsors, soundtrack, and animal-education quiz — clearly detailing **options, step-by-step process, and business + animal-welfare outcomes**.
2. **Process Validation Deliverable — End-to-End Code Factory Stress Test:**
   - Execute the complete Enterprise Code Factory lifecycle from zero: `cf-bootstrap` → `cf-research` → `cf-grill-me` → `cf-plan` → `cf-implement` (Swarm / Orchestrator-Worker) → `cf-qa-review` + `cf-verify-map` + `depcruise` + `cf-eval` → `cf-deploy-staging` → `cf-handover`.
   - Validate the **NotebookLM Vibe Website Factory** pipeline (Token-First Design System, Hybrid SSR HTML + R3F/Three.js 3D Stage, GLB/KTX2 asset optimization, SEO/AEO/GEO Tri-Layer Discovery) inside the Code Factory harness.
3. **Proof & Capture Deliverable — End-to-End Evidence Pack:**
   - Capture timestamped screenshots, terminal gate outputs, before/after GLB compression metrics, 3-viewport (`375px`, `768px`, `1440px`) visual audits, and an end-to-end walkthrough recording at every stage.
4. **Curriculum Deliverable — Antigravity Academy Course 07:**
   - Package both the **NotebookLM Website Factory methodology** and the **live *GT Alpaca* worked example with visual proof** into Course 07 inside `Project_Antigravity/academy/` (complete with ELI5 + Pro modes, Mermaid diagrams, copyable Prompt Vault cards, proof screenshot galleries, and walkthrough video).

### Hard Constraints
- Zero hardcoded secrets, zero third-party ad trackers, zero invented testimonials/metrics.
- 100% SSR crawlable HTML for all headings, copy, FAQs, and JSON-LD (zero "WebGL Black Box" text traps).
- Strict Code Factory invariants: Zod validation at all boundaries, WCAG 2.1 AA (4.5:1 contrast, 44px touch targets, `:focus-visible`, `prefers-reduced-motion`), 3-viewport verification, `depcruise` architectural boundaries, decoupled verification (`cf-reviewer` / `cf-tester` / `cf-eval`).

---

## 2. NotebookLM 37-Source Methodology Synthesis

Synthesized directly from all 37 active sources across 4 structured extraction queries:

### Pillar 1 — Antigravity + Gemini 4 Neon Website Factory Pipeline
- **Setup:** Gemini 4 Neon (`high`/`xhigh` for architecture, spatial 3D, and specs; `medium`/`low` for routine formatting/metadata), `.agents/skills/` (`design-system`, `3d-web-experience`, `code-factory`), and a workspace Master Rules file pinning visual/motion/accessibility invariants so output never regresses to generic "AI slop."
- **Vibe-Design Briefing:** Combine core identity + real visual references (our Cycles figurine renders & promo banners) + explicit design lexicon (Bento grid, progressive glass blur, glowing border beam CTA, Z-axis scroll camera beats: *Entrance → Hold → Exit*).
- **Swarm Execution:** Orchestrator plans and locks specs → isolated parallel workers own non-overlapping folders (3D stage / Token UI / SEO+GEO+API) → independent verifier checks renders, tests, and Core Web Vitals.
- **Multimodal Iteration:** Feed localhost desktop/mobile screenshots back into context to tune lighting, framing, contrast, and motion timing.

### Pillar 2 — Token-First Design System (`tokens.json` → `tokens.css`)
- **Three-Layer Hierarchy:**
  1. *Primitive Tokens* (raw colors, font stacks, spacing, radii, durations)
  2. *Semantic Tokens* (`--color-surface-primary`, `--color-action-primary`, `--color-text-primary`, `--color-text-inverse`, `--border-subtle`) — named by intent, never appearance
  3. *Component Tokens* (scoped button, card, badge, blur-surface rules)
- **Automated Enforcement:** Build script compiles `tokens.json` (JSON Schema Draft-07 validated) → `tokens.css` (mounted into Tailwind CSS v4 `@theme`), paired with a CI validator (`validate-tokens`) flagging arbitrary hardcoded hex/pixel literals in `src/`.
- **50% Hero Rule & Layout Rhythm:** Dedicate ≥50% of visual craft to the above-the-fold Hero (sticky glass header, crisp H1 + value prop, glowing border-beam primary CTA + secondary action, interactive 3D hero stage + audio atmosphere toggle), followed by Social Proof / Live Metrics → Feature Bento Grid → Interactive 3D Showcase / Herd Roster → Trailer & Audio → Sponsorship Showcase → White-Label Farm Platform (Options / 4-Step Process / Outcomes) → FAQ Accordion (AEO 40–60 word answers) → Schema-aligned Footer.
- **Accessibility Tokens:** `--focus-outline-width: 3px`, `--touch-target-min: 44px`, minimum `4.5:1` normal text contrast, progressive `backdrop-filter` blur behind text overlaid on 3D scenes.

### Pillar 3 — Cutting-Edge 3D / Three.js / React Three Fiber & Performance Budgets
- **Hybrid DOM + WebGL:** Render all headings, value propositions, specs, tables, and links in SSR HTML layered cleanly over/beside the `<canvas>`. Apply `pointer-events: none` to passive overlays; maintain static high-res Cycles render fallback for `prefers-reduced-motion`, headless bots, or `webglcontextlost`.
- **Render Loop Discipline:** Use Three.js `Timer` (not deprecated `Clock`) with delta scaling; **never** call React `setState` or allocate `new THREE.Vector3()`/`Matrix4()` inside `useFrame`; dispose geometries/materials/textures on unmount.
- **Compression & Budgets:**
  - Optimize `.glb` with `@gltf-transform/cli` (`optimize` — Meshopt/Draco + `KHR_mesh_quantization` + `weld` + `prune`) to slash `avalon_poc.glb` (`4.5 MB` → target `< 500 KB`, ~85–90% savings!).
  - Target **≤ 100 draw calls** and **< 100k vertices** on mobile; ≤ 3 dynamic lights; shadow map ≤ 1024px mobile.
  - Clamp DPR: `Math.min(window.devicePixelRatio, 2)` + Drei `<PerformanceMonitor flipflops={3}>` adaptive scaling + `IntersectionObserver` lazy mounting for below-the-fold 3D.
  - Serve `.glb`/media with `Cache-Control: public, max-age=31536000, immutable` and preload hero `.glb` with `useGLTF.preload()`.

### Pillar 4 — Tri-Layer Search Discovery (SEO + AEO + GEO)
- **Layer 1 (SEO / Crawlability):** Vercel/MERJ study of **569M GPTBot fetches** showed **0% JS execution** → mandatory SSR/SSG HTML. `robots.txt` explicitly allows `GPTBot`, `ClaudeBot`, `PerplexityBot`, and `Google-Extended` (blocking `Google-Extended` silently removes the domain from Gemini Apps grounding). Clean `sitemap.xml` (200-only canonical URLs). Core Web Vitals targets: **LCP < 2.5s**, **INP < 200ms**, **CLS < 0.1**, **TTFB < 600ms**, raw HTML `< 1 MB`.
- **Layer 2 (AEO — Answer Engine Optimization):** Modular H2/H3 question headers paired with self-contained **40–60 word** answers + `FAQPage` and `HowTo` JSON-LD schemas.
- **Layer 3 (GEO — Generative Engine Optimization, arXiv:2311.09735 & AutoGEO arXiv:2509.08919):**
  - Connected `@graph` JSON-LD linking `Organization` (`Herd & Co.`) ↔ `VideoGame`/`SoftwareApplication` (`The Herd of Ibiza: GT Alpaca`) ↔ `Service` (`Regional Farm Edition Platform`) ↔ `FAQPage` ↔ `HowTo` ↔ `BreadcrumbList` via stable `@id` IRIs.
  - **Conclusion First:** Direct 50–150 word declarative summary in the opening 100–200 words of every core page.
  - **Fluency + Verifiable Statistics + Citations** (+35.8% AI citation lift) — use real game metrics (22 alpacas, 7 real Ibiza routes, 22 original songs, 0 third-party trackers, 60 FPS mobile budget) and comparison tables (*"Traditional Farm Marketing vs. Branded Regional GT Alpaca Edition"*).
  - **Topical Clustering / Query Fan-Out (+161% citation lift):** Dedicated spoke routes (`/game`, `/sponsors`, `/farms`, `/faq` or rich regional hub pages for UK, Europe, USA, Australia & Canada) interlinked cleanly within ≤ 3 clicks from `/`.

---

## 3. Codebase & Real Asset Inventory

### A. Live Game & Creative Assets (`/Users/ralphb/Projects_Personal/herd_and_co`)
- **Live Game URL:** `https://www.alpacas-ibiza.app` (Vercel project `herd-of-ibiza`, bilingual EN/ES, static Vite + Three.js + Vercel Function `/api/race.ts` + Supabase leaderboard).
- **Real Game Content (`src/game/data.ts`, `README.md`, `plans/monetisation-sponsor-platform-spec.md`):**
  - **22 Named Real Alpacas:** Abba, Avalon, Barbarella, Bardot, BeeGee, Binoche, Chet, Dusty, Fela, Badu, Bez, Fonda, Lewis, Marron, Mojo, Moloko, Nelson, Piaf, Sinatra, Suki, Toots, Vai — each with age, title, trait, bio, perk, coat hex, and music reference.
  - **7 Real Ibiza Routes:** Shearing Day (Es Figueral → Sant Carles), Heartland Lanes (Sant Carles → Santa Gertrudis), Race the Sunset (Santa Gertrudis → Café Mambo), Dusk to Dalt Vila, Harbour & Cliffs (Ibiza Town → Santa Eulària), Market Day (Las Dalias), plus Route 7.
  - **3 Modes:** *Wool Trails* (3D herding with drag steering, hay jumps, HUM rhythm recall, road-user close-call FLOW), *Herd Home Adventure* (4-tier bilingual educational quiz + Fireside Remix), and *Herd Race* (server-validated global leaderboard).
  - **15–22 Original Songs (`public/music/*.mp3`):** e.g., `alpacas-in-ibiza-theme-song.mp3`, `avalon-las-dalias.mp3` (106 BPM), `nelsons-mile.mp3` (76 BPM), `chet-moustache.mp3` (98 BPM), `sinatra-blue-eyes.mp3` (96 BPM).
- **Ready-to-Use 3D & Visual Assets:**
  - `creative/poc/avalon_poc.glb` (`4.5 MB`) — high-craft Blender sculpted vinyl-clay Avalon model (prime candidate for `@gltf-transform/cli` optimization showcase!).
  - `src/assets/models/{alpaca,fauna,landmarks,vehicles}.glb` (`359–426 KB` each) — lightweight in-game 3D assets.
  - `creative/herd-poc/marketing/01..05*.png` — 5 polished studio marketing posters (`01_full_herd_collectible_poster.png`, `04_character_track_cards.png`, `05_promo_social_banner.png`, etc.).
  - `creative/herd-poc/renders/herd/*.png` — all 22 sculpted vinyl-clay character renders.
  - `creative/poc/renders/{avalon_hero_diorama,avalon_turnaround_sheet}.png` & `mock_ibiza_trail.png`.
  - `public/alpacas/*.jpg` — 22 real/illustrated portraits; `public/fonts/` — `Fraunces` (600/700, OFL) + `DM Sans` (400/600/700, OFL).
  - `marketing/calendar-qr-pack/pack/` — verified QR badges pointing to `https://www.alpacas-ibiza.app`.
- **Existing Brand Visual System (Verified from Studio Renders):**
  - Warm Balearic Palette: Deep Pine/Teal (`#0F5E57` / `#0A3D39`), Sunlit Ibiza Sand/Ivory (`#FAF2E6` / `#F3E4CE`), Sunset Terracotta/Amber (`#D96240` / `#E08A4F`), Deep Espresso Dark (`#171311` / `#261C18`), Mediterranean Sky (`#3B6F9C`).
  - Typography: `Fraunces` display serif + `DM Sans` body sans + `JetBrains Mono` technical metadata.

### B. Video Assets (`/Users/ralphb/Projects_Personal/product-video-studio`)
- `out/gt-alpaca-teaser-16x9-master.mp4` (`24 MB`) and `out/gt-alpaca-teaser-9x16-master.mp4` (`22 MB`) — plus web-optimized `12 MB` copy in `Project_Antigravity/academy/public/media/gt-alpaca-teaser-16x9.mp4`.

### C. Business & Platform Strategy (`/Users/ralphb/Projects_Personal/Project_herd_and_co`)
- **Founders:** Ralph & Bella Mae (`Herd & Co.`).
- **Core Differentiator:** Animal welfare + farm revenue move together ("More income per animal = better care; education products = calmer animals").
- **Sponsor Pillars (`herd_and_co/plans/monetisation-sponsor-platform-spec.md`):** 22 Adopt-an-Alpaca cards, Route/Landmark Presenting Sponsors (including 3D wooden roadside signs), Herd Race Monthly Cup banner, phygital merch QR codes (unlocking 3D cosmetic scarves), zero-PII daily aggregate Media Kit dashboard (`/sponsors/report`).
- **Multi-Region & Multi-Species Expansion:** Alpaca farms, petting zoos, and smallholdings across the **UK, Europe, USA, Australia, and Canada** — supporting custom herds including **alpacas, zebras, emus, ostriches, llamas, donkeys, and goats** with localized roads, landmarks, sponsors, quizzes, and languages.

### D. Antigravity Academy Integration (`/Users/ralphb/Projects_Personal/Project_Antigravity/academy`)
- Courses 00–06 live under `academy/content/courses/<slug>/course.json` validated by Zod in `academy/src/lib/schemas.ts`.
- Currently `LessonStepSchema` supports `summary`, `eli5`, `keyTakeaways`, `actionChecklist`, `codeSnippet`, `additionalCodeSnippets`, `mermaidDiagram`, `repoArtifactPath`, and `promptId`, while `CourseSchema` supports one `illustration` and one chaptered `video`.
- **Small, Clean Schema Enhancement Needed for Course 07:** Add an optional `proofGallery` array to `LessonStepSchema` (strictly allowlisted to `/media/proof/<filename>.(png|webp|jpg)`) so Course 07 can render **inline stage-by-stage worked-example screenshots & before/after comparisons** directly inside each lesson step!
- Note: `Project_Antigravity` currently has staged (uncommitted) v2.4.0 Academy curriculum edits (`contracts.ts` + 5 `course.json` files).

---

## 4. Technical Feasibility & Architectural Trade-Offs

| Decision Area | Option A (Recommended) | Option B (Alternative) | Trade-Off Analysis |
|---|---|---|---|
| **Web Framework** | **Next.js 16 (App Router, SSR/SSG, React 19, Turbopack)** | Vite SPA (React 19) | **Next.js 16 wins decisively:** Query 4 proves AI bots (GPTBot/ClaudeBot/PerplexityBot) execute **0% JS**. App Router gives instant SSR HTML, `generateMetadata`, native `robots.ts` & `sitemap.ts`, Server Components, and Vercel Route Handlers for validated inquiry APIs. |
| **3D Showcase Architecture** | **Hybrid SSR HTML + R3F v9 / Drei v10 / Three.js r187** (`avalon_poc.glb` compressed via `@gltf-transform/cli`, scroll-bound camera, `<PerformanceMonitor>`, reduced-motion/WebGL-loss Cycles render fallback) | Static 2D Cycles renders only | **Hybrid R3F wins:** Directly validates Pillar 3 of the NotebookLM playbook, delivers an unmistakable "cutting-edge interactive 3D" Hero + Interactive Figurine/Species Stage, while keeping 100% of text/SEO in SSR DOM and degrading gracefully on low-power devices. |
| **Design System** | **Token-First Pipeline** (`design/tokens.json` → `scripts/generate-tokens.mjs` → `src/styles/tokens.css` → Tailwind CSS v4 `@theme` + `scripts/validate-tokens.mjs` CI gate) | Standard Tailwind config with inline classes | **Token-First Pipeline wins:** Directly implements Pillar 2, enables instant dark/sunlit theme polarity, enforces zero hardcoded hex values in CI, and creates an inspectable Code Factory artifact for Course 07. |
| **Multi-Page Information Architecture (GEO Hub-and-Spoke)** | **5 Focused SSR Routes:** `/` (Flagship Interactive Hub), `/game` (Full 22-Alpaca Herd, 7 Routes, Music & Trailer), `/sponsors` (In-Game Advertising, 3D Signs, Zero-PII Media Kit & ROI), `/farms` (White-Label Regional Platform for UK/EU/US/AU/CA Farms & Petting Zoos + Species Customizer), `/faq` (Complete AEO/GEO Knowledge Hub + Inquiry) | Single long scrolling page | **5-Route Hub-and-Spoke wins:** Query 4 proves topical clustering drives a **+161% AI citation lift** via Query Fan-Out, keeps each page's HTML `< 1 MB` and focused on a crisp user intent, and lets us validate multi-route `cf-verify-map` across all 5 routes × 3 viewports! |
| **Repository Placement** | **Dedicated New Repo** (`/Users/ralphb/Projects_Personal/gt-alpaca-website`) initialized cleanly via `cf-bootstrap` | Subfolder inside `herd_and_co` or `Project_herd_and_co` | **Dedicated Repo wins:** Cleanest, zero-risk validation of `cf-bootstrap` from scratch, zero blast radius on the live `herd_and_co` game repo, independent Vercel deployment, and crystal-clear git/screenshot evidence for Course 07. |
| **Inquiry Backend** | **Stateless Next.js Route Handler** (`POST /api/inquiries`) with Zod validation, honeypot, rate limiting, `maxDuration = 10`, optional Resend email forwarding + structured JSON response (clean dev/demo mode when no email key is set) | External third-party form embed (Typeform/Tally) | **Stateless Route Handler wins:** Zero third-party tracking cookies, full Code Factory security/boundary test coverage (`cf-tester` + `cf-reviewer`), works immediately in staging and wires cleanly to Resend when configured. |

---

## 5. Dependency Evaluation (Verified Live via `npm view`)

All proposed dependencies use permissive open-source licenses (**MIT** or **ISC**; **Apache-2.0** for Playwright dev tool) with zero GPL/AGPL/proprietary lock-in:

| Package | Verified Version | License | Scope | Purpose |
|---|---|---|---|---|
| `next` | `16.4.6` | MIT | Runtime | App Router SSR/SSG, `robots.ts`, `sitemap.ts`, Route Handlers |
| `react` / `react-dom` | `19.3.1` | MIT | Runtime | UI runtime (compatible with R3F v9 `>=19 <19.4`) |
| `tailwindcss` / `@tailwindcss/postcss` | `4.3.5` | MIT | Build | CSS-first `@theme` wired to generated `tokens.css` |
| `three` | `0.187.0` | MIT | Runtime | 3D engine (r187 `Timer`, WebGL2/WebGPU compatible) |
| `@react-three/fiber` | `9.8.2` | MIT | Runtime | Declarative React 19 3D canvas & `useFrame` ref loop |
| `@react-three/drei` | `10.7.9` | MIT | Runtime | `<PerformanceMonitor>`, `useGLTF`, `ContactShadows`, `Environment`, `Float` |
| `motion` | `14.14.0` | MIT | Runtime | Scroll choreography, glowing border beams, micro-interactions |
| `lenis` | `1.3.28` | MIT | Runtime | Smooth inertial scrolling (respects `prefers-reduced-motion`) |
| `lucide-react` | `1.80.0` | ISC | Runtime | Accessible vector icons |
| `zod` | `4.6.7` | MIT | Runtime | API/form/token-schema runtime validation |
| `@gltf-transform/cli` | `4.5.1` | MIT | Dev / Asset Pipeline | Meshopt/Draco + `KHR_mesh_quantization` GLB optimization |
| `vitest`, `@testing-library/react`, `jsdom` | latest | MIT | Dev / Test | Deterministic unit & component test suite |
| `dependency-cruiser` | latest | MIT | Dev / Gate | Architectural boundary enforcement (`cf-next-verify` Step 4b) |
| `playwright` | latest | Apache-2.0 | Dev / Gate | `cf-verify-map` 3-viewport gate + automated Course 07 stage screenshots |

*Security Gate:* `pnpm audit --audit-level=high` will be run immediately upon installation (Stage 3) and must report **0 High / 0 Critical CVEs**.

---

## 6. Security, Privacy, Child-Safety & Performance Impact Assessment

- **Zero Hardcoded Secrets & Zero PII Persistence:** All optional env vars (`RESEND_API_KEY`, `INQUIRY_TO_EMAIL`, `NEXT_PUBLIC_SITE_URL`) read exclusively from server env config; no secret ever prefixed with `NEXT_PUBLIC_*`. No ad trackers or third-party cookies.
- **Child-Safe Outbound Posture:** Consistent with `herd_and_co`, every external link uses `rel="noopener noreferrer"` and strictly allowlisted HTTPS origins (`https://www.alpacas-ibiza.app`, farm/social URLs); no programmatic ad SDKs anywhere.
- **API Abuse Controls:** `POST /api/inquiries` validates all fields strictly with Zod (`role: "sponsor" | "farm" | "press" | "general"`, bounded string lengths, enum regions, honeypot trap field, explicit payload size cap `<= 8 KB`, in-memory sliding-window rate limit + `maxDuration = 10`).
- **Performance & 3D Safety Budgets:**
  - `avalon_poc.glb` compressed via `@gltf-transform/cli` from `4.5 MB` → target `< 500 KB`.
  - DPR capped `<= 2`, `<PerformanceMonitor flipflops={3}>`, `IntersectionObserver` pause/lazy-load, explicit `.dispose()` on unmount, WebGL context-loss & `prefers-reduced-motion` static fallback to Cycles renders.
  - Core Web Vitals targets: `LCP < 2.5s`, `INP < 200ms`, `CLS < 0.1`, `TTFB < 600ms`.
  - `robots.txt` explicitly allows `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`.

---

## 7. Recommended Direction & End-to-End Proof Capture Plan

1. **Bootstrap & Build Standalone Site** in `/Users/ralphb/Projects_Personal/gt-alpaca-website` (or user-confirmed path) starting with `bash ~/.gemini/config/plugins/code-factory/skills/cf-bootstrap/scripts/bootstrap.sh`, verifying every Code Factory gate (`cf-research` → `cf-grill-me` → `cf-plan` → `cf-implement` via Swarm → `cf-next-verify` + `cf-verify-map` + `depcruise` + `cf-reviewer` / `cf-eval` → Vercel preview/prod).
2. **Capture Proof Pack Continuously** into `proof-pack/` (timestamped stage screenshots: `01-bootstrap`, `02-tokens-and-glb-compression`, `03-hero-3d-stage`, `04-game-roster-and-audio`, `05-sponsors-and-farms-platform`, `06-geo-schema-and-ssr-check`, `07-verify-map-3viewports`, `08-qa-verdict-and-deploy` + Playwright walkthrough recording).
3. **Author & Verify Course 07** (`vibe-website-factory`) in `Project_Antigravity/academy/` with the full 4-pillar NotebookLM methodology + inline `proofGallery` screenshots + walkthrough video + Prompt Vault cards + ELI5/Pro toggle, passing all `academy/` verification gates.
