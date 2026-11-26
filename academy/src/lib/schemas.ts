import { z } from "zod";

/**
 * Explicit allowlist for external or local video URLs (Security Invariant).
 * Prevents untrusted iframe injection or javascript: URLs.
 */
export const ALLOWED_VIDEO_URL_PATTERNS: readonly RegExp[] = [
  /^https:\/\/www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{6,32}(?:\?[A-Za-z0-9_=&%-]*)?$/,
  /^https:\/\/player\.vimeo\.com\/video\/\d+(?:\?[A-Za-z0-9_=&%-]*)?$/,
  /^https:\/\/www\.loom\.com\/embed\/[A-Za-z0-9-]+(?:\?[A-Za-z0-9_=&%-]*)?$/,
  /^\/media\/[A-Za-z0-9._-]+\.(?:mp4|webm)$/,
];

export function isAllowedVideoUrl(url: string): boolean {
  return ALLOWED_VIDEO_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Explicit allowlist for local editorial course illustrations (Security Invariant).
 * Prevents untrusted remote origins, javascript: URIs, or directory traversal.
 */
export const ALLOWED_IMAGE_URL_PATTERNS: readonly RegExp[] = [
  /^\/media\/illustrations\/[A-Za-z0-9._-]+\.(?:png|webp|jpg|jpeg|svg)$/,
];

/**
 * Explicit allowlist for local spoken audio explainers (Security Invariant).
 */
export const ALLOWED_AUDIO_URL_PATTERNS: readonly RegExp[] = [
  /^\/media\/audio\/[A-Za-z0-9._-]+\.(?:mp3|wav|ogg|m4a)$/,
];

export function isAllowedImageUrl(url: string): boolean {
  if (url.includes("..")) return false;
  return ALLOWED_IMAGE_URL_PATTERNS.some((pattern) => pattern.test(url));
}

export function isAllowedAudioUrl(url: string): boolean {
  if (url.includes("..")) return false;
  return ALLOWED_AUDIO_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Explicit allowlist for local Proof Pack screenshots (Security Invariant).
 * Restricts paths strictly to /media/proof-pack/<project-slug>/<filename>.<ext>
 * and blocks directory traversal, remote hosts, and javascript:/data: URIs.
 */
export const ALLOWED_PROOF_IMAGE_URL_PATTERNS: readonly RegExp[] = [
  /^\/media\/proof-pack\/[a-z0-9-]+\/[A-Za-z0-9._-]+\.(?:png|webp|jpg|jpeg|svg)$/,
];

export function isAllowedProofImageUrl(url: string): boolean {
  if (!url || url.includes("..")) return false;
  return ALLOWED_PROOF_IMAGE_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Explicit allowlist for external live demo URLs (Security Invariant).
 * Permits strictly https:// origins without whitespace or embedded credentials.
 */
export function isAllowedLiveUrl(url: string): boolean {
  if (!url || url.length > 500 || /\s/.test(url)) return false;
  if (!/^https:\/\/[A-Za-z0-9.-]+(?:\/[^\s]*)?$/.test(url)) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.length > 0 &&
      parsed.hostname.includes(".") &&
      !parsed.hostname.startsWith(".") &&
      !parsed.hostname.endsWith(".") &&
      !parsed.hostname.includes("..") &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

export const ProofMetricSchema = z.object({
  label: z.string().min(1).max(80),
  before: z.string().min(1).max(80).optional(),
  after: z.string().min(1).max(120),
  status: z.enum(["pass", "info"]),
});

export const ProofArtifactSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/).max(80),
    label: z.string().min(1).max(120),
    imageSrc: z
      .string()
      .refine(isAllowedProofImageUrl, {
        message:
          "Proof imageSrc must match /media/proof-pack/<project-slug>/<filename>.(png|webp|jpg|jpeg|svg).",
      })
      .optional(),
    alt: z.string().min(1).max(280).optional(),
    caption: z.string().min(1).max(300),
    command: z.string().min(1).max(240).optional(),
    cliExcerpt: z.string().min(1).max(2000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.imageSrc && !val.alt) {
      ctx.addIssue({
        code: "custom",
        path: ["alt"],
        message:
          "Proof artifact requires accessible alt text whenever imageSrc is provided.",
      });
    }
  });

export const ProofGallerySchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(600),
  pipelinePhase: z.string().min(1).max(80),
  skillsUsed: z.array(z.string().min(1).max(60)).min(1).max(20),
  promptsVerified: z.array(z.string().min(1).max(120)).default([]),
  metrics: z.array(ProofMetricSchema).default([]),
  artifacts: z.array(ProofArtifactSchema).min(1).max(16),
  liveUrl: z
    .string()
    .refine(isAllowedLiveUrl, {
      message: "Proof liveUrl must use a valid https:// origin.",
    })
    .optional(),
});

