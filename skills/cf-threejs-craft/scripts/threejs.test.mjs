import test from "node:test";
import assert from "node:assert/strict";

import { auditThreeSource, parseArgs as parseAuditArgs } from "./audit-threejs.mjs";
import {
  validateGlbPaths,
  buildOptimizeArgs,
  parseArgs as parseOptArgs,
} from "./optimize-glb.mjs";

test("auditThreeSource flags setState and new THREE.Vector3 inside useFrame even with comment parens", () => {
  const bad = `
    import * as THREE from "three";
    import { useFrame } from "@react-three/fiber";
    export function BadScene() {
      useFrame((_, delta) => {
        // 1) rotate mesh :)
        const label = "a) string with ) paren";
        const v = new THREE.Vector3(0, delta, 0);
        setProgress(v.y + label.length);
      });
      return null;
    }
  `;
  const findings = auditThreeSource(bad, "BadScene.tsx");
  const ids = findings.map((f) => f.ruleId);
  assert.ok(ids.includes("r3f-no-setstate-in-useframe"));
  assert.ok(ids.includes("r3f-no-alloc-in-useframe"));
});

test("auditThreeSource flags deprecated THREE.Clock, uncapped DPR, and static/side-effect lil-gui", () => {
  const bad = `
    import * as THREE from "three";
    import "lil-gui";
    const stats = require("stats-gl");
    const clock = new THREE.Clock();
    const renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    console.log(clock, stats);
  `;
  const findings = auditThreeSource(bad, "Legacy.ts");
  const ids = findings.map((f) => f.ruleId);
  assert.ok(ids.includes("three-no-deprecated-clock"));
  assert.ok(ids.includes("three-cap-dpr"));
  assert.ok(ids.includes("three-dev-only-debug-ui"));
  assert.ok(ids.includes("three-dispose-resources"));
  assert.ok(ids.includes("three-context-loss-fallback"));
});

test("auditThreeSource passes clean R3F component with clamped DPR, reduced-motion, and webglcontextlost", () => {
  const clean = `
    import * as THREE from "three";
    import { Canvas, useFrame } from "@react-three/fiber";
    const scratchVec = new THREE.Vector3();
    export function CleanStage({ reducedMotion }: { reducedMotion: boolean }) {
      useFrame((_, delta) => {
        if (!reducedMotion && meshRef.current) {
          scratchVec.set(0, delta, 0);
          meshRef.current.rotation.y += scratchVec.y;
        }
      });
      const onCreated = ({ gl }: { gl: THREE.WebGLRenderer }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
      };
      return <Canvas dpr={[1, 2]} onCreated={onCreated} />;
    }
  `;
  const findings = auditThreeSource(clean, "CleanStage.tsx");
  assert.equal(findings.length, 0);
});

test("optimize-glb validates .glb paths, missing CLI values, and builds safe argument arrays", () => {
  assert.throws(() => parseAuditArgs(["--dir"]), /Missing value for --dir/);
  assert.throws(() => parseOptArgs(["--in", "a.glb", "--out"]), /Missing value for --out/);
  assert.throws(() => validateGlbPaths("model.obj", "out.glb"), /must have a \.glb extension/);
  assert.throws(() => validateGlbPaths("same.glb", "same.glb"), /must differ/);
  assert.throws(() => validateGlbPaths("a.glb\0x", "b.glb"), /control characters/);

  const { resolvedIn, resolvedOut } = validateGlbPaths("raw/hero.glb", "out/hero.glb");
  const args = buildOptimizeArgs(resolvedIn, resolvedOut, {
    textureFormat: "webp",
    maxTextureSize: 1024,
  });
  assert.deepEqual(args.slice(0, 1), ["optimize"]);
  assert.ok(args.includes("meshopt"));
  assert.ok(args.includes("webp"));
});
