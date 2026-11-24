"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Move, Orbit, RotateCw } from "lucide-react";
import {
  SDLC_STAGES,
  type SdlcOrbitalSceneProps,
  type SdlcStageSpec,
} from "@/lib/contracts";
import type { SdlcStageKey } from "@/lib/schemas";
import WebGLFallbackCard from "./WebGLFallbackCard";

type ActiveStageId = Exclude<SdlcStageKey, "meta">;

const PALETTE = {
  cyan: 0x38bdf8,
  violet: 0xa78bfa,
  emerald: 0x34d399,
  inkWhite: 0xf8fafc,
} as const;

const ORBIT_RADIUS = 3.25;

interface StageBeaconRecord {
  spec: SdlcStageSpec;
  index: number;
  angle: number;
  group: THREE.Group;
  crystalMesh: THREE.Mesh;
  crystalMat: THREE.MeshStandardMaterial;
  cageMesh: THREE.Mesh;
  cageMat: THREE.MeshBasicMaterial;
  haloMesh: THREE.Mesh;
  haloMat: THREE.MeshBasicMaterial;
  beamMesh: THREE.Mesh;
  beamMat: THREE.MeshBasicMaterial;
  baseDiscMesh: THREE.Mesh;
  baseDiscMat: THREE.MeshBasicMaterial;
  auraSprite: THREE.Sprite;
  auraMat: THREE.SpriteMaterial;
  color: THREE.Color;
  activation: number;
}

