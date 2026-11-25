import {
  LearnerProgressSchema,
  type LearnerProgress,
  type PromptVariable,
} from "./schemas";

export const LEARNER_PROGRESS_STORAGE_KEY = "antigravity_academy_progress_v1";

function deduplicateStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeProgress(progress: LearnerProgress): LearnerProgress {
  return {
    schemaVersion: 1,
    completedStepIds: deduplicateStrings(progress.completedStepIds),
    bookmarkedPromptIds: deduplicateStrings(progress.bookmarkedPromptIds),
    promptVariableValues: progress.promptVariableValues,
    activeHarnessMode: progress.activeHarnessMode,
    learningDepthMode: progress.learningDepthMode,
    updatedAt: progress.updatedAt,
  };
}

export function createDefaultProgress(nowIso?: string): LearnerProgress {
  return {
    schemaVersion: 1,
    completedStepIds: [],
    bookmarkedPromptIds: [],
    promptVariableValues: {},
    activeHarnessMode: "code-factory-v3",
    learningDepthMode: "eli5",
    updatedAt: nowIso ?? new Date().toISOString(),
  };
}

/**
 * Replaces `{{variable_key}}` placeholders using user overrides first,
 * then variable `defaultValue`, falling back to the raw token if empty.
 */
export function interpolatePrompt(
  template: string,
  variables: PromptVariable[],
  overrides: Record<string, string> = {},
): string {
  const variableMap = new Map<string, PromptVariable>();
  for (const variable of variables) {
    variableMap.set(variable.key, variable);
  }

  return template.replace(/\{\{([a-z0-9_]+)\}\}/g, (match, key: string) => {
    const overrideValue = overrides[key];
    if (typeof overrideValue === "string" && overrideValue.length > 0) {
      return overrideValue;
    }

    const definition = variableMap.get(key);
    if (definition && definition.defaultValue.length > 0) {
      return definition.defaultValue;
    }

    return match;
  });
}

export function loadLearnerProgress(
  storage?: Pick<Storage, "getItem">,
): LearnerProgress {
  const target =
    storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);

  if (!target) {
    return createDefaultProgress();
  }

  try {
    const raw = target.getItem(LEARNER_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return createDefaultProgress();
    }

    const parsedJson: unknown = JSON.parse(raw);
    const validated = LearnerProgressSchema.safeParse(parsedJson);
    if (!validated.success) {
      return createDefaultProgress();
    }

    return normalizeProgress(validated.data);
  } catch {
    return createDefaultProgress();
  }
}

export function saveLearnerProgress(
  progress: LearnerProgress,
  storage?: Pick<Storage, "setItem">,
): void {
  const target =
    storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);

  if (!target) {
    return;
  }

  const validated = LearnerProgressSchema.safeParse(progress);
  if (!validated.success) {
    return;
  }

  try {
    const normalized = normalizeProgress(validated.data);
    target.setItem(LEARNER_PROGRESS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage quota or private-browsing exceptions gracefully.
  }
}

export function parseImportedProgress(
  rawJson: string,
): { ok: true; data: LearnerProgress } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      ok: false,
      error: "Invalid JSON syntax. Please paste a valid exported progress JSON file.",
    };
  }

  const validated = LearnerProgressSchema.safeParse(parsed);
  if (!validated.success) {
    const firstIssue = validated.error.issues[0];
    const pathLabel =
      firstIssue && firstIssue.path.length > 0
        ? ` at '${firstIssue.path.join(".")}'`
        : "";
    return {
      ok: false,
      error: `Invalid progress schema${pathLabel}: ${firstIssue?.message ?? "validation failed"}.`,
    };
  }

  return {
    ok: true,
    data: normalizeProgress(validated.data),
  };
}

export function formatTimestamp(seconds: number): string {
  const safeSeconds =
    Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  const pad = (value: number): string => String(value).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}`;
  }

  return `${pad(minutes)}:${pad(secs)}`;
}
