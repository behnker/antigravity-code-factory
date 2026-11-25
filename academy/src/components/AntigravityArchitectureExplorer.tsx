"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  BookOpen,
  CheckCircle2,
  Compass,
  Cpu,
  Layers,
  Lightbulb,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  ANTIGRAVITY_AGENT_MODES,
  ANTIGRAVITY_BUILDING_BLOCKS,
  ANTIGRAVITY_STEERING_COMMANDS,
  type AgentModeId,
  type AgentModeSpec,
  type BuildingBlockCategory,
  type BuildingBlockId,
  type BuildingBlockSpec,
  type HarnessMode,
} from "@/lib/contracts";

export interface AntigravityArchitectureExplorerProps {
  harnessMode: HarnessMode;
  className?: string;
}

type SelectionState =
  | { kind: "mode"; id: AgentModeId }
  | { kind: "block"; id: BuildingBlockId };

const BUILDING_BLOCK_GROUPS: readonly {
  category: BuildingBlockCategory;
  title: string;
  subtitle: string;
}[] = [
  {
    category: "tools",
    title: "Tools & Hands",
    subtitle: "How AI reads, edits, connects & sees",
  },
  {
    category: "memory",
    title: "Memory & Knowledge",
    subtitle: "How AI remembers rules & project state",
  },
  {
    category: "safety",
    title: "Safety & Guardrails",
    subtitle: "How you stay protected & portable",
  },
];

function StatusBadge({
  status,
}: {
  status: BuildingBlockSpec["statusRaw"];
}) {
  if (status === "leader") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-glow/40 bg-emerald-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-glow">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Leader
      </span>
    );
  }
  if (status === "parity") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-glow/40 bg-cyan-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-cyan-glow">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Parity+
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-glow/40 bg-amber-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-amber-glow">
      <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Open Gap
    </span>
  );
}

function CategoryIcon({ category }: { category: BuildingBlockCategory }) {
  if (category === "tools") {
    return <Wrench className="h-3.5 w-3.5 text-cyan-glow" aria-hidden="true" />;
  }
  if (category === "memory") {
    return (
      <BookOpen className="h-3.5 w-3.5 text-violet-glow" aria-hidden="true" />
    );
  }
  return (
    <ShieldCheck className="h-3.5 w-3.5 text-emerald-glow" aria-hidden="true" />
  );
}

