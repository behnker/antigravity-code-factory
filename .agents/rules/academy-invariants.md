# Antigravity Academy Project Invariants (Distilled via Stage 6 `cf-learn`)

Permanent project-local rules distilled from Stage 1–5 discovery, QA review, and staging deployment so solved failures never recur as future courses are added:

## 1. Three.js & WebGL Runtime Safety
- **Never trust `now - lastTimestamp` to be positive on the first `requestAnimationFrame`:** Always clamp `dt = Math.max(0, Math.min((now - lastTimestamp) / 1000, 0.05))` and wrap modular spline parameters strictly into `[0, 1]` before calling `CatmullRomCurve3.getPointAt()`.
- **Halt GPU loops on `webglcontextlost`:** Track a `contextLost` flag checked inside `tick()` and call `stopLoop()` immediately before flipping fallback state to `<WebGLFallbackCard />`.
- **Always enforce GPU hygiene:** Cap `devicePixelRatio` at `2`, pause `rAF` off-screen via `IntersectionObserver` + `visibilitychange`, respect `prefers-reduced-motion: reduce`, and dispose all geometries, materials, and textures on unmount.

## 2. Glassmorphism Accessibility & WAI-ARIA Integrity
- **Verify contrast mathematically on tinted glass & CTA tokens:** Keep normal-text contrast `>= 4.5:1` (e.g., `--color-cyan-deep` must remain `<= #0369a1` when paired with `#f8fafc`). Never use literal hex colors in component markup or CSS gradients—reference `@theme` tokens via `var(--color-*)`.
- **Valid WAI-ARIA Roles Only:** Never place non-tab cards or buttons inside `role="tablist"`. Use `role="group"` + `aria-pressed` for filter/course selectors unless every `role="tab"` is explicitly paired via `id` / `aria-controls` / `aria-labelledby` with a `role="tabpanel"`.
- **Never Gate Tall Sections Behind Fractional `whileInView` Thresholds:** Never wrap multi-screen sections (e.g., `CourseCurriculumStudio`, `PromptVault`, `repo-hitl`) in `motion` `initial={{ opacity: 0 }}` + numeric `viewport={{ amount: 0.05 }}`—when a section exceeds ~16,000px tall, `5%` exceeds viewport height so `IntersectionObserver` never fires and the section stays invisible forever. Render tall sections directly visible, or use `amount: "some"` only on compact single-screen blocks.

## 3. Dependency & License Hygiene
- **Verify licenses in Stage 1 before installing:** Reject proprietary EULAs (e.g., GSAP Standard License) in favor of MIT/Apache-2.0/BSD/ISC packages (`motion`, `three`, `mermaid`, `zod`).
- **Zero High/Critical CVEs before Stage 5:** Run `pnpm audit --audit-level=high` and resolve High/Critical advisories via patched versions or `pnpm-workspace.yaml` `overrides` (pnpm v11 ignores `package.json` `pnpm.*` fields).

## 4. Extensible Course Registry & Vercel Monorepo Deployments
- **Zero-UI-Code Course Expansion:** Add every new course exclusively as a Zod-validated `academy/content/courses/<slug>/course.json` bundle, then run `pnpm run sync:resources`.
- **Serverless Manifest Tracing:** Preserve `outputFileTracingIncludes` in `academy/next.config.ts`, keep `src/data/generated-repo-manifest.json` uploadable via `academy/.vercelignore`, keep `academy/.env*` in root `.gitignore`, and pin `"engines": { "node": "24.x" }` for Vercel compatibility.
