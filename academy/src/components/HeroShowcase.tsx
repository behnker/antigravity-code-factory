"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import {
  HARNESS_NODES,
  type HarnessMode,
  type HarnessNodeSpec,
} from "@/lib/contracts";
import type { RepoManifest } from "@/lib/schemas";

const HarnessConstellationScene = dynamic(
  () => import("@/components/three/HarnessConstellationScene"),
  {
    ssr: false,
    loading: () => (
      <div
        className="glass-panel flex h-80 w-full flex-col items-center justify-center gap-3 rounded-2xl p-6 sm:h-96 lg:h-128"
        role="status"
        aria-live="polite"
      >
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-glow border-t-transparent" />
        <p className="font-mono text-xs text-ink-muted">
          Initializing 3D Agent Harness Constellation...
        </p>
      </div>
    ),
  },
);

export interface HeroShowcaseProps {
  manifest: RepoManifest;
  harnessMode: HarnessMode;
  onChangeHarnessMode: (mode: HarnessMode) => void;
}

function StatusBadge({
  status,
}: {
  status: HarnessNodeSpec["statusRaw"];
}) {
  if (status === "leader") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-glow/40 bg-emerald-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-glow">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Leader
      </span>
    );
  }
  if (status === "parity") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-glow/40 bg-cyan-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-cyan-glow">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Parity+
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-glow/40 bg-amber-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-amber-glow">
      <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
      Open Gap
    </span>
  );
}

export function HeroShowcase({
  manifest,
  harnessMode,
  onChangeHarnessMode,
}: HeroShowcaseProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("hooks");

  const activeNode =
    HARNESS_NODES.find((node) => node.id === selectedNodeId) ??
    HARNESS_NODES[0];

  const activeStatus =
    harnessMode === "raw"
      ? activeNode.statusRaw
      : activeNode.statusCodeFactory;

  const kpis = [
    { label: "Live Skills", value: manifest.counts.skills },
    { label: "Agent Personas", value: manifest.counts.agents },
    { label: "Courses Loaded", value: manifest.counts.courses },
    { label: "SDLC Stages", value: 8 },
  ];

  return (
    <section
      id="hero-lab"
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-glass-border py-10 sm:py-14 lg:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-medium text-cyan-glow">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Live Repo Reference · v{manifest.pluginVersion}
              </span>
              <span className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs text-ink-secondary">
                <Layers className="h-3.5 w-3.5 text-violet-glow" aria-hidden="true" />
                {manifest.resources.length} Auto-Synced Repo Artifacts
              </span>
            </div>

            <h1
              id="hero-heading"
              className="text-3xl font-bold tracking-tight text-ink-primary sm:text-4xl lg:text-5xl"
            >
              Master the{" "}
              <span className="text-gradient-plasma">
                Antigravity Agent Harness
              </span>{" "}
              &amp; Enterprise Code Factory
            </h1>

            <p className="max-w-2xl text-sm leading-relaxed text-ink-secondary sm:text-base">
              Inspect every subsystem of Google Antigravity in interactive 3D,
              compare Raw Antigravity against Claude Code across 12 engineering
              dimensions, plug every structural gap with Code Factory v3.0, and
              copy battle-tested prompts backed by this live repository.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="#courses"
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-deep px-5 py-2.5 text-sm font-semibold text-ink-primary shadow-lg transition-colors hover:bg-cyan-glow hover:text-void-950"
              >
                Explore Courses
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#prompt-vault"
                className="glass-pill inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-ink-primary transition-colors hover:border-glass-border-strong hover:text-cyan-glow"
              >
                <Terminal className="h-4 w-4 text-violet-glow" aria-hidden="true" />
                Copy Starter Prompts
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">
              3D Harness Mode
            </span>
            <div
              className="glass-panel inline-flex w-full rounded-xl p-1 sm:w-auto"
              role="group"
              aria-label="Toggle between Raw Antigravity and Antigravity plus Code Factory v3.0"
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
                + Code Factory v3.0
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-8">
            <div className="glass-panel-elevated relative overflow-hidden rounded-2xl p-2">
              <div className="h-80 w-full overflow-hidden rounded-xl sm:h-96 lg:h-128">
                <HarnessConstellationScene
                  mode={harnessMode}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                  className="h-full w-full"
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1 pb-1" role="group" aria-label="Select a 3D harness subsystem node">
                {HARNESS_NODES.map((node) => {
                  const isSelected = node.id === activeNode.id;
                  const nodeStatus =
                    harnessMode === "raw"
                      ? node.statusRaw
                      : node.statusCodeFactory;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setSelectedNodeId(node.id)}
                      aria-pressed={isSelected}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                        isSelected
                          ? "border-cyan-glow bg-cyan-glow/20 text-ink-primary"
                          : "border-glass-border bg-void-900/70 text-ink-secondary hover:border-glass-border-strong hover:text-ink-primary"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          nodeStatus === "gap"
                            ? "bg-amber-glow"
                            : nodeStatus === "leader"
                              ? "bg-emerald-glow"
                              : "bg-cyan-glow"
                        }`}
                        aria-hidden="true"
                      />
                      {node.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside
            aria-label="Selected harness node telemetry"
            className="flex min-w-0 flex-col justify-between gap-4 lg:col-span-4"
          >
            <div className="glass-panel-elevated flex flex-1 flex-col justify-between rounded-2xl p-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-cyan-glow">
                    <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
                    Node Telemetry HUD
                  </span>
                  <StatusBadge status={activeStatus} />
                </div>

                <h2 className="mt-3 text-xl font-bold text-ink-primary">
                  {activeNode.label}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  {activeNode.role}
                </p>

                <div className="mt-5 space-y-3">
                  <div
                    className={`rounded-xl border p-3.5 ${
                      harnessMode === "raw"
                        ? "border-amber-glow/50 bg-amber-glow/10"
                        : "border-glass-border bg-void-900/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-amber-glow">
                        Raw Antigravity Baseline
                      </span>
                      <StatusBadge status={activeNode.statusRaw} />
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                      {activeNode.rawSummary}
                    </p>
                  </div>

                  <div
                    className={`rounded-xl border p-3.5 ${
                      harnessMode === "code-factory-v3"
                        ? "border-cyan-glow/60 bg-cyan-glow/10"
                        : "border-glass-border bg-void-900/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-cyan-glow">
                        Code Factory v3.0 Upgrade
                      </span>
                      <StatusBadge status={activeNode.statusCodeFactory} />
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-primary">
                      {activeNode.codeFactoryUpgrade}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-glass-border pt-3 text-xs text-ink-muted">
                Tip: Drag the 3D orbital constellation or click any node pill to
                inspect how Code Factory plugs harness gaps.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="glass-panel rounded-xl px-4 py-3"
                >
                  <p className="font-mono text-2xl font-bold text-ink-primary">
                    {kpi.value}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">{kpi.label}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
