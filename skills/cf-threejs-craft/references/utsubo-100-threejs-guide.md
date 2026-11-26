# Production Three.js & R3F Engineering Guide (Utsubo 100 Tips Taxonomy)

*Distilled engineering reference synthesized from Utsubo's "100 Three.js Tips That Actually Improve Performance (2026)" and modern React Three Fiber v9 / Three.js r186+ standards.*

## 1. Architecture, Hybrid HTML+WebGL & Render Setup
- **Hybrid DOM Layering:** WebGL `<canvas>` pixels are invisible to search engines and AI crawlers (569M GPTBot fetches → 0% JS execution). Keep all headlines, narrative copy, tables, and links in semantic SSR HTML; project 3D anchors to CSS transforms only for visual callouts, and add `pointer-events: none` on passive wrappers.
- **Progressive Glass Readability:** Place `backdrop-filter: blur(...)` / gradient scrims behind overlaid typography to guarantee ≥ 4.5:1 WCAG contrast over moving 3D lighting.
- **WebGPU & Automatic WebGL 2 Fallback:** When using `WebGPURenderer` (`three/webgpu`), initialize with `await renderer.init()` and `renderer.setAnimationLoop()` (never manual `requestAnimationFrame` before init). Author custom shaders in **TSL (Three.js Shading Language)** node materials (`MeshStandardNodeMaterial`, `colorNode`, `positionNode`) so one graph compiles to both WGSL and GLSL.
- **Pre-Warm Shaders:** Run `await renderer.compileAsync(scene, camera)` during loading screens to prevent first-frame shader compilation hitches.

## 2. Timing, Camera Choreography & React Three Fiber Rules
- **Use `Timer`, Never `Clock`:** `THREE.Clock` was deprecated in r183. Use `import { Timer } from "three"`, call `timer.connect(document)` (pauses cleanly when tabs go hidden), and scale all motion by `delta`.
- **Scroll as Narrative Engine:** Bind scroll progress (e.g. Lenis / scroll listener respecting `prefers-reduced-motion`) to smooth damped camera beats: **Entrance → Hold → Exit**.
- **R3F `useFrame` Hard Laws:**
  - **NEVER** call React `setState` inside `useFrame` (causes 60–120fps reconciliation stalls). Mutate `meshRef.current` directly.
  - **NEVER** allocate `new THREE.Vector3()`, `new THREE.Matrix4()`, or `new THREE.Color()` inside `useFrame`. Hoist reusable scratch instances outside the component or in `useMemo`.
  - Use `<Canvas frameloop="demand">` + `invalidate()` for static/product-viewer stages to save mobile battery.

## 3. Draw Calls, Geometry & Memory Budgets
- **Mobile Budget:** Target **`<= 100` draw calls/frame** and **`< 100,000` vertices** on mobile (`renderer.info.render.calls`).
- **Batching & Instancing:**
  - Repeated identical geometry → `THREE.InstancedMesh` (1 draw call).
  - Multiple varied geometries sharing a material → `THREE.BatchedMesh` (1 draw call + per-object frustum culling).
  - Static environment props → `BufferGeometryUtils.mergeGeometries()`, or freeze transforms (`mesh.matrixAutoUpdate = false; mesh.updateMatrix()`).
- **Mandatory GPU Disposal:** JS GC does **not** free GPU VRAM. On unmount, traverse and `.dispose()` every `BufferGeometry`, `Material`, `Texture` (calling `texture.source.data?.close?.()` first for `ImageBitmap` textures), and `WebGLRenderTarget`.
- **Fast Raycasting:** For interactive meshes >10k triangles, attach `three-mesh-bvh` (`computeBoundsTree` / `acceleratedRaycast`).

## 4. Asset Compression Pipeline (`.glb` & Textures)
| Stage | Technique | Expected Impact | Notes |
|---|---|---|---|
| Cleanup | `prune` + `weld` | Removes unused nodes/accessors & merges vertices | Always run first |
| Vertex Quantization | `KHR_mesh_quantization` (`quantize`) | **35%–50% GPU vertex memory reduction** | Drops float32 (32 B) → 16-bit (~20 B) |
| Geometry Compression | **Meshopt** (default) or **Draco** | **~85%–95% wire-size reduction** | Meshopt decodes faster & preserves morph targets/animations cleanly |
| Texture Compression | **WebP** (zero native binary) or **KTX2** (Basis Universal) | WebP cuts wire size sharply; KTX2 cuts **GPU VRAM 4–8×** | Max `1024–2048px`; KTX2 requires native `KTX-Software` 4.4+ + `ktx2Loader.detectSupport(renderer)` |
| HTTP Delivery | `Cache-Control: public, max-age=31536000, immutable` + Brotli | Instant repeat loads | Preload above-the-fold `.glb` with `useGLTF.preload()` |

## 5. Lighting, Shadows & Mobile Fallbacks
- Cap active dynamic lights at **`<= 3`**; prefer baked lightmaps/AO (UV2) + lightweight `<Environment>` IBL over dynamic shadow-casting point lights (each `PointLight` shadow costs **6 render passes**!).
- Shadow map caps: `512–1024px` mobile, `1024–2048px` desktop (`PCFShadowMap`; note `PCFSoftShadowMap` removed in r186). Freeze static shadows with `light.shadow.autoUpdate = false`.
- **DPR Clamping & Adaptive Scaling:**
  - Raw Three.js: `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`
  - R3F: `<PerformanceMonitor onIncline={() => setDpr(2)} onDecline={() => setDpr(1)} flipflops={3} onFallback={() => setDpr(1)} />`
- **Lazy Mount & Context Loss:** Mount below-the-fold 3D canvases only via `IntersectionObserver`; listen to `webglcontextlost` / `renderer.onDeviceLost` and degrade cleanly to a static high-res render (`<img>`).

## 6. Dev-Only Debugging & Live Tweaking (`lil-gui`, `stats-gl`, Inspectors)
- **`lil-gui` (Tip #92 — Live Parameter Tweaking):** Mount a floating tweak panel for lighting azimuth/intensity, camera targets, fog density, and material roughness **exclusively in development**:
  ```ts
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    let gui: import("lil-gui").default | undefined;
    import("lil-gui").then(({ default: GUI }) => {
      gui = new GUI({ title: "3D Stage Dev Controls" });
      gui.add(params, "exposure", 0.5, 2.0, 0.05);
    });
    return () => gui?.destroy();
  }, []);
  ```
- **Performance & Frame Inspection:**
  - `stats-gl` (`trackGPU: true`) or `r3f-webgpu-perf` for live FPS/CPU/GPU ms during development.
  - Three.js r181+ built-in `Inspector` (`renderer.inspector`) for native timeline/memory panels.
  - Browser extensions: **Spector.js** (WebGL 2 draw calls) and **WebGPU Inspector** (WGSL passes).
  - Always test WebGL fallback with `forceWebGL: true` and on a real mobile viewport before launch.
