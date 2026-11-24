import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CourseSchema,
  RepoManifestSchema,
  RepoResourceSchema,
  type Course,
  type RepoManifest,
  type RepoResource,
  type RepoResourceCategory,
} from "../src/lib/schemas";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ACADEMY_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const OUTPUT_PATH = path.join(
  ACADEMY_ROOT,
  "src",
  "data",
  "generated-repo-manifest.json",
);

const CATEGORY_ORDER: Record<RepoResourceCategory, number> = {
  manifest: 0,
  rule: 1,
  hook: 2,
  agent: 3,
  skill: 4,
  memory: 5,
  plan: 6,
};

const SKILL_STAGE_MAP: Record<string, string> = {
  "cf-bootstrap": "Stage 0: Bootstrap",
  "cf-start": "Session Init",
  "cf-handover": "Stage 8: Optimise & Handover",
  "cf-research": "Stage 1: Research",
  "cf-grill-me": "Stage 2A: Spec Interrogation",
  "cf-plan": "Stage 2B: Spec & Architecture",
  "cf-implement": "Stage 3: Build",
  "cf-qa-review": "Stage 4: Test & QA",
  "cf-next-verify": "Stage 4: Full-Stack Verification",
  "cf-eval": "Stage 4: Dual-Axis Eval",
  "cf-loop-engineer": "Loop Engineering & Lit Factory",
  "cf-deploy-staging": "Stage 5: Deploy",
  "cf-triage": "Stage 6A: User Feedback & Triage",
  "cf-learn": "Stage 6B: Optimise & Learn",
};

/**
 * Security boundary guard: guarantees every file read resolves strictly inside
 * `repoRoot` and never touches `.git` or `.env*` secrets.
 */
