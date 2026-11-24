"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { AlertTriangle, Move, ShieldCheck } from "lucide-react";
import {
  HARNESS_NODES,
  type HarnessConstellationProps,
  type HarnessMode,
  type HarnessNodeSpec,
} from "@/lib/contracts";
import WebGLFallbackCard from "./WebGLFallbackCard";

const PALETTE = {
  cyan: 0x38bdf8,
  cyanDeep: 0x0284c7,
  violet: 0xa78bfa,
  emerald: 0x34d399,
  amber: 0xfbbf24,
  inkWhite: 0xf8fafc,
} as const;

interface NodeVisualRecord {
  spec: HarnessNodeSpec;
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  wireMesh: THREE.Mesh;
  wireMat: THREE.MeshBasicMaterial;
  haloMesh: THREE.Mesh;
  haloMat: THREE.MeshBasicMaterial;
  reticleMesh: THREE.Mesh;
  reticleMat: THREE.MeshBasicMaterial;
  warningRing: THREE.LineSegments | null;
  warningMat: THREE.LineBasicMaterial | null;
  auraSprite: THREE.Sprite;
  auraMat: THREE.SpriteMaterial;
  hitMesh: THREE.Mesh;
  baseColor: THREE.Color;
  upgradedColor: THREE.Color;
  basePosition: THREE.Vector3;
  phaseOffset: number;
}

interface EnergyLinkRecord {
  spec: HarnessNodeSpec;
  curve: THREE.CatmullRomCurve3;
  lineMat: THREE.LineBasicMaterial;
  outboundMesh: THREE.Mesh;
  outboundMat: THREE.MeshBasicMaterial;
  inboundMesh: THREE.Mesh;
  inboundMat: THREE.MeshBasicMaterial;
  speed: number;
  phaseOffset: number;
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
  gradient.addColorStop(0.28, "rgba(255, 255, 255, 0.72)");
  gradient.addColorStop(0.62, "rgba(255, 255, 255, 0.16)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createDashedRingGeometry(
  radius: number,
  segments: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const step = (Math.PI * 2) / segments;
  for (let i = 0; i < segments; i += 2) {
    const a0 = i * step;
    const a1 = (i + 1) * step;
    positions.push(
      Math.cos(a0) * radius,
      0,
      Math.sin(a0) * radius,
      Math.cos(a1) * radius,
      0,
      Math.sin(a1) * radius,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  return geometry;
}

function getEffectiveStatus(
  node: HarnessNodeSpec,
  mode: HarnessMode,
): "leader" | "parity" | "gap" {
  return mode === "raw" ? node.statusRaw : node.statusCodeFactory;
}

export default function HarnessConstellationScene({
  mode,
  selectedNodeId,
  onSelectNode,
  className = "",
}: HarnessConstellationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const modeRef = useRef<HarnessMode>(mode);
  const selectedNodeIdRef = useRef<string | null>(selectedNodeId);
  const onSelectNodeRef = useRef<(nodeId: string) => void>(onSelectNode);
  const requestStaticRenderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    modeRef.current = mode;
    requestStaticRenderRef.current?.();
  }, [mode]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
    requestStaticRenderRef.current?.();
  }, [selectedNodeId]);

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

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
    renderer.toneMappingExposure = 1.12;

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
    const camera = new THREE.PerspectiveCamera(44, 16 / 10, 0.1, 100);
    camera.position.set(0, 2.35, 9.4);
    camera.lookAt(0, -0.1, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x88b4e8, 0.9);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(
      PALETTE.cyan,
      PALETTE.violet,
      0.75,
    );
    scene.add(hemiLight);

    const corePointLight = new THREE.PointLight(PALETTE.cyan, 5.5, 16, 1.5);
    corePointLight.position.set(0, 0, 0);
    scene.add(corePointLight);

    const rimLightA = new THREE.PointLight(PALETTE.violet, 3.8, 22, 1.4);
    rimLightA.position.set(6.5, 5.2, 6.0);
    scene.add(rimLightA);

