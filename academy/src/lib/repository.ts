import fs from "node:fs";
import path from "node:path";
import {
  RepoManifestSchema,
  type Course,
  type RepoManifest,
  type RepoResource,
} from "./schemas";

const EMPTY_MANIFEST: RepoManifest = {
  syncedAt: "1970-01-01T00:00:00.000Z",
  pluginVersion: "0.0.0",
  pluginName: "code-factory",
  counts: {
    skills: 0,
    agents: 0,
    rules: 0,
    hooks: 0,
    memory: 0,
    plans: 0,
    courses: 0,
  },
  resources: [],
  courses: [],
};

function resolveManifestCandidates(): string[] {
  const cwd = process.cwd();
  return [
    path.join(cwd, "src", "data", "generated-repo-manifest.json"),
    path.join(cwd, "academy", "src", "data", "generated-repo-manifest.json"),
  ];
}

let cachedManifest: RepoManifest | null = null;

/**
 * Loads and Zod-validates the build-time generated repository manifest.
 * Cached in module scope for stateless serverless efficiency; falls back safely
 * to an empty manifest if the sync script has not yet run.
 */
export function getRepoManifest(): RepoManifest {
  if (cachedManifest) {
    return cachedManifest;
  }

  for (const candidate of resolveManifestCandidates()) {
    try {
      if (!fs.existsSync(candidate)) {
        continue;
      }
      const raw = fs.readFileSync(candidate, "utf8");
      const parsed: unknown = JSON.parse(raw);
      const validated = RepoManifestSchema.safeParse(parsed);
      if (validated.success) {
        cachedManifest = validated.data;
        return validated.data;
      }
    } catch {
      // Fall through to next candidate or safe empty fallback.
    }
  }

  return EMPTY_MANIFEST;
}

export interface CourseQueryOptions {
  limit: number;
  offset: number;
  level?: string;
  tag?: string;
}

export interface CourseQueryResult {
  items: Course[];
  total: number;
  limit: number;
  offset: number;
}

export function queryCourses(opts: CourseQueryOptions): CourseQueryResult {
  const manifest = getRepoManifest();
  const normalizedTag = opts.tag?.trim().toLowerCase();
  const normalizedLevel = opts.level?.trim().toLowerCase();

  const filtered = manifest.courses.filter((course) => {
    if (normalizedLevel && course.level.toLowerCase() !== normalizedLevel) {
      return false;
    }
    if (
      normalizedTag &&
      !course.tags.some((t) => t.toLowerCase().includes(normalizedTag))
    ) {
      return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => a.number - b.number);
  const safeLimit = Math.min(Math.max(1, Math.floor(opts.limit)), 100);
  const safeOffset = Math.max(0, Math.floor(opts.offset));

  return {
    items: sorted.slice(safeOffset, safeOffset + safeLimit),
    total: sorted.length,
    limit: safeLimit,
    offset: safeOffset,
  };
}

export interface ResourceQueryOptions {
  limit: number;
  offset: number;
  category?: string;
  q?: string;
}

export interface ResourceQueryResult {
  items: RepoResource[];
  total: number;
  limit: number;
  offset: number;
  syncedAt: string;
}

export function queryResources(
  opts: ResourceQueryOptions,
): ResourceQueryResult {
  const manifest = getRepoManifest();
  const normalizedCategory = opts.category?.trim().toLowerCase();
  const normalizedQuery = opts.q?.trim().toLowerCase();

  const filtered = manifest.resources.filter((resource) => {
    if (
      normalizedCategory &&
      resource.category.toLowerCase() !== normalizedCategory
    ) {
      return false;
    }
    if (normalizedQuery) {
      const haystack = `${resource.name} ${resource.relativePath} ${resource.summary} ${resource.stageRef ?? ""}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) {
        return false;
      }
    }
    return true;
  });

  const safeLimit = Math.min(Math.max(1, Math.floor(opts.limit)), 100);
  const safeOffset = Math.max(0, Math.floor(opts.offset));

  return {
    items: filtered.slice(safeOffset, safeOffset + safeLimit),
    total: filtered.length,
    limit: safeLimit,
    offset: safeOffset,
    syncedAt: manifest.syncedAt,
  };
}
