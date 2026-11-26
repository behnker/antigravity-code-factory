"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { ShieldCheck, Sparkles } from "lucide-react";
import type { AcademyShellProps, HarnessMode } from "@/lib/contracts";
import {
  createDefaultProgress,
  loadLearnerProgress,
  saveLearnerProgress,
} from "@/lib/prompt-engine";
import type {
  LearnerProgress,
  LearningDepthMode,
  SdlcStageKey,
} from "@/lib/schemas";
import { CourseCurriculumStudio } from "./CourseCurriculumStudio";
import { FourDomainShowcase } from "./FourDomainShowcase";
import { GlassNavbar } from "./GlassNavbar";
import { HarnessComparisonLab } from "./HarnessComparisonLab";
import { HeroShowcase } from "./HeroShowcase";
import { HitlGateSimulator } from "./HitlGateSimulator";
import { PromptVault } from "./PromptVault";
import { RepoResourceExplorer } from "./RepoResourceExplorer";
import { SdlcReferenceShowcase } from "./SdlcReferenceShowcase";

export function AcademyShell({
  manifest,
  harnessDimensions,
  domainCases = [],
}: AcademyShellProps) {
  const [progress, setProgress] = useState<LearnerProgress>(() =>
    createDefaultProgress("2026-11-24T00:00:00.000Z"),
  );
  const [hydrated, setHydrated] = useState(false);
  const [activeCourseId, setActiveCourseId] = useState<string>(
    () => manifest.courses[0]?.id ?? "",
  );
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [highlightedPromptId, setHighlightedPromptId] = useState<string | null>(
    null,
  );
  const [stageFilterOverride, setStageFilterOverride] = useState<
    SdlcStageKey | "all" | null
  >(null);
  const [selectedResourcePath, setSelectedResourcePath] = useState<
    string | null
  >(null);

  useEffect(() => {
    const loaded = loadLearnerProgress();
    setProgress(loaded);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveLearnerProgress(progress);
  }, [hydrated, progress]);

  const totalStepCount = useMemo(
    () =>
      manifest.courses.reduce((total, course) => total + course.steps.length, 0),
    [manifest.courses],
  );

  const validStepIds = useMemo(() => {
    const ids = new Set<string>();
    for (const course of manifest.courses) {
      for (const step of course.steps) {
        ids.add(step.id);
      }
    }
    return ids;
  }, [manifest.courses]);

  const completedCount = useMemo(
    () => progress.completedStepIds.filter((id) => validStepIds.has(id)).length,
    [progress.completedStepIds, validStepIds],
  );

  const completionPercent =
    totalStepCount > 0
      ? Math.round((completedCount / totalStepCount) * 100)
      : 0;

  const handleChangeHarnessMode = useCallback((mode: HarnessMode) => {
    setProgress((prev) => ({
      ...prev,
      activeHarnessMode: mode,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const handleChangeLearningDepthMode = useCallback(
    (mode: LearningDepthMode) => {
      setProgress((prev) => ({
        ...prev,
        learningDepthMode: mode,
        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const handleToggleStepComplete = useCallback((stepId: string) => {
    setProgress((prev) => {
      const exists = prev.completedStepIds.includes(stepId);
      const nextSteps = exists
        ? prev.completedStepIds.filter((id) => id !== stepId)
        : [...prev.completedStepIds, stepId];
      return {
        ...prev,
        completedStepIds: nextSteps,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleMarkLabComplete = useCallback((labId: string) => {
    setProgress((prev) => {
      if (prev.completedLabIds.includes(labId)) return prev;
      return {
        ...prev,
        completedLabIds: [...prev.completedLabIds, labId],
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleToggleBookmark = useCallback((promptId: string) => {
    setProgress((prev) => {
      const exists = prev.bookmarkedPromptIds.includes(promptId);
      const nextBookmarks = exists
        ? prev.bookmarkedPromptIds.filter((id) => id !== promptId)
        : [...prev.bookmarkedPromptIds, promptId];
      return {
        ...prev,
        bookmarkedPromptIds: nextBookmarks,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleUpdatePromptVariable = useCallback(
    (promptId: string, varKey: string, value: string) => {
      setProgress((prev) => ({
        ...prev,
        promptVariableValues: {
          ...prev.promptVariableValues,
          [promptId]: {
            ...(prev.promptVariableValues[promptId] ?? {}),
            [varKey]: value,
          },
        },
        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const handleImportProgress = useCallback((next: LearnerProgress) => {
    setProgress(next);
  }, []);

  const handleResetProgress = useCallback(() => {
    setProgress(createDefaultProgress());
  }, []);

  const handleJumpToPrompt = useCallback((promptId: string) => {
    setStageFilterOverride("all");
    setHighlightedPromptId(promptId);
    const el = document.getElementById(`prompt-card-${promptId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      document
        .getElementById("prompt-vault")
        ?.scrollIntoView({ behavior: "smooth" });
    }
    window.setTimeout(() => {
      setHighlightedPromptId((curr) => (curr === promptId ? null : curr));
    }, 3500);
  }, []);

  const handleJumpToPromptStage = useCallback((stage: SdlcStageKey) => {
    setStageFilterOverride(stage);
    document
      .getElementById("prompt-vault")
      ?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleClearStageFilterOverride = useCallback(() => {
    setStageFilterOverride(null);
  }, []);

  const handleJumpToResource = useCallback((relativePath: string) => {
    setSelectedResourcePath(relativePath);
    document
      .getElementById("repo-explorer")
      ?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleOpenCourseBySlug = useCallback(
    (courseSlug: string) => {
      const matchedCourse = manifest.courses.find(
        (course) => course.slug === courseSlug || course.id === courseSlug,
      );
      if (matchedCourse) {
        setActiveCourseId(matchedCourse.id);
      }
      document
        .getElementById("courses")
        ?.scrollIntoView({ behavior: "smooth" });
    },
    [manifest.courses],
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen w-full overflow-x-clip">
        <GlassNavbar
          completionPercent={completionPercent}
          completedCount={completedCount}
          totalStepCount={totalStepCount}
          harnessMode={progress.activeHarnessMode}
          onChangeHarnessMode={handleChangeHarnessMode}
          onOpenProgressModal={() => setProgressModalOpen(true)}
        />

        <main id="main-content">
          <HeroShowcase
            manifest={manifest}
            harnessMode={progress.activeHarnessMode}
            onChangeHarnessMode={handleChangeHarnessMode}
          />

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: "some" }}
            transition={{ duration: 0.45 }}
            className="border-t-2 border-glass-border-strong bg-void-900/65"
          >
            <HarnessComparisonLab
              dimensions={harnessDimensions}
              harnessMode={progress.activeHarnessMode}
              onChangeHarnessMode={handleChangeHarnessMode}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: "some" }}
            transition={{ duration: 0.45 }}
            className="border-t-2 border-glass-border-strong bg-void-950"
          >
            <SdlcReferenceShowcase
              resources={manifest.resources}
              onJumpToPromptStage={handleJumpToPromptStage}
              onJumpToResource={handleJumpToResource}
            />
          </motion.div>

          <div className="border-t-2 border-glass-border-strong bg-void-900/65">
            <FourDomainShowcase
              domainCases={domainCases}
              learningDepthMode={progress.learningDepthMode}
              onOpenCourse={handleOpenCourseBySlug}
            />
          </div>

          <div className="border-t-2 border-glass-border-strong bg-void-950">
            <CourseCurriculumStudio
              courses={manifest.courses}
              activeCourseId={activeCourseId}
              onSelectCourseId={setActiveCourseId}
              completedStepIds={progress.completedStepIds}
              onToggleStepComplete={handleToggleStepComplete}
              completedLabIds={progress.completedLabIds}
              onMarkLabComplete={handleMarkLabComplete}
              onJumpToPrompt={handleJumpToPrompt}
              onJumpToResource={handleJumpToResource}
              progressModalOpen={progressModalOpen}
              onOpenProgressModal={() => setProgressModalOpen(true)}
              onCloseProgressModal={() => setProgressModalOpen(false)}
              progress={progress}
              onImportProgress={handleImportProgress}
              onResetProgress={handleResetProgress}
              learningDepthMode={progress.learningDepthMode}
              onChangeLearningDepthMode={handleChangeLearningDepthMode}
            />
          </div>

          <div className="border-t-2 border-glass-border-strong bg-void-900/65">
            <PromptVault
              courses={manifest.courses}
              bookmarkedPromptIds={progress.bookmarkedPromptIds}
              promptVariableValues={progress.promptVariableValues}
              onToggleBookmark={handleToggleBookmark}
              onUpdateVariable={handleUpdatePromptVariable}
              highlightedPromptId={highlightedPromptId}
              stageFilterOverride={stageFilterOverride}
              onClearStageFilterOverride={handleClearStageFilterOverride}
              learningDepthMode={progress.learningDepthMode}
            />
          </div>

          <section
            id="repo-hitl"
            aria-labelledby="repo-hitl-heading"
            className="border-t-2 border-glass-border-strong bg-void-950 py-14 sm:py-16"
          >
            <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
              <div className="max-w-3xl space-y-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-amber-glow">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Live Guardrails &amp; Repository Source of Truth
                </span>
                <h2
                  id="repo-hitl-heading"
                  className="text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl"
                >
                  HITL Safety Hook Simulator &amp; Repo Explorer
                </h2>
                <p className="text-sm leading-relaxed text-ink-secondary">
                  Verify how Antigravity intercepts dangerous terminal commands
                  before execution, then inspect the real rules, skills, agents,
                  hooks, and memory files powering this plugin.
                </p>
              </div>

              <HitlGateSimulator />

              <RepoResourceExplorer
                resources={manifest.resources}
                syncedAt={manifest.syncedAt}
                selectedResourcePath={selectedResourcePath}
                onSelectResourcePath={setSelectedResourcePath}
              />
            </div>
          </section>
        </main>

        <footer className="border-t-2 border-glass-border-strong bg-void-950 py-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-glow" aria-hidden="true" />
              <span className="font-semibold text-ink-primary">
                Antigravity Academy
              </span>
              <span>·</span>
              <span className="font-mono">
                {manifest.pluginName} v{manifest.pluginVersion}
              </span>
            </div>
            <p className="font-mono">
              Built via Enterprise Code Factory SDLC · Zero Secrets · WCAG 2.1 AA
            </p>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
