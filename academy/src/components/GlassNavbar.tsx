"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { HarnessMode } from "@/lib/contracts";

export interface GlassNavbarProps {
  completionPercent: number;
  completedCount: number;
  totalStepCount: number;
  harnessMode: HarnessMode;
  onChangeHarnessMode: (mode: HarnessMode) => void;
  onOpenProgressModal: () => void;
}

const NAV_LINKS = [
  { href: "#hero-lab", label: "3D Lab" },
  { href: "#comparison-lab", label: "Comparison" },
  { href: "#sdlc-loop", label: "SDLC Loop" },
  { href: "#four-domains", label: "4 Domains" },
  { href: "#courses", label: "Courses" },
  { href: "#prompt-vault", label: "Prompt Vault" },
  { href: "#repo-hitl", label: "Repo & HITL" },
] as const;

export function GlassNavbar({
  completionPercent,
  completedCount,
  totalStepCount,
  harnessMode,
  onChangeHarnessMode,
  onOpenProgressModal,
}: GlassNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-glass-border bg-void-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <a
          href="#hero-lab"
          className="group flex shrink-0 items-center gap-2.5 rounded-lg py-0.5 text-ink-primary transition-colors hover:text-cyan-glow"
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-glass-border-strong bg-glass-elevated shadow-sm transition-transform group-hover:scale-105"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 32 32"
              className="h-5 w-5"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <polygon
                points="16,3 28,24 22.5,24 16,12.5 9.5,24 4,24"
                className="fill-cyan-glow/20 stroke-cyan-glow"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <circle
                cx="16"
                cy="21"
                r="3"
                className="fill-violet-glow"
              />
              <path
                d="M7 27H25"
                className="stroke-emerald-glow"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight sm:text-base">
              Antigravity Academy
            </span>
            <span className="font-mono text-xs text-ink-muted">
              Code Factory v3.0
            </span>
          </span>
        </a>

        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-1 lg:flex"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-glass-elevated hover:text-ink-primary xl:px-3"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div
            className="glass-pill hidden items-center gap-2 rounded-full px-3 py-1 text-xs sm:flex"
            aria-label={`Course progress: ${completionPercent}% (${completedCount} of ${totalStepCount} steps complete)`}
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-pulse-glow rounded-full bg-emerald-glow" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-glow" />
            </span>
            <span className="font-mono font-semibold text-ink-primary">
              {completionPercent}%
            </span>
            <span className="text-ink-muted">
              ({completedCount}/{totalStepCount})
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenProgressModal}
            className="glass-pill inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:border-glass-border-strong hover:text-ink-primary"
            aria-label="Export or import learner progress"
          >
            <Download className="h-3.5 w-3.5 text-cyan-glow" aria-hidden="true" />
            <span className="hidden sm:inline">Progress</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="glass-pill inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-primary transition-colors hover:border-glass-border-strong lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          id="mobile-nav-drawer"
          className="border-t border-glass-border bg-void-900/95 px-4 py-4 backdrop-blur-2xl lg:hidden"
        >
          <div className="mb-3 flex items-center justify-between rounded-xl border border-glass-border bg-glass-surface px-3 py-2">
            <span className="text-xs font-medium text-ink-secondary">
              Learner Progress
            </span>
            <span className="font-mono text-xs font-semibold text-emerald-glow">
              {completionPercent}% ({completedCount}/{totalStepCount} steps)
            </span>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2" role="group" aria-label="Harness visualization mode">
            <button
              type="button"
              onClick={() => onChangeHarnessMode("raw")}
              aria-pressed={harnessMode === "raw"}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                harnessMode === "raw"
                  ? "border-amber-glow/60 bg-amber-glow/15 text-amber-glow"
                  : "border-glass-border bg-glass-surface text-ink-secondary"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Raw Mode
            </button>
            <button
              type="button"
              onClick={() => onChangeHarnessMode("code-factory-v3")}
              aria-pressed={harnessMode === "code-factory-v3"}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                harnessMode === "code-factory-v3"
                  ? "border-cyan-glow/60 bg-cyan-glow/15 text-cyan-glow"
                  : "border-glass-border bg-glass-surface text-ink-secondary"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Code Factory
            </button>
          </div>

          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-glass-elevated hover:text-ink-primary"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
