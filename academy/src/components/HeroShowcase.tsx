"use client";

import { ArrowRight, Layers, Sparkles, Terminal } from "lucide-react";
import type { HarnessMode } from "@/lib/contracts";
import type { RepoManifest } from "@/lib/schemas";
import { AntigravityArchitectureExplorer } from "@/components/AntigravityArchitectureExplorer";

export interface HeroShowcaseProps {
  manifest: RepoManifest;
  harnessMode: HarnessMode;
  onChangeHarnessMode: (mode: HarnessMode) => void;
}

export function HeroShowcase({
  manifest,
  harnessMode,
  onChangeHarnessMode,
}: HeroShowcaseProps) {
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
      className="relative overflow-hidden bg-void-950 py-10 sm:py-14 lg:py-16"
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
                <Layers
                  className="h-3.5 w-3.5 text-violet-glow"
                  aria-hidden="true"
                />
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
              New to building software with AI? Explore the 4-layer Antigravity
              operating model below—see how you steer 7 escalating Agent Modes
              powered by shared Tools, Memory, and Safety Guardrails—then follow
              plain-English courses and copy-ready prompts to ship with Code
              Factory v3.0.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="#courses"
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-deep px-5 py-2.5 text-sm font-semibold text-ink-primary shadow-lg transition-colors hover:bg-cyan-glow hover:text-void-950"
              >
                Start Here: Courses (Plain English)
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#prompt-vault"
                className="glass-pill inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-ink-primary transition-colors hover:border-glass-border-strong hover:text-cyan-glow"
              >
                <Terminal
                  className="h-4 w-4 text-violet-glow"
                  aria-hidden="true"
                />
                Copy Starter Prompts
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">
              Harness View Mode
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
                className={`flex-1 cursor-pointer rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors sm:flex-none ${
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
                className={`flex-1 cursor-pointer rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors sm:flex-none ${
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

        <AntigravityArchitectureExplorer harnessMode={harnessMode} />

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      </div>
    </section>
  );
}
