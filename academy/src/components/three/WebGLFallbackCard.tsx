"use client";

import { AlertTriangle, Orbit, ShieldCheck, Sparkles } from "lucide-react";
import {
  HARNESS_NODES,
  SDLC_STAGES,
  type HarnessMode,
  type HarnessNodeSpec,
  type SdlcStageSpec,
} from "@/lib/contracts";
import type { SdlcStageKey } from "@/lib/schemas";

export type WebGLFallbackCardProps =
  | {
      variant: "harness";
      mode: HarnessMode;
      selectedNodeId: string | null;
      onSelectNode: (nodeId: string) => void;
      className?: string;
      reason?: string;
    }
  | {
      variant: "sdlc";
      activeStageId: Exclude<SdlcStageKey, "meta">;
      onSelectStage: (stageId: Exclude<SdlcStageKey, "meta">) => void;
      className?: string;
      reason?: string;
    };

function getHarnessStatus(
  node: HarnessNodeSpec,
  mode: HarnessMode,
): "leader" | "parity" | "gap" {
  return mode === "raw" ? node.statusRaw : node.statusCodeFactory;
}

function statusStrokeVar(status: "leader" | "parity" | "gap"): string {
  switch (status) {
    case "gap":
      return "var(--color-amber-glow)";
    case "parity":
      return "var(--color-violet-glow)";
    case "leader":
      return "var(--color-cyan-glow)";
  }
}

function statusBadgeLabel(status: "leader" | "parity" | "gap"): string {
  switch (status) {
    case "gap":
      return "Gap";
    case "parity":
      return "Parity";
    case "leader":
      return "Leader";
  }
}

function stageAccentVar(stage: SdlcStageSpec): string {
  switch (stage.id) {
    case "research":
    case "spec":
      return "var(--color-cyan-glow)";
    case "architecture":
    case "build":
      return "var(--color-violet-glow)";
    case "test":
    case "deploy":
      return "var(--color-emerald-glow)";
    case "feedback":
      return "var(--color-amber-glow)";
    case "optimise":
      return "var(--color-rose-glow)";
  }
}

export default function WebGLFallbackCard(props: WebGLFallbackCardProps) {
  if (props.variant === "harness") {
    return <HarnessSvgFallback {...props} />;
  }
  return <SdlcSvgFallback {...props} />;
}