function AgentModeSchematic({
  modeId,
  active,
}: {
  modeId: AgentModeId;
  active: boolean;
}) {
  const accent = active ? "var(--color-cyan-glow)" : "var(--color-ink-secondary)";
  const secondaryAccent = active
    ? "var(--color-violet-glow)"
    : "var(--color-ink-muted)";
  const successAccent = "var(--color-emerald-glow)";
  const boxFill = "var(--color-void-900)";
  const boxStroke = active
    ? "var(--color-cyan-glow)"
    : "var(--color-glass-border-strong)";

  switch (modeId) {
    case "just-ask":
      return (
        <svg
          viewBox="0 0 180 54"
          className="h-12 w-full"
          aria-hidden="true"
          fill="none"
        >
          <rect
            x="16"
            y="14"
            width="48"
            height="26"
            rx="6"
            fill={boxFill}
            stroke={boxStroke}
            strokeWidth="1.5"
          />
          <text
            x="40"
            y="30"
            textAnchor="middle"
            fill="var(--color-ink-primary)"
            fontSize="9"
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            YOU
          </text>
          <line
            x1="68"
            y1="27"
            x2="108"
            y2="27"
            stroke={accent}
            strokeWidth="1.75"
          />
          <polyline
            points="103,22 109,27 103,32"
            stroke={accent}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="114"
            y="14"
            width="50"
            height="26"
            rx="6"
            fill={boxFill}
            stroke={accent}
            strokeWidth="1.5"
          />
          <text
            x="139"
            y="30"
            textAnchor="middle"
            fill={accent}
            fontSize="9"
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            1 AI
          </text>
        </svg>
      );

    case "subagents":
      return (
        <svg
          viewBox="0 0 180 54"
          className="h-12 w-full"
          aria-hidden="true"
          fill="none"
        >
          <rect
            x="14"
            y="8"
            width="58"
            height="24"
            rx="6"
            fill={boxFill}
            stroke={accent}
            strokeWidth="1.5"
          />
          <text
            x="43"
            y="23"
            textAnchor="middle"
            fill="var(--color-ink-primary)"
            fontSize="8.5"
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            LEAD AI
          </text>
          <path
            d="M72 20 C90 20, 90 36, 106 36"
            stroke={secondaryAccent}
            strokeWidth="1.6"
            strokeDasharray="3 2"
          />
          <polyline
            points="102,32 107,36 102,40"
            stroke={secondaryAccent}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="110"
            y="24"
            width="56"
            height="24"
            rx="6"
            fill={boxFill}
            stroke={secondaryAccent}
            strokeWidth="1.5"
          />
          <text
            x="138"
            y="39"
            textAnchor="middle"
            fill={secondaryAccent}
            fontSize="8.5"
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            HELPER
          </text>
        </svg>
      );

    case "orchestrator":
      return (
        <svg
          viewBox="0 0 180 54"
          className="h-12 w-full"
          aria-hidden="true"
          fill="none"
        >
          <rect
            x="10"
            y="14"
            width="58"
            height="26"
            rx="6"
            fill={boxFill}
            stroke={accent}
            strokeWidth="1.5"
          />
          <text
            x="39"
            y="30"
            textAnchor="middle"
            fill={accent}
            fontSize="8.5"
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            PLANNER
          </text>
          <path
            d="M68 23 L106 14"
            stroke={accent}
            strokeWidth="1.5"
          />
          <path
            d="M68 31 L106 40"
            stroke={accent}
            strokeWidth="1.5"
          />
          <rect
            x="108"
            y="5"
            width="62"
            height="19"
            rx="5"
            fill={boxFill}
            stroke={secondaryAccent}
            strokeWidth="1.4"
          />
          <text
            x="139"
            y="17"
            textAnchor="middle"
            fill="var(--color-ink-primary)"
            fontSize="8"
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            BUILDER 1
          </text>
          <rect
            x="108"
            y="30"
            width="62"
            height="19"
            rx="5"
            fill={boxFill}
            stroke={secondaryAccent}
            strokeWidth="1.4"
          />
          <text
            x="139"
            y="42"
            textAnchor="middle"
            fill="var(--color-ink-primary)"
            fontSize="8"
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            BUILDER 2
          </text>
        </svg>
      );

    case "workflows":
      return (
        <svg
          viewBox="0 0 180 54"
          className="h-12 w-full"
          aria-hidden="true"
          fill="none"
        >
          <rect
            x="8"
            y="16"
            width="42"
            height="22"
            rx="5"
            fill={boxFill}
            stroke={accent}
            strokeWidth="1.5"
          />
          <text
            x="29"
            y="30"
            textAnchor="middle"
            fill={accent}
            fontSize="7.5"
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            PIPE
          </text>
          <line x1="50" y1="27" x2="72" y2="11" stroke={accent} strokeWidth="1.3" />
          <line x1="50" y1="27" x2="72" y2="27" stroke={accent} strokeWidth="1.3" />
          <line x1="50" y1="27" x2="72" y2="43" stroke={accent} strokeWidth="1.3" />
          {[4, 20, 36].map((yPos, idx) => (
            <g key={yPos}>
              <rect
                x="74"
                y={yPos}
                width="34"
                height="14"
                rx="3.5"
                fill={boxFill}
                stroke={boxStroke}
                strokeWidth="1.3"
              />
              <text
                x="91"
                y={yPos + 10}
                textAnchor="middle"
                fill="var(--color-ink-primary)"
                fontSize="7.5"
                fontWeight="700"
                fontFamily="var(--font-mono)"
              >
                #{idx + 1}
              </text>
            </g>
          ))}
          <line x1="108" y1="11" x2="132" y2="27" stroke={successAccent} strokeWidth="1.3" />
          <line x1="108" y1="27" x2="132" y2="27" stroke={successAccent} strokeWidth="1.3" />
          <line x1="108" y1="43" x2="132" y2="27" stroke={successAccent} strokeWidth="1.3" />
          <rect
            x="134"
            y="14"
            width="38"
            height="26"
            rx="6"
            fill={boxFill}
            stroke={successAccent}
            strokeWidth="1.5"
          />
          <path
            d="M146 27 L151 32 L160 22"
            stroke={successAccent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "swarm":
      return (
        <svg
          viewBox="0 0 180 54"
          className="h-12 w-full"
          aria-hidden="true"
          fill="none"
        >
          {[10, 52, 94].map((xPos, idx) => (
            <g key={xPos}>
              <rect
                x={xPos}
                y="6"
                width="34"
                height="18"
                rx="4.5"
                fill={boxFill}
                stroke={accent}
                strokeWidth="1.4"
              />
              <text
                x={xPos + 17}
                y="18"
                textAnchor="middle"
                fill="var(--color-ink-primary)"
                fontSize="7.5"
                fontWeight="700"
                fontFamily="var(--font-mono)"
              >
                W{idx + 1}
              </text>
              <line
                x1={xPos + 17}
                y1="24"
                x2={xPos + 17}
                y2="34"
                stroke={accent}
                strokeWidth="1.3"
              />
            </g>
          ))}
          <rect
            x="10"
            y="34"
            width="118"
            height="14"
            rx="4"
            fill={boxFill}
            stroke={secondaryAccent}
            strokeWidth="1.4"
          />
          <text
            x="69"
            y="44"
            textAnchor="middle"
            fill={secondaryAccent}
            fontSize="7.5"
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            SHARED BOARD
          </text>
          <line
            x1="128"
            y1="41"
            x2="140"
            y2="31"
            stroke={successAccent}
            strokeWidth="1.4"
          />
          <path
            d="M156 12 L169 17 V28 C169 36 163 41 156 44 C149 41 143 36 143 28 V17 Z"
            fill={boxFill}
            stroke={successAccent}
            strokeWidth="1.5"
          />
          <path
            d="M151 28 L155 32 L162 24"
            stroke={successAccent}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "boost":
      return (
        <svg
          viewBox="0 0 180 54"
          className="h-12 w-full"
          aria-hidden="true"
          fill="none"
        >
          {[4, 20, 36].map((yPos, idx) => (
            <g key={yPos}>
              <rect
                x="12"
                y={yPos}
                width="48"
                height="14"
                rx="4"
                fill={boxFill}
                stroke={secondaryAccent}
                strokeWidth="1.4"
              />
              <text
                x="36"
                y={yPos + 10}
                textAnchor="middle"
                fill="var(--color-ink-primary)"
                fontSize="7.5"
                fontWeight="700"
                fontFamily="var(--font-mono)"
              >
                BRAIN {idx + 1}
              </text>
              <line
                x1="60"
                y1={yPos + 7}
                x2="112"
                y2="27"
                stroke={accent}
                strokeWidth="1.4"
              />
            </g>
          ))}
          <circle
            cx="140"
            cy="27"
            r="18"
            fill={boxFill}
            stroke={accent}
            strokeWidth="1.5"
          />
          <circle
            cx="140"
            cy="27"
            r="10"
            stroke={secondaryAccent}
            strokeWidth="1.4"
          />
          <circle cx="140" cy="27" r="3.5" fill={successAccent} />
        </svg>
      );

    case "teamwork":
      return (
        <svg
          viewBox="0 0 220 54"
          className="h-12 w-full"
          aria-hidden="true"
          fill="none"
        >
          <rect
            x="6"
            y="14"
            width="40"
            height="24"
            rx="10"
            fill={boxFill}
            stroke={accent}
            strokeWidth="1.4"
          />
          <text
            x="26"
            y="29"
            textAnchor="middle"
            fill="var(--color-ink-primary)"
            fontSize="7.5"
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            ASK
          </text>
          <line x1="46" y1="26" x2="58" y2="26" stroke={accent} strokeWidth="1.4" />
          <rect
            x="58"
            y="14"
            width="42"
            height="24"
            rx="5"
            fill={boxFill}
            stroke={secondaryAccent}
            strokeWidth="1.4"
          />
          <text
            x="79"
            y="29"
            textAnchor="middle"
            fill={secondaryAccent}
            fontSize="7.5"
            fontWeight="700"
            fontFamily="var(--font-mono)"
          >
            SPEC
          </text>
          <line x1="100" y1="26" x2="112" y2="26" stroke={accent} strokeWidth="1.4" />
          {[112, 132, 152].map((xPos, idx) => (
            <rect
              key={xPos}
              x={xPos}
              y="10"
              width="16"
              height="32"
              rx="4"
              fill={boxFill}
              stroke={accent}
              strokeWidth="1.3"
            >
              <title>{`Team column ${idx + 1}`}</title>
            </rect>
          ))}
          <line x1="168" y1="26" x2="180" y2="26" stroke={successAccent} strokeWidth="1.4" />
          <rect
            x="180"
            y="14"
            width="34"
            height="24"
            rx="6"
            fill={boxFill}
            stroke={successAccent}
            strokeWidth="1.5"
          />
          <path
            d="M191 26 L195 30 L204 21"
            stroke={successAccent}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export function AntigravityArchitectureExplorer({
  harnessMode,
  className = "",
}: AntigravityArchitectureExplorerProps) {
  const [selection, setSelection] = useState<SelectionState>({
    kind: "mode",
    id: "just-ask",
  });
  const [activeSteeringId, setActiveSteeringId] = useState<string>(
    ANTIGRAVITY_STEERING_COMMANDS[0].id,
  );

  const activeSteering =
    ANTIGRAVITY_STEERING_COMMANDS.find((cmd) => cmd.id === activeSteeringId) ??
    ANTIGRAVITY_STEERING_COMMANDS[0];

  const selectedMode: AgentModeSpec | null =
    selection.kind === "mode"
      ? (ANTIGRAVITY_AGENT_MODES.find((mode) => mode.id === selection.id) ??
        ANTIGRAVITY_AGENT_MODES[0])
      : null;

  const selectedBlock: BuildingBlockSpec | null =
    selection.kind === "block"
      ? (ANTIGRAVITY_BUILDING_BLOCKS.find(
          (block) => block.id === selection.id,
        ) ?? ANTIGRAVITY_BUILDING_BLOCKS[0])
      : null;

  const activeModeBlockSet = new Set<BuildingBlockId>(
    selectedMode ? selectedMode.buildingBlockIds : [],
  );

  const modesUsingSelectedBlock: AgentModeSpec[] = selectedBlock
    ? ANTIGRAVITY_AGENT_MODES.filter((mode) =>
        mode.buildingBlockIds.includes(selectedBlock.id),
      )
    : [];

  return (
    <div
      className={`grid grid-cols-1 gap-6 lg:grid-cols-12 ${className}`}
      aria-label="Antigravity 4-Layer Operating Model Visualizer"
    >
      {/* Left / Main Stage: 3 Interactive Layers */}
      <div className="min-w-0 lg:col-span-8">
        <div className="glass-panel-elevated space-y-5 rounded-2xl p-4 sm:p-5">
          {/* LAYER 1: YOU (THE DIRECTOR) & STEERING COMMANDS */}
          <div className="rounded-xl border border-glass-border-strong bg-void-900/80 p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-cyan-glow">
                <Compass className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Layer 1 · You (Desktop · IDE · Terminal · SDK)
              </span>
              <span className="rounded-full border border-glass-border bg-void-950/80 px-2.5 py-0.5 font-mono text-xs text-ink-secondary">
                5 Steering Commands
              </span>
            </div>

            <div
              className="mt-3 flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Layer 1 steering commands"
            >
              {ANTIGRAVITY_STEERING_COMMANDS.map((cmd) => {
                const isActive = cmd.id === activeSteering.id;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    aria-pressed={isActive}
                    title={cmd.plainDescription}
                    onClick={() => setActiveSteeringId(cmd.id)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                      isActive
                        ? "border-cyan-glow bg-cyan-glow/15 text-ink-primary"
                        : "border-glass-border bg-void-950/85 text-ink-secondary hover:border-cyan-glow/60 hover:text-ink-primary"
                    }`}
                  >
                    <span className="font-mono text-xs font-bold text-cyan-glow">
                      {cmd.command}
                    </span>
                    <span className="text-xs font-medium text-ink-secondary">
                      · {cmd.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-2.5 rounded-lg border border-glass-border bg-void-950/70 px-3 py-2 text-xs leading-relaxed text-ink-secondary">
              <span className="font-mono font-semibold text-cyan-glow">
                {activeSteering.command}
              </span>{" "}
              ({activeSteering.label}): {activeSteering.plainDescription}
            </p>
          </div>

          {/* LAYER 2: HOW YOU RUN AI — THE 7 AGENT MODES */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-ink-primary">
                <Cpu
                  className="h-3.5 w-3.5 shrink-0 text-cyan-glow"
                  aria-hidden="true"
                />
                Layer 2 · How You Run AI — The 7 Agent Modes (Click any mode to
                inspect)
              </h2>
              <span className="font-mono text-xs text-ink-muted">
                Smallest &amp; Fastest (1) → Largest &amp; Multi-Day (7)
              </span>
            </div>

            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
              role="group"
              aria-label="Select one of the 7 Antigravity Agent Modes"
            >
              {ANTIGRAVITY_AGENT_MODES.map((mode) => {
                const isSelected =
                  selection.kind === "mode" && selection.id === mode.id;
                const isPoweredBySelectedBlock =
                  selection.kind === "block" &&
                  mode.buildingBlockIds.includes(selection.id);
                const isDimmedByBlock =
                  selection.kind === "block" && !isPoweredBySelectedBlock;
                const isWidestMode = mode.id === "teamwork";

                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelection({ kind: "mode", id: mode.id })}
                    className={`flex min-w-0 cursor-pointer flex-col justify-between rounded-xl p-3 text-left transition-all ${
                      isWidestMode ? "sm:col-span-2 xl:col-span-2" : ""
                    } ${
                      isSelected
                        ? "border-2 border-cyan-glow bg-cyan-glow/15 shadow-lg"
                        : isPoweredBySelectedBlock
                          ? "border border-emerald-glow/60 bg-emerald-glow/10 hover:border-cyan-glow/70"
                          : isDimmedByBlock
                            ? "border border-glass-border bg-void-950/60 opacity-60 hover:border-cyan-glow/60 hover:opacity-100"
                            : "border border-glass-border-strong bg-void-950/90 hover:border-cyan-glow/60"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs font-bold ${
                            isSelected
                              ? "bg-cyan-deep text-ink-primary"
                              : "border border-glass-border bg-void-900 text-cyan-glow"
                          }`}
                        >
                          {String(mode.order).padStart(2, "0")}
                        </span>
                        <span className="truncate rounded-md border border-glass-border bg-void-900/90 px-1.5 py-0.5 font-mono text-xs text-ink-secondary">
                          {mode.commandHint}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-ink-primary">
                          {mode.name}
                        </span>
                        {isPoweredBySelectedBlock && (
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-emerald-glow">
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-emerald-glow"
                              aria-hidden="true"
                            />
                            Uses it
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 text-xs leading-snug text-ink-secondary">
                        {mode.shortTagline}
                      </p>
                    </div>

                    <div className="mt-2.5 rounded-lg border border-glass-border bg-void-950/85 px-2 py-1">
                      <AgentModeSchematic
                        modeId={mode.id}
                        active={isSelected || isPoweredBySelectedBlock}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* VISUAL LAYER CONNECTOR */}
          <div className="flex items-center justify-center gap-2 rounded-xl border border-glass-border bg-void-900/75 px-3 py-2 text-center">
            <ArrowDown
              className="h-3.5 w-3.5 shrink-0 text-emerald-glow"
              aria-hidden="true"
            />
            <span className="font-mono text-xs font-semibold text-ink-secondary">
              Every Agent Mode Runs On These Shared Building Blocks (Tools,
              Memory &amp; Safety)
            </span>
            <ArrowDown
              className="h-3.5 w-3.5 shrink-0 text-emerald-glow"
              aria-hidden="true"
            />
          </div>

          {/* LAYER 3: SHARED BUILDING BLOCKS (TOOLS, MEMORY & SAFETY) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-ink-primary">
                <Layers
                  className="h-3.5 w-3.5 shrink-0 text-violet-glow"
                  aria-hidden="true"
                />
                Layer 3 · What Powers All 7 Modes — Shared Building Blocks
              </h2>
              <span className="font-mono text-xs text-emerald-glow">
                {selectedMode
                  ? `${selectedMode.buildingBlockIds.length} of ${ANTIGRAVITY_BUILDING_BLOCKS.length} highlighted for ${selectedMode.name}`
                  : "Click any block or mode to explore connections"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {BUILDING_BLOCK_GROUPS.map((group) => {
                const blocks = ANTIGRAVITY_BUILDING_BLOCKS.filter(
                  (block) => block.category === group.category,
                );
                return (
                  <div
                    key={group.category}
                    className="flex min-w-0 flex-col gap-2 rounded-xl border border-glass-border bg-void-900/65 p-3"
                  >
                    <div className="border-b border-glass-border pb-2">
                      <div className="flex items-center gap-1.5">
                        <CategoryIcon category={group.category} />
                        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-primary">
                          {group.title}
                        </h3>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {group.subtitle}
                      </p>
                    </div>

                    <div
                      className="flex flex-col gap-2"
                      role="group"
                      aria-label={`${group.title} building blocks`}
                    >
                      {blocks.map((block) => {
                        const isBlockSelected =
                          selection.kind === "block" &&
                          selection.id === block.id;
                        const isHighlightedByMode =
                          selection.kind === "mode" &&
                          activeModeBlockSet.has(block.id);
                        const isDimmedByMode =
                          selection.kind === "mode" && !isHighlightedByMode;
                        const blockStatus =
                          harnessMode === "raw"
                            ? block.statusRaw
                            : block.statusCodeFactory;

                        return (
                          <button
                            key={block.id}
                            type="button"
                            aria-pressed={isBlockSelected}
                            onClick={() =>
                              setSelection({ kind: "block", id: block.id })
                            }
                            className={`flex min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-all ${
                              isBlockSelected
                                ? "border-2 border-violet-glow bg-violet-glow/15 text-ink-primary shadow-md"
                                : isHighlightedByMode
                                  ? "border-emerald-glow/60 bg-emerald-glow/10 text-ink-primary hover:border-violet-glow/70"
                                  : isDimmedByMode
                                    ? "border-glass-border bg-void-950/55 text-ink-secondary hover:border-violet-glow/60 hover:bg-void-900/80 hover:text-ink-primary"
                                    : "border-glass-border-strong bg-void-950/85 text-ink-primary hover:border-violet-glow/60"
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  isBlockSelected
                                    ? "bg-violet-glow"
                                    : isHighlightedByMode
                                      ? "bg-emerald-glow"
                                      : blockStatus === "gap"
                                        ? "bg-amber-glow"
                                        : blockStatus === "leader"
                                          ? "bg-emerald-glow"
                                          : "bg-cyan-glow"
                                }`}
                                aria-hidden="true"
                              />
                              <span className="truncate text-xs font-semibold">
                                {block.shortLabel}
                              </span>
                            </div>

                            {isHighlightedByMode ? (
                              <span className="shrink-0 font-mono text-xs font-semibold text-emerald-glow">
                                Active
                              </span>
                            ) : (
                              <span className="shrink-0 font-mono text-xs text-ink-secondary">
                                {blockStatus === "gap"
                                  ? "Gap"
                                  : blockStatus === "leader"
                                    ? "Leader"
                                    : "Parity+"}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right-Side Inspector Panel (Layer 4 / Guide) */}
      <aside
        aria-label="Selected architecture layer guide"
        className="flex min-w-0 flex-col lg:col-span-4"
      >
        <div className="glass-panel-elevated flex flex-1 flex-col justify-between gap-4 rounded-2xl p-5">
          {selectedMode ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-glow/40 bg-cyan-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-cyan-glow">
                  <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                  LAYER 2 · AGENT MODE GUIDE
                </span>
                <span className="font-mono text-xs font-semibold text-ink-muted">
                  Mode {String(selectedMode.order).padStart(2, "0")} / 07
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold text-ink-primary">
                    {selectedMode.name}
                  </h3>
                  <span className="rounded-lg border border-glass-border-strong bg-void-900 px-2 py-0.5 font-mono text-xs font-semibold text-cyan-glow">
                    {selectedMode.commandHint}
                  </span>
                </div>

                <div className="mt-3 rounded-xl border border-cyan-glow/35 bg-cyan-glow/10 p-3">
                  <p className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-cyan-glow">
                    <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Plain-English Analogy
                  </p>
                  <p className="mt-1 text-xs leading-relaxed font-medium text-ink-primary">
                    {selectedMode.eli5Analogy}
                  </p>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                  {selectedMode.plainDescription}
                </p>
              </div>

              {/* Scale / Speed / Compute 3-chip bar */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-glass-border bg-void-900/75 p-2.5">
                  <span className="block font-mono text-xs text-ink-muted">
                    Scale
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-ink-primary">
                    {selectedMode.scaleLabel}
                  </span>
                </div>
                <div className="rounded-xl border border-glass-border bg-void-900/75 p-2.5">
                  <span className="block font-mono text-xs text-ink-muted">
                    Speed
                  </span>
                  <span className="mt-0.5 block text-xs font-semibold text-ink-primary">
                    {selectedMode.speedLabel}
                  </span>
                </div>
                <div className="rounded-xl border border-glass-border bg-void-900/75 p-2.5">
                  <span className="block font-mono text-xs text-ink-muted">
                    Compute
                  </span>
                  <div
                    className="mt-1.5 flex items-center gap-1"
                    aria-label={`Compute level ${selectedMode.computeLevel} of 5`}
                    role="img"
                  >
                    {[1, 2, 3, 4, 5].map((pip) => (
                      <span
                        key={pip}
                        className={`h-2 flex-1 rounded-full ${
                          pip <= selectedMode.computeLevel
                            ? "bg-cyan-glow"
                            : "bg-void-800"
                        }`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Use When vs Do NOT Use When */}
              <div className="space-y-2.5">
                <div className="rounded-xl border border-emerald-glow/40 bg-emerald-glow/10 p-3">
                  <p className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-glow">
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    Use This Mode When:
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-primary">
                    {selectedMode.useWhen}
                  </p>
                </div>

                <div className="rounded-xl border border-rose-glow/40 bg-rose-glow/10 p-3">
                  <p className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-rose-glow">
                    <AlertTriangle
                      className="h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    Do NOT Use When:
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-primary">
                    {selectedMode.doNotUseWhen}
                  </p>
                </div>
              </div>

              {/* Active Building Blocks Strip */}
              <div>
                <p className="font-mono text-xs font-semibold text-ink-muted">
                  Powered By These Building Blocks (Click to inspect):
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedMode.buildingBlockIds.map((blockId) => {
                    const block = ANTIGRAVITY_BUILDING_BLOCKS.find(
                      (b) => b.id === blockId,
                    );
                    if (!block) return null;
                    return (
                      <button
                        key={block.id}
                        type="button"
                        onClick={() =>
                          setSelection({ kind: "block", id: block.id })
                        }
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-glow/45 bg-emerald-glow/10 px-2.5 py-1 text-xs font-semibold text-emerald-glow transition-colors hover:border-violet-glow hover:bg-violet-glow/15 hover:text-ink-primary"
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-emerald-glow"
                          aria-hidden="true"
                        />
                        {block.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Raw vs Code Factory v3.0 comparison */}
              <div className="space-y-2.5 border-t border-glass-border pt-3">
                <div
                  className={`rounded-xl border p-3 ${
                    harnessMode === "raw"
                      ? "border-amber-glow/55 bg-amber-glow/10"
                      : "border-glass-border bg-void-900/60"
                  }`}
                >
                  <span className="font-mono text-xs font-semibold text-amber-glow">
                    Raw Antigravity Baseline
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                    {selectedMode.rawBaseline}
                  </p>
                </div>

                <div
                  className={`rounded-xl border p-3 ${
                    harnessMode === "code-factory-v3"
                      ? "border-cyan-glow/60 bg-cyan-glow/10"
                      : "border-glass-border bg-void-900/60"
                  }`}
                >
                  <span className="font-mono text-xs font-semibold text-cyan-glow">
                    + Code Factory v3.0 Upgrade
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-ink-primary">
                    {selectedMode.codeFactoryUpgrade}
                  </p>
                </div>
              </div>
            </div>
          ) : selectedBlock ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-glow/40 bg-violet-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-violet-glow">
                  <Layers className="h-3 w-3 shrink-0" aria-hidden="true" />
                  LAYER 3 · BUILDING BLOCK GUIDE
                </span>
                <StatusBadge
                  status={
                    harnessMode === "raw"
                      ? selectedBlock.statusRaw
                      : selectedBlock.statusCodeFactory
                  }
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-bold text-ink-primary">
                    {selectedBlock.name}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-lg border border-glass-border bg-void-900 px-2 py-0.5 font-mono text-xs font-semibold text-ink-secondary">
                    <CategoryIcon category={selectedBlock.category} />
                    {selectedBlock.categoryLabel}
                  </span>
                </div>

                <div className="mt-3 rounded-xl border border-violet-glow/40 bg-violet-glow/10 p-3">
                  <p className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-violet-glow">
                    <Lightbulb className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Plain-English Analogy
                  </p>
                  <p className="mt-1 text-xs leading-relaxed font-medium text-ink-primary">
                    {selectedBlock.eli5Analogy}
                  </p>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                  {selectedBlock.plainDescription}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-glow/40 bg-emerald-glow/10 p-3">
                <p className="font-mono text-xs font-semibold text-emerald-glow">
                  Why It Matters
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-primary">
                  {selectedBlock.whyItMatters}
                </p>
              </div>

              {/* Used By These Modes Strip */}
              <div>
                <p className="font-mono text-xs font-semibold text-ink-muted">
                  Used By These Agent Modes (Click to inspect):
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {modesUsingSelectedBlock.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() =>
                        setSelection({ kind: "mode", id: mode.id })
                      }
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-cyan-glow/45 bg-cyan-glow/10 px-2.5 py-1 text-xs font-semibold text-cyan-glow transition-colors hover:bg-cyan-glow/20 hover:text-ink-primary"
                    >
                      <span className="font-mono text-xs">
                        {String(mode.order).padStart(2, "0")}
                      </span>
                      <span>{mode.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Raw vs Code Factory v3.0 comparison */}
              <div className="space-y-2.5 border-t border-glass-border pt-3">
                <div
                  className={`rounded-xl border p-3 ${
                    harnessMode === "raw"
                      ? "border-amber-glow/55 bg-amber-glow/10"
                      : "border-glass-border bg-void-900/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-amber-glow">
                      Raw Antigravity Baseline
                    </span>
                    <StatusBadge status={selectedBlock.statusRaw} />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                    {selectedBlock.rawSummary}
                  </p>
                </div>

                <div
                  className={`rounded-xl border p-3 ${
                    harnessMode === "code-factory-v3"
                      ? "border-cyan-glow/60 bg-cyan-glow/10"
                      : "border-glass-border bg-void-900/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-cyan-glow">
                      + Code Factory v3.0 Upgrade
                    </span>
                    <StatusBadge status={selectedBlock.statusCodeFactory} />
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-primary">
                    {selectedBlock.codeFactoryUpgrade}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="border-t border-glass-border pt-3 text-xs text-ink-muted">
            Tip: Click any of the 7 Agent Modes (Layer 2) to highlight the exact
            Building Blocks (Layer 3) that power it—or click any Building Block
            to see which modes rely on it.
          </div>
        </div>
      </aside>
    </div>
  );
}
