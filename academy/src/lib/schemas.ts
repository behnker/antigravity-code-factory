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
  steps: z.array(LessonStepSchema).min(1),
  prompts: z.array(PromptCardSchema).default([]),
});

export const RepoResourceCategorySchema = z.enum([
  "rule",
  "skill",
  "agent",
  "hook",
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