function assertSafeRepoFile(repoRoot: string, targetPath: string): string {
  const resolvedRoot = path.resolve(repoRoot);
  const resolvedTarget = path.resolve(targetPath);

  if (
    resolvedTarget !== resolvedRoot &&
    !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new Error(
      `Security violation: path '${targetPath}' escapes repository root.`,
    );
  }

  const relative = path.relative(resolvedRoot, resolvedTarget);
  const segments = relative.split(path.sep);
  for (const segment of segments) {
    const lower = segment.toLowerCase();
    if (lower === ".git" || lower.startsWith(".env")) {
      throw new Error(
        `Security violation: refused to read forbidden path '${relative}'.`,
      );
    }
  }

  if (fs.existsSync(resolvedTarget)) {
    const stat = fs.lstatSync(resolvedTarget);
    if (stat.isSymbolicLink()) {
      throw new Error(
        `Security violation: refused to follow symbolic link '${relative}'.`,
      );
    }
    const realRoot = fs.realpathSync(resolvedRoot);
    const realTarget = fs.realpathSync(resolvedTarget);
    if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${path.sep}`)) {
      throw new Error(
        `Security violation: resolved path '${relative}' escapes repository root.`,
      );
    }
  }

  return resolvedTarget;
}

function toPosixRelative(repoRoot: string, absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function extractSummary(relativePath: string, content: string): string {
  if (relativePath.endsWith(".json")) {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (typeof parsed.description === "string" && parsed.description.trim()) {
        return parsed.description.trim();
      }
      if (relativePath === "hooks.json") {
        return "Declarative Antigravity lifecycle hooks registry binding PreToolUse safety checks to run_command.";
      }
    } catch {
      // Fallback below
    }
  }

  if (relativePath.endsWith(".py")) {
    const docstringMatch = content.match(/"""([\s\S]*?)"""/);
    if (docstringMatch?.[1]) {
      const firstLine = docstringMatch[1]
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);
      if (firstLine) {
        return firstLine;
      }
    }
  }

  // Extract YAML frontmatter `description:` if present
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatterMatch?.[1]) {
    const descLine = frontmatterMatch[1]
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith("description:"));
    if (descLine) {
      const rawDesc = descLine
        .slice(descLine.indexOf(":") + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (rawDesc.length > 0) {
        return rawDesc;
      }
    }
  }

  // Fallback to first markdown heading or non-empty text line
  const body = frontmatterMatch
    ? content.slice(frontmatterMatch[0].length)
    : content;
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("---"));

  const firstHeading = lines.find((line) => line.startsWith("#"));
  if (firstHeading) {
    return firstHeading.replace(/^#+\s*/, "").trim();
  }

  return lines[0]?.slice(0, 180) ?? `Repository resource at ${relativePath}`;
}

function readAllowlistedResource(
  relativePath: string,
  category: RepoResourceCategory,
  name: string,
  stageRef?: string,
): RepoResource | null {
  const fullPath = assertSafeRepoFile(
    REPO_ROOT,
    path.join(REPO_ROOT, relativePath),
  );
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return null;
  }

  const content = fs.readFileSync(fullPath, "utf8");
  const posixPath = toPosixRelative(REPO_ROOT, fullPath);
  const id = `${category}:${posixPath.replace(/[^a-zA-Z0-9/_-]/g, "-")}`;

  return RepoResourceSchema.parse({
    id,
    category,
    name,
    relativePath: posixPath,
    summary: extractSummary(posixPath, content),
    content,
    sizeBytes: Buffer.byteLength(content, "utf8"),
    stageRef,
  });
}

function collectResources(): RepoResource[] {
  const resources: RepoResource[] = [];

  const pushIfPresent = (resource: RepoResource | null): void => {
    if (resource) {
      resources.push(resource);
    }
  };

  // 1. Root manifest, rules, and hooks
  pushIfPresent(
    readAllowlistedResource("plugin.json", "manifest", "plugin.json", "Plugin Manifest"),
  );
  pushIfPresent(
    readAllowlistedResource("rules/AGENTS.md", "rule", "AGENTS.md (Global Invariants)", "All Stages"),
  );
  pushIfPresent(
    readAllowlistedResource("hooks.json", "hook", "hooks.json (Hook Registry)", "Guardrails"),
  );
  pushIfPresent(
    readAllowlistedResource("hooks/hitl-gate.py", "hook", "hitl-gate.py (PreToolUse Gate)", "Guardrails"),
  );
  pushIfPresent(
    readAllowlistedResource("hooks/secret-guard.py", "hook", "secret-guard.py (Secret Leak Guard)", "Guardrails"),
  );

  // 2. Agents: agents/cf-*.md
  const agentsDir = assertSafeRepoFile(REPO_ROOT, path.join(REPO_ROOT, "agents"));
  if (fs.existsSync(agentsDir)) {
    const agentFiles = fs
      .readdirSync(agentsDir)
      .filter((entry) => entry.startsWith("cf-") && entry.endsWith(".md"))
      .sort();
    for (const file of agentFiles) {
      const baseName = file.replace(/\.md$/, "");
      const stageMap: Record<string, string> = {
        "cf-architect": "Stages 1–2: Research & Architecture",
        "cf-backend": "Stage 3: Backend Build",
        "cf-frontend": "Stage 3: Frontend Build",
        "cf-reviewer": "Stage 4: Independent Security & QA",
        "cf-tester": "Stage 4: Deterministic Test Verification",
      };
      pushIfPresent(
        readAllowlistedResource(
          path.join("agents", file),
          "agent",
          baseName,
          stageMap[baseName],
        ),
      );
    }
  }

  // 3. Skills: skills/cf-*/SKILL.md + skills/cf-implement/references/orchestration.md
  const skillsDir = assertSafeRepoFile(REPO_ROOT, path.join(REPO_ROOT, "skills"));
  if (fs.existsSync(skillsDir)) {
    const skillDirs = fs
      .readdirSync(skillsDir)
      .filter((entry) => entry.startsWith("cf-"))
      .sort();
    for (const dir of skillDirs) {
      const skillRel = path.join("skills", dir, "SKILL.md");
      pushIfPresent(
        readAllowlistedResource(skillRel, "skill", dir, SKILL_STAGE_MAP[dir]),
      );
    }
    pushIfPresent(
      readAllowlistedResource(
        path.join("skills", "cf-implement", "references", "orchestration.md"),
        "skill",
        "cf-implement/orchestration.md",
        "Stage 3: Swarm Orchestration",
      ),
    );
    pushIfPresent(
      readAllowlistedResource(
        path.join("skills", "cf-loop-engineer", "references", "project-examples.md"),
        "skill",
        "cf-loop-engineer/project-examples.md",
        "Loop Engineering Examples",
      ),
    );
    pushIfPresent(
      readAllowlistedResource(
        path.join("skills", "cf-eval", "references", "eval-rubric.md"),
        "skill",
        "cf-eval/eval-rubric.md",
        "Stage 4: Dual-Axis Eval Rubric",
      ),
    );
  }

  // 4. Memory: .memory/*.md and .memory/decisions/*.md
  const memoryDir = assertSafeRepoFile(REPO_ROOT, path.join(REPO_ROOT, ".memory"));
  if (fs.existsSync(memoryDir)) {
    const memoryFiles = fs
      .readdirSync(memoryDir)
      .filter((entry) => entry.endsWith(".md"))
      .sort();
    for (const file of memoryFiles) {
      const memoryStageMap: Record<string, string> = {
        "research.md": "Stage 1: Harness Research",
        "research-academy-platform.md": "Stage 1: Platform Research",
        "research-vibe-coding-lit-factory.md": "Stage 1: Lit Factory Research",
        "architecture.md": "Stage 2B: System Architecture",
        "tasks.md": "Milestone Backlog",
        "handover.md": "Session Handover",
        "qa-report.md": "Stage 4: QA Report",
      };
      pushIfPresent(
        readAllowlistedResource(
          path.join(".memory", file),
          "memory",
          file,
          memoryStageMap[file] ?? "Workspace Memory",
        ),
      );
    }

    const decisionsDir = assertSafeRepoFile(
      REPO_ROOT,
      path.join(memoryDir, "decisions"),
    );
    if (fs.existsSync(decisionsDir)) {
      const adrFiles = fs
        .readdirSync(decisionsDir)
        .filter((entry) => entry.endsWith(".md"))
        .sort();
      for (const file of adrFiles) {
        pushIfPresent(
          readAllowlistedResource(
            path.join(".memory", "decisions", file),
            "memory",
            `decisions/${file}`,
            "Stage 2B: ADR",
          ),
        );
      }
    }
  }

  // 5. Plans: plans/*.md (excluding plans/templates/)
  const plansDir = assertSafeRepoFile(REPO_ROOT, path.join(REPO_ROOT, "plans"));
  if (fs.existsSync(plansDir)) {
    const planEntries = fs
      .readdirSync(plansDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name)
      .sort();
    for (const file of planEntries) {
      pushIfPresent(
        readAllowlistedResource(
          path.join("plans", file),
          "plan",
          file,
          "Stage 2B: Locked Spec",
        ),
      );
    }
  }

  // Deterministic sort by category priority then name
  resources.sort((a, b) => {
    const catDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (catDiff !== 0) {
      return catDiff;
    }
    return a.name.localeCompare(b.name);
  });

  return resources;
}

function collectCourses(): Course[] {
  const coursesRoot = assertSafeRepoFile(
    REPO_ROOT,
    path.join(ACADEMY_ROOT, "content", "courses"),
  );
  if (!fs.existsSync(coursesRoot)) {
    return [];
  }

  const courseDirs = fs
    .readdirSync(coursesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const courses: Course[] = [];
  for (const slugDir of courseDirs) {
    const courseFile = assertSafeRepoFile(
      REPO_ROOT,
      path.join(coursesRoot, slugDir, "course.json"),
    );
    if (!fs.existsSync(courseFile)) {
      continue;
    }

    const raw = fs.readFileSync(courseFile, "utf8");
    const parsedJson: unknown = JSON.parse(raw);
    const validated = CourseSchema.parse(parsedJson);
    courses.push(validated);
  }

  courses.sort((a, b) => a.number - b.number);
  return courses;
}

function readPluginMetadata(): { pluginName: string; pluginVersion: string } {
  const pluginPath = assertSafeRepoFile(REPO_ROOT, path.join(REPO_ROOT, "plugin.json"));
  if (!fs.existsSync(pluginPath)) {
    return { pluginName: "code-factory", pluginVersion: "0.0.0" };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(pluginPath, "utf8")) as Record<string, unknown>;
    return {
      pluginName: typeof raw.name === "string" ? raw.name : "code-factory",
      pluginVersion: typeof raw.version === "string" ? raw.version : "0.0.0",
    };
  } catch {
    return { pluginName: "code-factory", pluginVersion: "0.0.0" };
  }
}

function main(): void {
  const pluginManifestPath = path.join(REPO_ROOT, "plugin.json");
  if (!fs.existsSync(pluginManifestPath) && fs.existsSync(OUTPUT_PATH)) {
    try {
      const existing = RepoManifestSchema.parse(
        JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")),
      );
      console.log(
        `[sync-resources] Preserved existing validated manifest (${existing.resources.length} resources, ${existing.courses.length} courses).`,
      );
      return;
    } catch {
      // Fall through and regenerate from available paths.
    }
  }

  const { pluginName, pluginVersion } = readPluginMetadata();
  const resources = collectResources();
  const courses = collectCourses();

  const countByCategory = (cat: RepoResourceCategory): number =>
    resources.filter((item) => item.category === cat).length;

  const manifest: RepoManifest = RepoManifestSchema.parse({
    syncedAt: new Date().toISOString(),
    pluginVersion,
    pluginName,
    counts: {
      skills: countByCategory("skill"),
      agents: countByCategory("agent"),
      rules: countByCategory("rule"),
      hooks: countByCategory("hook"),
      memory: countByCategory("memory"),
      plans: countByCategory("plan"),
      courses: courses.length,
    },
    resources,
    courses,
  });

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(
    `[sync-resources] Generated ${path.relative(REPO_ROOT, OUTPUT_PATH)} ` +
      `(${manifest.resources.length} resources, ${manifest.courses.length} courses).`,
  );
}

main();
