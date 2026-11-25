# ADR-0003: Dual-Mode Progressive-Disclosure ELI5, Hybrid Client Audio & Phased Swarm Upgrade Architecture

**Status:** Accepted (2026-11-25)  
**Date:** 2026-11-25  
**Related Spec:** `plans/eli5-multimodal-academy-spec.md`  
**Supersedes / Extends:** Extends `0002-academy-nextjs-glassmorphic-architecture.md` without modifying its core Next.js App Router, Three.js, MIT Motion, or `localStorage`+Zod boundaries.

---

## Context

Antigravity Academy (`academy/`) currently ships 6 engineering courses (`01` through `06`) written primarily for practicing software engineers. While strong on senior depth, absolute beginners (zero prior coding experience) hit an immediate jargon barrier, and learners who absorb concepts better through plain-English mental models, visual analogies, diagrams, and spoken narration lack a unified entry ramp.

We must upgrade the platform to an **8-course ELI5 + 4-Part Microlearning + Multimodal Academy** (`Course 00` through `Course 07`) while upholding all Code Factory invariants:
1. **Zero Knowledge Loss:** Every existing senior code snippet, repo artifact link, Prompt Vault card, and technical takeaway must remain intact.
2. **Zero UI-Core Fragmentation & Backward Compatibility:** Extending `academy/content/courses/<slug>/course.json` and `academy/src/lib/schemas.ts` must never break existing courses or Vitest suites during incremental rollout.
3. **Zero New Paid Runtime APIs or Secrets:** Audio explainers and bespoke course artwork must work deterministically on Vercel without third-party TTS/image-generation runtime API keys or client secret leaks.
4. **Bounded Swarm Safety:** Upgrading 8 courses across schemas, UI components, artwork, and tests must enforce strict file partitioning, a `<= 5` parallel worker concurrency cap, and decoupled verification (`cf-tester`, `cf-reviewer`, `browser`).

---

## Decision

1. **Unified Progressive-Disclosure Dual-Mode (`Eli5ConceptBlockSchema` + `learningDepthMode`):**
   - Extend `LessonStepSchema` with an **optional** `eli5` block (`Eli5ConceptBlockSchema`) containing a short `everydayAnalogy`, 4 structured microlearning sections (`simpleExplanation`, `whyItMatters`, `roleInProtocol`, `howToUseGoingForward`), `realWorldExample`, warm ear-first `audioScript`, optional allowlisted `audioUrl`, `estimatedMinutes`, and optional `diagramCaption`.
   - Extend `LearnerProgressSchema` with `learningDepthMode: z.enum(["eli5", "pro"]).default("eli5")` so new learners default to plain-English **Start Simple (ELI5)** mode (technical specs and code collapsed behind a **"Go Deeper: Senior Technical Specs & Code"** drawer), while experienced engineers can flip the global **Full Pro View** toggle (`role="group"` + `aria-pressed`) to auto-expand all technical drawers.
   - Keep `eli5`, `eli5Tagline`, and `illustration` optional during Phase 1 so Courses 02–06 remain schema-valid and render gracefully until upgraded in Phase 2.

2. **Two-Phase Delivery: Phase 1 Pilot Before Phase 2 Swarm Fan-Out:**
   - **Phase 1 (Pilot):** Lock Task 0 shared Zod schemas & state utilities, build the 3 multimodal UI components (`CourseIllustrationBanner`, `AudioExplainerBar`, `Eli5MicrolearningCard`), upgrade `CourseCurriculumStudio`, upgrade **Course 01 (`harness-mastery`)** with its bespoke illustration as the gold-standard template, and pass decoupled QA (`cf-tester`, `cf-reviewer`, `browser` at `375px / 768px / 1440px`) plus user sign-off.
   - **Phase 2 (Swarm Fan-Out):** After user approval of the Pilot aesthetic and readability, launch **4 concurrent Swarm workers** (`<= 5` cap) across zero-overlap course partitions (`00+02`, `03+04`, `05+06`, `07`), generate remaining `image-generator` illustrations, run a single Orchestrator `pnpm run sync:resources` synthesis pass, and execute full decoupled QA.