function HarnessSvgFallback({
  mode,
  selectedNodeId,
  onSelectNode,
  className = "",
  reason,
}: Extract<WebGLFallbackCardProps, { variant: "harness" }>) {
  const isUpgraded = mode === "code-factory-v3";
  const centerNode =
    HARNESS_NODES.find((node) => node.id === "orchestrator") ?? HARNESS_NODES[0];
  const orbitingNodes = HARNESS_NODES.filter((node) => node.id !== "orchestrator");
  const activeId = selectedNodeId ?? centerNode.id;
  const activeNode =
    HARNESS_NODES.find((node) => node.id === activeId) ?? centerNode;

  const cx = 320;
  const cy = 186;
  const rx = 212;
  const ry = 122;

  return (
    <div
      role="region"
      aria-label="Antigravity Agent Harness 2D holographic topology fallback"
      className={`glass-panel cosmic-grid relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-5 ${className}`}
    >
      {/* Top telemetry header */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
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
              {isUpgraded ? "Code Factory v3.0 Shield" : "Raw Antigravity"}
            </span>
          </span>
          <span className="hidden font-mono text-xs text-ink-secondary sm:inline">
            Selected: <strong className="text-ink-primary">{activeNode.label}</strong>
          </span>
        </div>

        <span
          className="glass-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] text-ink-muted"
          title={reason ?? "Interactive 2D SVG topology active"}
        >
          <Sparkles className="h-3 w-3 text-cyan-glow" aria-hidden="true" />
          <span>2D Telemetry View</span>
        </span>
      </div>

      {/* Holographic SVG Constellation */}
      <div className="relative my-2 flex flex-1 items-center justify-center">
        <svg
          viewBox="0 0 640 372"
          className="h-full max-h-[300px] w-full select-none"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="harness-core-aura" cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                stopColor={
                  isUpgraded
                    ? "var(--color-emerald-glow)"
                    : "var(--color-cyan-glow)"
                }
                stopOpacity="0.32"
              />
              <stop
                offset="58%"
                stopColor="var(--color-violet-glow)"
                stopOpacity="0.09"
              />
              <stop
                offset="100%"
                stopColor="var(--color-void-950)"
                stopOpacity="0"
              />
            </radialGradient>
          </defs>

          {/* Cosmic aura */}
          <ellipse cx={cx} cy={cy} rx={270} ry={162} fill="url(#harness-core-aura)" />

          {/* Orbital guide tracks */}
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill="none"
            stroke="var(--color-glass-border)"
            strokeWidth="1.25"
            strokeDasharray="5 6"
          />
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx * 0.56}
            ry={ry * 0.56}
            fill="none"
            stroke="var(--color-glass-border)"
            strokeWidth="1"
            opacity="0.65"
          />

          {/* Code Factory Shield Dome perimeter in upgraded mode */}
          {isUpgraded ? (
            <g>
              <ellipse
                cx={cx}
                cy={cy}
                rx={rx + 46}
                ry={ry + 32}
                fill="none"
                stroke="var(--color-emerald-glow)"
                strokeWidth="1.8"
                opacity="0.65"
              />
              <ellipse
                cx={cx}
                cy={cy}
                rx={rx + 56}
                ry={ry + 39}
                fill="none"
                stroke="var(--color-cyan-glow)"
                strokeWidth="1"
                strokeDasharray="8 6"
                opacity="0.45"
              />
            </g>
          ) : null}

          {/* Curved spline filaments from Orchestrator Core to 7 orbiting nodes */}
          {orbitingNodes.map((node) => {
            const rad = ((node.angleDeg - 90) * Math.PI) / 180;
            const nx = cx + Math.cos(rad) * rx;
            const ny = cy + Math.sin(rad) * ry;
            const ctrlX = (cx + nx) / 2 + (ny - cy) * 0.14;
            const ctrlY = (cy + ny) / 2 - (nx - cx) * 0.12;
            const status = getHarnessStatus(node, mode);
            const isSelected = activeId === node.id;
            const stroke =
              status === "gap"
                ? "var(--color-amber-glow)"
                : isUpgraded
                  ? "var(--color-emerald-glow)"
                  : "var(--color-cyan-glow)";

            return (
              <g key={`link-${node.id}`}>
                <path
                  d={`M ${cx} ${cy} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={isSelected ? 2.4 : 1.3}
                  strokeDasharray={status === "gap" ? "4 4" : undefined}
                  opacity={isSelected ? 0.95 : 0.45}
                />
                {/* Energy pulse bead at curve midpoint */}
                <circle
                  cx={((cx + 2 * ctrlX + nx) / 4).toFixed(1)}
                  cy={((cy + 2 * ctrlY + ny) / 4).toFixed(1)}
                  r={isSelected ? 4 : 2.8}
                  fill={stroke}
                  opacity={0.9}
                />
              </g>
            );
          })}

          {/* Central Orchestrator Core */}
          <g>
            <circle
              cx={cx}
              cy={cy}
              r={activeId === centerNode.id ? 40 : 34}
              fill="var(--color-void-900)"
              stroke="var(--color-cyan-glow)"
              strokeWidth={activeId === centerNode.id ? 2.8 : 1.8}
            />
            <polygon
              points={`${cx},${cy - 22} ${cx + 19},${cy - 11} ${cx + 19},${cy + 11} ${cx},${cy + 22} ${cx - 19},${cy + 11} ${cx - 19},${cy - 11}`}
              fill="var(--color-cyan-glow)"
              fillOpacity="0.18"
              stroke="var(--color-cyan-glow)"
              strokeWidth="1.4"
            />
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              fill="var(--color-ink-primary)"
              fontSize="11"
              fontWeight="700"
              fontFamily="var(--font-mono)"
            >
              CORE
            </text>
          </g>

          {/* 7 Orbiting Subsystem Nodes */}
          {orbitingNodes.map((node) => {
            const rad = ((node.angleDeg - 90) * Math.PI) / 180;
            const nx = cx + Math.cos(rad) * rx;
            const ny = cy + Math.sin(rad) * ry;
            const status = getHarnessStatus(node, mode);
            const isSelected = activeId === node.id;
            const stroke = statusStrokeVar(status);

            return (
              <g key={node.id}>
                {status === "gap" ? (
                  <circle
                    cx={nx}
                    cy={ny}
                    r={28}
                    fill="none"
                    stroke="var(--color-amber-glow)"
                    strokeWidth="1.3"
                    strokeDasharray="4 4"
                    opacity="0.85"
                  />
                ) : null}
                {isSelected ? (
                  <circle
                    cx={nx}
                    cy={ny}
                    r={32}
                    fill="none"
                    stroke={stroke}
                    strokeWidth="2"
                    opacity="0.8"
                  />
                ) : null}
                <circle
                  cx={nx}
                  cy={ny}
                  r={21}
                  fill="var(--color-void-900)"
                  stroke={stroke}
                  strokeWidth={isSelected ? 2.4 : 1.5}
                />
                <text
                  x={nx}
                  y={ny + 4}
                  textAnchor="middle"
                  fill="var(--color-ink-primary)"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                >
                  {node.shortLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Accessible keyboard-navigable node selector strip */}
      <div
        className="z-10 flex max-w-full items-center gap-1.5 overflow-x-auto pb-1 pt-1"
        role="group"
        aria-label="Select harness subsystem node"
      >
        {HARNESS_NODES.map((node) => {
          const status = getHarnessStatus(node, mode);
          const isSelected = activeId === node.id;
          const dotClass =
            status === "gap"
              ? "bg-amber-glow"
              : status === "parity"
                ? "bg-violet-glow"
                : isUpgraded
                  ? "bg-emerald-glow"
                  : "bg-cyan-glow";

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectNode(node.id)}
              aria-pressed={isSelected}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs transition-colors ${
                isSelected
                  ? "border-cyan-glow bg-void-800 text-ink-primary"
                  : "border-glass-border bg-glass-subtle text-ink-secondary hover:border-glass-border-strong hover:text-ink-primary"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${dotClass}`}
                aria-hidden="true"
              />
              <span>{node.shortLabel}</span>
              <span className="text-[10px] text-ink-muted">
                ({statusBadgeLabel(status)})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SdlcSvgFallback({
  activeStageId,
  onSelectStage,
  className = "",
  reason,
}: Extract<WebGLFallbackCardProps, { variant: "sdlc" }>) {
  const activeStage =
    SDLC_STAGES.find((stage) => stage.id === activeStageId) ?? SDLC_STAGES[0];

  const cx = 320;
  const cy = 186;
  const rx = 220;
  const ry = 120;

  return (
    <div
      role="region"
      aria-label="Enterprise Code Factory 8-Stage SDLC Orbital Loop 2D fallback"
      className={`glass-panel cosmic-grid relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 sm:p-5 ${className}`}
    >
      {/* Top telemetry header */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs text-ink-primary">
            <Orbit className="h-3.5 w-3.5 text-cyan-glow" aria-hidden="true" />
            <span>
              Stage 0{activeStage.order} / 08 · {activeStage.title}
            </span>
          </span>
          <span className="hidden rounded-full border border-glass-border bg-void-900/70 px-2.5 py-0.5 font-mono text-[11px] text-cyan-glow sm:inline">
            {activeStage.skillCommand}
          </span>
        </div>

        <span
          className="glass-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] text-ink-muted"
          title={reason ?? "Interactive 2D SVG orbital diagram active"}
        >
          <Sparkles className="h-3 w-3 text-violet-glow" aria-hidden="true" />
          <span>2D Orbital View</span>
        </span>
      </div>

      {/* Holographic 8-Stage Orbital SVG */}
      <div className="relative my-2 flex flex-1 items-center justify-center">
        <svg
          viewBox="0 0 640 372"
          className="h-full max-h-[300px] w-full select-none"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="sdlc-orbit-aura" cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                stopColor="var(--color-violet-glow)"
                stopOpacity="0.22"
              />
              <stop
                offset="60%"
                stopColor="var(--color-cyan-glow)"
                stopOpacity="0.08"
              />
              <stop
                offset="100%"
                stopColor="var(--color-void-950)"
                stopOpacity="0"
              />
            </radialGradient>
          </defs>

          <ellipse cx={cx} cy={cy} rx={275} ry={162} fill="url(#sdlc-orbit-aura)" />

          {/* Dual concentric SDLC orbital track */}
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill="none"
            stroke="var(--color-cyan-glow)"
            strokeWidth="3"
            opacity="0.35"
          />
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill="none"
            stroke="var(--color-violet-glow)"
            strokeWidth="1.2"
            strokeDasharray="8 8"
            opacity="0.7"
          />
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx - 32}
            ry={ry - 22}
            fill="none"
            stroke="var(--color-glass-border)"
            strokeWidth="1"
            opacity="0.6"
          />

          {/* Center repeating factory hub */}
          <g>
            <circle
              cx={cx}
              cy={cy}
              r={54}
              fill="var(--color-void-900)"
              stroke="var(--color-glass-border-strong)"
              strokeWidth="1.5"
            />
            <text
              x={cx}
              y={cy - 10}
              textAnchor="middle"
              fill="var(--color-cyan-glow)"
              fontSize="11"
              fontWeight="700"
              fontFamily="var(--font-mono)"
            >
              STAGE 0{activeStage.order}
            </text>
            <text
              x={cx}
              y={cy + 8}
              textAnchor="middle"
              fill="var(--color-ink-primary)"
              fontSize="13"
              fontWeight="700"
              fontFamily="var(--font-sans)"
            >
              {activeStage.title}
            </text>
            <text
              x={cx}
              y={cy + 25}
              textAnchor="middle"
              fill="var(--color-ink-muted)"
              fontSize="9"
              fontFamily="var(--font-mono)"
            >
              CONTINUOUS LOOP
            </text>
          </g>

          {/* 8 Stage Beacons arranged clockwise starting from top */}
          {SDLC_STAGES.map((stage, index) => {
            const angle = (index / SDLC_STAGES.length) * Math.PI * 2 - Math.PI / 2;
            const nx = cx + Math.cos(angle) * rx;
            const ny = cy + Math.sin(angle) * ry;
            const isActive = stage.id === activeStage.id;
            const accent = stageAccentVar(stage);

            return (
              <g key={stage.id}>
                {isActive ? (
                  <>
                    <line
                      x1={cx}
                      y1={cy}
                      x2={nx}
                      y2={ny}
                      stroke={accent}
                      strokeWidth="1.6"
                      strokeDasharray="4 4"
                      opacity="0.65"
                    />
                    <circle
                      cx={nx}
                      cy={ny}
                      r={31}
                      fill={accent}
                      fillOpacity="0.16"
                      stroke={accent}
                      strokeWidth="2"
                    />
                  </>
                ) : null}
                <circle
                  cx={nx}
                  cy={ny}
                  r={isActive ? 22 : 18}
                  fill="var(--color-void-900)"
                  stroke={accent}
                  strokeWidth={isActive ? 2.6 : 1.5}
                />
                <text
                  x={nx}
                  y={ny + 4}
                  textAnchor="middle"
                  fill="var(--color-ink-primary)"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="var(--font-mono)"
                >
                  0{stage.order}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Accessible keyboard-navigable 8-stage selector strip */}
      <div
        className="z-10 flex max-w-full items-center gap-1.5 overflow-x-auto pb-1 pt-1"
        role="group"
        aria-label="Select SDLC stage"
      >
        {SDLC_STAGES.map((stage) => {
          const isActive = stage.id === activeStage.id;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelectStage(stage.id)}
              aria-pressed={isActive}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs transition-colors ${
                isActive
                  ? "border-cyan-glow bg-void-800 text-ink-primary"
                  : "border-glass-border bg-glass-subtle text-ink-secondary hover:border-glass-border-strong hover:text-ink-primary"
              }`}
            >
              <span className="text-cyan-glow">0{stage.order}</span>
              <span>{stage.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
