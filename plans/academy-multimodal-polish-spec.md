# Locked Feature Specification: Academy Multimodal Polish (Course 00–08 Videos & Interactive Micro-Labs)

**Status:** Locked (Stage 2A Decisions `A1–A4` Approved)  
**ADR:** `.memory/decisions/0009-academy-explainer-videos-and-micro-labs.md`  
**New Dependencies in `academy/`:** `0` (`package.json` and `pnpm-lock.yaml` untouched)

---

## 1. Objectives & Scope

1. **All 9 Academy Courses Playable (`/media/*.mp4`):**
   - **Course 08 (`vibe-website-factory`):** Transcode real `/Users/ralphb/Projects_Personal/gt-alpaca-website/proof-pack/09-launch-and-walkthrough/walkthrough.webm` (`1280×800`, VP9, `13.6s`, `3.62 MB`) via FFmpeg into web-optimized `academy/public/media/gt-alpaca-walkthrough-16x9.mp4` (`1280×720` H.264 `yuv420p` `+faststart`, AAC stereo ambient bed) with 6 chapter markers synced to the exact `00:14` walkthrough timeline (`0s`, `3s`, `5s`, `8s`, `10s`, `12s`).
   - **Courses `00–05` & `07`:** Render 7 deterministic `24s` (`720` frames @ `30 fps`, `1280×720`) H.264 `+faststart` Code-as-Video motion explainers using a parameterized Remotion composition in `/Users/ralphb/Projects_Personal/product-video-studio` (`AcademyCourseExplainer`), combining each course's bespoke `/media/illustrations/<slug>-studio.jpg` artwork, course number/emblem badge, kinetic chapter cards synced 1:1 to `video.chapters[]` timestamps (`0s`, `4s`, `8s`, `12s`, `16s`, `20s`), and a subtle FFmpeg-synthesized ambient + chime stereo audio track (`~1–2 MB` per MP4).
   - **Course 06 (`enterprise-product-video-studio`):** Retain existing `/media/gt-alpaca-teaser-16x9.mp4` (`12 MB`) and add `posterSrc: "/media/illustrations/product-video-studio.jpg"`.
2. **`VideoStage.tsx` Polish:**
   - Support allowlisted optional `video.posterSrc` (validated via `isAllowedImageUrl`) passed to `<video poster={...}>` for crisp branded thumbnails before playback (`CLS = 0`).
   - Auto-highlight the active chapter in the Chapter Timeline via `onTimeUpdate` (finding the latest chapter where `timestampSeconds <= currentTime`), while retaining click-to-seek and error/retry fail-closed handling.
3. **Interactive Micro-Labs (Courses `00–05`, `07`, `08`):**
   - Add discriminated-union `MicroLabSchema` to `CourseSchema` (`microLab?: MicroLab`) and `completedLabIds: string[]` (default `[]`) to `LearnerProgressSchema` (100% backwards-compatible with existing `localStorage` JSON).
   - Pure deterministic evaluation engine (`academy/src/lib/micro-lab-engine.ts`) with unit tests:
     - **Scenario Drills (`kind: "scenario-drill"`):** Courses `00` (Mode Picker), `01` (Hook Safety Router), `02` (SDLC Gate Triage), `05` (NotebookLM Bridge & Drift Audit).
     - **Live Calculators / Simulators:**
       - Course `03` (`kind: "context-budget"`): Interactive `AGENTS.md` `<= 10 KB` Context Budget & Progressive-Disclosure Auditor.
       - Course `04` (`kind: "loop-autonomy"`): Selective Autonomy Classifier + `3–5` Concurrent Loop Ceiling & Decoupled Verifier Simulator.
       - Course `07` (`kind: "swarm-partition"`): Parallel Worker File-Ownership Partitioner & Overlap Collision Detector (`@backend`, `@frontend`, `@verifier`).
       - Course `08` (`kind: "website-factory-lab"`): Live W3C WCAG 2.1 AA/AAA Contrast Ratio Calculator (Light/Dark presets including GT-Alpaca Pass 1 fail vs Pass 2 pass), GLB Meshopt/WebP Compression Estimator, and Tri-Layer GEO/AEO Readiness Gate.
   - Single reusable token-first, WCAG 2.1 AA `<InteractiveMicroLab />` component mounted inside `CourseCurriculumStudio.tsx` with ELI5/Pro depth adaptation, `data-testid="interactive-micro-lab"`, `role="group"`/`aria-pressed`, `aria-live="polite"` status feedback, reset control, and `localStorage` completion persistence.