export const DomainIdSchema = z.enum(["website", "game", "video", "harness"]);

export const DomainCaseStudySchema = z.object({
  id: DomainIdSchema,
  order: z.number().int().min(1).max(4),
  domainLabel: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  eli5Title: z.string().min(1).max(120),
  repoName: z.string().min(1).max(80),
  status: z.enum(["shipped", "in-progress"]),
  accentTone: z.enum(["amber", "emerald", "rose", "cyan"]),
  summary: z.string().min(1).max(400),
  eli5Summary: z.string().min(1).max(400),
  stack: z.array(z.string().min(1).max(60)).min(2).max(10),
  skillsApplied: z.array(z.string().min(1).max(40)).min(2).max(12),
  verifiedMetrics: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        value: z.string().min(1).max(80),
      }),
    )
    .min(2)
    .max(6),
  proofArtifactPath: z.string().min(1).max(160),
  liveUrl: z
    .string()
    .refine(isAllowedLiveUrl, {
      message: "Domain liveUrl must use a valid https:// origin.",
    })
    .optional(),
  linkedCourseSlug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  linkedCourseNumber: z.number().int().min(0).optional(),
});

export const LearningDepthModeSchema = z.enum(["eli5", "pro"]);

export const CourseIllustrationSchema = z.object({
  src: z.string().min(1).refine(isAllowedImageUrl, {
    message:
      "Illustration src must match /media/illustrations/<filename>.(png|webp|jpg|jpeg|svg).",
  }),
  alt: z.string().min(1).max(280),
  caption: z.string().min(1).max(240),
  visualAnalogy: z.string().min(1).max(160),
});

export const Eli5ConceptBlockSchema = z.object({
  plainTitle: z.string().min(1).max(120).optional(),
  oneLineHook: z.string().min(1).max(200).optional(),
  everydayAnalogy: z.string().min(1).max(160),
  simpleExplanation: z.string().min(1).max(500),
  whyItMatters: z.string().min(1).max(500),
  roleInProtocol: z.string().min(1).max(500),
  howToUseGoingForward: z.string().min(1).max(500),
  whenToUse: z.string().min(1).max(400).optional(),
  realWorldExample: z.string().min(1).max(500),
  audioScript: z.string().min(1).max(1400),
  audioUrl: z
    .string()
    .refine(isAllowedAudioUrl, {
      message:
        "Audio URL must match /media/audio/<filename>.(mp3|wav|ogg|m4a).",
    })
    .optional(),
  estimatedMinutes: z.number().int().min(1).max(30).default(5),
  diagramCaption: z.string().min(1).max(240).optional(),
});

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const SdlcStageKeySchema = z.enum([
  "research",
  "spec",
  "architecture",
  "build",
  "test",
  "deploy",
  "feedback",
  "optimise",
  "meta",
]);

export const DifficultyLevelSchema = z.enum(["beginner", "intermediate", "senior"]);

export const PromptVariableSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(60),
  placeholder: z.string().max(120),
  defaultValue: z.string().max(200).default(""),
});

export const PromptCardSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  eli5Title: z.string().min(1).max(120).optional(),
  stage: SdlcStageKeySchema,
  difficulty: DifficultyLevelSchema,
  skillRef: z.string().optional(),
  description: z.string().min(1).max(400),
  whenToUse: z.string().min(1).max(300).optional(),
  template: z.string().min(1).max(4000),
  variables: z.array(PromptVariableSchema).default([]),
  expectedOutcome: z.string().min(1).max(400),
});

export const VideoChapterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(100),
  timestampSeconds: z.number().int().min(0),
  summary: z.string().max(240),
});

