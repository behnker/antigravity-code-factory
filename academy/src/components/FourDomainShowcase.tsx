"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCode2,
  FolderGit2,
  Layers,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  isAllowedLiveUrl,
  type DomainCaseStudy,
  type LearningDepthMode,
} from "@/lib/schemas";

export interface FourDomainShowcaseProps {
  domainCases: DomainCaseStudy[];
  learningDepthMode: LearningDepthMode;
  onOpenCourse: (courseSlug: string) => void;
}

const ACCENT_STYLES: Record<
  DomainCaseStudy["accentTone"],
  {
    topBar: string;
    border: string;
    badge: string;
    skillChip: string;
  }
> = {
  amber: {
    topBar: "bg-gradient-to-r from-amber-glow via-emerald-glow to-cyan-glow",
    border: "border-amber-glow/40 hover:border-amber-glow/75",
    badge: "border-amber-glow/40 bg-amber-glow/15 text-amber-glow",
    skillChip: "border-amber-glow/35 text-amber-glow",
  },
  emerald: {
    topBar: "bg-gradient-to-r from-emerald-glow via-cyan-glow to-violet-glow",
    border: "border-emerald-glow/40 hover:border-emerald-glow/75",
    badge: "border-emerald-glow/40 bg-emerald-glow/15 text-emerald-glow",
    skillChip: "border-emerald-glow/35 text-emerald-glow",
  },
  rose: {
    topBar: "bg-gradient-to-r from-rose-glow via-violet-glow to-cyan-glow",
    border: "border-rose-glow/40 hover:border-rose-glow/75",
    badge: "border-rose-glow/40 bg-rose-glow/15 text-rose-glow",
    skillChip: "border-rose-glow/35 text-rose-glow",
  },
  cyan: {
    topBar: "bg-gradient-to-r from-cyan-glow via-violet-glow to-emerald-glow",
    border: "border-cyan-glow/40 hover:border-cyan-glow/75",
    badge: "border-cyan-glow/40 bg-cyan-glow/15 text-cyan-glow",
    skillChip: "border-cyan-glow/35 text-cyan-glow",
  },
};

