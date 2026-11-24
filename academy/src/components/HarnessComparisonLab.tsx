"use client";

import { useMemo, useState } from "react";
import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Wrench,
} from "lucide-react";
import type { HarnessMode } from "@/lib/contracts";
import type { HarnessDimension } from "@/lib/schemas";

export interface HarnessComparisonLabProps {
  dimensions: HarnessDimension[];
  harnessMode: HarnessMode;
  onChangeHarnessMode: (mode: HarnessMode) => void;
}

type CategoryFilter = "all" | HarnessDimension["category"];

const CATEGORY_FILTERS: readonly { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "orchestration", label: "Orchestration" },
  { id: "guardrails", label: "Guardrails" },
  { id: "intelligence", label: "Intelligence" },
  { id: "ux", label: "UX" },
  { id: "platform", label: "Platform" },
];

function polarPoint(
  cx: number,
  cy: number,
  radius: number,
  index: number,
  total: number,
): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

function buildPolygonPoints(
  scores: number[],
  cx: number,
  cy: number,
  maxRadius: number,
): string {
  const total = scores.length;
  if (total === 0) return "";
  return scores
    .map((score, idx) => {
      const ratio = Math.max(0, Math.min(10, score)) / 10;
      const pt = polarPoint(cx, cy, maxRadius * ratio, idx, total);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(" ");
}

function WinnerBadge({
  winner,
  mode,
}: {
  winner: HarnessDimension["winnerRaw"];
  mode: HarnessMode;
}) {
  if (winner === "antigravity") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-glow/40 bg-cyan-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-cyan-glow">
        <Award className="h-3 w-3" aria-hidden="true" />
        {mode === "code-factory-v3" ? "AGY + CF Wins" : "Antigravity Wins"}
      </span>
    );
  }
  if (winner === "claude-code") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-violet-glow/40 bg-violet-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-violet-glow">
        <ShieldAlert className="h-3 w-3" aria-hidden="true" />
        Claude Code Leads
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-glow/40 bg-emerald-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-glow">
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      Parity Tie
    </span>
  );
}