    const rimLightB = new THREE.PointLight(PALETTE.emerald, 2.6, 20, 1.5);
    rimLightB.position.set(-6.0, -3.8, 5.5);
    scene.add(rimLightB);

    // Soft radial glow sprite texture
    const glowTexture = createGlowTexture();
    if (glowTexture) {
      textures.push(glowTexture);
    }

    // 1. Luminous Starfield / Cosmic Dust Nebula
    const rand = createSeededRandom(42197);
    const starCount = 420;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const cyanColor = new THREE.Color(PALETTE.cyan);
    const violetColor = new THREE.Color(PALETTE.violet);
    const emeraldColor = new THREE.Color(PALETTE.emerald);
    const amberColor = new THREE.Color(PALETTE.amber);
    const tempStarColor = new THREE.Color();

    for (let i = 0; i < starCount; i++) {
      const u = rand();
      const v = rand();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const radius = 5.8 + rand() * 9.5;

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi) * 0.72;
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      const mix = rand();
      if (mix < 0.55) {
        tempStarColor.copy(cyanColor);
      } else if (mix < 0.88) {
        tempStarColor.copy(violetColor);
      } else {
        tempStarColor.copy(emeraldColor);
      }
      const brightness = 0.55 + rand() * 0.45;
      starColors[i * 3] = tempStarColor.r * brightness;
      starColors[i * 3 + 1] = tempStarColor.g * brightness;
      starColors[i * 3 + 2] = tempStarColor.b * brightness;
    }

    const starGeometry = trackGeo(new THREE.BufferGeometry());
    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    starGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(starColors, 3),
    );
    const starMaterial = trackMat(
      new THREE.PointsMaterial({
        size: 0.16,
        map: glowTexture ?? undefined,
        vertexColors: true,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // Constellation root group (rotates smoothly with orbit & parallax)
    const constellationGroup = new THREE.Group();
    constellationGroup.position.set(0, -0.05, 0);
    scene.add(constellationGroup);

    // Shared geometries
    const hitColliderGeo = trackGeo(new THREE.SphereGeometry(0.72, 12, 12));
    const coreHitColliderGeo = trackGeo(new THREE.SphereGeometry(1.12, 14, 14));
    const octGeo = trackGeo(new THREE.OctahedronGeometry(0.36, 0));
    const dodecGeo = trackGeo(new THREE.DodecahedronGeometry(0.34, 0));
    const nodeWireGeo = trackGeo(new THREE.IcosahedronGeometry(0.5, 1));
    const nodeHaloGeo = trackGeo(new THREE.TorusGeometry(0.62, 0.018, 10, 48));
    const reticleGeo = trackGeo(new THREE.TorusGeometry(0.78, 0.025, 10, 48));
    const warningRingGeo = trackGeo(createDashedRingGeometry(0.84, 32));
    const packetGeo = trackGeo(new THREE.SphereGeometry(0.058, 10, 10));

    // Raycast targets
    const raycastTargets: THREE.Object3D[] = [];

    // 2. Central Orchestrator Core
    const orchestratorSpec =
      HARNESS_NODES.find((n) => n.id === "orchestrator") ?? HARNESS_NODES[0];
    const coreGroup = new THREE.Group();
    constellationGroup.add(coreGroup);

    const coreInnerGeo = trackGeo(new THREE.IcosahedronGeometry(0.66, 1));
    const coreInnerMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: PALETTE.cyan,
        emissive: PALETTE.cyanDeep,
        emissiveIntensity: 1.35,
        metalness: 0.45,
        roughness: 0.22,
        flatShading: true,
      }),
    );
    const coreInnerMesh = new THREE.Mesh(coreInnerGeo, coreInnerMat);
    coreGroup.add(coreInnerMesh);

    const coreGlassGeo = trackGeo(new THREE.IcosahedronGeometry(0.92, 2));
    const coreGlassMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: PALETTE.cyan,
        transparent: true,
        opacity: 0.14,
        roughness: 0.12,
        metalness: 0.1,
        transmission: 0.35,
        depthWrite: false,
      }),
    );
    const coreGlassMesh = new THREE.Mesh(coreGlassGeo, coreGlassMat);
    coreGroup.add(coreGlassMesh);

    const coreWireGeo = trackGeo(new THREE.IcosahedronGeometry(1.02, 2));
    const coreWireMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: PALETTE.cyan,
        wireframe: true,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const coreWireMesh = new THREE.Mesh(coreWireGeo, coreWireMat);
    coreGroup.add(coreWireMesh);

    const gyroRingAGeo = trackGeo(new THREE.TorusGeometry(1.32, 0.018, 12, 72));
    const gyroRingAMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: PALETTE.cyan,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const gyroRingA = new THREE.Mesh(gyroRingAGeo, gyroRingAMat);
    gyroRingA.rotation.set(Math.PI * 0.32, 0.2, 0);
    coreGroup.add(gyroRingA);

    const gyroRingBGeo = trackGeo(new THREE.TorusGeometry(1.52, 0.014, 12, 72));
    const gyroRingBMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: PALETTE.violet,
        transparent: true,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const gyroRingB = new THREE.Mesh(gyroRingBGeo, gyroRingBMat);
    gyroRingB.rotation.set(-Math.PI * 0.4, 0.45, 0.3);
    coreGroup.add(gyroRingB);

    const coreReticleGeo = trackGeo(new THREE.TorusGeometry(1.72, 0.025, 10, 64));
    const coreReticleMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: PALETTE.inkWhite,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const coreReticleMesh = new THREE.Mesh(coreReticleGeo, coreReticleMat);
    coreReticleMesh.rotation.x = Math.PI / 2;
    coreGroup.add(coreReticleMesh);

    const coreAuraMat = trackMat(
      new THREE.SpriteMaterial({
        map: glowTexture ?? undefined,
        color: PALETTE.cyan,
        transparent: true,
        opacity: glowTexture ? 0.48 : 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const coreAura = new THREE.Sprite(coreAuraMat);
    coreAura.scale.set(3.4, 3.4, 1);
    coreGroup.add(coreAura);

    const sharedHitMat = trackMat(
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    const coreHitMesh = new THREE.Mesh(coreHitColliderGeo, sharedHitMat);
    coreHitMesh.userData = { nodeId: orchestratorSpec.id };
    coreGroup.add(coreHitMesh);
    raycastTargets.push(coreHitMesh);

    // Subtle equatorial reference orbit ring
    const baseOrbitGeo = trackGeo(new THREE.TorusGeometry(3.15, 0.01, 8, 120));
    const baseOrbitMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: PALETTE.violet,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const baseOrbitRing = new THREE.Mesh(baseOrbitGeo, baseOrbitMat);
    baseOrbitRing.rotation.x = Math.PI / 2;
    constellationGroup.add(baseOrbitRing);

    // 3. 7 Orbiting Subsystem Nodes + Animated Spline Energy Packets
    const orbitingSpecs = HARNESS_NODES.filter((n) => n.id !== "orchestrator");
    const nodeRecords: NodeVisualRecord[] = [];
    const energyLinks: EnergyLinkRecord[] = [];

    orbitingSpecs.forEach((spec, index) => {
      const angleRad = (spec.angleDeg * Math.PI) / 180;
      const basePosition = new THREE.Vector3(
        Math.cos(angleRad) * spec.orbitRadius,
        spec.elevation,
        Math.sin(angleRad) * spec.orbitRadius,
      );

      const nodeGroup = new THREE.Group();
      nodeGroup.position.copy(basePosition);
      constellationGroup.add(nodeGroup);

      const baseColor = new THREE.Color(spec.colorHex);
      const upgradedColor = new THREE.Color(
        spec.statusRaw === "gap"
          ? spec.statusCodeFactory === "leader"
            ? PALETTE.emerald
            : PALETTE.cyan
          : spec.colorHex,
      );

      const coreMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: baseColor.clone(),
          emissive: baseColor.clone(),
          emissiveIntensity: 0.85,
          metalness: 0.42,
          roughness: 0.26,
          flatShading: true,
        }),
      );
      const coreMesh = new THREE.Mesh(
        index % 2 === 0 ? octGeo : dodecGeo,
        coreMat,
      );
      nodeGroup.add(coreMesh);

      const wireMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: baseColor.clone(),
          wireframe: true,
          transparent: true,
          opacity: 0.28,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const wireMesh = new THREE.Mesh(nodeWireGeo, wireMat);
      nodeGroup.add(wireMesh);

      const haloMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: baseColor.clone(),
          transparent: true,
          opacity: 0.56,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const haloMesh = new THREE.Mesh(nodeHaloGeo, haloMat);
      haloMesh.rotation.set(Math.PI * 0.45, index * 0.4, 0);
      nodeGroup.add(haloMesh);

      const reticleMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: PALETTE.inkWhite,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const reticleMesh = new THREE.Mesh(reticleGeo, reticleMat);
      reticleMesh.rotation.x = Math.PI / 2;
      nodeGroup.add(reticleMesh);

      let warningRing: THREE.LineSegments | null = null;
      let warningMat: THREE.LineBasicMaterial | null = null;
      if (spec.statusRaw === "gap") {
        warningMat = trackMat(
          new THREE.LineBasicMaterial({
            color: PALETTE.amber,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        warningRing = new THREE.LineSegments(warningRingGeo, warningMat);
        warningRing.rotation.set(0.35, 0, 0.22);
        nodeGroup.add(warningRing);
      }

      const auraMat = trackMat(
        new THREE.SpriteMaterial({
          map: glowTexture ?? undefined,
          color: baseColor.clone(),
          transparent: true,
          opacity: glowTexture ? 0.36 : 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const auraSprite = new THREE.Sprite(auraMat);
      auraSprite.scale.set(1.75, 1.75, 1);
      nodeGroup.add(auraSprite);

      const hitMesh = new THREE.Mesh(hitColliderGeo, sharedHitMat);
      hitMesh.userData = { nodeId: spec.id };
      nodeGroup.add(hitMesh);
      raycastTargets.push(hitMesh);

      nodeRecords.push({
        spec,
        group: nodeGroup,
        coreMesh,
        coreMat,
        wireMesh,
        wireMat,
        haloMesh,
        haloMat,
        reticleMesh,
        reticleMat,
        warningRing,
        warningMat,
        auraSprite,
        auraMat,
        hitMesh,
        baseColor,
        upgradedColor,
        basePosition,
        phaseOffset: index * 0.91,
      });

      // CatmullRomCurve3 spline from Core [0,0,0] to Node
      const midPoint = basePosition
        .clone()
        .multiplyScalar(0.52)
        .add(
          new THREE.Vector3(
            -Math.sin(angleRad) * 0.32,
            0.55 + (index % 2 === 0 ? 0.18 : -0.14),
            Math.cos(angleRad) * 0.32,
          ),
        );
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        midPoint,
        basePosition.clone(),
      ]);
      const curvePoints = curve.getPoints(36);
      const lineGeo = trackGeo(
        new THREE.BufferGeometry().setFromPoints(curvePoints),
      );
      const lineMat = trackMat(
        new THREE.LineBasicMaterial({
          color: baseColor.clone(),
          transparent: true,
          opacity: 0.32,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const splineLine = new THREE.Line(lineGeo, lineMat);
      constellationGroup.add(splineLine);

      const outboundMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: PALETTE.cyan,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const outboundMesh = new THREE.Mesh(packetGeo, outboundMat);
      constellationGroup.add(outboundMesh);

      const inboundMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: PALETTE.violet,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const inboundMesh = new THREE.Mesh(packetGeo, inboundMat);
      constellationGroup.add(inboundMesh);

      energyLinks.push({
        spec,
        curve,
        lineMat,
        outboundMesh,
        outboundMat,
        inboundMesh,
        inboundMat,
        speed: 0.24 + (index % 3) * 0.045,
        phaseOffset: index / orbitingSpecs.length,
      });
    });

    // 4. Code Factory v3.0 Shield Dome (scales & fades in upgraded mode)
    const shieldGroup = new THREE.Group();
    constellationGroup.add(shieldGroup);

    const shieldWireGeo = trackGeo(new THREE.IcosahedronGeometry(4.32, 2));
    const shieldWireMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: PALETTE.emerald,
        wireframe: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const shieldWireMesh = new THREE.Mesh(shieldWireGeo, shieldWireMat);
    shieldGroup.add(shieldWireMesh);

    const shieldShellGeo = trackGeo(new THREE.SphereGeometry(4.26, 32, 20));
    const shieldShellMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: PALETTE.cyan,
        transparent: true,
        opacity: 0,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const shieldShellMesh = new THREE.Mesh(shieldShellGeo, shieldShellMat);
    shieldGroup.add(shieldShellMesh);

    const shieldEqGeo = trackGeo(new THREE.TorusGeometry(4.38, 0.024, 12, 120));
    const shieldEqMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: PALETTE.emerald,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const shieldEqRing = new THREE.Mesh(shieldEqGeo, shieldEqMat);
    shieldEqRing.rotation.x = Math.PI / 2;
    shieldGroup.add(shieldEqRing);

    const shieldTiltGeo = trackGeo(new THREE.TorusGeometry(4.48, 0.014, 10, 120));
    const shieldTiltMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: PALETTE.cyan,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const shieldTiltRing = new THREE.Mesh(shieldTiltGeo, shieldTiltMat);
    shieldTiltRing.rotation.set(Math.PI * 0.36, 0.25, 0);
    shieldGroup.add(shieldTiltRing);

    // Interactive orbit, parallax, and raycasting state
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2(0, 0);
    const packetPos = new THREE.Vector3();
    const workingColor = new THREE.Color();

    let isDragging = false;
    let pointerDownX = 0;
    let pointerDownY = 0;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let dragDistance = 0;

    let targetYaw = 0.24;
    let currentYaw = 0.24;
    let targetPitch = 0.14;
    let currentPitch = 0.14;
    let parallaxX = 0;
    let parallaxY = 0;
    let hoveredIdLocal: string | null = null;
    let shieldMix = modeRef.current === "code-factory-v3" ? 1 : 0;

    // Lifecycle & Motion Preferences
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
      const targetShield = modeRef.current === "code-factory-v3" ? 1 : 0;
      if (snapTransitions) {
        shieldMix = targetShield;
        currentYaw = targetYaw;
        currentPitch = targetPitch;
      } else {
        elapsedTime += dt;
        shieldMix = THREE.MathUtils.lerp(
          shieldMix,
          targetShield,
          Math.min(1, dt * 4.5),
        );
        if (!isDragging) {
          targetYaw += dt * 0.11;
        }
        const damp = Math.min(1, dt * 6.0);
        currentYaw = THREE.MathUtils.lerp(currentYaw, targetYaw + parallaxX, damp);
        currentPitch = THREE.MathUtils.lerp(
          currentPitch,
          targetPitch + parallaxY,
          damp,
        );
      }

      constellationGroup.rotation.y = currentYaw;
      constellationGroup.rotation.x = currentPitch;

      // Subtle starfield drift
      starField.rotation.y = elapsedTime * 0.018;
      starField.rotation.x = Math.sin(elapsedTime * 0.04) * 0.05;

      // Central Orchestrator Core animation
      const selectedId = selectedNodeIdRef.current;
      const isCoreActive =
        selectedId === orchestratorSpec.id || hoveredIdLocal === orchestratorSpec.id;

      coreInnerMesh.rotation.y = elapsedTime * 0.45;
      coreInnerMesh.rotation.x = elapsedTime * 0.25;
      coreWireMesh.rotation.y = -elapsedTime * 0.22;
      gyroRingA.rotation.z = elapsedTime * 0.55;
      gyroRingB.rotation.z = -elapsedTime * 0.42;

      const coreScaleTarget = isCoreActive ? 1.1 : 1.0;
      coreGroup.scale.setScalar(
        snapTransitions
          ? coreScaleTarget
          : THREE.MathUtils.lerp(coreGroup.scale.x, coreScaleTarget, Math.min(1, dt * 8)),
      );
      coreReticleMat.opacity = isCoreActive ? 0.85 : 0;
      coreInnerMat.emissiveIntensity =
        1.25 + shieldMix * 0.35 + Math.sin(elapsedTime * 2.2) * 0.12;
      coreAuraMat.color.lerpColors(cyanColor, emeraldColor, shieldMix * 0.35);

      // Code Factory Shield Dome smooth transition
      const shieldVisible = shieldMix > 0.01;
      shieldGroup.visible = shieldVisible;
      if (shieldVisible) {
        const domeScale = THREE.MathUtils.lerp(0.84, 1.0, shieldMix);
        shieldGroup.scale.setScalar(domeScale);
        shieldWireMat.opacity = 0.16 * shieldMix;
        shieldShellMat.opacity = 0.045 * shieldMix;
        shieldEqMat.opacity = 0.55 * shieldMix;
        shieldTiltMat.opacity = 0.36 * shieldMix;
        shieldWireMesh.rotation.y = elapsedTime * 0.06;
        shieldEqRing.rotation.z = -elapsedTime * 0.14;
        shieldTiltRing.rotation.z = elapsedTime * 0.18;
      }

      // 7 Orbiting Subsystem Nodes
      for (const node of nodeRecords) {
        const isGapRaw = node.spec.statusRaw === "gap";
        const isSelected = selectedId === node.spec.id;
        const isHovered = hoveredIdLocal === node.spec.id;
        const pulse = 0.5 + 0.5 * Math.sin(elapsedTime * 3.4 + node.phaseOffset);

        // Bobbing & gap instability in raw mode
        const bobY = Math.sin(elapsedTime * 1.35 + node.phaseOffset) * 0.09;
        const instability = isGapRaw ? (1 - shieldMix) * 0.055 : 0;
        node.group.position.set(
          node.basePosition.x +
            Math.sin(elapsedTime * 5.2 + node.phaseOffset) * instability,
          node.basePosition.y + bobY,
          node.basePosition.z +
            Math.cos(elapsedTime * 4.7 + node.phaseOffset) * instability,
        );

        // Color transition: amber pulse for raw gaps -> emerald/cyan harmony in Code Factory v3
        if (isGapRaw) {
          workingColor.lerpColors(amberColor, node.upgradedColor, shieldMix);
        } else {
          workingColor.copy(node.baseColor);
        }

        node.coreMat.color.copy(workingColor);
        node.coreMat.emissive.copy(workingColor);
        node.coreMat.emissiveIntensity =
          isGapRaw && shieldMix < 0.5
            ? 0.9 + pulse * 0.95
            : isSelected || isHovered
              ? 1.45
              : 0.85;
        node.wireMat.color.copy(workingColor);
        node.haloMat.color.copy(workingColor);
        node.auraMat.color.copy(workingColor);

        node.coreMesh.rotation.y = elapsedTime * 0.65 + node.phaseOffset;
        node.coreMesh.rotation.x = elapsedTime * 0.35 + node.phaseOffset;
        node.wireMesh.rotation.y = -elapsedTime * 0.35;
        node.haloMesh.rotation.z = elapsedTime * (isGapRaw ? 0.9 - shieldMix * 0.45 : 0.45);

        // Warning ring visible only for raw gaps
        if (node.warningRing && node.warningMat) {
          const warnAlpha = (1 - shieldMix) * (0.48 + pulse * 0.45);
          node.warningRing.visible = warnAlpha > 0.02;
          node.warningMat.opacity = warnAlpha;
          node.warningRing.rotation.y = -elapsedTime * 1.1;
          node.warningRing.rotation.z = Math.sin(elapsedTime * 2.4 + node.phaseOffset) * 0.25;
        }

        // Selection / hover emphasis
        const targetScale = isSelected ? 1.28 : isHovered ? 1.15 : 1.0;
        node.group.scale.setScalar(
          snapTransitions
            ? targetScale
            : THREE.MathUtils.lerp(node.group.scale.x, targetScale, Math.min(1, dt * 8)),
        );
        node.reticleMat.opacity = isSelected ? 0.92 : isHovered ? 0.55 : 0;
        node.reticleMat.color.copy(isSelected ? cyanColor : workingColor);
        node.auraMat.opacity = !glowTexture
          ? 0
          : isSelected
            ? 0.68
            : isGapRaw && shieldMix < 0.5
              ? 0.35 + pulse * 0.3
              : 0.34;
      }

      // Animated Spline Energy Packets
      for (const link of energyLinks) {
        const isGapRaw = link.spec.statusRaw === "gap";
        const isSelected = selectedId === link.spec.id;
        if (isGapRaw) {
          workingColor.lerpColors(amberColor, emeraldColor, shieldMix);
        } else {
          workingColor.lerpColors(cyanColor, emeraldColor, shieldMix * 0.35);
        }
        link.lineMat.color.copy(workingColor);
        link.lineMat.opacity = isSelected ? 0.72 : 0.26 + shieldMix * 0.14;

        const rawOut = (elapsedTime * link.speed + link.phaseOffset) % 1;
        const outT = THREE.MathUtils.clamp(rawOut < 0 ? rawOut + 1 : rawOut, 0, 1);
        const rawIn = (elapsedTime * link.speed * 0.78 + link.phaseOffset + 0.5) % 1;
        const inT = THREE.MathUtils.clamp(1 - (rawIn < 0 ? rawIn + 1 : rawIn), 0, 1);

        link.curve.getPointAt(outT, packetPos);
        link.outboundMesh.position.copy(packetPos);
        link.outboundMat.color.copy(workingColor);

        link.curve.getPointAt(inT, packetPos);
        link.inboundMesh.position.copy(packetPos);
        link.inboundMat.color.copy(isGapRaw && shieldMix < 0.5 ? amberColor : violetColor);
      }

      renderer.render(scene, camera);
    };

    const getHitNodeId = (clientX: number, clientY: number): string | null => {
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
      const hitNodeId = intersections[0]?.object.userData?.nodeId;
      return typeof hitNodeId === "string" ? hitNodeId : null;
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
      const rect = domElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        parallaxX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.45;
        parallaxY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.28;
      }

      if (isDragging) {
        const dx = event.clientX - lastPointerX;
        const dy = event.clientY - lastPointerY;
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
        dragDistance += Math.hypot(dx, dy);
        targetYaw += dx * 0.0065;
        targetPitch = THREE.MathUtils.clamp(
          targetPitch + dy * 0.005,
          -0.65,
          0.75,
        );
        if (prefersReducedMotion) {
          renderFrame(0, true);
        }
        return;
      }

      const hitId = getHitNodeId(event.clientX, event.clientY);
      if (hitId !== hoveredIdLocal) {
        hoveredIdLocal = hitId;
        setHoveredNodeId(hitId);
        domElement.style.cursor = hitId ? "pointer" : "grab";
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
        const hitId = getHitNodeId(event.clientX, event.clientY);
        if (hitId) {
          onSelectNodeRef.current(hitId);
        }
      }
    };

    const handlePointerLeave = () => {
      isDragging = false;
      parallaxX = 0;
      parallaxY = 0;
      if (hoveredIdLocal !== null) {
        hoveredIdLocal = null;
        setHoveredNodeId(null);
      }
      domElement.style.cursor = "grab";
    };

    domElement.style.cursor = "grab";
    domElement.addEventListener("pointerdown", handlePointerDown);
    domElement.addEventListener("pointermove", handlePointerMove);
    domElement.addEventListener("pointerup", handlePointerUp);
    domElement.addEventListener("pointercancel", handlePointerUp);
    domElement.addEventListener("pointerleave", handlePointerLeave);

    // Responsive sizing with ResizeObserver
    const updateSize = () => {
      const width = Math.max(canvasHost.clientWidth, 1);
      const height = Math.max(canvasHost.clientHeight, 1);
      camera.aspect = width / height;
      // Pull camera back smoothly on narrow 375px viewports so no nodes clip
      const responsiveDistance = width < 480 ? 11.8 : width < 768 ? 10.4 : 9.4;
      camera.position.set(0, width < 480 ? 2.8 : 2.35, responsiveDistance);
      camera.lookAt(0, -0.1, 0);
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

    requestStaticRenderRef.current = () => {
      if (prefersReducedMotion || !isLoopActive()) {
        renderFrame(0, true);
      }
    };

    // IntersectionObserver to pause GPU loop when scrolled off-screen
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
      requestStaticRenderRef.current = null;
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
        variant="harness"
        mode={mode}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        className={className}
        reason="WebGL context unavailable — showing interactive 2D holographic topology"
      />
    );
  }

  const isUpgraded = mode === "code-factory-v3";
  const activeNode =
    HARNESS_NODES.find((node) => node.id === (hoveredNodeId ?? selectedNodeId)) ??
    HARNESS_NODES[0];
  const gapCount = HARNESS_NODES.filter(
    (node) => getEffectiveStatus(node, mode) === "gap",
  ).length;

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Interactive 3D Antigravity Agent Harness Constellation visualizer"
      className={`glass-panel relative flex flex-col justify-between overflow-hidden rounded-2xl ${className}`}
    >
      {/* WebGL Canvas Host */}
      <div
        ref={canvasHostRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      />

      {/* Top Overlay Telemetry HUD & Legend */}
      <div className="pointer-events-none relative z-10 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs text-ink-primary">
            {isUpgraded ? (
              <ShieldCheck
                className="h-3.5 w-3.5 text-emerald-glow"
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                className="h-3.5 w-3.5 text-amber-glow"
                aria-hidden="true"
              />
            )}
            <span>
              {isUpgraded
                ? "Code Factory v3.0 Shield Active"
                : `Raw Antigravity · ${gapCount} Open Gaps`}
            </span>
          </span>

          <span className="glass-pill hidden items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs text-ink-secondary sm:inline-flex">
            <span className="text-cyan-glow">Focus:</span>
            <span className="text-ink-primary">{activeNode.label}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="glass-pill hidden items-center gap-2 rounded-full px-2.5 py-1 font-mono text-[11px] text-ink-muted md:inline-flex">
            <span className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full bg-cyan-glow"
                aria-hidden="true"
              />
              Leader
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full bg-emerald-glow"
                aria-hidden="true"
              />
              Shielded
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full bg-amber-glow"
                aria-hidden="true"
              />
              Gap
            </span>
          </span>
          <span className="glass-pill inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[11px] text-ink-muted">
            <Move className="h-3 w-3 text-cyan-glow" aria-hidden="true" />
            <span className="hidden sm:inline">Drag to orbit · Click node</span>
            <span className="sm:hidden">Drag · Tap</span>
          </span>
        </div>
      </div>

      {/* Bottom Floating Glassmorphic Keyboard-Accessible Quick-Select Strip */}
      <div className="relative z-10 mt-auto p-3 sm:p-4">
        <div
          className="glass-panel-elevated flex max-w-full items-center gap-1.5 overflow-x-auto rounded-xl p-1.5"
          role="group"
          aria-label="Inspect harness architecture node"
        >
          {HARNESS_NODES.map((node) => {
            const status = getEffectiveStatus(node, mode);
            const isSelected = selectedNodeId === node.id;
            const dotClass =
              status === "gap"
                ? "bg-amber-glow"
                : status === "parity"
                  ? "bg-violet-glow"
                  : isUpgraded && node.statusRaw === "gap"
                    ? "bg-emerald-glow"
                    : "bg-cyan-glow";

            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node.id)}
                aria-pressed={isSelected}
                aria-label={`${node.label} (${status})`}
                className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-xs transition-colors ${
                  isSelected
                    ? "border-cyan-glow bg-void-800 text-ink-primary"
                    : "border-transparent bg-glass-subtle text-ink-secondary hover:border-glass-border hover:text-ink-primary"
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`}
                  aria-hidden="true"
                />
                <span>{node.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
