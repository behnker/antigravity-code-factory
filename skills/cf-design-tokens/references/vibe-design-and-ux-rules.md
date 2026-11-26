# Vibe Design & Token-First UX Standards

*Distilled from the 37-source Vibe Design playbook and MIT-licensed W3C Design Token patterns (`nextlevelbuilder/ui-ux-pro-max-skill`, MIT).*

## 1. Anti-"AI Slop" Vibe Design Principles
Generic AI sites fail because bare prompts omit visual anchors, typography pairing, and design vocabulary. Always ground every UI specification in:
- **Visual Anchor & Palette Polarity:** Real brand photography/renders + intentional semantic surface hierarchy (avoid stark `#000000` / `#FFFFFF` defaults unless explicitly justified).
- **The 50% Hero Rule:** Dedicate ≥50% of visual craft to the above-the-fold Hero:
  - Sticky glassmorphic header (`backdrop-filter: blur(...)`) with clear brand mark, ≤5 primary nav links, and primary CTA.
  - High-craft display H1 + direct 1–2 sentence value proposition + primary glowing border-beam CTA + secondary low-friction CTA.
  - Signature interactive stage (3D canvas, product demo frame, or sculpted hero visual) + optional subtle audio/theme controls.
- **Deliberate Section Rhythm:** Hero → Trust / Live Stats Strip → Feature Bento Grid / 3-Card Split → Interactive Showcase / Storytelling → Social Proof / Commercial Offer → AEO FAQ Accordion (40–60 word answers) → Schema-Aligned Footer.
- **Progressive Blur Over Dynamic Media:** Whenever text overlays 3D WebGL geometry or video, back it with a progressive glass blur / gradient scrim guaranteeing **≥ 4.5:1** WCAG 2.1 AA contrast across all camera angles.

## 2. Three-Layer Token Hierarchy (W3C Format)
```
primitive (raw values) ──▶ semantic (purpose/intent) ──▶ component (scoped UI)
                                  │
                                  ▼
                       dark.semantic (polarity flip)
```
- **Required Accessibility Tokens:**
  - `--focus-outline-width: 3px` (explicit `:focus-visible` ring on every interactive control)
  - `--touch-target-min: 44px` (minimum hit target for buttons, links, and icon toggles on touch viewports)
- **Typography Craft:**
  - Pair a distinctive display face (e.g., `Fraunces`, `Space Grotesk`, `Syne`) with a high-legibility body sans (`DM Sans`, `Plus Jakarta Sans`, `Inter`) and monospace (`JetBrains Mono`) for metrics/code.
  - Never skip heading levels (`h1` → `h2` → `h3`); never use heading tags solely for font size.

## 3. Motion & Micro-Interaction Discipline
- **Choreograph Beats:** Structure scroll sections as *Entrance → Hold → Exit*.
- **Respect `prefers-reduced-motion`:** Disable parallax, Lenis inertia, auto-orbiting 3D cameras, and ambient loops when reduced motion is active; keep instant clean transitions.
- **No Layout Shift (CLS < 0.1):** Pre-allocate explicit `aspect-ratio` or `width`/`height` on all images, video containers, 3D stages, and dynamic cards.
- **Loading / Error / Empty States:** Every interactive form, configurator, audio player, and API call must render explicit loading feedback, actionable error alerts with retry, and empty-state guidance.

## 4. High-Impact UX Anti-Patterns to Reject
- Arbitrary Tailwind color/spacing brackets (`bg-[#1a2b3c]`, `p-[17px]`) bypassing tokens.
- Invisible focus rings (`outline-none` without `focus-visible:ring-*`).
- Passive overlay divs blocking pointer/touch interaction on underlying canvases (`pointer-events: none` required on non-interactive overlays).
- Fabricated reviews, placeholder `Lorem ipsum`, or invented client logos/metrics.