export function HarnessComparisonLab({
  dimensions,
  harnessMode,
  onChangeHarnessMode,
}: HarnessComparisonLabProps) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const first = dimensions[0];
    return first ? { [first.id]: true } : {};
  });

  const filteredDimensions = useMemo(() => {
    if (category === "all") return dimensions;
    return dimensions.filter((dim) => dim.category === category);
  }, [category, dimensions]);

  const metrics = useMemo(() => {
    const count = dimensions.length || 1;
    const rawAvg =
      dimensions.reduce((sum, item) => sum + item.antigravityRawScore, 0) / count;
    const claudeAvg =
      dimensions.reduce((sum, item) => sum + item.claudeCodeScore, 0) / count;
    const cfAvg =
      dimensions.reduce(
        (sum, item) => sum + item.antigravityCodeFactoryScore,
        0,
      ) / count;

    const agyWins = dimensions.filter((item) =>
      harnessMode === "raw"
        ? item.winnerRaw === "antigravity"
        : item.winnerWithCodeFactory === "antigravity",
    ).length;
    const claudeWins = dimensions.filter((item) =>
      harnessMode === "raw"
        ? item.winnerRaw === "claude-code"
        : item.winnerWithCodeFactory === "claude-code",
    ).length;
    const ties = dimensions.length - agyWins - claudeWins;

    return {
      rawAvg,
      claudeAvg,
      cfAvg,
      deltaVsClaude: cfAvg - claudeAvg,
      deltaGain: cfAvg - rawAvg,
      agyWins,
      claudeWins,
      ties,
    };
  }, [dimensions, harnessMode]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const radarSize = 360;
  const cx = radarSize / 2;
  const cy = radarSize / 2;
  const maxRadius = 124;

  const claudePolygon = buildPolygonPoints(
    dimensions.map((d) => d.claudeCodeScore),
    cx,
    cy,
    maxRadius,
  );
  const rawPolygon = buildPolygonPoints(
    dimensions.map((d) => d.antigravityRawScore),
    cx,
    cy,
    maxRadius,
  );
  const cfPolygon = buildPolygonPoints(
    dimensions.map((d) => d.antigravityCodeFactoryScore),
    cx,
    cy,
    maxRadius,
  );

  return (
    <section
      id="comparison-lab"
      aria-labelledby="comparison-heading"
      className="border-b border-glass-border py-14 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-cyan-glow">
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              12-Dimension Engineering Appraisal
            </span>
            <h2
              id="comparison-heading"
              className="text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl"
            >
              Antigravity vs. Claude Code &amp; Gap-Plugging Lab
            </h2>
            <p className="text-sm leading-relaxed text-ink-secondary">
              Toggle between Raw Antigravity and Antigravity fortified with the
              Enterprise Code Factory v3.0 harness to see exactly where base
              gaps sit—and how deterministic hooks, specs, and sidecars flip the
              scorecard.
            </p>
          </div>

          <div
            className="glass-panel inline-flex w-full rounded-xl p-1 sm:w-auto"
            role="group"
            aria-label="Comparison harness profile"
          >
            <button
              type="button"
              onClick={() => onChangeHarnessMode("raw")}
              aria-pressed={harnessMode === "raw"}
              className={`flex-1 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors sm:flex-none ${
                harnessMode === "raw"
                  ? "bg-amber-glow/20 text-amber-glow ring-1 ring-amber-glow/50"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              Raw Antigravity
            </button>
            <button
              type="button"
              onClick={() => onChangeHarnessMode("code-factory-v3")}
              aria-pressed={harnessMode === "code-factory-v3"}
              className={`flex-1 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors sm:flex-none ${
                harnessMode === "code-factory-v3"
                  ? "bg-cyan-glow/20 text-cyan-glow ring-1 ring-cyan-glow/50"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              Antigravity + Code Factory v3.0
            </button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="glass-panel-elevated flex min-w-0 flex-col items-center justify-between rounded-2xl p-5 lg:col-span-6">
            <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink-primary">
                Multi-Axis Capability Radar (12 Dimensions)
              </h3>
              <span className="font-mono text-xs text-ink-muted">
                Scale 0–10
              </span>
            </div>

            <div className="flex w-full items-center justify-center py-2">
              <svg
                viewBox={`0 0 ${radarSize} ${radarSize}`}
                className="h-72 w-full max-w-sm sm:h-80"
                role="img"
                aria-label="12-dimension radar chart comparing Claude Code, Raw Antigravity, and Antigravity with Code Factory v3.0"
              >
                {[2, 4, 6, 8, 10].map((level) => (
                  <polygon
                    key={level}
                    points={buildPolygonPoints(
                      dimensions.map(() => level),
                      cx,
                      cy,
                      maxRadius,
                    )}
                    className="fill-none stroke-glass-border"
                    strokeWidth="1"
                  />
                ))}

                {dimensions.map((dim, idx) => {
                  const outer = polarPoint(
                    cx,
                    cy,
                    maxRadius,
                    idx,
                    dimensions.length,
                  );
                  const labelPt = polarPoint(
                    cx,
                    cy,
                    maxRadius + 22,
                    idx,
                    dimensions.length,
                  );
                  const isHighlighted =
                    category === "all" || dim.category === category;
                  return (
                    <g key={dim.id}>
                      <line
                        x1={cx}
                        y1={cy}
                        x2={outer.x}
                        y2={outer.y}
                        className="stroke-glass-border"
                        strokeWidth="1"
                      />
                      <text
                        x={labelPt.x}
                        y={labelPt.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className={`font-mono text-xs ${
                          isHighlighted ? "fill-ink-primary" : "fill-ink-muted/50"
                        }`}
                      >
                        D{dim.index}
                      </text>
                    </g>
                  );
                })}

                <polygon
                  points={claudePolygon}
                  className="fill-violet-glow/15 stroke-violet-glow transition-all duration-500"
                  strokeWidth="2"
                />

                <polygon
                  points={rawPolygon}
                  className={`transition-all duration-500 ${
                    harnessMode === "raw"
                      ? "fill-amber-glow/20 stroke-amber-glow"
                      : "fill-amber-glow/5 stroke-amber-glow/50"
                  }`}
                  strokeWidth={harnessMode === "raw" ? "2.5" : "1.5"}
                  strokeDasharray={harnessMode === "raw" ? undefined : "4 3"}
                />

                {harnessMode === "code-factory-v3" && (
                  <polygon
                    points={cfPolygon}
                    className="fill-cyan-glow/20 stroke-cyan-glow transition-all duration-500"
                    strokeWidth="2.5"
                  />
                )}
              </svg>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-4 border-t border-glass-border pt-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-ink-secondary">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-violet-glow"
                  aria-hidden="true"
                />
                Claude Code
              </span>
              <span className="inline-flex items-center gap-1.5 text-ink-secondary">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-amber-glow"
                  aria-hidden="true"
                />
                Raw Antigravity
              </span>
              <span className="inline-flex items-center gap-1.5 text-ink-primary">
                <span
                  className="h-2.5 w-2.5 rounded-full bg-cyan-glow"
                  aria-hidden="true"
                />
                Antigravity + Code Factory v3.0
              </span>
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-between gap-4 lg:col-span-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="glass-panel rounded-2xl p-4">
                <span className="font-mono text-xs text-violet-glow">
                  Claude Code Avg
                </span>
                <p className="mt-2 font-mono text-3xl font-bold text-ink-primary">
                  {metrics.claudeAvg.toFixed(1)}
                  <span className="text-sm font-normal text-ink-muted">/10</span>
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Strong CLI hooks &amp; LSP defaults
                </p>
              </div>

              <div
                className={`rounded-2xl p-4 ${
                  harnessMode === "raw" ? "glass-panel-elevated" : "glass-panel"
                }`}
              >
                <span className="font-mono text-xs text-amber-glow">
                  Raw Antigravity
                </span>
                <p className="mt-2 font-mono text-3xl font-bold text-ink-primary">
                  {metrics.rawAvg.toFixed(1)}
                  <span className="text-sm font-normal text-ink-muted">/10</span>
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Leads workflows, browser &amp; swarm
                </p>
              </div>

              <div
                className={`rounded-2xl p-4 ${
                  harnessMode === "code-factory-v3"
                    ? "glass-panel-elevated"
                    : "glass-panel"
                }`}
              >
                <span className="font-mono text-xs text-cyan-glow">
                  + Code Factory v3.0
                </span>
                <p className="mt-2 font-mono text-3xl font-bold text-cyan-glow">
                  {metrics.cfAvg.toFixed(1)}
                  <span className="text-sm font-normal text-ink-muted">/10</span>
                </p>
                <p className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-emerald-glow">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  +{metrics.deltaGain.toFixed(1)} lift (
                  {metrics.deltaVsClaude >= 0 ? "+" : ""}
                  {metrics.deltaVsClaude.toFixed(1)} vs CC)
                </p>
              </div>
            </div>

            <div className="glass-panel flex-1 rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink-primary">
                  Dimension Verdict Breakdown ({harnessMode === "raw" ? "Raw Mode" : "Code Factory v3.0"})
                </h3>
                <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-glow">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {dimensions.length} Dimensions Audited
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-cyan-glow/30 bg-cyan-glow/10 p-3">
                  <p className="font-mono text-2xl font-bold text-cyan-glow">
                    {metrics.agyWins}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-secondary">
                    Antigravity Leads
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-glow/30 bg-emerald-glow/10 p-3">
                  <p className="font-mono text-2xl font-bold text-emerald-glow">
                    {metrics.ties}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-secondary">
                    Parity Ties
                  </p>
                </div>
                <div className="rounded-xl border border-violet-glow/30 bg-violet-glow/10 p-3">
                  <p className="font-mono text-2xl font-bold text-violet-glow">
                    {metrics.claudeWins}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-secondary">
                    Claude Code Leads
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-ink-secondary">
                {harnessMode === "raw"
                  ? "In Raw mode, Antigravity already dominates multi-agent swarms, Python run_workflow pipelines, and multimodal browser verification, while trailing on hook granularity, native LSP, and auto-memory."
                  : "With Enterprise Code Factory v3.0 active, deterministic HITL hooks, two-stage feedback bridges, .memory/ sidecars, and companion LSP close every structural gap—putting Antigravity ahead overall."}
              </p>
            </div>
          </div>
        </div>

        <div
          className="mb-5 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter dimensions by engineering category"
        >
          {CATEGORY_FILTERS.map((item) => {
            const active = category === item.id;
            const count =
              item.id === "all"
                ? dimensions.length
                : dimensions.filter((d) => d.category === item.id).length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                aria-pressed={active}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-cyan-glow bg-cyan-glow/20 text-ink-primary"
                    : "border-glass-border bg-glass-surface text-ink-secondary hover:border-glass-border-strong hover:text-ink-primary"
                }`}
              >
                {item.label}{" "}
                <span className="font-mono text-ink-muted">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          {filteredDimensions.map((dim) => {
            const isExpanded = Boolean(expandedIds[dim.id]);
            const activeScore =
              harnessMode === "raw"
                ? dim.antigravityRawScore
                : dim.antigravityCodeFactoryScore;
            const activeWinner =
              harnessMode === "raw"
                ? dim.winnerRaw
                : dim.winnerWithCodeFactory;

            return (
              <article
                key={dim.id}
                className="glass-panel min-w-0 overflow-hidden rounded-2xl transition-colors hover:border-glass-border-strong"
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(dim.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`dimension-panel-${dim.id}`}
                  className="flex w-full flex-col gap-3 p-4 text-left sm:p-5"
                >
                  <div className="flex w-full flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-cyan-glow">
                          D{String(dim.index).padStart(2, "0")}
                        </span>
                        <span className="rounded bg-void-900/80 px-2 py-0.5 font-mono text-xs uppercase text-ink-muted">
                          {dim.category}
                        </span>
                      </div>
                      <h3 className="mt-1 text-base font-bold text-ink-primary">
                        {dim.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <WinnerBadge winner={activeWinner} mode={harnessMode} />
                      {isExpanded ? (
                        <ChevronUp
                          className="h-4 w-4 text-ink-muted"
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronDown
                          className="h-4 w-4 text-ink-muted"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </div>

                  <div className="w-full space-y-2">
                    <div>
                      <div className="mb-1 flex justify-between font-mono text-xs">
                        <span className="text-ink-secondary">
                          {harnessMode === "raw"
                            ? "Raw Antigravity"
                            : "Antigravity + Code Factory v3.0"}
                        </span>
                        <span
                          className={
                            harnessMode === "raw"
                              ? "text-amber-glow"
                              : "text-cyan-glow"
                          }
                        >
                          {activeScore.toFixed(1)} / 10
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-void-950">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            harnessMode === "raw"
                              ? "bg-amber-glow"
                              : "bg-cyan-glow"
                          }`}
                          style={{ width: `${(activeScore / 10) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 flex justify-between font-mono text-xs">
                        <span className="text-ink-muted">Claude Code</span>
                        <span className="text-violet-glow">
                          {dim.claudeCodeScore.toFixed(1)} / 10
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-void-950">
                        <div
                          className="h-full rounded-full bg-violet-glow transition-all duration-500"
                          style={{
                            width: `${(dim.claudeCodeScore / 10) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div
                    id={`dimension-panel-${dim.id}`}
                    className="space-y-3 border-t border-glass-border bg-void-900/50 p-4 text-xs leading-relaxed sm:p-5"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-glass-border bg-void-950/60 p-3">
                        <p className="font-mono font-semibold text-cyan-glow">
                          Antigravity Architecture
                        </p>
                        <p className="mt-1 text-ink-secondary">
                          {dim.antigravitySummary}
                        </p>
                      </div>
                      <div className="rounded-xl border border-glass-border bg-void-950/60 p-3">
                        <p className="font-mono font-semibold text-violet-glow">
                          Claude Code Baseline
                        </p>
                        <p className="mt-1 text-ink-secondary">
                          {dim.claudeCodeSummary}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-glow/30 bg-amber-glow/10 p-3">
                      <p className="font-mono font-semibold text-amber-glow">
                        Exact Gap Analysis
                      </p>
                      <p className="mt-1 text-ink-secondary">
                        {dim.gapAnalysis}
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-glow/35 bg-emerald-glow/10 p-3">
                      <p className="inline-flex items-center gap-1.5 font-mono font-semibold text-emerald-glow">
                        <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                        Senior Engineer Playbook: How to Plug &amp; Exceed
                      </p>
                      <p className="mt-1 text-ink-primary">
                        {dim.howToPlugAndExceed}
                      </p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