3. **Hybrid Zero-Secret Audio Architecture (`AudioExplainerBar`):**
   - Store conversational 30–60s `audioScript` text directly in `course.json` and optionally attach allowlisted local audio files (`/media/audio/*.mp3|wav|ogg|m4a` checked via `isAllowedAudioUrl`).
   - Play `/media/audio/*` via HTML5 `<audio>` when provided; otherwise synthesize speech client-side via the browser-native **Web Speech API (`window.speechSynthesis`)** with `0.9x` / `1.0x` / `1.25x` speed controls, clean unmount cancellation, an expandable **"Read Script"** transcript drawer, and an accessible non-blocking fallback when `speechSynthesis` is unavailable.

4. **Build-Time Editorial Artwork (`image-generator` → `/media/illustrations/*`) + Strict Allowlist:**
   - Generate 1 bespoke `16:9` glassmorphic editorial illustration per course during authoring (`academy/public/media/illustrations/<slug>.png`), validate paths at build time via `CourseIllustrationSchema` + `isAllowedImageUrl`, and render with Next.js `<Image>` inside CLS-safe `aspect-video` containers (zero `@next/next/no-img-element` lint warnings, zero CLS).

5. **Plain-English Strict-SVG Mermaid Diagrams (`htmlLabels: false`):**
   - Mandate a plain-English `mermaidDiagram` on 100% of upgraded steps, authored strictly without HTML tags (`<br/>`, `<b>`) and with double-quoted labels so `MermaidDiagram.tsx` (`securityLevel: "strict"`, `htmlLabels: false`) parses valid XML/SVG across every viewport.

---

## Alternatives Considered

1. **Separate Beginner Portal / Route (`/academy/eli5` or Duplicated Courses):**
   - *Pros:* Completely separate beginner copy without conditional UI drawers.
   - *Cons:* Doubles maintenance surface, splits Prompt Vault cross-links and `LearnerProgressSchema` state, and creates drift whenever courses evolve.
2. **Big-Bang Rewrite of All 8 Courses in One Shot (No Pilot Gate):**
   - *Pros:* Fewer coordination checkpoints.
   - *Cons:* High blast radius—any defect in tone, 4-part layout, or visual framing repeats 8 times before the user reviews a single rendered course.
3. **Server-Side Cloud TTS API or Committed Bulk MP3s for Every Step:**
   - *Pros:* Uniform neural voice across devices.
   - *Cons:* Server TTS requires API keys, runtime billing, rate limiting, and external network timeouts; committing ~50 MP3 files bloats Git history and Vercel static assets. Hybrid local `/media/audio/*` + Web Speech API avoids both while allowing selective studio MP3 upgrades later.
4. **Runtime AI Image Generation or External Image Hosts:**
   - *Pros:* Dynamic per-session artwork.
   - *Cons:* Slow loading, API costs, unpredictable visual contrast, and CSP/broken-link risks. Static build-time `image-generator` assets under `academy/public/media/illustrations/` are fast, deterministic, and offline/cache friendly.

---

## Consequences

- **Positive:**
  - Complete beginners enter cleanly via **Course 00 (`zero-to-one-foundations`)** and **Start Simple (ELI5)** mode, while senior engineers lose zero technical depth.
  - Zero new npm runtime dependencies, zero new API keys/secrets, and zero CVEs introduced.
  - Clean Task 0 -> Phase 1 Pilot -> Phase 2 4-Worker Swarm boundaries eliminate parallel merge conflicts.
  - Living **Course 07 (`orchestration-showcase`)** documents this exact multi-agent orchestration inside the platform itself.
- **Negative / Trade-offs:**
  - Browser `speechSynthesis` voice timbre varies slightly across macOS/Windows/Linux browsers (mitigated by clean **"Read Script"** drawer and optional `/media/audio/*` override hook).
  - Requires maintaining discipline in `cf-reviewer` audits against the **ELI5 Readability Rubric** so Part 1 explanations never regress into unexplained jargon.
- **Follow-up Actions:**
  - Lock `plans/eli5-multimodal-academy-spec.md` with Senior Engineer sign-off prior to Stage 3 Task 0.
  - Execute Phase 1 Pilot (`Task 0` + UI components + `Course 01` + illustration + decoupled QA) and pause for explicit user Pilot sign-off before launching Phase 2 Swarm workers.