export const VideoConfigSchema = z
  .object({
    title: z.string().min(1).max(140),
    durationLabel: z.string().max(20),
    provider: z.enum(["mp4", "youtube", "vimeo", "loom", "coming_soon"]),
    embedUrl: z.string().optional(),
    posterSrc: z
      .string()
      .refine(isAllowedImageUrl, {
        message:
          "Video posterSrc must match /media/illustrations/<filename>.(png|webp|jpg|jpeg|svg).",
      })
      .optional(),
    posterLabel: z.string().max(160).optional(),
    chapters: z.array(VideoChapterSchema).default([]),
    transcriptSummary: z.string().max(2000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.embedUrl && !isAllowedVideoUrl(val.embedUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["embedUrl"],
        message: "Video embedUrl must match an allowlisted provider or /media/*.mp4|webm path.",
      });
    }
  });

const MicroLabBaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(80),
  title: z.string().min(1).max(140),
  eli5Title: z.string().min(1).max(140),
  subtitle: z.string().min(1).max(320),
  eli5Subtitle: z.string().min(1).max(320),
  badgeLabel: z.string().min(1).max(60),
  estimatedMinutes: z.number().int().min(1).max(20).default(4),
});

export const ScenarioDrillOptionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(60),
  label: z.string().min(1).max(160),
  isCorrect: z.boolean(),
  feedback: z.string().min(1).max(360),
  eli5Feedback: z.string().min(1).max(360),
});

export const ScenarioDrillItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(60),
  prompt: z.string().min(1).max(360),
  eli5Prompt: z.string().min(1).max(360),
  options: z.array(ScenarioDrillOptionSchema).min(2).max(5),
});

export const ScenarioDrillLabSchema = MicroLabBaseSchema.extend({
  kind: z.literal("scenario-drill"),
  scenarios: z.array(ScenarioDrillItemSchema).min(2).max(6),
});

export const ContextBudgetModuleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(60),
  label: z.string().min(1).max(120),
  bytes: z.number().int().min(100).max(15000),
  defaultAlwaysOn: z.boolean(),
  recommendedPlacement: z.enum(["always-on", "progressive-skill"]),
  criticalSecurity: z.boolean().default(false),
  rationale: z.string().min(1).max(280),
});

export const ContextBudgetLabSchema = MicroLabBaseSchema.extend({
  kind: z.literal("context-budget"),
  budgetBytes: z.number().int().min(2048).max(32768).default(10240),
  modules: z.array(ContextBudgetModuleSchema).min(3).max(10),
});

export const LoopAutonomyTaskSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(60),
  label: z.string().min(1).max(140),
  blastRadius: z.enum(["low", "high"]),
  expectedMode: z.enum(["lights-out", "human-lit"]),
  defaultMode: z.enum(["lights-out", "human-lit"]),
  rationale: z.string().min(1).max(280),
});

export const LoopAutonomyLabSchema = MicroLabBaseSchema.extend({
  kind: z.literal("loop-autonomy"),
  minLoops: z.number().int().min(1).max(10).default(3),
  maxLoops: z.number().int().min(1).max(10).default(5),
  initialLoops: z.number().int().min(1).max(10).default(7),
  tasks: z.array(LoopAutonomyTaskSchema).min(3).max(6),
});

export const SwarmPartitionFileSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(60),
  path: z.string().min(1).max(140),
  role: z.string().min(1).max(120),
  recommendedWorker: z.enum(["@backend", "@frontend", "@verifier"]),
  initialWorkers: z.array(z.enum(["@backend", "@frontend", "@verifier"])).min(0).max(3),
});

export const SwarmPartitionLabSchema = MicroLabBaseSchema.extend({
  kind: z.literal("swarm-partition"),
  workers: z.array(z.enum(["@backend", "@frontend", "@verifier"])).min(2).max(4),
  files: z.array(SwarmPartitionFileSchema).min(3).max(8),
});

const HEX_COLOR_VALUE_RE = /^#[0-9A-Fa-f]{6}$/;

export const WebsiteContrastPresetSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(60),
  label: z.string().min(1).max(120),
  mode: z.enum(["light", "dark"]),
  fgLabel: z.string().min(1).max(80),
  bgLabel: z.string().min(1).max(80),
  fgHex: z.string().regex(HEX_COLOR_VALUE_RE),
  bgHex: z.string().regex(HEX_COLOR_VALUE_RE),
  note: z.string().min(1).max(260),
});

export const WebsiteGlbOptimizationSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(60),
  label: z.string().min(1).max(100),
  reductionFactor: z.number().min(0.05).max(0.85),
  defaultEnabled: z.boolean(),
  explanation: z.string().min(1).max(240),
});

