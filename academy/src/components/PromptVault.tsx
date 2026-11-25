"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  Check,
  Compass,
  Copy,
  FilterX,
  Search,
  Sparkles,
  Terminal,
} from "lucide-react";
import { interpolatePrompt } from "@/lib/prompt-engine";
import type {
  Course,
  DifficultyLevel,
  LearningDepthMode,
  PromptCard,
  SdlcStageKey,
} from "@/lib/schemas";

export interface PromptVaultProps {
  courses: Course[];
  bookmarkedPromptIds: string[];
  promptVariableValues: Record<string, Record<string, string>>;
  onToggleBookmark: (promptId: string) => void;
  onUpdateVariable: (promptId: string, varKey: string, value: string) => void;
  highlightedPromptId?: string | null;
  stageFilterOverride?: SdlcStageKey | "all" | null;
  onClearStageFilterOverride?: () => void;
  learningDepthMode?: LearningDepthMode;
}

interface IndexedPrompt extends PromptCard {
  courseNumber: number;
  courseTitle: string;
}

const STAGE_OPTIONS: readonly { id: SdlcStageKey | "all"; label: string }[] = [
  { id: "all", label: "All Stages" },
  { id: "research", label: "Research" },
  { id: "spec", label: "Spec" },
  { id: "architecture", label: "Architecture" },
  { id: "build", label: "Build" },
  { id: "test", label: "Test" },
  { id: "deploy", label: "Deploy" },
  { id: "feedback", label: "Feedback" },
  { id: "optimise", label: "Optimise" },
  { id: "meta", label: "Meta / Harness" },
];

const DIFFICULTY_OPTIONS: readonly {
  id: DifficultyLevel | "all";
  label: string;
}[] = [
  { id: "all", label: "All Levels" },
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "senior", label: "Senior" },
];

