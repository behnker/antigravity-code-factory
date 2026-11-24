"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  FileCode2,
  GraduationCap,
  PlusCircle,
  RotateCcw,
  Terminal,
  Upload,
  X,
} from "lucide-react";
import { parseImportedProgress } from "@/lib/prompt-engine";
import type { Course, LearnerProgress } from "@/lib/schemas";
import { MermaidDiagram } from "./MermaidDiagram";
import { VideoStage } from "./VideoStage";

export interface CourseCurriculumStudioProps {
  courses: Course[];
  completedStepIds: string[];
  onToggleStepComplete: (stepId: string) => void;
  onJumpToPrompt: (promptId: string) => void;
  onJumpToResource: (relativePath: string) => void;
  progressModalOpen: boolean;
  onOpenProgressModal: () => void;
  onCloseProgressModal: () => void;
  progress: LearnerProgress;
  onImportProgress: (next: LearnerProgress) => void;
  onResetProgress: () => void;
}

async function copyCodeSafely(text: string): Promise<boolean> {
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

export function CourseCurriculumStudio({
  courses,
  completedStepIds,
  onToggleStepComplete,
  onJumpToPrompt,
  onJumpToResource,
  progressModalOpen,
  onOpenProgressModal,
  onCloseProgressModal,
  progress,
  onImportProgress,
  onResetProgress,
}: CourseCurriculumStudioProps) {
  const [activeCourseId, setActiveCourseId] = useState<string>(
    courses[0]?.id ?? "",
  );
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>(
    () => {
      const firstStep = courses[0]?.steps[0];
      return firstStep ? { [firstStep.id]: true } : {};
    },
  );
  const [copiedSnippetStepId, setCopiedSnippetStepId] = useState<string | null>(
    null,
  );
  const [blueprintExpanded, setBlueprintExpanded] = useState(false);

  const [importJsonText, setImportJsonText] = useState("");
  const [importStatus, setImportStatus] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });
  const [copiedExportJson, setCopiedExportJson] = useState(false);

  const activeCourse =
    courses.find((course) => course.id === activeCourseId) ?? courses[0] ?? null;

  useEffect(() => {
    if (!progressModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseProgressModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [progressModalOpen, onCloseProgressModal]);

  const courseStats = useMemo(() => {
    if (!activeCourse) return { completed: 0, total: 0, percent: 0 };
    const total = activeCourse.steps.length;
    const completed = activeCourse.steps.filter((step) =>
      completedStepIds.includes(step.id),
    ).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percent };
  }, [activeCourse, completedStepIds]);

  const handleSelectCourse = (course: Course) => {
    setActiveCourseId(course.id);
    if (course.steps[0]) {
      setExpandedSteps((prev) => ({ ...prev, [course.steps[0].id]: true }));
    }
  };

  const toggleStepAccordion = (stepId: string) => {
    setExpandedSteps((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const handleCopySnippet = async (stepId: string, code: string) => {
    const ok = await copyCodeSafely(code);
    if (ok) {
      setCopiedSnippetStepId(stepId);
      window.setTimeout(() => {
        setCopiedSnippetStepId((curr) => (curr === stepId ? null : curr));
      }, 2000);
    }
  };

  const serializedProgress = useMemo(
    () => JSON.stringify(progress, null, 2),
    [progress],
  );

  const handleDownloadExport = () => {
    const blob = new Blob([serializedProgress], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "antigravity-academy-progress.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyExport = async () => {
    const ok = await copyCodeSafely(serializedProgress);
    if (ok) {
      setCopiedExportJson(true);
      window.setTimeout(() => setCopiedExportJson(false), 2000);
    }
  };

  const handleImportSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseImportedProgress(importJsonText);
    if (!parsed.ok) {
      setImportStatus({ type: "error", message: parsed.error });
      return;
    }
    onImportProgress(parsed.data);
    setImportStatus({
      type: "success",
      message: `Imported ${parsed.data.completedStepIds.length} completed steps and ${parsed.data.bookmarkedPromptIds.length} bookmarked prompts.`,
    });
    setImportJsonText("");
  };

  return (
    <section
      id="courses"
      aria-labelledby="courses-heading"
      className="border-b border-glass-border py-14 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-emerald-glow">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              Structured Guided Curriculum
            </span>
            <h2
              id="courses-heading"
              className="text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl"
            >
              Course Curriculum Studio
            </h2>
            <p className="text-sm leading-relaxed text-ink-secondary">
              Work through hands-on courses with broadcast-ready video stages,
              Mermaid architecture graphs, syntax-highlighted snippets, and
              Zod-persisted completion tracking.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenProgressModal}
            className="glass-pill inline-flex items-center gap-2 self-start rounded-xl px-4 py-2 text-xs font-semibold text-cyan-glow transition-colors hover:border-cyan-glow/60 lg:self-auto"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export / Import Progress JSON
          </button>
        </div>

        <div
          className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
          role="group"
          aria-label="Select a course track"
        >
          {courses.map((course) => {
            const isSelected = activeCourse?.id === course.id;
            const completed = course.steps.filter((s) =>
              completedStepIds.includes(s.id),
            ).length;
            const pct = Math.round((completed / course.steps.length) * 100);
            return (
              <button
                key={course.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleSelectCourse(course)}
                className={`flex min-w-0 flex-col justify-between rounded-2xl p-4 text-left transition-all ${
                  isSelected
                    ? "glass-panel-elevated ring-1 ring-cyan-glow/50"
                    : "glass-panel hover:border-glass-border-strong"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-cyan-glow">
                      Course 0{course.number}
                    </span>
                    <span className="rounded-full border border-glass-border bg-void-900/80 px-2 py-0.5 font-mono text-xs capitalize text-ink-secondary">
                      {course.level}
                    </span>
                  </div>
                  <h3 className="mt-2 text-base font-bold text-ink-primary">
                    {course.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-secondary">
                    {course.subtitle}
                  </p>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between font-mono text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {course.estimatedMinutes} min
                    </span>
                    <span className="text-emerald-glow">
                      {completed}/{course.steps.length} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-void-950">
                    <div
                      className="h-full rounded-full bg-emerald-glow transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}

          <div className="glass-panel flex min-w-0 flex-col justify-between rounded-2xl border-dashed p-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-violet-glow">
                  <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Expand Platform
                </span>
                <span className="rounded-full border border-violet-glow/40 bg-violet-glow/15 px-2 py-0.5 font-mono text-xs text-violet-glow">
                  Course N+1
                </span>
              </div>
              <h3 className="mt-2 text-base font-bold text-ink-primary">
                Add Course {courses.length + 1} via Future Conversation
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                Drop a new Zod-validated{" "}
                <code className="font-mono text-cyan-glow">course.json</code>{" "}
                under{" "}
                <code className="font-mono text-cyan-glow">
                  academy/content/courses/&lt;slug&gt;/
                </code>{" "}
                — zero UI code changes required.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setBlueprintExpanded((prev) => !prev)}
              aria-expanded={blueprintExpanded}
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-glow/40 bg-violet-glow/15 px-3 py-2 text-xs font-semibold text-violet-glow transition-colors hover:bg-violet-glow/25"
            >
              {blueprintExpanded ? "Hide Authoring Blueprint" : "View Authoring Blueprint"}
            </button>
          </div>
        </div>

        {blueprintExpanded && (
          <div className="glass-panel mb-6 rounded-2xl border-violet-glow/40 p-5 text-xs text-ink-secondary">
            <h3 className="text-sm font-bold text-ink-primary">
              Extensible Course Registry Blueprint (Zero Core Edits)
            </h3>
            <p className="mt-1 leading-relaxed">
              Every future conversation can publish a new course into Antigravity
              Academy in 3 deterministic steps:
            </p>
            <ol className="mt-2.5 list-decimal space-y-1.5 pl-4">
              <li>
                Create{" "}
                <code className="font-mono text-cyan-glow">
                  academy/content/courses/&lt;new-slug&gt;/course.json
                </code>{" "}
                conforming to{" "}
                <code className="font-mono text-violet-glow">CourseSchema</code>.
              </li>
              <li>
                Include chapters, step checklists, optional Mermaid diagrams,
                and parameterized <code className="font-mono text-cyan-glow">prompts[]</code>.
              </li>
              <li>
                Run{" "}
                <code className="font-mono text-emerald-glow">
                  pnpm run sync:resources
                </code>{" "}
                — the new course automatically registers in the Studio, VideoStage,
                Prompt Vault, and{" "}
                <code className="font-mono text-cyan-glow">/api/courses</code>.
              </li>
            </ol>
          </div>
        )}

        {activeCourse && (
          <div
            aria-label={activeCourse.title}
            className="space-y-6"
          >
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-cyan-glow">
                      COURSE 0{activeCourse.number}
                    </span>
                    {activeCourse.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-glass-border bg-void-900/70 px-2.5 py-0.5 font-mono text-xs text-ink-muted"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <h3 className="mt-1.5 text-xl font-bold text-ink-primary">
                    {activeCourse.title}
                  </h3>
                  <p className="mt-1 text-sm text-ink-secondary">
                    {activeCourse.subtitle}
                  </p>
                </div>

                <div className="min-w-44 rounded-xl border border-glass-border bg-void-900/60 p-3">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-ink-muted">Course Progress</span>
                    <span className="font-bold text-emerald-glow">
                      {courseStats.percent}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-void-950">
                    <div
                      className="h-full rounded-full bg-emerald-glow transition-all duration-300"
                      style={{ width: `${courseStats.percent}%` }}
                    />
                  </div>
                  <p className="mt-1.5 font-mono text-xs text-ink-muted">
                    {courseStats.completed} of {courseStats.total} steps complete
                  </p>
                </div>
              </div>
            </div>

            <VideoStage
              key={activeCourse.id}
              video={activeCourse.video}
              accentTone={activeCourse.accentTone}
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="inline-flex items-center gap-2 text-base font-bold text-ink-primary">
                  <BookOpenCheck
                    className="h-4 w-4 text-cyan-glow"
                    aria-hidden="true"
                  />
                  Step-by-Step Interactive Lessons
                </h4>
                <span className="font-mono text-xs text-ink-muted">
                  Progress auto-saves locally
                </span>
              </div>

              {activeCourse.steps.map((step) => {
                const isCompleted = completedStepIds.includes(step.id);
                const isExpanded = Boolean(expandedSteps[step.id]);
                const checkboxId = `complete-step-${step.id}`;
                const isSnippetCopied = copiedSnippetStepId === step.id;

                return (
                  <article
                    key={step.id}
                    className={`min-w-0 overflow-hidden rounded-2xl transition-colors ${
                      isCompleted
                        ? "glass-panel border-emerald-glow/35"
                        : "glass-panel"
                    }`}
                  >
                    <div className="flex items-start gap-3 p-4 sm:p-5">
                      <div className="pt-1">
                        <input
                          id={checkboxId}
                          type="checkbox"
                          checked={isCompleted}
                          onChange={() => onToggleStepComplete(step.id)}
                          className="h-4 w-4 cursor-pointer rounded border-glass-border bg-void-950 accent-emerald-glow"
                        />
                        <label htmlFor={checkboxId} className="sr-only">
                          Mark step {step.order}: {step.title} as complete
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleStepAccordion(step.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`step-body-${step.id}`}
                        className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-cyan-glow">
                              Step {String(step.order).padStart(2, "0")}
                            </span>
                            <span className="rounded-full border border-glass-border bg-void-900/80 px-2 py-0.5 font-mono text-xs text-violet-glow">
                              {step.stageTag}
                            </span>
                            {isCompleted && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-glow/15 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-glow">
                                <CheckCircle2
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                                Complete
                              </span>
                            )}
                          </div>
                          <h5 className="mt-1 text-base font-bold text-ink-primary">
                            {step.title}
                          </h5>
                          <p className="mt-1 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                            {step.summary}
                          </p>
                        </div>

                        <span className="mt-1 shrink-0 text-ink-muted">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          )}
                        </span>
                      </button>
                    </div>

                    {isExpanded && (
                      <div
                        id={`step-body-${step.id}`}
                        className="space-y-4 border-t border-glass-border bg-void-900/45 p-4 sm:p-5"
                      >
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

                        {step.codeSnippet && (() => {
                          const snippet = step.codeSnippet;
                          return (
                            <div className="min-w-0 overflow-hidden rounded-xl border border-glass-border bg-void-950/90">
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
                                  onClick={() =>
                                    void handleCopySnippet(
                                      step.id,
                                      snippet.code,
                                    )
                                  }
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
                        })()}

                        {step.mermaidDiagram && (
                          <MermaidDiagram
                            chart={step.mermaidDiagram}
                            title={`Step ${step.order} Diagram · ${step.title}`}
                            caption={`Architectural flow for ${step.title}`}
                          />
                        )}

                        {(step.promptId || step.repoArtifactPath) && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {step.promptId && (() => {
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
                            {step.repoArtifactPath && (() => {
                              const artifactPath = step.repoArtifactPath;
                              return (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onJumpToResource(artifactPath)
                                  }
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
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {progressModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="progress-modal-title"
        >
          <div className="glass-panel-elevated max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-glass-border pb-4">
              <div>
                <h3
                  id="progress-modal-title"
                  className="text-lg font-bold text-ink-primary"
                >
                  Export or Import Learner Progress
                </h3>
                <p className="mt-1 text-xs text-ink-secondary">
                  Progress is stored locally in your browser and validated via{" "}
                  <code className="font-mono text-cyan-glow">
                    LearnerProgressSchema
                  </code>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseProgressModal}
                aria-label="Close progress dialog"
                className="glass-pill rounded-lg p-1.5 text-ink-secondary hover:text-ink-primary"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-5">
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-primary">
                    Current Progress Snapshot (JSON)
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopyExport()}
                      className="glass-pill inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-cyan-glow"
                    >
                      {copiedExportJson ? (
                        <Check
                          className="h-3.5 w-3.5 text-emerald-glow"
                          aria-hidden="true"
                        />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {copiedExportJson ? "Copied JSON" : "Copy JSON"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadExport}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-deep px-3 py-1.5 text-xs font-semibold text-ink-primary hover:bg-cyan-glow hover:text-void-950"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Download File
                    </button>
                  </div>
                </div>
                <pre className="max-h-40 overflow-auto rounded-xl border border-glass-border bg-void-950 p-3 font-mono text-xs text-ink-secondary">
                  <code>{serializedProgress}</code>
                </pre>
              </div>

              <form onSubmit={handleImportSubmit} className="space-y-3">
                <div>
                  <label
                    htmlFor="import-progress-json"
                    className="mb-1.5 block text-xs font-semibold text-ink-primary"
                  >
                    Import Progress JSON
                  </label>
                  <textarea
                    id="import-progress-json"
                    rows={5}
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                    placeholder='Paste exported JSON starting with { "schemaVersion": 1, ... }'
                    aria-invalid={importStatus.type === "error"}
                    aria-describedby={
                      importStatus.type !== "idle"
                        ? "import-progress-feedback"
                        : undefined
                    }
                    className="w-full rounded-xl border border-glass-border bg-void-950 p-3 font-mono text-xs text-ink-primary placeholder:text-ink-muted focus:border-cyan-glow"
                  />
                </div>

                {importStatus.type !== "idle" && (
                  <div
                    id="import-progress-feedback"
                    role={importStatus.type === "error" ? "alert" : "status"}
                    className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
                      importStatus.type === "error"
                        ? "border-rose-glow/40 bg-rose-glow/10 text-rose-glow"
                        : "border-emerald-glow/40 bg-emerald-glow/10 text-emerald-glow"
                    }`}
                  >
                    {importStatus.type === "error" ? (
                      <AlertTriangle
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span>{importStatus.message}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onResetProgress();
                      setImportStatus({
                        type: "success",
                        message: "Progress reset to clean defaults.",
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-glow/40 bg-rose-glow/10 px-3 py-1.5 text-xs font-semibold text-rose-glow hover:bg-rose-glow/20"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Reset Local Progress
                  </button>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-deep px-4 py-2 text-xs font-semibold text-ink-primary hover:bg-violet-glow hover:text-void-950"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    Validate &amp; Import
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
