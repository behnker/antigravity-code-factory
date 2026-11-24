"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  FileCode2,
  GitBranch,
  Terminal,
  Users,
} from "lucide-react";
import { SDLC_STAGES } from "@/lib/contracts";
import type { RepoResource, SdlcStageKey } from "@/lib/schemas";

const SdlcOrbitalScene = dynamic(
  () => import("@/components/three/SdlcOrbitalScene"),
  {
    ssr: false,
    loading: () => (
      <div
        className="glass-panel flex h-80 w-full flex-col items-center justify-center gap-3 rounded-2xl p-6 sm:h-96"
        role="status"
        aria-live="polite"
      >
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-glow border-t-transparent" />
        <p className="font-mono text-xs text-ink-muted">
          Initializing 3D SDLC Orbital Pipeline...
        </p>
      </div>
    ),
  },
);

export interface SdlcReferenceShowcaseProps {
  resources: RepoResource[];
  onJumpToPromptStage?: (stage: SdlcStageKey) => void;
  onJumpToResource?: (relativePath: string) => void;
}

async function copyTextSafely(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function SdlcReferenceShowcase({
  resources,
  onJumpToPromptStage,
  onJumpToResource,
}: SdlcReferenceShowcaseProps) {
  const [activeStageId, setActiveStageId] =
    useState<Exclude<SdlcStageKey, "meta">>("research");
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);
  const [showFullArtifact, setShowFullArtifact] = useState(false);

  const activeStage =
    SDLC_STAGES.find((stage) => stage.id === activeStageId) ?? SDLC_STAGES[0];

  const matchedArtifact = useMemo(() => {
    const normalized = activeStage.artifactPath.replace(/^\.\//, "");
    return (
      resources.find(
        (res) =>
          res.relativePath === normalized ||
          res.relativePath.endsWith(normalized),
      ) ?? null
    );
  }, [activeStage.artifactPath, resources]);

  const handleCopy = async (label: string, text: string) => {
    const ok = await copyTextSafely(text);
    if (ok) {
      setCopiedTarget(label);
      window.setTimeout(() => {
        setCopiedTarget((current) => (current === label ? null : current));
      }, 2000);
    }
  };

  const artifactPreview = useMemo(() => {
    if (!matchedArtifact) return "";
    if (showFullArtifact) return matchedArtifact.content;
    const lines = matchedArtifact.content.split("\n");
    return lines.slice(0, 24).join("\n");
  }, [matchedArtifact, showFullArtifact]);

  return (
    <section
      id="sdlc-loop"
      aria-labelledby="sdlc-heading"
      className="border-b border-glass-border py-14 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl space-y-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-violet-glow">
            <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
            Repeatable 8-Stage Enterprise SDLC Reference Model
          </span>
          <h2
            id="sdlc-heading"
            className="text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl"
          >
            Live Orbital Code Factory Loop
          </h2>
          <p className="text-sm leading-relaxed text-ink-secondary">
            Every feature built in this repository—including Antigravity Academy
            itself—travels through these 8 gated stages. Click any orbital node
            or stage pill to inspect the active persona, sign-off gate, and the
            real artifact generated in this repo.
          </p>
        </div>

        <div
          className="mb-6 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Select an Enterprise Code Factory SDLC stage"
        >
          {SDLC_STAGES.map((stage) => {
            const isActive = stage.id === activeStage.id;
            return (
              <button
                key={stage.id}
                id={`sdlc-tab-${stage.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`sdlc-panel-${stage.id}`}
                onClick={() => {
                  setActiveStageId(stage.id);
                  setShowFullArtifact(false);
                }}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  isActive
                    ? "border-violet-glow bg-violet-glow/20 text-ink-primary"
                    : "border-glass-border bg-glass-surface text-ink-secondary hover:border-glass-border-strong hover:text-ink-primary"
                }`}
              >
                <span className="font-mono text-cyan-glow">
                  0{stage.order}
                </span>
                <span>{stage.title}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-5">
            <div className="glass-panel-elevated overflow-hidden rounded-2xl p-2">
              <div className="h-80 w-full overflow-hidden rounded-xl sm:h-96">
                <SdlcOrbitalScene
                  activeStageId={activeStage.id}
                  onSelectStage={(stageId) => {
                    setActiveStageId(stageId);
                    setShowFullArtifact(false);
                  }}
                  className="h-full w-full"
                />
              </div>
              <div className="mt-2 flex items-center justify-between px-2 pb-1 font-mono text-xs text-ink-muted">
                <span>
                  Stage 0{activeStage.order} / 08 · {activeStage.title}
                </span>
                <span className="text-emerald-glow">Continuous Loop</span>
              </div>
            </div>
          </div>

          <div
            id={`sdlc-panel-${activeStage.id}`}
            role="tabpanel"
            aria-labelledby={`sdlc-tab-${activeStage.id}`}
            className="glass-panel-elevated flex min-w-0 flex-col justify-between gap-5 rounded-2xl p-5 sm:p-6 lg:col-span-7"
          >
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-glow/50 bg-cyan-glow/15 font-mono text-sm font-bold text-cyan-glow">
                    0{activeStage.order}
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-ink-primary">
                      {activeStage.title}
                    </h3>
                    <p className="inline-flex items-center gap-1.5 font-mono text-xs text-violet-glow">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      {activeStage.persona}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopy("skill", activeStage.skillCommand)
                    }
                    className="glass-pill inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs font-medium text-cyan-glow transition-colors hover:border-cyan-glow/60"
                  >
                    {copiedTarget === "skill" ? (
                      <Check
                        className="h-3.5 w-3.5 text-emerald-glow"
                        aria-hidden="true"
                      />
                    ) : (
                      <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {copiedTarget === "skill"
                      ? "Copied Skill"
                      : activeStage.skillCommand}
                  </button>

                  {onJumpToPromptStage && (
                    <button
                      type="button"
                      onClick={() => onJumpToPromptStage(activeStage.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-glow/40 bg-violet-glow/15 px-3 py-1.5 text-xs font-semibold text-violet-glow transition-colors hover:bg-violet-glow/25"
                    >
                      Stage Prompts
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                {activeStage.summary}
              </p>

              <div className="mt-4 rounded-xl border border-glass-border bg-void-900/60 p-4">
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-glow">
                  Mandatory Sign-Off Gate Checklist
                </h4>
                <ul className="mt-2.5 space-y-2">
                  {activeStage.gateChecklist.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-xs leading-relaxed text-ink-primary sm:text-sm"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-glow"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="min-w-0 rounded-xl border border-glass-border bg-void-950/70 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileCode2
                    className="h-4 w-4 shrink-0 text-cyan-glow"
                    aria-hidden="true"
                  />
                  <span className="truncate font-mono text-xs font-semibold text-ink-primary">
                    {matchedArtifact
                      ? matchedArtifact.relativePath
                      : activeStage.artifactPath}
                  </span>
                  {matchedArtifact && (
                    <span className="shrink-0 rounded bg-void-800 px-1.5 py-0.5 font-mono text-xs text-ink-muted">
                      {formatBytes(matchedArtifact.sizeBytes)}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {matchedArtifact && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopy("artifact", matchedArtifact.content)
                        }
                        className="glass-pill inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-secondary hover:text-ink-primary"
                      >
                        {copiedTarget === "artifact" ? (
                          <Check
                            className="h-3 w-3 text-emerald-glow"
                            aria-hidden="true"
                          />
                        ) : (
                          <Copy className="h-3 w-3" aria-hidden="true" />
                        )}
                        {copiedTarget === "artifact" ? "Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFullArtifact((prev) => !prev)}
                        aria-expanded={showFullArtifact}
                        className="glass-pill rounded-md px-2 py-1 text-xs text-cyan-glow"
                      >
                        {showFullArtifact ? "Collapse" : "Expand Full"}
                      </button>
                      {onJumpToResource && (
                        <button
                          type="button"
                          onClick={() =>
                            onJumpToResource(matchedArtifact.relativePath)
                          }
                          className="glass-pill rounded-md px-2 py-1 text-xs text-violet-glow"
                        >
                          Open in Explorer
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {matchedArtifact ? (
                <pre className="max-h-56 max-w-full overflow-auto rounded-lg border border-glass-border bg-void-950 p-3 font-mono text-xs leading-relaxed text-ink-secondary">
                  <code>{artifactPreview}</code>
                </pre>
              ) : (
                <p className="rounded-lg border border-glass-border bg-void-900/60 p-3 text-xs text-ink-muted">
                  Live artifact preview will populate automatically once{" "}
                  <code className="font-mono text-cyan-glow">
                    {activeStage.artifactPath}
                  </code>{" "}
                  is synced into the repository manifest.
                </p>
              )}

              <div className="sr-only" role="status" aria-live="polite">
                {copiedTarget ? `Copied ${copiedTarget} to clipboard.` : ""}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