async function copyPromptToClipboard(text: string): Promise<boolean> {
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

export function PromptVault({
  courses,
  bookmarkedPromptIds,
  promptVariableValues,
  onToggleBookmark,
  onUpdateVariable,
  highlightedPromptId = null,
  stageFilterOverride = null,
  onClearStageFilterOverride,
  learningDepthMode = "eli5",
}: PromptVaultProps) {
  const [stageFilter, setStageFilter] = useState<SdlcStageKey | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<
    DifficultyLevel | "all"
  >("all");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string>("");

  useEffect(() => {
    if (stageFilterOverride) {
      setStageFilter(stageFilterOverride);
      setBookmarkedOnly(false);
      setSearchQuery("");
      onClearStageFilterOverride?.();
    }
  }, [stageFilterOverride, onClearStageFilterOverride]);

  const allPrompts = useMemo<IndexedPrompt[]>(() => {
    const seen = new Set<string>();
    const list: IndexedPrompt[] = [];
    for (const course of courses) {
      for (const prompt of course.prompts) {
        if (seen.has(prompt.id)) continue;
        seen.add(prompt.id);
        list.push({
          ...prompt,
          courseNumber: course.number,
          courseTitle: course.title,
        });
      }
    }
    return list;
  }, [courses]);

  const filteredPrompts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allPrompts.filter((prompt) => {
      if (stageFilter !== "all" && prompt.stage !== stageFilter) return false;
      if (difficultyFilter !== "all" && prompt.difficulty !== difficultyFilter) {
        return false;
      }
      if (bookmarkedOnly && !bookmarkedPromptIds.includes(prompt.id)) {
        return false;
      }
      if (!query) return true;
      return (
        prompt.title.toLowerCase().includes(query) ||
        (prompt.eli5Title?.toLowerCase().includes(query) ?? false) ||
        prompt.description.toLowerCase().includes(query) ||
        (prompt.whenToUse?.toLowerCase().includes(query) ?? false) ||
        prompt.template.toLowerCase().includes(query) ||
        (prompt.skillRef?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [
    allPrompts,
    bookmarkedOnly,
    bookmarkedPromptIds,
    difficultyFilter,
    searchQuery,
    stageFilter,
  ]);

  const handleClearFilters = () => {
    setStageFilter("all");
    setDifficultyFilter("all");
    setBookmarkedOnly(false);
    setSearchQuery("");
  };

  const handleCopyPrompt = async (prompt: IndexedPrompt, resolved: string) => {
    const ok = await copyPromptToClipboard(resolved);
    if (ok) {
      setCopiedPromptId(prompt.id);
      setToastMessage(`Copied "${prompt.title}" to clipboard.`);
      window.setTimeout(() => {
        setCopiedPromptId((curr) => (curr === prompt.id ? null : curr));
      }, 2200);
    } else {
      setToastMessage(
        "Clipboard access unavailable — select and copy the prompt manually.",
      );
    }
  };

  return (
    <section
      id="prompt-vault"
      aria-labelledby="prompt-vault-heading"
      className="py-14 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-cyan-glow">
              <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
              Parameterized Engineering Prompts
            </span>
            <h2
              id="prompt-vault-heading"
              className="text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl"
            >
              Copyable Prompt Vault
            </h2>
            <p className="text-sm leading-relaxed text-ink-secondary">
              Fill in live <code className="font-mono text-cyan-glow">{"{{variable}}"}</code>{" "}
              fields to customize each Antigravity prompt for your own codebase,
              bookmark favorites, and copy in one click.
            </p>
          </div>

          <div className="glass-pill inline-flex items-center gap-2 self-start rounded-full px-3.5 py-1.5 font-mono text-xs text-ink-secondary lg:self-auto">
            <Sparkles className="h-3.5 w-3.5 text-violet-glow" aria-hidden="true" />
            <span>
              {filteredPrompts.length} / {allPrompts.length} prompts shown
            </span>
          </div>
        </div>

        <div className="glass-panel mb-6 space-y-4 rounded-2xl p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-6">
              <label
                htmlFor="prompt-vault-search"
                className="mb-1.5 block text-xs font-semibold text-ink-secondary"
              >
                Search Prompts, Skills, or Keywords
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  id="prompt-vault-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. cf-plan, HITL, swarm, spec, RLS..."
                  className="w-full rounded-xl border border-glass-border bg-void-950/80 py-2 pr-3 pl-9 text-sm text-ink-primary placeholder:text-ink-muted focus:border-cyan-glow"
                />
              </div>
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="prompt-difficulty-select"
                className="mb-1.5 block text-xs font-semibold text-ink-secondary"
              >
                Difficulty Level
              </label>
              <select
                id="prompt-difficulty-select"
                value={difficultyFilter}
                onChange={(e) =>
                  setDifficultyFilter(
                    e.target.value as DifficultyLevel | "all",
                  )
                }
                className="w-full rounded-xl border border-glass-border bg-void-950/80 px-3 py-2 text-sm text-ink-primary focus:border-cyan-glow"
              >
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end md:col-span-2">
              <button
                type="button"
                onClick={() => setBookmarkedOnly((prev) => !prev)}
                aria-pressed={bookmarkedOnly}
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  bookmarkedOnly
                    ? "border-amber-glow bg-amber-glow/15 text-amber-glow"
                    : "border-glass-border bg-void-950/80 text-ink-secondary hover:border-glass-border-strong hover:text-ink-primary"
                }`}
              >
                <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                Saved ({bookmarkedPromptIds.length})
              </button>
            </div>
          </div>

          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Filter prompts by SDLC stage"
          >
            {STAGE_OPTIONS.map((stage) => {
              const active = stageFilter === stage.id;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setStageFilter(stage.id)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-cyan-glow bg-cyan-glow/20 text-ink-primary"
                      : "border-glass-border bg-void-900/60 text-ink-secondary hover:border-glass-border-strong hover:text-ink-primary"
                  }`}
                >
                  {stage.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className={
            toastMessage
              ? "mb-4 flex items-center justify-between rounded-xl border border-emerald-glow/40 bg-emerald-glow/10 px-4 py-2.5 text-xs font-medium text-emerald-glow"
              : "sr-only"
          }
        >
          <span>{toastMessage}</span>
        </div>

        {filteredPrompts.length === 0 ? (
          <div className="glass-panel flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center">
            <FilterX className="h-8 w-8 text-ink-muted" aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-ink-primary">
                No matching prompts found
              </h3>
              <p className="text-xs text-ink-secondary">
                Try clearing your stage, difficulty, bookmark, or search
                filters.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-xl border border-cyan-glow/50 bg-cyan-glow/15 px-4 py-2 text-xs font-semibold text-cyan-glow transition-colors hover:bg-cyan-glow/25"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {filteredPrompts.map((prompt) => {
              const overrides = promptVariableValues[prompt.id] ?? {};
              const interpolated = interpolatePrompt(
                prompt.template,
                prompt.variables,
                overrides,
              );
              const isBookmarked = bookmarkedPromptIds.includes(prompt.id);
              const isHighlighted = highlightedPromptId === prompt.id;
              const isCopied = copiedPromptId === prompt.id;
              const displayTitle =
                learningDepthMode === "eli5"
                  ? (prompt.eli5Title ?? prompt.title)
                  : prompt.title;
              const showTechnicalSubtitle =
                learningDepthMode === "eli5" &&
                Boolean(prompt.eli5Title) &&
                prompt.eli5Title !== prompt.title;

              return (
                <article
                  key={prompt.id}
                  id={`prompt-card-${prompt.id}`}
                  className={`flex min-w-0 flex-col justify-between rounded-2xl p-5 transition-all ${
                    isHighlighted
                      ? "glass-panel-elevated ring-2 ring-cyan-glow"
                      : "glass-panel"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full border border-cyan-glow/40 bg-cyan-glow/15 px-2.5 py-0.5 font-mono text-xs font-medium uppercase text-cyan-glow">
                            {prompt.stage}
                          </span>
                          <span className="rounded-full border border-violet-glow/40 bg-violet-glow/15 px-2.5 py-0.5 font-mono text-xs capitalize text-violet-glow">
                            {prompt.difficulty}
                          </span>
                          {prompt.skillRef && (
                            <span className="rounded-full border border-glass-border bg-void-900/80 px-2.5 py-0.5 font-mono text-xs text-ink-secondary">
                              {prompt.skillRef}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-base font-bold text-ink-primary sm:text-lg">
                          {displayTitle}
                        </h3>
                        {showTechnicalSubtitle && (
                          <p className="mt-0.5 font-mono text-xs text-ink-muted">
                            {prompt.title}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleBookmark(prompt.id)}
                        aria-pressed={isBookmarked}
                        aria-label={
                          isBookmarked
                            ? `Remove ${displayTitle} from bookmarks`
                            : `Bookmark ${displayTitle}`
                        }
                        className={`shrink-0 cursor-pointer rounded-lg border p-2 transition-colors ${
                          isBookmarked
                            ? "border-amber-glow/60 bg-amber-glow/15 text-amber-glow"
                            : "border-glass-border bg-void-900/60 text-ink-muted hover:text-ink-primary"
                        }`}
                      >
                        <Bookmark
                          className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    {prompt.whenToUse && (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-glow/40 bg-emerald-glow/10 px-3.5 py-2.5">
                        <Compass
                          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-glow"
                          aria-hidden="true"
                        />
                        <p className="text-xs leading-relaxed text-ink-primary">
                          <span className="font-mono font-semibold text-emerald-glow">
                            Use This Prompt When:{" "}
                          </span>
                          {prompt.whenToUse}
                        </p>
                      </div>
                    )}

                    <p className="mt-2.5 text-xs leading-relaxed text-ink-secondary sm:text-sm">
                      {prompt.description}
                    </p>

                    {prompt.variables.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-glass-border bg-void-900/60 p-3.5 sm:grid-cols-2">
                        {prompt.variables.map((variable) => {
                          const inputId = `prompt-var-${prompt.id}-${variable.key}`;
                          const value =
                            overrides[variable.key] ?? variable.defaultValue;
                          return (
                            <div key={variable.key} className="min-w-0">
                              <label
                                htmlFor={inputId}
                                className="mb-1 block font-mono text-xs text-ink-secondary"
                              >
                                {variable.label}
                              </label>
                              <input
                                id={inputId}
                                type="text"
                                value={value}
                                onChange={(e) =>
                                  onUpdateVariable(
                                    prompt.id,
                                    variable.key,
                                    e.target.value,
                                  )
                                }
                                placeholder={variable.placeholder}
                                className="w-full rounded-lg border border-glass-border bg-void-950/90 px-2.5 py-1.5 font-mono text-xs text-ink-primary placeholder:text-ink-muted focus:border-cyan-glow"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-mono text-xs text-ink-muted">
                          Live Interpolated Prompt
                        </span>
                        <span className="font-mono text-xs text-ink-muted">
                          Course {String(prompt.courseNumber).padStart(2, "0")}
                        </span>
                      </div>
                      <pre className="max-h-56 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-xl border border-glass-border bg-void-950/90 p-3.5 font-mono text-xs leading-relaxed text-ink-primary">
                        <code>{interpolated}</code>
                      </pre>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t border-glass-border pt-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-ink-muted">
                      <span className="font-semibold text-emerald-glow">
                        Expected outcome:
                      </span>{" "}
                      {prompt.expectedOutcome}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleCopyPrompt(prompt, interpolated)}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-cyan-deep px-4 py-2 text-xs font-semibold text-ink-primary transition-colors hover:bg-cyan-glow hover:text-void-950"
                    >
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {isCopied ? "Copied Prompt" : "Copy Prompt"}
                    </button>
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
