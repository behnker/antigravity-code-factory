"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Gauge,
  GitFork,
  Layers,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  evaluateContextBudget,
  evaluateLoopAutonomy,
  evaluateScenarioDrill,
  evaluateSwarmPartition,
  evaluateWebsiteFactoryLab,
} from "@/lib/micro-lab-engine";
import type {
  ContextBudgetLab,
  LearningDepthMode,
  LoopAutonomyLab,
  MicroLab,
  ScenarioDrillLab,
  SwarmPartitionLab,
  WebsiteFactoryLab,
} from "@/lib/schemas";

export interface InteractiveMicroLabProps {
  lab: MicroLab;
  learningDepthMode: LearningDepthMode;
  isCompleted: boolean;
  onMarkComplete: (labId: string) => void;
  className?: string;
}

function useEdgeTriggeredLabCompletion(
  passed: boolean,
  labId: string,
  onMarkComplete: (labId: string) => void,
) {
  const prevPassedRef = useRef(false);
  useEffect(() => {
    if (passed && !prevPassedRef.current) {
      onMarkComplete(labId);
    }
    prevPassedRef.current = passed;
  }, [passed, labId, onMarkComplete]);
}

function LabHeader({
  lab,
  learningDepthMode,
  isCompleted,
  passed,
  onReset,
}: {
  lab: MicroLab;
  learningDepthMode: LearningDepthMode;
  isCompleted: boolean;
  passed: boolean;
  onReset: () => void;
}) {
  const title = learningDepthMode === "eli5" ? lab.eli5Title : lab.title;
  const subtitle =
    learningDepthMode === "eli5" ? lab.eli5Subtitle : lab.subtitle;

  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-glass-border pb-4">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-glow/45 bg-cyan-glow/12 px-2.5 py-0.5 font-mono text-xs font-semibold text-cyan-glow">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            {lab.badgeLabel}
          </span>
          <span className="glass-pill rounded-full px-2.5 py-0.5 font-mono text-xs text-ink-secondary">
            ~{lab.estimatedMinutes} min hands-on
          </span>
          {(isCompleted || passed) && (
            <span
              data-testid="micro-lab-completed-badge"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-glow/50 bg-emerald-glow/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-glow"
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Lab Passed
            </span>
          )}
        </div>
        <h3 className="text-base font-bold text-ink-primary sm:text-lg">
          {title}
        </h3>
        <p className="text-xs leading-relaxed text-ink-secondary sm:text-sm">
          {subtitle}
        </p>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="glass-pill inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:border-cyan-glow/60 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Reset Lab
      </button>
    </div>
  );
}