interface FlowBeadRecord {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  offset: number;
  speed: number;
  isLeadComet: boolean;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createGlowTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.28, "rgba(255, 255, 255, 0.7)");
  gradient.addColorStop(0.65, "rgba(255, 255, 255, 0.14)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createBeamGradientTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  const gradient = ctx.createLinearGradient(0, 128, 0, 0);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  gradient.addColorStop(0.35, "rgba(255, 255, 255, 0.45)");
  gradient.addColorStop(0.75, "rgba(255, 255, 255, 0.12)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 16, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function getStageIndex(stageId: ActiveStageId): number {
  const idx = SDLC_STAGES.findIndex((stage) => stage.id === stageId);
  return idx >= 0 ? idx : 0;
}

function shortestAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export default function SdlcOrbitalScene({
  activeStageId,
  onSelectStage,
  className = "",
}: SdlcOrbitalSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [hoveredStageId, setHoveredStageId] = useState<ActiveStageId | null>(
    null,
  );

  const activeStageIdRef = useRef<ActiveStageId>(activeStageId);
  const onSelectStageRef = useRef<(stageId: ActiveStageId) => void>(
    onSelectStage,
  );
  const focusActiveStageRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    activeStageIdRef.current = activeStageId;
    focusActiveStageRef.current?.();
  }, [activeStageId]);

  useEffect(() => {
    onSelectStageRef.current = onSelectStage;
  }, [onSelectStage]);

  useEffect(() => {
    const container = containerRef.current;
    const canvasHost = canvasHostRef.current;
    if (!container || !canvasHost) {
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    const glContext = renderer.getContext();
    if (!glContext) {
      renderer.dispose();
      setWebglFailed(true);
      return;
    }

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];

    const trackGeo = <T extends THREE.BufferGeometry>(geo: T): T => {
      geometries.push(geo);
      return geo;
    };
    const trackMat = <T extends THREE.Material>(mat: T): T => {
      materials.push(mat);
      return mat;
    };

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const domElement = renderer.domElement;
    domElement.style.width = "100%";
    domElement.style.height = "100%";
    domElement.style.display = "block";
    domElement.style.touchAction = "pan-y";
    canvasHost.appendChild(domElement);

    let contextLost = false;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      stopLoop();
      setWebglFailed(true);
    };
    domElement.addEventListener("webglcontextlost", handleContextLost, false);

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 16 / 10, 0.1, 100);
    camera.position.set(0, 3.85, 8.6);
    camera.lookAt(0, 0.15, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x8bb6ea, 0.95);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(
      PALETTE.cyan,
      PALETTE.violet,
      0.8,
    );
    scene.add(hemiLight);

    const spotlightA = new THREE.PointLight(PALETTE.cyan, 4.5, 22, 1.4);
    spotlightA.position.set(0, 4.5, 5.5);
    scene.add(spotlightA);

    const spotlightB = new THREE.PointLight(PALETTE.violet, 3.4, 22, 1.4);
    spotlightB.position.set(-5.5, 2.8, -4.5);
    scene.add(spotlightB);

    const activeBeaconLight = new THREE.PointLight(PALETTE.cyan, 4.2, 8, 1.6);
    scene.add(activeBeaconLight);

    // Procedural glow & plasma beam textures
    const glowTexture = createGlowTexture();
    if (glowTexture) {
      textures.push(glowTexture);
    }
    const beamTexture = createBeamGradientTexture();
    if (beamTexture) {
      textures.push(beamTexture);
    }

    // 1. Ambient Cosmic Dust Starfield
    const rand = createSeededRandom(88421);
    const starCount = 300;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const cyanColor = new THREE.Color(PALETTE.cyan);
    const violetColor = new THREE.Color(PALETTE.violet);
    const emeraldColor = new THREE.Color(PALETTE.emerald);
    const tempColor = new THREE.Color();

    for (let i = 0; i < starCount; i++) {
      const u = rand();
      const v = rand();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const radius = 5.4 + rand() * 8.5;

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi) * 0.68;
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      const pick = rand();
      tempColor.copy(
        pick < 0.5 ? cyanColor : pick < 0.85 ? violetColor : emeraldColor,
      );
      const scale = 0.55 + rand() * 0.45;
      starColors[i * 3] = tempColor.r * scale;
      starColors[i * 3 + 1] = tempColor.g * scale;
      starColors[i * 3 + 2] = tempColor.b * scale;
    }

    const starGeo = trackGeo(new THREE.BufferGeometry());
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    const starMat = trackMat(
      new THREE.PointsMaterial({
        size: 0.15,
        map: glowTexture ?? undefined,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Orbital Root Group (rotates around Y to spotlight active stage)
    const orbitalTiltGroup = new THREE.Group();
    orbitalTiltGroup.rotation.x = 0.14;
    scene.add(orbitalTiltGroup);

    const orbitalRingGroup = new THREE.Group();
    orbitalTiltGroup.add(orbitalRingGroup);

    // 2. Luminous Translucent Torus Orbital Track + Precision Guide Rings
    const mainTorusGeo = trackGeo(
      new THREE.TorusGeometry(ORBIT_RADIUS, 0.052, 20, 128),
    );
    const mainTorusMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.cyan,
        emissive: PALETTE.violet,
        emissiveIntensity: 0.55,
        metalness: 0.35,
        roughness: 0.2,
        transparent: true,
        opacity: 0.62,
      }),
    );
    const mainTorusMesh = new THREE.Mesh(mainTorusGeo, mainTorusMat);
    mainTorusMesh.rotation.x = Math.PI / 2;
    orbitalRingGroup.add(mainTorusMesh);

    const trackGlowGeo = trackGeo(
      new THREE.TorusGeometry(ORBIT_RADIUS, 0.14, 12, 128),
    );
    const trackGlowMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: PALETTE.cyan,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const trackGlowMesh = new THREE.Mesh(trackGlowGeo, trackGlowMat);
    trackGlowMesh.rotation.x = Math.PI / 2;
    orbitalRingGroup.add(trackGlowMesh);

    const innerGuideGeo = trackGeo(
      new THREE.TorusGeometry(ORBIT_RADIUS - 0.55, 0.012, 8, 96),
    );
    const innerGuideMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: PALETTE.violet,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const innerGuideMesh = new THREE.Mesh(innerGuideGeo, innerGuideMat);
    innerGuideMesh.rotation.x = Math.PI / 2;
    orbitalRingGroup.add(innerGuideMesh);

    const outerGuideGeo = trackGeo(
      new THREE.TorusGeometry(ORBIT_RADIUS + 0.55, 0.012, 8, 96),
    );
    const outerGuideMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: PALETTE.cyan,
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const outerGuideMesh = new THREE.Mesh(outerGuideGeo, outerGuideMat);
    outerGuideMesh.rotation.x = Math.PI / 2;
    orbitalRingGroup.add(outerGuideMesh);

    // Central Holographic Repeating-Loop Gyroscope Core
    const hubGroup = new THREE.Group();
    orbitalRingGroup.add(hubGroup);

    const knotGeo = trackGeo(new THREE.TorusKnotGeometry(0.62, 0.13, 96, 16, 2, 3));
    const knotMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.cyan,
        emissive: PALETTE.violet,
        emissiveIntensity: 0.72,
        metalness: 0.5,
        roughness: 0.22,
        wireframe: true,
        transparent: true,
        opacity: 0.45,
      }),
    );
    const knotMesh = new THREE.Mesh(knotGeo, knotMat);
    hubGroup.add(knotMesh);

    const hubCoreGeo = trackGeo(new THREE.IcosahedronGeometry(0.32, 1));
    const hubCoreMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.inkWhite,
        emissive: PALETTE.cyan,
        emissiveIntensity: 1.3,
        roughness: 0.2,
        metalness: 0.4,
        flatShading: true,
      }),
    );
    const hubCoreMesh = new THREE.Mesh(hubCoreGeo, hubCoreMat);
    hubGroup.add(hubCoreMesh);

    const hubAuraMat = trackMat(
      new THREE.SpriteMaterial({
        map: glowTexture ?? undefined,
        color: PALETTE.violet,
        transparent: true,
        opacity: glowTexture ? 0.36 : 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const hubAura = new THREE.Sprite(hubAuraMat);
    hubAura.scale.set(2.5, 2.5, 1);
    hubGroup.add(hubAura);

    // 3. 8 Crystalline Stage Beacons arranged clockwise
    const crystalGeo = trackGeo(new THREE.OctahedronGeometry(0.35, 0));
    const cageGeo = trackGeo(new THREE.OctahedronGeometry(0.5, 0));
    const haloGeo = trackGeo(new THREE.TorusGeometry(0.62, 0.022, 10, 48));
    const beamGeo = trackGeo(
      new THREE.CylinderGeometry(0.035, 0.24, 2.35, 16, 1, true),
    );
    beamGeo.translate(0, 1.18, 0);
    const baseDiscGeo = trackGeo(new THREE.RingGeometry(0.28, 0.72, 32));
    const hitGeo = trackGeo(new THREE.SphereGeometry(0.76, 12, 12));
    const sharedHitMat = trackMat(
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );

    const beaconRecords: StageBeaconRecord[] = [];
    const raycastTargets: THREE.Object3D[] = [];

    SDLC_STAGES.forEach((spec, index) => {
      // Clockwise arrangement when viewed from above: stage 0 at front (0, 0, +R)
      const angle = -(index / SDLC_STAGES.length) * Math.PI * 2;
      const x = Math.sin(angle) * ORBIT_RADIUS;
      const z = Math.cos(angle) * ORBIT_RADIUS;

      const stageGroup = new THREE.Group();
      stageGroup.position.set(x, 0, z);
      orbitalRingGroup.add(stageGroup);

      const stageColor = new THREE.Color(spec.colorHex);

      // Subtle radial spoke from center hub to beacon
      const spokeGeo = trackGeo(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(x * 0.88, 0, z * 0.88),
        ]),
      );
      const spokeMat = trackMat(
        new THREE.LineBasicMaterial({
          color: stageColor,
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const spokeLine = new THREE.Line(spokeGeo, spokeMat);
      orbitalRingGroup.add(spokeLine);

      const crystalMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: stageColor,
          emissive: stageColor,
          emissiveIntensity: 0.85,
          metalness: 0.45,
          roughness: 0.22,
          flatShading: true,
        }),
      );
      const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
      stageGroup.add(crystalMesh);

      const cageMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: stageColor,
          wireframe: true,
          transparent: true,
          opacity: 0.34,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const cageMesh = new THREE.Mesh(cageGeo, cageMat);
      stageGroup.add(cageMesh);

      const haloMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: stageColor,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.rotation.x = Math.PI / 2;
      stageGroup.add(haloMesh);

      const beamMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: stageColor,
          map: beamTexture ?? undefined,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.y = -0.15;
      stageGroup.add(beamMesh);

      const baseDiscMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: stageColor,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const baseDiscMesh = new THREE.Mesh(baseDiscGeo, baseDiscMat);
      baseDiscMesh.rotation.x = -Math.PI / 2;
      baseDiscMesh.position.y = -0.22;
      stageGroup.add(baseDiscMesh);

      const auraMat = trackMat(
        new THREE.SpriteMaterial({
          map: glowTexture ?? undefined,
          color: stageColor,
          transparent: true,
          opacity: glowTexture ? 0.38 : 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const auraSprite = new THREE.Sprite(auraMat);
      auraSprite.scale.set(1.7, 1.7, 1);
      stageGroup.add(auraSprite);

      const hitMesh = new THREE.Mesh(hitGeo, sharedHitMat);
      hitMesh.userData = { stageId: spec.id };
      stageGroup.add(hitMesh);
      raycastTargets.push(hitMesh);

      beaconRecords.push({
        spec,
        index,
        angle,
        group: stageGroup,
        crystalMesh,
        crystalMat,
        cageMesh,
        cageMat,
        haloMesh,
        haloMat,
        beamMesh,
        beamMat,
        baseDiscMesh,
        baseDiscMat,
        auraSprite,
        auraMat,
        color: stageColor,
        activation: spec.id === activeStageIdRef.current ? 1 : 0,
      });
    });

    // 4. Animated Clockwise Data-Flow Beads travelling along the Orbital Loop
    const beadGeo = trackGeo(new THREE.SphereGeometry(0.056, 10, 10));
    const cometGeo = trackGeo(new THREE.SphereGeometry(0.095, 12, 12));
    const flowBeads: FlowBeadRecord[] = [];
    const totalBeads = 24;

    for (let i = 0; i < totalBeads; i++) {
      const isLeadComet = i % 8 === 0;
      const stageColorIdx = Math.floor((i / totalBeads) * SDLC_STAGES.length);
      const beadColor = SDLC_STAGES[stageColorIdx]?.colorHex ?? PALETTE.cyan;

      const mat = trackMat(
        new THREE.MeshBasicMaterial({
          color: isLeadComet ? PALETTE.inkWhite : beadColor,
          transparent: true,
          opacity: isLeadComet ? 0.96 : 0.78,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const mesh = new THREE.Mesh(isLeadComet ? cometGeo : beadGeo, mat);
      orbitalRingGroup.add(mesh);

      flowBeads.push({
        mesh,
        mat,
        offset: i / totalBeads,
        speed: 0.085,
        isLeadComet,
      });
    }

    // Raycasting, Drag-to-Orbit, and Camera-Focus Transition State
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2(0, 0);
    const activeWorldPos = new THREE.Vector3();

    const computeStageTargetYaw = (stageId: ActiveStageId): number => {
      const idx = getStageIndex(stageId);
      // Rotating orbitalRingGroup by +idx*(2pi/8) brings stage idx (at angle -idx*2pi/8) to front +Z!
      return (idx / SDLC_STAGES.length) * Math.PI * 2;
    };

    let targetRingYaw = computeStageTargetYaw(activeStageIdRef.current);
    let currentRingYaw = targetRingYaw;
    let userDragYawOffset = 0;
    let targetTiltX = 0.14;
    let currentTiltX = 0.14;

    let isDragging = false;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let dragDistance = 0;
    let hoveredIdLocal: ActiveStageId | null = null;

    // Lifecycle & Reduced Motion Controls
    const motionMediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let prefersReducedMotion = motionMediaQuery.matches;
    let isInViewport = true;
    let isTabVisible = document.visibilityState === "visible";
    let rafId: number | null = null;
    let elapsedTime = 0;
    let lastTimestamp = performance.now();

    const isLoopActive = (): boolean =>
      isInViewport && isTabVisible && !prefersReducedMotion;

    const renderFrame = (dt: number, snapTransitions: boolean) => {
      const desiredStageYaw = computeStageTargetYaw(activeStageIdRef.current);
      targetRingYaw = desiredStageYaw + userDragYawOffset;

      if (snapTransitions) {
        currentRingYaw = targetRingYaw;
        currentTiltX = targetTiltX;
      } else {
        elapsedTime += dt;
        const deltaYaw = shortestAngleDelta(currentRingYaw, targetRingYaw);
        currentRingYaw += deltaYaw * Math.min(1, dt * 4.2);
        currentTiltX = THREE.MathUtils.lerp(
          currentTiltX,
          targetTiltX,
          Math.min(1, dt * 5.0),
        );
      }

      orbitalRingGroup.rotation.y = currentRingYaw;
      orbitalTiltGroup.rotation.x = currentTiltX;

      // Ambient starfield & central loop core rotation
      starField.rotation.y = elapsedTime * 0.015;
      knotMesh.rotation.y = elapsedTime * 0.35;
      knotMesh.rotation.x = elapsedTime * 0.22;
      hubCoreMesh.rotation.y = -elapsedTime * 0.55;
      hubCoreMesh.rotation.z = elapsedTime * 0.3;

      // Update 8 Stage Beacons
      const currentActiveId = activeStageIdRef.current;
      for (const beacon of beaconRecords) {
        const isActive = beacon.spec.id === currentActiveId;
        const isHovered = beacon.spec.id === hoveredIdLocal;
        const targetActivation = isActive ? 1 : 0;

        beacon.activation = snapTransitions
          ? targetActivation
          : THREE.MathUtils.lerp(
              beacon.activation,
              targetActivation,
              Math.min(1, dt * 6.5),
            );

        const act = beacon.activation;
        const pulse = 0.5 + 0.5 * Math.sin(elapsedTime * 3.2 + beacon.index);

        const hoverBoost = isHovered && !isActive ? 0.14 : 0;
        const targetScale = 1.0 + act * 0.36 + hoverBoost;
        beacon.group.scale.setScalar(targetScale);
        beacon.group.position.y =
          act * 0.22 + Math.sin(elapsedTime * 1.8 + beacon.index * 0.8) * 0.06;

        beacon.crystalMesh.rotation.y = elapsedTime * (0.55 + act * 0.65) + beacon.index;
        beacon.crystalMesh.rotation.x = Math.sin(elapsedTime * 0.8 + beacon.index) * 0.25;
        beacon.cageMesh.rotation.y = -elapsedTime * 0.4;
        beacon.haloMesh.rotation.z = elapsedTime * (0.4 + act * 0.8);

        beacon.crystalMat.emissiveIntensity =
          0.75 + act * (0.95 + pulse * 0.3) + (isHovered ? 0.35 : 0);
        beacon.haloMat.opacity = 0.42 + act * 0.55 + (isHovered ? 0.2 : 0);
        beacon.cageMat.opacity = 0.28 + act * 0.45;
        beacon.auraMat.opacity = glowTexture ? 0.3 + act * 0.48 : 0;
        beacon.auraSprite.scale.setScalar(1.6 + act * 1.15);

        // Vertical Plasma Beam & Base Disc illuminate smoothly on the active stage
        const showBeam = act > 0.02;
        beacon.beamMesh.visible = showBeam;
        beacon.baseDiscMesh.visible = showBeam;
        if (showBeam) {
          beacon.beamMat.opacity = act * (0.62 + pulse * 0.22);
          beacon.beamMesh.scale.set(1, 0.4 + act * 0.65, 1);
          beacon.baseDiscMat.opacity = act * 0.52;
          beacon.baseDiscMesh.scale.setScalar(0.85 + pulse * 0.2);
        }

        if (isActive) {
          beacon.group.getWorldPosition(activeWorldPos);
          activeBeaconLight.position.set(
            activeWorldPos.x,
            activeWorldPos.y + 1.1,
            activeWorldPos.z,
          );
          activeBeaconLight.color.copy(beacon.color);
          hubCoreMat.emissive.lerp(beacon.color, snapTransitions ? 1 : Math.min(1, dt * 4));
        }
      }

      // Animate Clockwise Data-Flow Beads around the orbital ring
      for (const bead of flowBeads) {
        // Decreasing theta moves clockwise around the XZ ring matching Stage 1 -> 8 -> 1
        const rawProgress = (bead.offset + elapsedTime * bead.speed) % 1;
        const progress = rawProgress < 0 ? rawProgress + 1 : rawProgress;
        const theta = -progress * Math.PI * 2;
        const radialOffset = bead.isLeadComet ? 0 : Math.sin(progress * Math.PI * 16) * 0.04;
        const r = ORBIT_RADIUS + radialOffset;
        bead.mesh.position.set(
          Math.sin(theta) * r,
          Math.cos(progress * Math.PI * 8 + elapsedTime * 2) * 0.035,
          Math.cos(theta) * r,
        );
      }

      renderer.render(scene, camera);
    };

    const resolveStageIdFromHit = (raw: unknown): ActiveStageId | null => {
      if (typeof raw !== "string") {
        return null;
      }
      const match = SDLC_STAGES.find((stage) => stage.id === raw);
      return match ? match.id : null;
    };

    const getHitStageId = (
      clientX: number,
      clientY: number,
    ): ActiveStageId | null => {
      const rect = domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return null;
      }
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const intersections = raycaster.intersectObjects(raycastTargets, false);
      if (intersections.length === 0) {
        return null;
      }
      return resolveStageIdFromHit(intersections[0]?.object.userData?.stageId);
    };

    const handlePointerDown = (event: PointerEvent) => {
      isDragging = true;
      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      dragDistance = 0;
      try {
        domElement.setPointerCapture(event.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (isDragging) {
        const dx = event.clientX - lastPointerX;
        const dy = event.clientY - lastPointerY;
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
        dragDistance += Math.hypot(dx, dy);
        userDragYawOffset += dx * 0.0065;
        targetTiltX = THREE.MathUtils.clamp(
          targetTiltX + dy * 0.004,
          -0.28,
          0.62,
        );
        if (prefersReducedMotion) {
          renderFrame(0, true);
        }
        return;
      }

      const hitStage = getHitStageId(event.clientX, event.clientY);
      if (hitStage !== hoveredIdLocal) {
        hoveredIdLocal = hitStage;
        setHoveredStageId(hitStage);
        domElement.style.cursor = hitStage ? "pointer" : "grab";
        if (prefersReducedMotion) {
          renderFrame(0, true);
        }
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!isDragging) {
        return;
      }
      isDragging = false;
      try {
        if (domElement.hasPointerCapture(event.pointerId)) {
          domElement.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore if pointer capture was already released
      }
      const moved = Math.hypot(
        event.clientX - pointerDownX,
        event.clientY - pointerDownY,
      );
      if (dragDistance < 6 && moved < 6) {
        const hitStage = getHitStageId(event.clientX, event.clientY);
        if (hitStage) {
          userDragYawOffset = 0;
          onSelectStageRef.current(hitStage);
        }
      }
    };

    const handlePointerLeave = () => {
      isDragging = false;
      if (hoveredIdLocal !== null) {
        hoveredIdLocal = null;
        setHoveredStageId(null);
      }
      domElement.style.cursor = "grab";
    };

    domElement.style.cursor = "grab";
    domElement.addEventListener("pointerdown", handlePointerDown);
    domElement.addEventListener("pointermove", handlePointerMove);
    domElement.addEventListener("pointerup", handlePointerUp);
    domElement.addEventListener("pointercancel", handlePointerUp);
    domElement.addEventListener("pointerleave", handlePointerLeave);

    // Responsive ResizeObserver
    const updateSize = () => {
      const width = Math.max(canvasHost.clientWidth, 1);
      const height = Math.max(canvasHost.clientHeight, 1);
      camera.aspect = width / height;
      const dist = width < 480 ? 11.2 : width < 768 ? 9.6 : 8.6;
      const camY = width < 480 ? 4.4 : 3.85;
      camera.position.set(0, camY, dist);
      camera.lookAt(0, 0.15, 0);
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
    };
    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
      if (prefersReducedMotion || !isLoopActive()) {
        renderFrame(0, true);
      }
    });
    resizeObserver.observe(canvasHost);

    const tick = (now: number) => {
      if (contextLost || !isLoopActive()) {
        rafId = null;
        return;
      }
      const dt = Math.max(0, Math.min((now - lastTimestamp) / 1000, 0.05));
      lastTimestamp = now;
      renderFrame(dt, false);
      rafId = window.requestAnimationFrame(tick);
    };

    const startLoopIfAllowed = () => {
      if (isLoopActive() && rafId === null) {
        lastTimestamp = performance.now();
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const stopLoop = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    focusActiveStageRef.current = () => {
      userDragYawOffset = 0;
      if (prefersReducedMotion || !isLoopActive()) {
        renderFrame(0, true);
      }
    };

    // IntersectionObserver pauses GPU loop off-screen
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isInViewport = Boolean(entry?.isIntersecting);
        if (isInViewport) {
          startLoopIfAllowed();
        } else {
          stopLoop();
        }
      },
      { threshold: 0.05 },
    );
    intersectionObserver.observe(container);

    const handleVisibilityChange = () => {
      isTabVisible = document.visibilityState === "visible";
      if (isTabVisible) {
        startLoopIfAllowed();
      } else {
        stopLoop();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const handleMotionChange = (event: MediaQueryListEvent) => {
      prefersReducedMotion = event.matches;
      if (prefersReducedMotion) {
        stopLoop();
        renderFrame(0, true);
      } else {
        startLoopIfAllowed();
      }
    };
    motionMediaQuery.addEventListener("change", handleMotionChange);

    // Initial render
    renderFrame(0, true);
    if (!prefersReducedMotion) {
      startLoopIfAllowed();
    }

    return () => {
      focusActiveStageRef.current = null;
      stopLoop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      motionMediaQuery.removeEventListener("change", handleMotionChange);
      domElement.removeEventListener("webglcontextlost", handleContextLost);
      domElement.removeEventListener("pointerdown", handlePointerDown);
      domElement.removeEventListener("pointermove", handlePointerMove);
      domElement.removeEventListener("pointerup", handlePointerUp);
      domElement.removeEventListener("pointercancel", handlePointerUp);
      domElement.removeEventListener("pointerleave", handlePointerLeave);

      for (const geo of geometries) {
        geo.dispose();
      }
      for (const mat of materials) {
        mat.dispose();
      }
      for (const tex of textures) {
        tex.dispose();
      }

      renderer.dispose();
      if (domElement.parentNode === canvasHost) {
        canvasHost.removeChild(domElement);
      }
    };
  }, []);

  if (webglFailed) {
    return (
      <WebGLFallbackCard
        variant="sdlc"
        activeStageId={activeStageId}
        onSelectStage={onSelectStage}
        className={className}
        reason="WebGL context unavailable — showing interactive 2D SDLC orbital diagram"
      />
    );
  }

  const displayStage =
    SDLC_STAGES.find(
      (stage) => stage.id === (hoveredStageId ?? activeStageId),
    ) ?? SDLC_STAGES[0];

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Interactive 3D 8-Stage Enterprise Code Factory SDLC Orbital Loop"
      className={`glass-panel relative flex flex-col justify-between overflow-hidden rounded-2xl ${className}`}
    >
      {/* WebGL Canvas Host */}
      <div
        ref={canvasHostRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      />

      {/* Top Overlay Telemetry HUD */}
      <div className="pointer-events-none relative z-10 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs text-ink-primary">
            <Orbit className="h-3.5 w-3.5 text-cyan-glow" aria-hidden="true" />
            <span>
              Stage 0{displayStage.order} / 08 · {displayStage.title}
            </span>
          </span>

          <span className="glass-pill hidden items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs text-cyan-glow sm:inline-flex">
            <RotateCw className="h-3 w-3" aria-hidden="true" />
            <span>{displayStage.skillCommand}</span>
          </span>
        </div>

        <span className="glass-pill inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[11px] text-ink-muted">
          <Move className="h-3 w-3 text-violet-glow" aria-hidden="true" />
          <span className="hidden sm:inline">Drag ring · Click beacon</span>
          <span className="sm:hidden">Drag · Tap</span>
        </span>
      </div>

      {/* Bottom Floating Glassmorphic Keyboard-Accessible 8-Stage Pill Strip */}
      <div className="relative z-10 mt-auto p-3 sm:p-4">
        <div
          className="glass-panel-elevated flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-xl p-1.5"
          role="group"
          aria-label="Select SDLC orbital stage"
        >
          {SDLC_STAGES.map((stage) => {
            const isActive = stage.id === activeStageId;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onSelectStage(stage.id)}
                aria-pressed={isActive}
                aria-label={`Stage ${stage.order}: ${stage.title}`}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-xs transition-colors ${
                  isActive
                    ? "border-cyan-glow bg-void-800 text-ink-primary"
                    : "border-transparent bg-glass-subtle text-ink-secondary hover:border-glass-border hover:text-ink-primary"
                }`}
              >
                <span className="text-cyan-glow">0{stage.order}</span>
                <span>{stage.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