---

## 2. Security, Design Token & Architecture Invariants

- **Zero New Dependencies:** `academy/package.json` and `academy/pnpm-lock.yaml` remain completely unchanged; `pnpm audit --audit-level=high` stays at `0` High/Critical CVEs.
- **Strict Media Allowlists:** All `video.embedUrl` values match `isAllowedVideoUrl` (`/media/[A-Za-z0-9._-]+.mp4`) and all `video.posterSrc` values match `isAllowedImageUrl` (`/media/illustrations/[A-Za-z0-9._-]+.(jpg|png|webp|svg)`), verified on disk by Vitest tests.
- **Zero Hardcoded `#hex` / `opacity-55` / Arbitrary Brackets in `academy/src/`:** All component styling uses Tailwind `@theme` tokens (`bg-void-*`, `text-ink-*`, `border-cyan-glow`, `text-emerald-glow`, `text-amber-glow`, `text-rose-glow`). Course 08 WCAG contrast lab hex values live purely inside `course.json` data (never hardcoded hex literals inside `.ts`/`.tsx`).
- **Accessibility & Layout Stability:** `aspect-video` reserved on `<video>`, zero fractional `whileInView` wrappers, keyboard-accessible controls with `:focus-visible`, valid WAI-ARIA roles (`role="group"` + `aria-pressed`), and `>= 4.5:1` contrast on all labels/badges.
- **Zero `depcruise` Violations:** `micro-lab-engine.ts` lives under `src/lib/` (importing only `./schemas`), `InteractiveMicroLab.tsx` imports only from `@/lib/schemas` and `@/lib/micro-lab-engine`.

---

## 3. Verification & Release Acceptance Criteria

1. All 9 `academy/content/courses/*/course.json` files have `video.provider === "mp4"`, allowlisted `embedUrl` & `posterSrc` present on disk (`ffprobe` confirms H.264 + `yuv420p` + valid duration), and monotonic `chapters[]` timestamps within actual media duration.
2. Courses `00–05`, `07`, and `08` each declare a Zod-validated `microLab`, rendered cleanly in `CourseCurriculumStudio` with `completedLabIds` persisted via `localStorage`.
3. `bash skills/cf-next-verify/scripts/verify-stack.sh academy --coverage` — **`6/6` PASS** (`tsc` 0, `next lint` 0, Vitest 100% pass with dedicated `micro-lab-engine` + `InteractiveMicroLab` + `VideoStage` + all-9-media-files-on-disk assertions, `depcruise` 0 violations, `next build` clean).
4. `cd academy && pnpm audit --audit-level=high` — **`0` High/Critical CVEs**.
5. Live `next start` 3-viewport `cf-verify-map` (`375px`, `768px`, `1440px`) — **`9/9` PASS** (`0px` overflow, `0` console/page/network errors) + live 3-viewport `browser` visual/interactive QA verifying video playback & micro-lab interactivity across courses.
6. Decoupled `cf-reviewer` Dual-Axis Eval (`cf-eval`) — **`SHIP`** verdict logged in `.memory/qa-report.md`.
7. Commit & push to `origin/main`, then **pause at Stage 5 HITL gate** for human approval prior to Vercel production deployment (`https://antigravity-academy-ten.vercel.app`).