export const WebsiteGeoCheckSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(60),
  label: z.string().min(1).max(120),
  defaultEnabled: z.boolean(),
  explanation: z.string().min(1).max(240),
});

export const WebsiteFactoryLabSchema = MicroLabBaseSchema.extend({
  kind: z.literal("website-factory-lab"),
  defaultPresetId: z.string().min(1).max(60),
  contrastPresets: z.array(WebsiteContrastPresetSchema).min(2).max(6),
  rawGlbKb: z.number().int().min(100).max(50000),
  glbTargetKb: z.number().int().min(100).max(10000),
  glbOptimizations: z.array(WebsiteGlbOptimizationSchema).min(2).max(5),
  geoChecks: z.array(WebsiteGeoCheckSchema).min(2).max(5),
});

export const MicroLabSchema = z.discriminatedUnion("kind", [
  ScenarioDrillLabSchema,
  ContextBudgetLabSchema,
  LoopAutonomyLabSchema,
  SwarmPartitionLabSchema,
  WebsiteFactoryLabSchema,
]);

export const CodeSnippetSchema = z.object({
  language: z.string(),
  filename: z.string(),
  code: z.string(),
});

export const LessonStepSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(1),
  title: z.string().min(1).max(120),
  stageTag: z.string().min(1).max(40),
  summary: z.string().min(1).max(600),
  eli5: Eli5ConceptBlockSchema.optional(),
  keyTakeaways: z.array(z.string().min(1)).min(1),
  actionChecklist: z.array(z.string().min(1)).min(1),
  codeSnippet: CodeSnippetSchema.optional(),
  additionalCodeSnippets: z.array(CodeSnippetSchema).optional(),
  mermaidDiagram: z.string().optional(),
  repoArtifactPath: z.string().optional(),
  promptId: z.string().optional(),
  proofGallery: ProofGallerySchema.optional(),
});

export const CourseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  number: z.number().int().min(0),
  title: z.string().min(1).max(140),
  eli5Title: z.string().min(1).max(140).optional(),
  subtitle: z.string().min(1).max(260),
  eli5Tagline: z.string().min(1).max(260).optional(),
  illustration: CourseIllustrationSchema.optional(),
  level: z.enum(["beginner", "intermediate", "senior", "all-levels"]),
  estimatedMinutes: z.number().int().min(5).max(600),
  threeScenePreset: z.enum(["harness-constellation", "sdlc-orbital", "hook-pipeline"]),
  accentTone: z.enum(["cyan", "violet", "emerald"]),
  tags: z.array(z.string().min(1)).min(1),
  video: VideoConfigSchema,
  microLab: MicroLabSchema.optional(),
  steps: z.array(LessonStepSchema).min(1),
  prompts: z.array(PromptCardSchema).default([]),
});

export const RepoResourceCategorySchema = z.enum([
  "rule",
  "skill",
  "agent",
  "hook",
  "sidecar",
  "workflow",
  "memory",
  "plan",
  "manifest",
]);

export const RepoResourceSchema = z.object({
  id: z.string().min(1),
  category: RepoResourceCategorySchema,
  name: z.string().min(1),
  relativePath: z.string().min(1),
  summary: z.string(),
  content: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  stageRef: z.string().optional(),
});

export const RepoManifestSchema = z.object({
  syncedAt: z.string(),
  pluginVersion: z.string(),
  pluginName: z.string(),
  counts: z.object({
    skills: z.number().int().nonnegative(),
    agents: z.number().int().nonnegative(),
    rules: z.number().int().nonnegative(),
    hooks: z.number().int().nonnegative(),
    sidecars: z.number().int().nonnegative().default(0),
    workflows: z.number().int().nonnegative().default(0),
    memory: z.number().int().nonnegative(),
    plans: z.number().int().nonnegative(),
    courses: z.number().int().nonnegative(),
  }),
  resources: z.array(RepoResourceSchema),
  courses: z.array(CourseSchema),
});

export const HitlDecisionSchema = z.enum(["allow", "ask", "force_ask", "deny"]);

export const HitlSimulateRequestSchema = z.object({
  commandLine: z
    .string()
    .trim()
    .min(1, "Command line is required")
    .max(1000, "Command line exceeds 1000 characters"),
  bypassSandbox: z.boolean().optional().default(false),
});

