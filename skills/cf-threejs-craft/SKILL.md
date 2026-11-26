---
name: cf-threejs-craft
description: >-
  Production Three.js, React Three Fiber (R3F), and WebGL/WebGPU engineering
  skill grounded in Utsubo's 100 Three.js Performance Tips (2026). Provides
  hybrid SSR HTML + WebGL architecture, zero-native-binary GLB compression
  (Meshopt + KHR_mesh_quantization + WebP via @gltf-transform/cli), dev-only
  lil-gui/stats-gl workflows, and a deterministic static audit gate.
---

# Skill: Three.js & 3D Web Experience Craft (`cf-threejs-craft`)

Build high-craft, 60 FPS interactive 3D web experiences that preserve crawlable SSR HTML, stay within mobile GPU budgets (`<= 100` draw calls), and cleanly isolate dev-only tweak tools (`lil-gui`, `stats-gl`).

## Reference Guide
- Complete Distilled Engineering Reference (Utsubo 100 Three.js Tips): [references/utsubo-100-threejs-guide.md](./references/utsubo-100-threejs-guide.md)

## Non-Negotiable 3D Invariants
1. **No WebGL Black Box:** Keep all primary headings, copy, pricing, FAQs, and links in SSR HTML layered over/beside `<canvas>`. Apply `pointer-events: none` to passive overlays.
2. **R3F `useFrame` Discipline:** Never call React `setState` or allocate `new THREE.Vector3()`/`Matrix4()` inside `useFrame`. Mutate refs directly and scale by delta.
3. **Modern Three.js APIs:** Use `Timer` from `three` (`timer.connect(document)`), never deprecated `THREE.Clock` (deprecated r183).
4. **Mobile & Battery Safety:** Clamp DPR (`Math.min(window.devicePixelRatio, 2)`), wrap R3F scenes in Drei `<PerformanceMonitor flipflops={3} onFallback={() => setDpr(1)} />`, lazy-load below-the-fold canvases with `IntersectionObserver`, cap dynamic lights `<= 3`, and provide a static render fallback for `prefers-reduced-motion` and `webglcontextlost`.
5. **Dev Tooling Isolation:** Gate `lil-gui` and `stats-gl` behind `process.env.NODE_ENV === "development"` (or dynamic `import("lil-gui")` in dev-only hooks) so debug UIs never ship to production visitors.

## Executable Scripts

### 1. Optimize `.glb` Assets (Zero Native Binary Default)
```bash
node "<path-to-this-skill>/scripts/optimize-glb.mjs" \
  --in assets/raw/hero.glb \
  --out public/models/hero.glb \
  --texture-format webp \
  --max-texture-size 1024
```
- Runs `prune` → `weld` → `quantize` (`KHR_mesh_quantization`) → `meshopt` → `webp` (or optional `--texture-format ktx2` when native `KTX-Software` 4.4+ is installed).
- Emits structured before/after byte savings JSON for Proof Packs.

### 2. Run Static Three.js / R3F Audit Gate
```bash
node "<path-to-this-skill>/scripts/audit-threejs.mjs" --dir src/
```
- **Exit `0` (`PASS`):** Zero blocking 3D anti-patterns detected.
- **Exit `1` (`FAIL`):** Blocking violation found (`setState` in `useFrame`, `new THREE.*` in `useFrame`, deprecated `THREE.Clock`, uncapped DPR, or unguarded `lil-gui`/`stats-gl`).
- **Exit `2` (`CONFIG_ERROR`):** Invalid flags or missing directory.
- **Exit `3` (`TOOL_UNAVAILABLE`):** Returned by `optimize-glb.mjs` if `@gltf-transform/cli` is not installed locally.
