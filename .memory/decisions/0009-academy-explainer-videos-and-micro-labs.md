# ADR-0009: Academy Course Explainer Videos (Code-as-Video) & Declarative Interactive Micro-Labs

**Date:** 2026-11-26  
**Status:** Accepted  
**Spec:** `plans/academy-multimodal-polish-spec.md`

## Context
Only Course 06 (`enterprise-product-video-studio`) in `academy/` shipped with a playable `/media/*.mp4` video; Courses `00–05`, `07`, and `08` displayed `coming_soon` slates despite real GT-Alpaca walkthrough footage existing on disk and a reusable Remotion + FFmpeg studio existing in `/Users/ralphb/Projects_Personal/product-video-studio`. Additionally, learners lacked per-course hands-on interactive micro-labs tailored to each course's core mental model.

## Decision
1. **Local Self-Hosted Web-Optimized MP4s (`H.264` + `yuv420p` + `+faststart`):**
   - Transcode real `gt-alpaca-website/proof-pack/09-launch-and-walkthrough/walkthrough.webm` into `/media/gt-alpaca-walkthrough-16x9.mp4` for Course 08.
   - Render 7 deterministic `24s` `1280×720` motion-graphic explainers via a parameterized Remotion composition (`AcademyCourseExplainer`) in `product-video-studio` for Courses `00–05` and `07`, keeping each file `~1–2 MB` so Git and Vercel static asset budgets stay lean while making all `9/9` courses immediately playable with zero third-party embed trackers.
2. **Schema-Driven Mixed Micro-Labs (`MicroLabSchema` + `micro-lab-engine.ts` + `InteractiveMicroLab.tsx`):**
   - Represent course micro-labs as a Zod discriminated union (`scenario-drill`, `context-budget`, `loop-autonomy`, `swarm-partition`, `website-factory-lab`) inside each `course.json` instead of hardcoding per-course UI branches in `CourseCurriculumStudio.tsx`.
   - Isolate all deterministic scoring, WCAG luminance math, byte budgeting, and collision detection inside pure `academy/src/lib/micro-lab-engine.ts` for fast, deterministic Vitest unit testing and zero `depcruise` boundary violations.
   - Persist `completedLabIds: string[]` (default `[]`) inside existing `LearnerProgressSchema` (`localStorage`) for seamless backwards compatibility.

## Consequences
- **Positive:** 100% (`9/9`) courses have instant native MP4 playback with studio poster thumbnails and live chapter tracking; `8/9` courses gain targeted interactive micro-labs (`0` new npm dependencies, `0` external API calls, `0` hardcoded hex in TSX).
- **Trade-offs:** Adding ~10–12 MB of static MP4 assets increases repository media size modestly (comparable to Course 06's existing `12 MB` teaser), mitigated by tight `720p` `crf=24` H.264 encoding and `preload="metadata"` so pages never eagerly download videos until played.