function ScenarioDrillView({
  lab,
  learningDepthMode,
  isCompleted,
  onMarkComplete,
}: {
  lab: ScenarioDrillLab;
  learningDepthMode: LearningDepthMode;
  isCompleted: boolean;
  onMarkComplete: (labId: string) => void;
}) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const result = useMemo(
    () => evaluateScenarioDrill(lab, selections),
    [lab, selections],
  );

  useEdgeTriggeredLabCompletion(result.passed, lab.id, onMarkComplete);

  return (
    <div>
      <LabHeader
        lab={lab}
        learningDepthMode={learningDepthMode}
        isCompleted={isCompleted}
        passed={result.passed}
        onReset={() => setSelections({})}
      />

      <div className="space-y-4">
        {lab.scenarios.map((scenario, idx) => {
          const chosenId = selections[scenario.id];
          const chosenOption = scenario.options.find(
            (opt) => opt.id === chosenId,
          );
          const promptText =
            learningDepthMode === "eli5"
              ? scenario.eli5Prompt
              : scenario.prompt;

          return (
            <div
              key={scenario.id}
              className="rounded-xl border border-glass-border bg-void-950/70 p-4"
            >
              <p className="text-xs font-semibold text-ink-primary sm:text-sm">
                <span className="mr-2 font-mono text-cyan-glow">
                  Q{idx + 1}.
                </span>
                {promptText}
              </p>

              <div
                role="group"
                aria-label={`Scenario ${idx + 1} choices`}
                className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                {scenario.options.map((option) => {
                  const isSelected = chosenId === option.id;
                  const stateClasses = isSelected
                    ? option.isCorrect
                      ? "border-emerald-glow/70 bg-emerald-glow/15 text-ink-primary"
                      : "border-rose-glow/70 bg-rose-glow/15 text-ink-primary"
                    : "border-glass-border bg-void-900/70 text-ink-secondary hover:border-cyan-glow/55 hover:text-ink-primary";

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() =>
                        setSelections((prev) => ({
                          ...prev,
                          [scenario.id]: option.id,
                        }))
                      }
                      className={`rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow ${stateClasses}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {chosenOption && (
                <div
                  aria-live="polite"
                  className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                    chosenOption.isCorrect
                      ? "border-emerald-glow/40 bg-emerald-glow/10 text-ink-primary"
                      : "border-amber-glow/40 bg-amber-glow/10 text-ink-primary"
                  }`}
                >
                  <span className="mr-1.5 font-mono font-bold">
                    {chosenOption.isCorrect ? "PASS:" : "TRY AGAIN:"}
                  </span>
                  {learningDepthMode === "eli5"
                    ? chosenOption.eli5Feedback
                    : chosenOption.feedback}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        aria-live="polite"
        className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-glass-border bg-void-900/70 px-4 py-2.5 text-xs"
      >
        <span className="font-mono text-ink-secondary">
          Score:{" "}
          <strong className="text-ink-primary">
            {result.correctCount} / {result.totalCount}
          </strong>{" "}
          correct
        </span>
        <span
          className={`font-mono font-semibold ${
            result.passed ? "text-emerald-glow" : "text-cyan-glow"
          }`}
        >
          {result.passed
            ? "All scenarios mastered · Progress saved locally"
            : `Select the best answer for all ${result.totalCount} scenarios`}
        </span>
      </div>
    </div>
  );
}

function ContextBudgetView({
  lab,
  learningDepthMode,
  isCompleted,
  onMarkComplete,
}: {
  lab: ContextBudgetLab;
  learningDepthMode: LearningDepthMode;
  isCompleted: boolean;
  onMarkComplete: (labId: string) => void;
}) {
  const buildDefaults = () =>
    Object.fromEntries(
      lab.modules.map((m) => [
        m.id,
        m.defaultAlwaysOn ? "always-on" : "progressive-skill",
      ]),
    ) as Record<string, "always-on" | "progressive-skill">;

  const [placements, setPlacements] = useState<
    Record<string, "always-on" | "progressive-skill">
  >(buildDefaults);

  const evalResult = useMemo(
    () => evaluateContextBudget(lab, placements),
    [lab, placements],
  );

  useEdgeTriggeredLabCompletion(evalResult.passed, lab.id, onMarkComplete);

  const barWidth = Math.min(100, evalResult.utilizationPercent);

  return (
    <div>
      <LabHeader
        lab={lab}
        learningDepthMode={learningDepthMode}
        isCompleted={isCompleted}
        passed={evalResult.passed}
        onReset={() => setPlacements(buildDefaults())}
      />

      <div className="mb-4 rounded-xl border border-glass-border bg-void-950/80 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-ink-primary">
            <Gauge className="h-4 w-4 text-cyan-glow" aria-hidden="true" />
            Always-On AGENTS.md Footprint
          </span>
          <span
            data-testid="context-budget-meter"
            className={`font-mono font-bold ${
              evalResult.withinBudget ? "text-emerald-glow" : "text-rose-glow"
            }`}
          >
            {evalResult.alwaysOnBytes.toLocaleString()} B /{" "}
            {evalResult.budgetBytes.toLocaleString()} B (
            {evalResult.utilizationPercent}%)
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-void-800">
          <div
            className={`h-full rounded-full transition-all ${
              evalResult.withinBudget ? "bg-emerald-glow" : "bg-rose-glow"
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <p aria-live="polite" className="mt-2 text-xs text-ink-secondary">
          {evalResult.passed
            ? "Optimal! Core security guardrails stay Always-On while heavy runbooks load on demand as progressive skills."
            : evalResult.missingCriticalIds.length > 0
              ? "Warning: Keep critical security & secret guardrails Always-On so every turn enforces them."
              : !evalResult.withinBudget
                ? "Over the 10 KB context budget! Move heavy step-by-step runbooks to Progressive Skills."
                : "Almost there — check each item's recommended placement for clean progressive disclosure."}
        </p>
      </div>

      <div className="space-y-2.5">
        {lab.modules.map((mod) => {
          const current = placements[mod.id] ?? "always-on";
          return (
            <div
              key={mod.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-glass-border bg-void-950/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-ink-primary">
                    {mod.label}
                  </span>
                  <span className="font-mono text-xs text-cyan-glow">
                    {(mod.bytes / 1024).toFixed(1)} KB
                  </span>
                  {mod.criticalSecurity && (
                    <span className="rounded-full border border-amber-glow/40 bg-amber-glow/10 px-2 py-0.5 font-mono text-xs text-amber-glow">
                      Security Core
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-muted">{mod.rationale}</p>
              </div>

              <div
                role="group"
                aria-label={`Placement for ${mod.label}`}
                className="flex shrink-0 items-center gap-1.5"
              >
                <button
                  type="button"
                  aria-pressed={current === "always-on"}
                  onClick={() =>
                    setPlacements((prev) => ({
                      ...prev,
                      [mod.id]: "always-on",
                    }))
                  }
                  className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow ${
                    current === "always-on"
                      ? "border-cyan-glow/70 bg-cyan-glow/15 text-ink-primary"
                      : "border-glass-border bg-void-900 text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  Always-On
                </button>
                <button
                  type="button"
                  aria-pressed={current === "progressive-skill"}
                  onClick={() =>
                    setPlacements((prev) => ({
                      ...prev,
                      [mod.id]: "progressive-skill",
                    }))
                  }
                  className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow ${
                    current === "progressive-skill"
                      ? "border-emerald-glow/70 bg-emerald-glow/15 text-ink-primary"
                      : "border-glass-border bg-void-900 text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  Skill (On-Demand)
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoopAutonomyView({
  lab,
  learningDepthMode,
  isCompleted,
  onMarkComplete,
}: {
  lab: LoopAutonomyLab;
  learningDepthMode: LearningDepthMode;
  isCompleted: boolean;
  onMarkComplete: (labId: string) => void;
}) {
  const buildDefaults = () =>
    Object.fromEntries(
      lab.tasks.map((t) => [t.id, t.defaultMode]),
    ) as Record<string, "lights-out" | "human-lit">;

  const [taskModes, setTaskModes] = useState<
    Record<string, "lights-out" | "human-lit">
  >(buildDefaults);
  const [loopCount, setLoopCount] = useState<number>(lab.initialLoops);
  const [decoupledVerifier, setDecoupledVerifier] = useState<boolean>(false);

  const evalResult = useMemo(
    () => evaluateLoopAutonomy(lab, taskModes, loopCount, decoupledVerifier),
    [lab, taskModes, loopCount, decoupledVerifier],
  );

  useEdgeTriggeredLabCompletion(evalResult.passed, lab.id, onMarkComplete);

  const handleReset = () => {
    setTaskModes(buildDefaults());
    setLoopCount(lab.initialLoops);
    setDecoupledVerifier(false);
  };

  return (
    <div>
      <LabHeader
        lab={lab}
        learningDepthMode={learningDepthMode}
        isCompleted={isCompleted}
        passed={evalResult.passed}
        onReset={handleReset}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-glass-border bg-void-950/75 p-4">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor={`${lab.id}-loop-slider`}
              className="text-xs font-semibold text-ink-primary"
            >
              Active Concurrent Loops
            </label>
            <span
              className={`font-mono text-xs font-bold ${
                evalResult.withinLoopCap ? "text-emerald-glow" : "text-rose-glow"
              }`}
            >
              {loopCount} loops (Target {lab.minLoops}–{lab.maxLoops})
            </span>
          </div>
          <input
            id={`${lab.id}-loop-slider`}
            type="range"
            min={1}
            max={8}
            value={loopCount}
            onChange={(e) => setLoopCount(Number(e.target.value))}
            className="mt-3 w-full accent-cyan-glow"
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            Capping concurrent loops at {lab.minLoops}–{lab.maxLoops} protects
            human outer-loop review bandwidth.
          </p>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-glass-border bg-void-950/75 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-primary">
              Decoupled Verifier Context
            </span>
            <button
              type="button"
              aria-pressed={decoupledVerifier}
              onClick={() => setDecoupledVerifier((prev) => !prev)}
              className={`rounded-lg border px-3 py-1 font-mono text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow ${
                decoupledVerifier
                  ? "border-emerald-glow/70 bg-emerald-glow/15 text-emerald-glow"
                  : "border-rose-glow/60 bg-rose-glow/15 text-rose-glow"
              }`}
            >
              {decoupledVerifier ? "Enabled (cf-reviewer)" : "Self-Graded (Risk)"}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Never let the generator grade its own homework — isolate verification
            in a clean reviewer context.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {lab.tasks.map((task) => {
          const mode = taskModes[task.id] ?? task.defaultMode;
          return (
            <div
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-glass-border bg-void-950/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-ink-primary">
                    {task.label}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-xs ${
                      task.blastRadius === "high"
                        ? "border-rose-glow/40 bg-rose-glow/10 text-rose-glow"
                        : "border-emerald-glow/40 bg-emerald-glow/10 text-emerald-glow"
                    }`}
                  >
                    {task.blastRadius === "high"
                      ? "High Blast Radius"
                      : "Low Blast Radius"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">{task.rationale}</p>
              </div>

              <div
                role="group"
                aria-label={`Autonomy mode for ${task.label}`}
                className="flex shrink-0 items-center gap-1.5"
              >
                <button
                  type="button"
                  aria-pressed={mode === "lights-out"}
                  onClick={() =>
                    setTaskModes((prev) => ({
                      ...prev,
                      [task.id]: "lights-out",
                    }))
                  }
                  className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow ${
                    mode === "lights-out"
                      ? "border-cyan-glow/70 bg-cyan-glow/15 text-ink-primary"
                      : "border-glass-border bg-void-900 text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  Lights-Out
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "human-lit"}
                  onClick={() =>
                    setTaskModes((prev) => ({
                      ...prev,
                      [task.id]: "human-lit",
                    }))
                  }
                  className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow ${
                    mode === "human-lit"
                      ? "border-amber-glow/70 bg-amber-glow/15 text-ink-primary"
                      : "border-glass-border bg-void-900 text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  Human-Lit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div
        aria-live="polite"
        data-testid="loop-autonomy-verdict"
        className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-xs ${
          evalResult.verdict === "lit-factory"
            ? "border-emerald-glow/50 bg-emerald-glow/10 text-ink-primary"
            : evalResult.verdict === "dark-factory-risk"
              ? "border-rose-glow/50 bg-rose-glow/10 text-ink-primary"
              : "border-amber-glow/50 bg-amber-glow/10 text-ink-primary"
        }`}
      >
        <span className="inline-flex items-center gap-2 font-mono font-bold">
          {evalResult.verdict === "lit-factory" ? (
            <ShieldCheck className="h-4 w-4 text-emerald-glow" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-rose-glow" aria-hidden="true" />
          )}
          Factory Verdict:{" "}
          {evalResult.verdict === "lit-factory"
            ? "LIT SOFTWARE FACTORY (SHIP-READY)"
            : evalResult.verdict === "dark-factory-risk"
              ? "DARK FACTORY RISK — ADD HUMAN GUARDRAILS"
              : "NEEDS GUARDRAILS"}
        </span>
        <span className="font-mono text-ink-secondary">
          Tasks: {evalResult.correctTasks}/{evalResult.totalTasks} · Loops:{" "}
          {loopCount}
        </span>
      </div>
    </div>
  );
}

function SwarmPartitionView({
  lab,
  learningDepthMode,
  isCompleted,
  onMarkComplete,
}: {
  lab: SwarmPartitionLab;
  learningDepthMode: LearningDepthMode;
  isCompleted: boolean;
  onMarkComplete: (labId: string) => void;
}) {
  const buildDefaults = () =>
    Object.fromEntries(
      lab.files.map((f) => [f.id, [...f.initialWorkers]]),
    ) as Record<string, string[]>;

  const [assignments, setAssignments] =
    useState<Record<string, string[]>>(buildDefaults);

  const evalResult = useMemo(
    () => evaluateSwarmPartition(lab, assignments),
    [lab, assignments],
  );

  useEdgeTriggeredLabCompletion(evalResult.passed, lab.id, onMarkComplete);

  const toggleWorker = (fileId: string, worker: string) => {
    setAssignments((prev) => {
      const current = prev[fileId] ?? [];
      const exists = current.includes(worker);
      const next = exists
        ? current.filter((w) => w !== worker)
        : [...current, worker];
      return { ...prev, [fileId]: next };
    });
  };

  return (
    <div>
      <LabHeader
        lab={lab}
        learningDepthMode={learningDepthMode}
        isCompleted={isCompleted}
        passed={evalResult.passed}
        onReset={() => setAssignments(buildDefaults())}
      />

      <div className="space-y-2.5">
        {lab.files.map((file) => {
          const assigned = assignments[file.id] ?? [];
          const hasCollision = assigned.length > 1;
          return (
            <div
              key={file.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                hasCollision
                  ? "border-rose-glow/60 bg-rose-glow/10"
                  : "border-glass-border bg-void-950/65"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-xs font-semibold text-cyan-glow">
                    {file.path}
                  </code>
                  {hasCollision && (
                    <span className="rounded-full border border-rose-glow/50 bg-rose-glow/20 px-2 py-0.5 font-mono text-xs font-semibold text-rose-glow">
                      Write Collision!
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">{file.role}</p>
              </div>

              <div
                role="group"
                aria-label={`Assign worker for ${file.path}`}
                className="flex shrink-0 flex-wrap items-center gap-1.5"
              >
                {lab.workers.map((worker) => {
                  const active = assigned.includes(worker);
                  return (
                    <button
                      key={worker}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleWorker(file.id, worker)}
                      className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow ${
                        active
                          ? "border-cyan-glow/75 bg-cyan-glow/15 text-ink-primary"
                          : "border-glass-border bg-void-900 text-ink-secondary hover:text-ink-primary"
                      }`}
                    >
                      {worker}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div
        aria-live="polite"
        data-testid="swarm-partition-verdict"
        className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-xs ${
          evalResult.passed
            ? "border-emerald-glow/50 bg-emerald-glow/10 text-ink-primary"
            : "border-amber-glow/50 bg-amber-glow/10 text-ink-primary"
        }`}
      >
        <span className="inline-flex items-center gap-2 font-mono font-bold">
          <GitFork className="h-4 w-4 text-cyan-glow" aria-hidden="true" />
          {evalResult.passed
            ? "ZERO COLLISIONS · SAFE TO LAUNCH /SWARM"
            : evalResult.collisionPaths.length > 0
              ? `${evalResult.collisionPaths.length} file write collision(s) detected — assign exactly 1 owner per file`
              : evalResult.verifierWritePaths.length > 0
                ? "Keep @verifier read-only on production files (assign @verifier only to tests/QA)"
                : "Assign each file exclusively to its domain owner (@backend, @frontend, or @verifier)"}
        </span>
      </div>
    </div>
  );
}

function WebsiteFactoryLabView({
  lab,
  learningDepthMode,
  isCompleted,
  onMarkComplete,
}: {
  lab: WebsiteFactoryLab;
  learningDepthMode: LearningDepthMode;
  isCompleted: boolean;
  onMarkComplete: (labId: string) => void;
}) {
  const defaultOpts = () =>
    lab.glbOptimizations
      .filter((o) => o.defaultEnabled)
      .map((o) => o.id);
  const defaultGeos = () =>
    lab.geoChecks.filter((g) => g.defaultEnabled).map((g) => g.id);

  const [presetId, setPresetId] = useState<string>(lab.defaultPresetId);
  const [enabledOpts, setEnabledOpts] = useState<string[]>(defaultOpts);
  const [enabledGeos, setEnabledGeos] = useState<string[]>(defaultGeos);

  const evalResult = useMemo(
    () => evaluateWebsiteFactoryLab(lab, presetId, enabledOpts, enabledGeos),
    [lab, presetId, enabledOpts, enabledGeos],
  );

  useEdgeTriggeredLabCompletion(evalResult.passed, lab.id, onMarkComplete);

  const activePreset =
    lab.contrastPresets.find((p) => p.id === presetId) ??
    lab.contrastPresets[0];

  const handleReset = () => {
    setPresetId(lab.defaultPresetId);
    setEnabledOpts(defaultOpts());
    setEnabledGeos(defaultGeos());
  };

  return (
    <div>
      <LabHeader
        lab={lab}
        learningDepthMode={learningDepthMode}
        isCompleted={isCompleted}
        passed={evalResult.passed}
        onReset={handleReset}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Gate A: Live WCAG 2.1 AA/AAA Contrast Matrix */}
        <div className="rounded-xl border border-glass-border bg-void-950/75 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-cyan-glow">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Gate A · WCAG Contrast
            </span>
            <span
              data-testid="wcag-ratio-badge"
              className={`rounded-full border px-2 py-0.5 font-mono text-xs font-bold ${
                evalResult.contrastPass
                  ? "border-emerald-glow/50 bg-emerald-glow/15 text-emerald-glow"
                  : "border-rose-glow/50 bg-rose-glow/15 text-rose-glow"
              }`}
            >
              {evalResult.contrastRatio}:1 · {evalResult.wcagGrade}
            </span>
          </div>

          <div
            role="group"
            aria-label="WCAG semantic token contrast presets"
            className="space-y-1.5"
          >
            {lab.contrastPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={preset.id === presetId}
                onClick={() => setPresetId(preset.id)}
                className={`w-full rounded-lg border px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow ${
                  preset.id === presetId
                    ? "border-cyan-glow/70 bg-cyan-glow/15 text-ink-primary"
                    : "border-glass-border bg-void-900/70 text-ink-secondary hover:text-ink-primary"
                }`}
              >
                <div className="font-semibold">{preset.label}</div>
                <div className="font-mono text-xs text-ink-muted">
                  {preset.fgLabel} on {preset.bgLabel}
                </div>
              </button>
            ))}
          </div>

          {activePreset && (
            <div
              className="mt-3 rounded-lg border border-glass-border p-3 text-xs font-semibold"
              style={{
                backgroundColor: activePreset.bgHex,
                color: activePreset.fgHex,
              }}
            >
              <div>Aa · Live Token Preview ({activePreset.mode})</div>
              <p className="mt-1 font-normal">{activePreset.note}</p>
            </div>
          )}
        </div>

        {/* Gate B: GLB Compression Pipeline Estimator */}
        <div className="rounded-xl border border-glass-border bg-void-950/75 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-violet-glow">
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              Gate B · GLB Budget
            </span>
            <span
              data-testid="glb-budget-badge"
              className={`rounded-full border px-2 py-0.5 font-mono text-xs font-bold ${
                evalResult.glbPass
                  ? "border-emerald-glow/50 bg-emerald-glow/15 text-emerald-glow"
                  : "border-rose-glow/50 bg-rose-glow/15 text-rose-glow"
              }`}
            >
              {evalResult.estimatedGlbKb.toLocaleString()} KB (-
              {evalResult.reductionPercent}%)
            </span>
          </div>
          <p className="mb-2.5 text-xs text-ink-muted">
            Raw model: {(lab.rawGlbKb / 1024).toFixed(2)} MB · Target:{" "}
            {"<="} {(lab.glbTargetKb / 1024).toFixed(1)} MB
          </p>
          <div className="space-y-2">
            {lab.glbOptimizations.map((opt) => {
              const checked = enabledOpts.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={checked}
                  onClick={() =>
                    setEnabledOpts((prev) =>
                      checked
                        ? prev.filter((id) => id !== opt.id)
                        : [...prev, opt.id],
                    )
                  }
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow ${
                    checked
                      ? "border-emerald-glow/60 bg-emerald-glow/12 text-ink-primary"
                      : "border-glass-border bg-void-900/70 text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-semibold">
                    <span>{opt.label}</span>
                    <span className="font-mono text-xs">
                      {checked ? "ON" : "OFF"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {opt.explanation}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Gate C: Tri-Layer GEO / AEO Search Readiness */}
        <div className="rounded-xl border border-glass-border bg-void-950/75 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-glow">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Gate C · GEO / AEO
            </span>
            <span
              data-testid="geo-readiness-badge"
              className={`rounded-full border px-2 py-0.5 font-mono text-xs font-bold ${
                evalResult.geoPass
                  ? "border-emerald-glow/50 bg-emerald-glow/15 text-emerald-glow"
                  : "border-amber-glow/50 bg-amber-glow/15 text-amber-glow"
              }`}
            >
              {evalResult.geoPassedCount}/{evalResult.geoTotalCount} Ready
            </span>
          </div>
          <div className="space-y-2">
            {lab.geoChecks.map((check) => {
              const checked = enabledGeos.includes(check.id);
              return (
                <button
                  key={check.id}
                  type="button"
                  aria-pressed={checked}
                  onClick={() =>
                    setEnabledGeos((prev) =>
                      checked
                        ? prev.filter((id) => id !== check.id)
                        : [...prev, check.id],
                    )
                  }
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-glow ${
                    checked
                      ? "border-emerald-glow/60 bg-emerald-glow/12 text-ink-primary"
                      : "border-glass-border bg-void-900/70 text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-semibold">
                    <span>{check.label}</span>
                    <span className="font-mono text-xs">
                      {checked ? "PASS" : "MISSING"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {check.explanation}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        aria-live="polite"
        data-testid="website-factory-lab-verdict"
        className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-xs ${
          evalResult.passed
            ? "border-emerald-glow/50 bg-emerald-glow/10 text-ink-primary"
            : "border-amber-glow/50 bg-amber-glow/10 text-ink-primary"
        }`}
      >
        <span className="font-mono font-bold">
          {evalResult.passed
            ? "ALL 3 WEBSITE FACTORY GATES CLEARED (SHIP-READY)"
            : "Clear Gate A (>= 4.5:1 WCAG), Gate B (<= 2.0 MB GLB), and Gate C (3/3 GEO) to pass"}
        </span>
      </div>
    </div>
  );
}

export function InteractiveMicroLab({
  lab,
  learningDepthMode,
  isCompleted,
  onMarkComplete,
  className = "",
}: InteractiveMicroLabProps) {
  return (
    <section
      data-testid="interactive-micro-lab"
      aria-label={lab.title}
      className={`glass-panel-elevated min-w-0 overflow-hidden rounded-2xl p-4 sm:p-6 ${className}`}
    >
      {lab.kind === "scenario-drill" && (
        <ScenarioDrillView
          lab={lab}
          learningDepthMode={learningDepthMode}
          isCompleted={isCompleted}
          onMarkComplete={onMarkComplete}
        />
      )}
      {lab.kind === "context-budget" && (
        <ContextBudgetView
          lab={lab}
          learningDepthMode={learningDepthMode}
          isCompleted={isCompleted}
          onMarkComplete={onMarkComplete}
        />
      )}
      {lab.kind === "loop-autonomy" && (
        <LoopAutonomyView
          lab={lab}
          learningDepthMode={learningDepthMode}
          isCompleted={isCompleted}
          onMarkComplete={onMarkComplete}
        />
      )}
      {lab.kind === "swarm-partition" && (
        <SwarmPartitionView
          lab={lab}
          learningDepthMode={learningDepthMode}
          isCompleted={isCompleted}
          onMarkComplete={onMarkComplete}
        />
      )}
      {lab.kind === "website-factory-lab" && (
        <WebsiteFactoryLabView
          lab={lab}
          learningDepthMode={learningDepthMode}
          isCompleted={isCompleted}
          onMarkComplete={onMarkComplete}
        />
      )}
    </section>
  );
}
