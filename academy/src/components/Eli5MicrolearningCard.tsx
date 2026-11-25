"use client";

import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Copy,
  FileCode2,
  Lightbulb,
  Sparkles,
  Terminal,
  Wrench,
} from "lucide-react";
import type {
  Eli5ConceptBlock,
  LearningDepthMode,
  LessonStep,
} from "@/lib/schemas";
import { AudioExplainerBar } from "./AudioExplainerBar";
import { MermaidDiagram } from "./MermaidDiagram";

export interface Eli5MicrolearningCardProps {
  step: LessonStep;
  eli5: Eli5ConceptBlock;
  learningDepthMode: LearningDepthMode;
  copiedSnippetKey: string | null;
  onCopySnippet: (snippetKey: string, code: string) => void;
  onJumpToPrompt: (promptId: string) => void;
  onJumpToResource: (relativePath: string) => void;
}

export function Eli5MicrolearningCard({
  step,
  eli5,
  learningDepthMode,
  copiedSnippetKey,
  onCopySnippet,
  onJumpToPrompt,
  onJumpToResource,
}: Eli5MicrolearningCardProps) {
  const [prevDepthMode, setPrevDepthMode] =
    useState<LearningDepthMode>(learningDepthMode);
  const [manualDrawerOpen, setManualDrawerOpen] = useState<boolean | null>(
    null,
  );

  if (prevDepthMode !== learningDepthMode) {
    setPrevDepthMode(learningDepthMode);
    setManualDrawerOpen(null);
  }

  const goDeeperOpen = manualDrawerOpen ?? learningDepthMode === "pro";

  const handleToggleGoDeeper = () => {
    setManualDrawerOpen(!goDeeperOpen);
  };

  const stepSnippets = [
    ...(step.codeSnippet ? [step.codeSnippet] : []),
    ...(step.additionalCodeSnippets ?? []),
  ];

  const estimatedMinutes = eli5.estimatedMinutes ?? 5;
  const goDeeperId = `go-deeper-${step.id}`;
  const displayStepTitle =
    learningDepthMode === "eli5" ? (eli5.plainTitle ?? step.title) : step.title;

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-2xl border border-glass-border-strong bg-void-900/60 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-glow/35 bg-void-950/85 px-3.5 py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-glow/40 bg-cyan-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-cyan-glow">
              <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
              Everyday Analogy
            </span>
            <p className="text-xs font-medium text-ink-primary sm:text-sm">
              {eli5.everydayAnalogy}
            </p>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-glass-border bg-void-900/80 px-2.5 py-0.5 font-mono text-xs text-ink-secondary">
            <Clock className="h-3 w-3 text-emerald-glow" aria-hidden="true" />~
            {estimatedMinutes} min
          </span>
        </div>

        <AudioExplainerBar
          stepId={step.id}
          stepTitle={displayStepTitle}
          audioScript={eli5.audioScript}
          audioUrl={eli5.audioUrl}
          estimatedMinutes={estimatedMinutes}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-glass-border-strong border-t-2 border-t-cyan-glow bg-void-900/75 p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-glow/50 bg-cyan-glow/15 font-mono text-xs font-bold text-cyan-glow"
            >
              1
            </span>
            <h6 className="font-mono text-xs font-semibold uppercase tracking-wider text-cyan-glow">
              1. Explain Like I&apos;m 5
            </h6>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-primary sm:text-sm">
            {eli5.simpleExplanation}
          </p>
        </section>

        <section className="rounded-2xl border border-glass-border-strong border-t-2 border-t-violet-glow bg-void-900/75 p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-violet-glow/50 bg-violet-glow/15 font-mono text-xs font-bold text-violet-glow"
            >
              2
            </span>
            <h6 className="font-mono text-xs font-semibold uppercase tracking-wider text-violet-glow">
              2. Why It Matters
            </h6>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-primary sm:text-sm">
            {eli5.whyItMatters}
          </p>
        </section>

        <section className="rounded-2xl border border-glass-border-strong border-t-2 border-t-emerald-glow bg-void-900/75 p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-glow/50 bg-emerald-glow/15 font-mono text-xs font-bold text-emerald-glow"
            >
              3
            </span>
            <h6 className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-glow">
              3. Role in the Protocol
            </h6>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-primary sm:text-sm">
            {eli5.roleInProtocol}
          </p>
        </section>

        <section className="rounded-2xl border border-glass-border-strong border-t-2 border-t-amber-glow bg-void-900/75 p-4 sm:p-5">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-glow/50 bg-amber-glow/15 font-mono text-xs font-bold text-amber-glow"
            >
              4
            </span>
            <h6 className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-glow">
              4. How to Use It Going Forward
            </h6>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-primary sm:text-sm">
            {eli5.howToUseGoingForward}
          </p>
        </section>
      </div>

      <div className="rounded-2xl border border-emerald-glow/40 bg-emerald-glow/10 p-4 sm:p-5">
        {eli5.whenToUse && (
          <div className="flex items-start gap-2.5">
            <Compass
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-glow"
              aria-hidden="true"
            />
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-glow">
                Use This When...
              </p>
              <p className="text-xs leading-relaxed text-ink-primary sm:text-sm">
                {eli5.whenToUse}
              </p>
            </div>
          </div>
        )}

        <div
          className={
            eli5.whenToUse
              ? "mt-4 border-t border-emerald-glow/25 pt-4"
              : undefined
          }
        >
          <div className="flex items-start gap-2.5">
            <Lightbulb
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-glow"
              aria-hidden="true"
            />
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-glow">
                {eli5.whenToUse ? "Everyday Example" : "Real-World Example"}
              </p>
              <p className="text-xs leading-relaxed text-ink-primary sm:text-sm">
                {eli5.realWorldExample}
              </p>
            </div>
          </div>
        </div>

        {step.promptId &&
          (() => {
            const linkedPromptId = step.promptId;
            return (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-emerald-glow/25 pt-3.5">
                <span className="text-xs text-ink-secondary">
                  Ready to put this lesson into action?
                </span>
                <button
                  type="button"
                  onClick={() => onJumpToPrompt(linkedPromptId)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-cyan-deep px-4 py-2 text-xs font-semibold text-ink-primary transition-colors hover:bg-cyan-glow hover:text-void-950"
                >
                  <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
                  Try the Matching Prompt
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })()}
      </div>

      {step.mermaidDiagram && (
        <div className="rounded-2xl border border-glass-border-strong bg-void-900/55 p-3 sm:p-4">
          <MermaidDiagram
            chart={step.mermaidDiagram}
            title={`Step ${step.order} Visual · ${displayStepTitle}`}
            caption={
              eli5.diagramCaption ?? `Plain-English flow for ${displayStepTitle}`
            }
          />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-violet-glow/40 bg-void-900/70">
        <button
          type="button"
          onClick={handleToggleGoDeeper}
          aria-expanded={goDeeperOpen}
          aria-controls={goDeeperId}
          className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-void-850/80"
        >
          <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-ink-primary sm:text-sm">
            <Wrench
              className="h-4 w-4 shrink-0 text-violet-glow"
              aria-hidden="true"
            />
            <span>Go Deeper: Senior Technical Specs &amp; Code</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-glow/40 bg-violet-glow/15 px-2.5 py-1 font-mono text-xs font-semibold text-violet-glow">
            <span>{goDeeperOpen ? "Hide Specs" : "Expand Specs"}</span>
            {goDeeperOpen ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        </button>

        {goDeeperOpen && (
          <div
            id={goDeeperId}
            className="space-y-4 border-t border-glass-border bg-void-900/50 p-4"
          >
            <div className="rounded-xl border border-glass-border bg-void-950/60 p-3.5">
              <p className="font-mono text-xs font-semibold uppercase tracking-wider text-violet-glow">
                Senior Technical Summary
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                {step.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-glass-border bg-void-950/60 p-4">
                <h6 className="font-mono text-xs font-semibold uppercase tracking-wider text-cyan-glow">
                  Key Takeaways
                </h6>
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                  {step.keyTakeaways.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-glow"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-glass-border bg-void-950/60 p-4">
                <h6 className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-glow">
                  Actionable Checklist
                </h6>
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink-primary sm:text-sm">
                  {step.actionChecklist.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-glow"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {stepSnippets.map((snippet, snippetIdx) => {
              const snippetKey = `${step.id}:${snippet.filename}:${snippetIdx}`;
              const isSnippetCopied = copiedSnippetKey === snippetKey;
              return (
                <div
                  key={snippetKey}
                  className="min-w-0 overflow-hidden rounded-xl border border-glass-border bg-void-950/90"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-glass-border bg-void-900/80 px-3.5 py-2">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <FileCode2
                        className="h-3.5 w-3.5 text-cyan-glow"
                        aria-hidden="true"
                      />
                      <span className="text-ink-primary">
                        {snippet.filename}
                      </span>
                      <span className="rounded bg-void-800 px-1.5 py-0.5 text-ink-muted">
                        {snippet.language}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onCopySnippet(snippetKey, snippet.code)}
                      className="glass-pill inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-cyan-glow"
                    >
                      {isSnippetCopied ? (
                        <Check
                          className="h-3 w-3 text-emerald-glow"
                          aria-hidden="true"
                        />
                      ) : (
                        <Copy className="h-3 w-3" aria-hidden="true" />
                      )}
                      {isSnippetCopied ? "Copied" : "Copy Snippet"}
                    </button>
                  </div>
                  <pre className="max-w-full overflow-x-auto p-4 font-mono text-xs leading-relaxed text-ink-secondary">
                    <code>{snippet.code}</code>
                  </pre>
                </div>
              );
            })}

            {(step.promptId || step.repoArtifactPath) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {step.promptId &&
                  (() => {
                    const linkedPromptId = step.promptId;
                    return (
                      <button
                        type="button"
                        onClick={() => onJumpToPrompt(linkedPromptId)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-glow/40 bg-cyan-glow/15 px-3.5 py-1.5 text-xs font-semibold text-cyan-glow transition-colors hover:bg-cyan-glow/25"
                      >
                        <Terminal
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Jump to Linked Prompt
                        <ArrowUpRight
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })()}
                {step.repoArtifactPath &&
                  (() => {
                    const artifactPath = step.repoArtifactPath;
                    return (
                      <button
                        type="button"
                        onClick={() => onJumpToResource(artifactPath)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-violet-glow/40 bg-violet-glow/15 px-3.5 py-1.5 text-xs font-semibold text-violet-glow transition-colors hover:bg-violet-glow/25"
                      >
                        <FileCode2
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Inspect Repo Artifact ({artifactPath})
                      </button>
                    );
                  })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
