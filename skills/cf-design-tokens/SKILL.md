---
name: cf-design-tokens
description: >-
  Token-First Design System & Vibe Design skill: manages 3-layer W3C design tokens
  (primitive, semantic, component + dark overrides), compiles tokens.json into
  Tailwind CSS v4 @theme + CSS custom properties with build-time WCAG 2.1 AA
  contrast checks (>= 4.5:1), and validates source directories against hardcoded
  colors and arbitrary spacing literals.
---

# Skill: Token-First Design Systems (`cf-design-tokens`)

Build visually distinctive, accessible, zero-"AI slop" interfaces backed by a single machine-validated `design/tokens.json` source of truth.

## References & Resources
- Vibe Design & UX Guidelines: [references/vibe-design-and-ux-rules.md](./references/vibe-design-and-ux-rules.md)
- W3C 3-Layer Starter Template: [resources/tokens.template.json](./resources/tokens.template.json)

## Workflow

1. **Author `design/tokens.json` (3-Layer Hierarchy):**
   - `primitive`: Raw literal palette, spacing, typography, radii, shadows, durations.
   - `semantic`: Intent-named aliases (`background`, `foreground`, `primary`, `primary-foreground`, `muted`, `border`, `ring`, `focus-outline-width`, `touch-target-min`). Never name semantic tokens by color appearance (`blue-500`).
   - `component`: Scoped UI component tokens (`button.*`, `card.*`, `badge.*`, `glass.*`).
   - `dark.semantic`: Dark-mode semantic overrides so theme polarity flips with zero duplicated layout CSS.

2. **Compile & Enforce WCAG 2.1 AA Contrast:**
   ```bash
   node "<path-to-this-skill>/scripts/generate-tokens.mjs" \
     --config design/tokens.json \
     --out src/styles/tokens.css \
     --format tailwind-v4
   ```
   - Fails with exit `1` on cyclic `{ref}` chains, missing `{ref}` targets, unsafe CSS characters (`;`, `{`, `}`, `</style`, `javascript:`), or any paired semantic color below **4.5:1** contrast across Light & Dark modes (`foreground`, `muted-foreground`, and every `*-text` token against `background`/`surface`/`surface-elevated`/`card`, plus `*-foreground` on fill colors).

3. **Validate Source Code Against Hardcoded Literals:**
   ```bash
   node "<path-to-this-skill>/scripts/validate-tokens.mjs" --dir src/
   ```
   - Fails with exit `1` on raw CSS `#hex`/`rgb()`/`rgba()`/`hsl()` literals or arbitrary Tailwind brackets (`bg-[#...]`, `text-[13px]`, `p-[19px]`), while ignoring harmless `#anchor` hrefs, comments, and token definition files (`tokens.css`, `tokens.json`, `globals.css`).
   - Add `// @tokens-ignore-file` only to pure 3D material/scene color registries (e.g., Three.js coat hex tables).

## Exit Codes
- `0` — `PASS`
- `1` — `FAIL` (token/contrast/literal violation)
- `2` — `CONFIG_ERROR` (missing flags or unreadable file)
