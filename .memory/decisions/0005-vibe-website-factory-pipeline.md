# ADR 0005: First-Party Modular Website Factory Pipeline (`code-factory` v2.5.0)

**Date:** 2026-11-25  
**Status:** Accepted  
**Related Spec:** `plans/cf-website-factory-spec.md`  
**Research:** `.memory/research-vibe-website-factory.md`

---

## Context
We extracted a 37-source website-engineering methodology from NotebookLM spanning Vibe Design, Token-First Design Systems, Three.js / React Three Fiber performance craft (including Utsubo's 100 Three.js Tips), and Tri-Layer SEO/AEO/GEO for AI search engines. We also audited `nextlevelbuilder/ui-ux-pro-max-skill` (`b73ee96`, MIT) in a read-only scratch clone. While MIT-licensed and free of malicious network calls, its scripts lacked cyclic/missing-reference protection, Tailwind CSS v4 `@theme` support, and WCAG contrast verification, its regex validator suffered false positives on `#anchor` links while missing Tailwind arbitrary bracket literals, and the repo carried 5.2 MB of unrelated framework stacks.

## Decision
1. **Build Four First-Party Progressive-Disclosure Skills in `code-factory` (`v2.5.0`):** `cf-website-factory`, `cf-design-tokens`, `cf-threejs-craft`, and `cf-geo-seo`.
2. **Adopt MIT W3C Token JSON Format & Distilled UX Rules (With Attribution):** Retain the clean 3-layer `$value`/`$type` token format (`primitive` → `semantic` → `component` + `dark.semantic`) from `nextlevelbuilder/ui-ux-pro-max-skill` (MIT), while authoring hardened, zero-dependency Node.js ESM (`*.mjs`) scripts with full `node:test` coverage.
3. **Zero-Native-Binary Default GLB Pipeline:** Use `@gltf-transform/cli` (`prune` → `weld` → `quantize` → `meshopt` → `webp`) as the default 3D asset optimizer so the pipeline works identically on every developer machine without requiring native `KTX-Software` binaries, documenting KTX2 as an optional enhancement.
4. **Preserve Context Economics (`AGENTS.md ≤ 10 KB`):** Keep all 100 Three.js tips, UX guidelines, and 32 SEO/GEO checkpoints inside on-demand `skills/*/references/` files so non-web sessions incur zero static token overhead.

## Consequences
- **Positive:** Zero external skill supply-chain risk; zero runtime npm dependencies added to `code-factory`; build-time WCAG 4.5:1 contrast & Tailwind v4 `@theme` generation; static Three.js & GEO/AEO/SEO gates reusable across any Next.js/React website repo.
- **Trade-off:** We maintain our own compact reference guides and scripts (~25 KB total across 4 skills) instead of pulling upstream CSV updates automatically—an acceptable trade-off given deterministic stability, test coverage, and zero bloat.