export function FourDomainShowcase({
  domainCases,
  learningDepthMode,
  onOpenCourse,
}: FourDomainShowcaseProps) {
  const orderedCases = useMemo(
    () => [...domainCases].sort((a, b) => a.order - b.order),
    [domainCases],
  );

  return (
    <section
      id="four-domains"
      aria-labelledby="four-domains-heading"
      className="py-14 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-amber-glow">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Proven Across Four Production Domains
            </span>
            <h2
              id="four-domains-heading"
              className="text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl"
            >
              One Code Factory Method · 4 Real Shipped Domains
            </h2>
            <p className="text-sm leading-relaxed text-ink-secondary">
              {learningDepthMode === "eli5"
                ? "The exact same blueprint-first workshop ships real projects across four completely different worlds: Website, Mobile/Web 3D Game, Video Generation, and Application & Harness Development."
                : "Spec-Driven Development, non-overlapping Swarm partitions, fail-closed hooks, and deterministic QA gates verified across Website, Mobile/Web 3D Game, Video Generation, and Application & Harness Development."}
            </p>
          </div>

          <div className="glass-pill inline-flex items-center gap-2 self-start rounded-xl px-3.5 py-2 font-mono text-xs text-ink-secondary lg:self-auto">
            <Sparkles
              className="h-3.5 w-3.5 shrink-0 text-emerald-glow"
              aria-hidden="true"
            />
            <span>
              {orderedCases.length} Domains · 20/20 Skills Mapped
            </span>
          </div>
        </div>

        {orderedCases.length === 0 ? (
          <div
            role="status"
            className="glass-panel flex flex-col items-center justify-center gap-2 rounded-2xl p-8 text-center"
          >
            <Layers
              className="h-6 w-6 text-cyan-glow"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-ink-primary">
              No domain case studies loaded
            </p>
            <p className="max-w-md text-xs leading-relaxed text-ink-secondary">
              Domain evidence cards will appear here once{" "}
              <code className="font-mono text-cyan-glow">
                FOUR_DOMAIN_CASES
              </code>{" "}
              is supplied by the page manifest.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {orderedCases.map((domain) => {
              const accent = ACCENT_STYLES[domain.accentTone];
              const isShipped = domain.status === "shipped";
              const displayTitle =
                learningDepthMode === "eli5" ? domain.eli5Title : domain.title;
              const displaySummary =
                learningDepthMode === "eli5"
                  ? domain.eli5Summary
                  : domain.summary;
              const hasLiveUrl =
                typeof domain.liveUrl === "string" &&
                domain.liveUrl.length > 0;
              const liveUrlAllowed =
                hasLiveUrl && isAllowedLiveUrl(domain.liveUrl ?? "");

              const openCourseLabel =
                domain.linkedCourseNumber !== undefined
                  ? `Open Course ${String(domain.linkedCourseNumber).padStart(2, "0")} →`
                  : "Open Course →";

              return (
                <article
                  key={domain.id}
                  className={`glass-panel flex min-w-0 flex-col overflow-hidden rounded-2xl transition-colors ${accent.border}`}
                >
                  <span
                    className={`block h-1 w-full shrink-0 ${accent.topBar}`}
                    aria-hidden="true"
                  />

                  <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                    <div className="space-y-3.5">
                      {/* Header Pills */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${accent.badge}`}
                          >
                            Domain {String(domain.order).padStart(2, "0")} ·{" "}
                            {domain.domainLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-glass-border bg-void-950/80 px-2.5 py-0.5 font-mono text-xs text-ink-secondary">
                            <FolderGit2
                              className="h-3 w-3 shrink-0 text-cyan-glow"
                              aria-hidden="true"
                            />
                            {domain.repoName}
                          </span>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${
                            isShipped
                              ? "border-emerald-glow/40 bg-emerald-glow/15 text-emerald-glow"
                              : "border-amber-glow/40 bg-amber-glow/15 text-amber-glow"
                          }`}
                        >
                          {isShipped ? (
                            <>
                              <CheckCircle2
                                className="h-3 w-3 shrink-0"
                                aria-hidden="true"
                              />
                              Shipped
                            </>
                          ) : (
                            <>
                              <Clock
                                className="h-3 w-3 shrink-0"
                                aria-hidden="true"
                              />
                              In Progress
                            </>
                          )}
                        </span>
                      </div>

                      {/* Title & Summary */}
                      <div className="space-y-1.5">
                        <h3 className="text-lg font-bold text-ink-primary">
                          {displayTitle}
                        </h3>
                        <p className="text-xs leading-relaxed text-ink-secondary sm:text-sm">
                          {displaySummary}
                        </p>
                      </div>

                      {/* Stack Pills */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {domain.stack.map((tech) => (
                          <span
                            key={tech}
                            className="rounded-lg border border-glass-border bg-void-950/80 px-2 py-0.5 font-mono text-xs text-ink-secondary"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>

                      {/* Skills Applied */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-ink-muted">
                          Skills:
                        </span>
                        {domain.skillsApplied.map((skill) => (
                          <span
                            key={skill}
                            className={`rounded-full border bg-void-900/80 px-2.5 py-0.5 font-mono text-xs ${accent.skillChip}`}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>

                      {/* Verified Metrics Strip */}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {domain.verifiedMetrics.map((metric) => (
                          <div
                            key={`${domain.id}-${metric.label}`}
                            className="rounded-xl border border-glass-border bg-void-950/85 px-3 py-2"
                          >
                            <div className="font-mono text-xs text-ink-muted">
                              {metric.label}
                            </div>
                            <div className="mt-0.5 font-mono text-xs font-semibold text-ink-primary">
                              {metric.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Proof Path & Action Links */}
                    <div className="space-y-3 border-t border-glass-border pt-3.5">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-ink-muted">
                        <FileCode2
                          className="h-3.5 w-3.5 shrink-0 text-cyan-glow"
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          Proof: {domain.proofArtifactPath}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {hasLiveUrl &&
                            (liveUrlAllowed ? (
                              <a
                                href={domain.liveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="glass-pill inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-cyan-glow transition-colors hover:border-cyan-glow/60 hover:text-ink-primary"
                              >
                                <ExternalLink
                                  className="h-3.5 w-3.5 shrink-0"
                                  aria-hidden="true"
                                />
                                Live Deployment
                                <ArrowUpRight
                                  className="h-3.5 w-3.5 shrink-0"
                                  aria-hidden="true"
                                />
                              </a>
                            ) : (
                              <span
                                role="alert"
                                className="inline-flex items-center gap-1 rounded-xl border border-rose-glow/40 bg-rose-glow/15 px-2.5 py-1 font-mono text-xs font-semibold text-rose-glow"
                              >
                                <AlertTriangle
                                  className="h-3 w-3 shrink-0"
                                  aria-hidden="true"
                                />
                                Blocked Live URL
                              </span>
                            ))}
                        </div>

                        {domain.linkedCourseSlug && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenCourse(domain.linkedCourseSlug!)
                            }
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-cyan-deep px-3.5 py-2 text-xs font-semibold text-ink-primary transition-colors hover:bg-cyan-glow hover:text-void-950"
                          >
                            <span>{openCourseLabel}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
