"use client";

import { useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  ImageOff,
  Layers,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import {
  isAllowedLiveUrl,
  isAllowedProofImageUrl,
  type ProofArtifact,
  type ProofGallery,
} from "@/lib/schemas";

export interface ProofGalleryPanelProps {
  gallery: ProofGallery;
  stepId: string;
}

export function ProofGalleryPanel({ gallery, stepId }: ProofGalleryPanelProps) {
  const [failedArtifactIds, setFailedArtifactIds] = useState<
    Record<string, boolean>
  >({});
  const [openCliIds, setOpenCliIds] = useState<Record<string, boolean>>({});

  const markFailed = (artifactId: string) => {
    setFailedArtifactIds((prev) =>
      prev[artifactId] ? prev : { ...prev, [artifactId]: true },
    );
  };

  const toggleCli = (artifactId: string) => {
    setOpenCliIds((prev) => ({ ...prev, [artifactId]: !prev[artifactId] }));
  };

  const hasLiveUrl = typeof gallery.liveUrl === "string" && gallery.liveUrl.length > 0;
  const liveUrlAllowed = hasLiveUrl && isAllowedLiveUrl(gallery.liveUrl ?? "");

  const renderArtifactMedia = (artifact: ProofArtifact) => {
    const hasImageSrc =
      typeof artifact.imageSrc === "string" && artifact.imageSrc.length > 0;

    if (hasImageSrc && artifact.imageSrc) {
      if (!isAllowedProofImageUrl(artifact.imageSrc)) {
        return (
          <div
            role="alert"
            className="relative flex aspect-video w-full flex-col justify-between overflow-hidden rounded-xl border border-rose-glow/40 bg-void-900/80 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-glow/40 bg-rose-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-rose-glow">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Blocked Proof Image URL
              </span>
              <span className="font-mono text-xs text-ink-muted">
                Allowlist Enforced
              </span>
            </div>
            <div className="my-auto space-y-1 py-2">
              <p className="text-sm font-semibold text-ink-primary">
                {artifact.label}
              </p>
              <p className="text-xs leading-relaxed text-ink-secondary">
                Screenshot blocked because its path is outside{" "}
                <code className="font-mono text-rose-glow">
                  /media/proof-pack/&lt;slug&gt;/
                </code>
                .
              </p>
            </div>
          </div>
        );
      }

      if (failedArtifactIds[artifact.id]) {
        return (
          <div
            role="status"
            className="relative flex aspect-video w-full flex-col justify-between overflow-hidden rounded-xl border border-amber-glow/40 bg-void-900/80 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-glow/40 bg-amber-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-amber-glow">
                <ImageOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Proof Preview Unavailable
              </span>
              <span className="font-mono text-xs text-ink-muted">
                {artifact.id}
              </span>
            </div>
            <div className="my-auto space-y-1 py-2">
              <p className="text-sm font-semibold text-ink-primary">
                {artifact.label}
              </p>
              <p className="text-xs leading-relaxed text-ink-secondary">
                {artifact.alt ?? artifact.caption}
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-glass-border bg-void-950">
          <Image
            src={artifact.imageSrc}
            alt={artifact.alt ?? artifact.caption}
            fill
            sizes="(max-width: 768px) 100vw, 540px"
            unoptimized={artifact.imageSrc.endsWith(".svg")}
            className="object-cover"
            onError={() => markFailed(artifact.id)}
          />
        </div>
      );
    }

    const isCliProof = Boolean(artifact.cliExcerpt || artifact.command);

    return (
      <div
        role="status"
        className="cosmic-grid relative flex aspect-video w-full flex-col justify-between overflow-hidden rounded-xl border border-glass-border bg-void-950 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-glow/40 bg-void-900/80 px-2.5 py-0.5 font-mono text-xs font-semibold text-cyan-glow">
            <Terminal className="h-3 w-3 shrink-0" aria-hidden="true" />
            {artifact.id}
          </span>
          {isCliProof ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-glow/40 bg-emerald-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-glow">
              <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
              CLI Proof
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-glow/40 bg-amber-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-amber-glow">
              <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
              Pending Step 4B Capture
            </span>
          )}
        </div>

        <div className="my-auto space-y-2 py-2">
          <p className="text-sm font-semibold text-ink-primary">
            {artifact.label}
          </p>
          {artifact.command && (
            <p className="truncate rounded-lg border border-glass-border bg-void-900/80 px-2.5 py-1.5 font-mono text-xs text-cyan-glow">
              $ {artifact.command}
            </p>
          )}
        </div>

        <p className="font-mono text-xs text-ink-muted">
          {isCliProof
            ? "Verified CLI / log output attached below"
            : "Reserved 16:9 slot — zero fabricated metrics"}
        </p>
      </div>
    );
  };

  return (
    <section
      aria-label={`Proof Pack Gallery: ${gallery.title}`}
      className="glass-panel min-w-0 space-y-4 rounded-2xl border-glass-border-strong p-4 sm:p-5"
    >
      {/* 1. Header Strip */}
      <div className="flex flex-col gap-3 border-b border-glass-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-glow/40 bg-emerald-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-glow">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {gallery.pipelinePhase}
            </span>
            <span className="font-mono text-xs text-ink-muted">
              Verified Proof Pack Evidence
            </span>
          </div>

          <h6 className="text-base font-bold text-ink-primary">
            {gallery.title}
          </h6>
          <p className="text-xs leading-relaxed text-ink-secondary sm:text-sm">
            {gallery.summary}
          </p>
        </div>

        {hasLiveUrl &&
          (liveUrlAllowed ? (
            <a
              href={gallery.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-cyan-deep px-3.5 py-2 text-xs font-semibold text-ink-primary transition-colors hover:bg-cyan-glow hover:text-void-950"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Open Live Deployment
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </a>
          ) : (
            <div
              role="alert"
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-rose-glow/40 bg-rose-glow/15 px-3 py-1.5 font-mono text-xs font-semibold text-rose-glow"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Blocked Live URL
            </div>
          ))}
      </div>

      {/* Skills & Prompts Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-ink-muted">
          <Layers className="h-3.5 w-3.5 text-cyan-glow" aria-hidden="true" />
          Skills:
        </span>
        {gallery.skillsUsed.map((skill) => (
          <span
            key={skill}
            className="rounded-full border border-cyan-glow/35 bg-void-900/80 px-2.5 py-0.5 font-mono text-xs text-cyan-glow"
          >
            {skill}
          </span>
        ))}

        {gallery.promptsVerified.length > 0 && (
          <>
            <span className="ml-1 inline-flex items-center gap-1 font-mono text-xs font-semibold text-ink-muted">
              <Sparkles
                className="h-3.5 w-3.5 text-amber-glow"
                aria-hidden="true"
              />
              Prompts ({gallery.promptsVerified.length}):
            </span>
            {gallery.promptsVerified.map((promptRef) => (
              <span
                key={promptRef}
                className="rounded-full border border-amber-glow/35 bg-void-900/80 px-2.5 py-0.5 font-mono text-xs text-amber-glow"
              >
                {promptRef}
              </span>
            ))}
          </>
        )}
      </div>

      {/* 2. Metrics Strip */}
      {gallery.metrics.length > 0 && (
        <div
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Proof metrics"
        >
          {gallery.metrics.map((metric) => {
            const isPass = metric.status === "pass";
            return (
              <div
                key={`${metric.label}-${metric.after}`}
                className={`rounded-xl border bg-void-900/80 p-3 ${
                  isPass
                    ? "border-emerald-glow/40 text-emerald-glow"
                    : "border-amber-glow/40 text-amber-glow"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-ink-secondary">
                    {metric.label}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs font-semibold ${
                      isPass
                        ? "border-emerald-glow/40 bg-emerald-glow/15 text-emerald-glow"
                        : "border-amber-glow/40 bg-amber-glow/15 text-amber-glow"
                    }`}
                  >
                    {isPass ? (
                      <>
                        <CheckCircle2
                          className="h-3 w-3 shrink-0"
                          aria-hidden="true"
                        />
                        Verified
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                        Pending
                      </>
                    )}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-baseline gap-1.5 font-mono text-xs">
                  {metric.before && (
                    <>
                      <span className="text-ink-muted line-through">
                        {metric.before}
                      </span>
                      <span className="text-ink-muted" aria-hidden="true">
                        →
                      </span>
                    </>
                  )}
                  <span
                    className={`font-bold ${
                      isPass ? "text-emerald-glow" : "text-amber-glow"
                    }`}
                  >
                    {metric.after}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Artifact Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {gallery.artifacts.map((artifact) => {
          const cliDrawerId = `proof-cli-${stepId}-${artifact.id}`;
          const isCliOpen = Boolean(openCliIds[artifact.id]);

          return (
            <figure
              key={artifact.id}
              className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-glass-border bg-void-900/80 p-3.5"
            >
              <div className="space-y-3">
                {renderArtifactMedia(artifact)}

                <figcaption className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-ink-primary sm:text-sm">
                      {artifact.label}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-ink-secondary">
                    {artifact.caption}
                  </p>
                  {artifact.command && artifact.imageSrc && (
                    <p className="truncate rounded-lg border border-glass-border bg-void-950 px-2.5 py-1 font-mono text-xs text-cyan-glow">
                      $ {artifact.command}
                    </p>
                  )}
                </figcaption>
              </div>

              {/* 4. Expandable CLI Excerpt Drawer */}
              {artifact.cliExcerpt && (
                <div className="space-y-2 border-t border-glass-border pt-2.5">
                  <button
                    type="button"
                    aria-expanded={isCliOpen}
                    aria-controls={cliDrawerId}
                    onClick={() => toggleCli(artifact.id)}
                    className="glass-pill inline-flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-1.5 font-mono text-xs font-semibold text-cyan-glow transition-colors hover:border-cyan-glow/60 hover:text-ink-primary"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Terminal
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {isCliOpen ? "Hide CLI Excerpt" : "Inspect CLI Excerpt"}
                    </span>
                    {isCliOpen ? (
                      <ChevronUp
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronDown
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </button>

                  {isCliOpen && (
                    <pre
                      id={cliDrawerId}
                      className="max-h-56 overflow-auto rounded-xl border border-glass-border bg-void-950 p-3 font-mono text-xs leading-relaxed text-ink-secondary"
                    >
                      <code>{artifact.cliExcerpt}</code>
                    </pre>
                  )}
                </div>
              )}
            </figure>
          );
        })}
      </div>
    </section>
  );
}