export const HitlSegmentResultSchema = z.object({
  segment: z.string(),
  isDryRun: z.boolean(),
  matchedRule: z.string().nullable(),
  decision: HitlDecisionSchema,
});

export const HitlSimulateResponseSchema = z.object({
  decision: HitlDecisionSchema,
  reason: z.string(),
  matchedRule: z.string().nullable(),
  dryRunExempt: z.boolean(),
  segments: z.array(HitlSegmentResultSchema),
  overwrite: z.object({ CommandLine: z.string() }).optional(),
});

export const LearnerProgressSchema = z.object({
  schemaVersion: z.literal(1),
  completedStepIds: z.array(z.string()).default([]),
  completedLabIds: z.array(z.string()).default([]),
  bookmarkedPromptIds: z.array(z.string()).default([]),
  promptVariableValues: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  activeHarnessMode: z.enum(["raw", "code-factory-v3"]).default("code-factory-v3"),
  learningDepthMode: LearningDepthModeSchema.default("eli5"),
  updatedAt: z.string(),
});

export const HarnessDimensionSchema = z.object({
  id: z.string(),
  index: z.number().int().min(1).max(12),
  name: z.string(),
  category: z.enum(["orchestration", "guardrails", "intelligence", "ux", "platform"]),
  antigravityRawScore: z.number().min(0).max(10),
  claudeCodeScore: z.number().min(0).max(10),
  antigravityCodeFactoryScore: z.number().min(0).max(10),
  antigravitySummary: z.string(),
  claudeCodeSummary: z.string(),
  gapAnalysis: z.string(),
  howToPlugAndExceed: z.string(),
  winnerRaw: z.enum(["antigravity", "claude-code", "tie"]),
  winnerWithCodeFactory: z.enum(["antigravity", "claude-code", "tie"]),
});

export type LearningDepthMode = z.infer<typeof LearningDepthModeSchema>;
export type CourseIllustration = z.infer<typeof CourseIllustrationSchema>;
export type Eli5ConceptBlock = z.infer<typeof Eli5ConceptBlockSchema>;
export type Eli5ConceptBlockInput = z.input<typeof Eli5ConceptBlockSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type SdlcStageKey = z.infer<typeof SdlcStageKeySchema>;
export type DifficultyLevel = z.infer<typeof DifficultyLevelSchema>;
export type PromptVariable = z.infer<typeof PromptVariableSchema>;
export type PromptCard = z.infer<typeof PromptCardSchema>;
export type VideoChapter = z.infer<typeof VideoChapterSchema>;
export type VideoConfig = z.infer<typeof VideoConfigSchema>;
export type LessonStep = z.infer<typeof LessonStepSchema>;
export type Course = z.infer<typeof CourseSchema>;
export type RepoResourceCategory = z.infer<typeof RepoResourceCategorySchema>;
export type RepoResource = z.infer<typeof RepoResourceSchema>;
export type RepoManifest = z.infer<typeof RepoManifestSchema>;
export type HitlDecision = z.infer<typeof HitlDecisionSchema>;
export type HitlSimulateRequest = z.infer<typeof HitlSimulateRequestSchema>;
export type HitlSegmentResult = z.infer<typeof HitlSegmentResultSchema>;
export type HitlSimulateResponse = z.infer<typeof HitlSimulateResponseSchema>;
export type LearnerProgress = z.infer<typeof LearnerProgressSchema>;
export type HarnessDimension = z.infer<typeof HarnessDimensionSchema>;
export type ProofMetric = z.infer<typeof ProofMetricSchema>;
export type ProofArtifact = z.infer<typeof ProofArtifactSchema>;
export type ProofGallery = z.infer<typeof ProofGallerySchema>;
export type DomainId = z.infer<typeof DomainIdSchema>;
export type DomainCaseStudy = z.infer<typeof DomainCaseStudySchema>;
export type ScenarioDrillLab = z.infer<typeof ScenarioDrillLabSchema>;
export type ContextBudgetLab = z.infer<typeof ContextBudgetLabSchema>;
export type LoopAutonomyLab = z.infer<typeof LoopAutonomyLabSchema>;
export type SwarmPartitionLab = z.infer<typeof SwarmPartitionLabSchema>;
export type WebsiteFactoryLab = z.infer<typeof WebsiteFactoryLabSchema>;
export type MicroLab = z.infer<typeof MicroLabSchema>;
