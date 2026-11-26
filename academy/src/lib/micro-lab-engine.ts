import type {
  ContextBudgetLab,
  LoopAutonomyLab,
  ScenarioDrillLab,
  SwarmPartitionLab,
  VideoChapter,
  WebsiteFactoryLab,
} from "./schemas";

const HEX6_RE = /^#([0-9a-fA-F]{6})$/;

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function parseHexColor(hex: string): RgbColor | null {
  const match = HEX6_RE.exec(hex.trim());
  if (!match) return null;
  const num = Number.parseInt(match[1], 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function relativeLuminance({ r, g, b }: RgbColor): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function computeContrastRatio(fgHex: string, bgHex: string): number {
  const fg = parseHexColor(fgHex);
  const bg = parseHexColor(bgHex);
  if (!fg || !bg) return 1;
  const lumFg = relativeLuminance(fg);
  const lumBg = relativeLuminance(bg);
  const lighter = Math.max(lumFg, lumBg);
  const darker = Math.min(lumFg, lumBg);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function classifyWcagContrast(ratio: number): "AAA" | "AA" | "FAIL" {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  return "FAIL";
}

export function findActiveChapterForTime(
  chapters: readonly VideoChapter[],
  currentTimeSeconds: number,
): VideoChapter | null {
  if (chapters.length === 0) return null;
  const safeTime =
    Number.isFinite(currentTimeSeconds) && currentTimeSeconds >= 0
      ? currentTimeSeconds
      : 0;
  let active = chapters[0];
  for (const chapter of chapters) {
    if (chapter.timestampSeconds <= safeTime + 0.15) {
      active = chapter;
    }
  }
  return active;
}

export interface ScenarioDrillEvaluation {
  answeredCount: number;
  correctCount: number;
  totalCount: number;
  passed: boolean;
}

export function evaluateScenarioDrill(
  lab: ScenarioDrillLab,
  selections: Record<string, string>,
): ScenarioDrillEvaluation {
  let answeredCount = 0;
  let correctCount = 0;
  for (const scenario of lab.scenarios) {
    const chosenId = selections[scenario.id];
    if (!chosenId) continue;
    answeredCount += 1;
    const option = scenario.options.find((opt) => opt.id === chosenId);
    if (option?.isCorrect) {
      correctCount += 1;
    }
  }
  const totalCount = lab.scenarios.length;
  return {
    answeredCount,
    correctCount,
    totalCount,
    passed: totalCount > 0 && correctCount === totalCount,
  };
}

export interface ContextBudgetEvaluation {
  alwaysOnBytes: number;
  skillBytes: number;
  budgetBytes: number;
  utilizationPercent: number;
  withinBudget: boolean;
  missingCriticalIds: string[];
  misplacedIds: string[];
  passed: boolean;
}

export function evaluateContextBudget(
  lab: ContextBudgetLab,
  placements: Record<string, "always-on" | "progressive-skill">,
): ContextBudgetEvaluation {
  let alwaysOnBytes = 0;
  let skillBytes = 0;
  const missingCriticalIds: string[] = [];
  const misplacedIds: string[] = [];

  for (const mod of lab.modules) {
    const current =
      placements[mod.id] ??
      (mod.defaultAlwaysOn ? "always-on" : "progressive-skill");
    if (current === "always-on") {
      alwaysOnBytes += mod.bytes;
    } else {
      skillBytes += mod.bytes;
      if (mod.criticalSecurity) {
        missingCriticalIds.push(mod.id);
      }
    }
    if (current !== mod.recommendedPlacement) {
      misplacedIds.push(mod.id);
    }
  }

  const withinBudget = alwaysOnBytes <= lab.budgetBytes;
  const utilizationPercent = Math.min(
    200,
    Math.round((alwaysOnBytes / lab.budgetBytes) * 100),
  );
  return {
    alwaysOnBytes,
    skillBytes,
    budgetBytes: lab.budgetBytes,
    utilizationPercent,
    withinBudget,
    missingCriticalIds,
    misplacedIds,
    passed: withinBudget && missingCriticalIds.length === 0 && misplacedIds.length === 0,
  };
}

export interface LoopAutonomyEvaluation {
  correctTasks: number;
  totalTasks: number;
  withinLoopCap: boolean;
  decoupledVerifier: boolean;
  verdict: "lit-factory" | "needs-guardrails" | "dark-factory-risk";
  passed: boolean;
}

export function evaluateLoopAutonomy(
  lab: LoopAutonomyLab,
  taskModes: Record<string, "lights-out" | "human-lit">,
  loopCount: number,
  decoupledVerifier: boolean,
): LoopAutonomyEvaluation {
  let correctTasks = 0;
  let highBlastLightsOut = false;

  for (const task of lab.tasks) {
    const mode = taskModes[task.id] ?? task.defaultMode;
    if (mode === task.expectedMode) {
      correctTasks += 1;
    }
    if (task.blastRadius === "high" && mode === "lights-out") {
      highBlastLightsOut = true;
    }
  }

  const totalTasks = lab.tasks.length;
  const withinLoopCap = loopCount >= lab.minLoops && loopCount <= lab.maxLoops;
  const passed =
    correctTasks === totalTasks && withinLoopCap && decoupledVerifier;

  let verdict: LoopAutonomyEvaluation["verdict"] = "needs-guardrails";
  if (passed) {
    verdict = "lit-factory";
  } else if (highBlastLightsOut || !decoupledVerifier || loopCount > lab.maxLoops) {
    verdict = "dark-factory-risk";
  }

  return {
    correctTasks,
    totalTasks,
    withinLoopCap,
    decoupledVerifier,
    verdict,
    passed,
  };
}

export interface SwarmPartitionEvaluation {
  collisionPaths: string[];
  unassignedPaths: string[];
  verifierWritePaths: string[];
  misroutedPaths: string[];
  passed: boolean;
}

export function evaluateSwarmPartition(
  lab: SwarmPartitionLab,
  assignments: Record<string, readonly string[]>,
): SwarmPartitionEvaluation {
  const collisionPaths: string[] = [];
  const unassignedPaths: string[] = [];
  const verifierWritePaths: string[] = [];
  const misroutedPaths: string[] = [];

  for (const file of lab.files) {
    const assigned = assignments[file.id] ?? file.initialWorkers;
    if (assigned.length === 0) {
      unassignedPaths.push(file.path);
    } else if (assigned.length > 1) {
      collisionPaths.push(file.path);
    }
    if (
      assigned.includes("@verifier") &&
      file.recommendedWorker !== "@verifier"
    ) {
      verifierWritePaths.push(file.path);
    }
    if (
      assigned.length !== 1 ||
      assigned[0] !== file.recommendedWorker
    ) {
      misroutedPaths.push(file.path);
    }
  }

  return {
    collisionPaths,
    unassignedPaths,
    verifierWritePaths,
    misroutedPaths,
    passed:
      collisionPaths.length === 0 &&
      unassignedPaths.length === 0 &&
      verifierWritePaths.length === 0 &&
      misroutedPaths.length === 0,
  };
}

export interface WebsiteFactoryLabEvaluation {
  contrastRatio: number;
  wcagGrade: "AAA" | "AA" | "FAIL";
  contrastPass: boolean;
  estimatedGlbKb: number;
  reductionPercent: number;
  glbPass: boolean;
  geoPassedCount: number;
  geoTotalCount: number;
  geoPass: boolean;
  passed: boolean;
}

export function evaluateWebsiteFactoryLab(
  lab: WebsiteFactoryLab,
  selectedPresetId: string,
  enabledOptimizationIds: readonly string[],
  enabledGeoCheckIds: readonly string[],
): WebsiteFactoryLabEvaluation {
  const preset =
    lab.contrastPresets.find((p) => p.id === selectedPresetId) ??
    lab.contrastPresets[0];
  const ratio = preset ? computeContrastRatio(preset.fgHex, preset.bgHex) : 1;
  const wcagGrade = classifyWcagContrast(ratio);
  const contrastPass = ratio >= 4.5;

  let remainingSize = lab.rawGlbKb;
  for (const opt of lab.glbOptimizations) {
    if (enabledOptimizationIds.includes(opt.id)) {
      remainingSize *= 1 - opt.reductionFactor;
    }
  }
  const estimatedGlbKb = Math.max(1, Math.round(remainingSize));
  const reductionPercent = Number(
    (((lab.rawGlbKb - estimatedGlbKb) / lab.rawGlbKb) * 100).toFixed(1),
  );
  const glbPass = estimatedGlbKb <= lab.glbTargetKb;

  const geoTotalCount = lab.geoChecks.length;
  const geoPassedCount = lab.geoChecks.filter((check) =>
    enabledGeoCheckIds.includes(check.id),
  ).length;
  const geoPass = geoTotalCount > 0 && geoPassedCount === geoTotalCount;

  return {
    contrastRatio: ratio,
    wcagGrade,
    contrastPass,
    estimatedGlbKb,
    reductionPercent,
    glbPass,
    geoPassedCount,
    geoTotalCount,
    geoPass,
    passed: contrastPass && glbPass && geoPass,
  };
}
