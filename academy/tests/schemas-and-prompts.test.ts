import { describe, expect, it } from "vitest";
import {
  CourseIllustrationSchema,
  CourseSchema,
  Eli5ConceptBlockSchema,
  HarnessDimensionSchema,
  LearnerProgressSchema,
  PromptCardSchema,
  VideoConfigSchema,
  isAllowedAudioUrl,
  isAllowedImageUrl,
  isAllowedVideoUrl,
} from "@/lib/schemas";
import {
  LEARNER_PROGRESS_STORAGE_KEY,
  createDefaultProgress,
  formatTimestamp,
  interpolatePrompt,
  loadLearnerProgress,
  parseImportedProgress,
  saveLearnerProgress,
} from "@/lib/prompt-engine";
import { HARNESS_DIMENSIONS } from "@/data/harness-comparison";

describe("Video URL allowlist & schemas", () => {
  it("allows vetted video providers and local media paths", () => {
    expect(isAllowedVideoUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe(true);
    expect(isAllowedVideoUrl("https://player.vimeo.com/video/123456789")).toBe(true);
    expect(isAllowedVideoUrl("https://www.loom.com/embed/abc-123-def")).toBe(true);
    expect(isAllowedVideoUrl("/media/course-1-intro.mp4")).toBe(true);
    expect(isAllowedVideoUrl("/media/demo.webm")).toBe(true);
  });

  it("rejects untrusted hosts, javascript: URIs, and path traversal", () => {
    expect(isAllowedVideoUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedVideoUrl("https://evil.example.com/embed/123")).toBe(false);
    expect(isAllowedVideoUrl("/media/../etc/passwd.mp4")).toBe(false);
    expect(isAllowedVideoUrl("http://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe(false);

    const invalid = VideoConfigSchema.safeParse({
      title: "Bad Video",
      durationLabel: "05:00",
      provider: "youtube",
      embedUrl: "https://untrusted.example.com/v/1",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates all 12 harness comparison dimensions", () => {
    expect(HARNESS_DIMENSIONS).toHaveLength(12);
    for (const dim of HARNESS_DIMENSIONS) {
      expect(HarnessDimensionSchema.safeParse(dim).success).toBe(true);
    }
    const rawAvg =
      HARNESS_DIMENSIONS.reduce((sum, d) => sum + d.antigravityRawScore, 0) /
      HARNESS_DIMENSIONS.length;
    const cfAvg =
      HARNESS_DIMENSIONS.reduce((sum, d) => sum + d.antigravityCodeFactoryScore, 0) /
      HARNESS_DIMENSIONS.length;
    const claudeAvg =
      HARNESS_DIMENSIONS.reduce((sum, d) => sum + d.claudeCodeScore, 0) /
      HARNESS_DIMENSIONS.length;
    expect(cfAvg).toBeGreaterThan(rawAvg);
    expect(cfAvg).toBeGreaterThan(claudeAvg);
  });

  it("rejects malformed course slugs", () => {
    const res = CourseSchema.safeParse({
      id: "INVALID SLUG!",
      slug: "bad",
      number: 1,
      title: "Test",
      subtitle: "Sub",
      level: "beginner",
      estimatedMinutes: 15,
      threeScenePreset: "harness-constellation",
      accentTone: "cyan",
      tags: ["test"],
      video: { title: "V", durationLabel: "1:00", provider: "coming_soon" },
      steps: [
        {
          id: "s1",
          order: 1,
          title: "Step",
          stageTag: "Research",
          summary: "Summary",
          keyTakeaways: ["A"],
          actionChecklist: ["B"],
        },
      ],
    });
    expect(res.success).toBe(false);
  });
});

describe("prompt-engine & Zod localStorage persistence", () => {
  it("interpolates variables using overrides, defaults, and preserves unknown placeholders", () => {
    const out = interpolatePrompt(
      "Run cf-research on {{repo_name}} for {{feature}} using {{unknown_var}}",
      [
        { key: "repo_name", label: "Repo", placeholder: "repo", defaultValue: "my-app" },
        { key: "feature", label: "Feature", placeholder: "feat", defaultValue: "auth" },
      ],
      { feature: "billing-api" },
    );
    expect(out).toBe("Run cf-research on my-app for billing-api using {{unknown_var}}");
  });

  it("formats timestamps deterministically", () => {
    expect(formatTimestamp(0)).toBe("00:00");
    expect(formatTimestamp(65)).toBe("01:05");
    expect(formatTimestamp(3661)).toBe("1:01:01");
    expect(formatTimestamp(-10)).toBe("00:00");
  });

  it("gracefully resets on corrupted localStorage and round-trips valid state", () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
    };

    // Corrupted JSON
    store.set(LEARNER_PROGRESS_STORAGE_KEY, "{not-valid-json");
    const recovered = loadLearnerProgress(mockStorage);
    expect(recovered.schemaVersion).toBe(1);
    expect(recovered.completedStepIds).toEqual([]);

    // Valid round-trip
    const saved = {
      ...createDefaultProgress("2026-11-24T00:00:00.000Z"),
      completedStepIds: ["hm-1", "sdlc-1"],
      bookmarkedPromptIds: ["p-research"],
      activeHarnessMode: "raw" as const,
    };
    saveLearnerProgress(saved, mockStorage);
    const loaded = loadLearnerProgress(mockStorage);
    expect(loaded.completedStepIds).toEqual(["hm-1", "sdlc-1"]);
    expect(loaded.activeHarnessMode).toBe("raw");
  });

  it("validates imported progress JSON strictly", () => {
    const badJson = parseImportedProgress("{bad");
    expect(badJson.ok).toBe(false);

    const wrongVersion = parseImportedProgress(
      JSON.stringify({ schemaVersion: 99, completedStepIds: [], updatedAt: "2026-11-24" }),
    );
    expect(wrongVersion.ok).toBe(false);

    const good = parseImportedProgress(
      JSON.stringify(createDefaultProgress("2026-11-24T12:00:00.000Z")),
    );
    expect(good.ok).toBe(true);
  });
});

describe("Multimodal ELI5 URL allowlists & schemas", () => {
  it("isAllowedImageUrl allows local /media/illustrations/* assets and rejects remote, javascript:, and traversal paths", () => {
    expect(isAllowedImageUrl("/media/illustrations/harness-mastery.png")).toBe(true);
    expect(isAllowedImageUrl("/media/illustrations/course_00.jpg")).toBe(true);
    expect(isAllowedImageUrl("/media/illustrations/course-01.jpeg")).toBe(true);
    expect(isAllowedImageUrl("/media/illustrations/diagram-v2.webp")).toBe(true);
    expect(isAllowedImageUrl("/media/illustrations/vector-icon.svg")).toBe(true);

    expect(isAllowedImageUrl("https://cdn.example.com/harness-mastery.png")).toBe(false);
    expect(isAllowedImageUrl("http://localhost:3000/media/illustrations/a.png")).toBe(false);
    expect(isAllowedImageUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedImageUrl("/media/illustrations/../secret.png")).toBe(false);
    expect(isAllowedImageUrl("/media/illustrations/..%2fsecret.png")).toBe(false);
    expect(isAllowedImageUrl("/media/illustrations/nested/file.png")).toBe(false);
    expect(isAllowedImageUrl("/media/harness-mastery.png")).toBe(false);
    expect(isAllowedImageUrl("/media/illustrations/bad.gif")).toBe(false);
    expect(isAllowedImageUrl("")).toBe(false);
  });

  it("isAllowedAudioUrl allows local /media/audio/* assets and rejects remote, javascript:, and traversal paths", () => {
    expect(isAllowedAudioUrl("/media/audio/step-01.mp3")).toBe(true);
    expect(isAllowedAudioUrl("/media/audio/intro_voice.wav")).toBe(true);
    expect(isAllowedAudioUrl("/media/audio/walkthrough.ogg")).toBe(true);
    expect(isAllowedAudioUrl("/media/audio/clip-2.m4a")).toBe(true);

    expect(isAllowedAudioUrl("https://cdn.example.com/step-01.mp3")).toBe(false);
    expect(isAllowedAudioUrl("javascript:void(0)")).toBe(false);
    expect(isAllowedAudioUrl("/media/audio/../private.mp3")).toBe(false);
    expect(isAllowedAudioUrl("/media/audio/subdir/clip.wav")).toBe(false);
    expect(isAllowedAudioUrl("/media/step-01.mp3")).toBe(false);
    expect(isAllowedAudioUrl("/media/audio/unsupported.flac")).toBe(false);
    expect(isAllowedAudioUrl("")).toBe(false);
  });

  it("validates CourseIllustrationSchema and rejects unallowlisted image URLs", () => {
    const valid = CourseIllustrationSchema.safeParse({
      src: "/media/illustrations/harness-mastery.png",
      alt: "A workbench with safety locks and glowing checklists around a brain icon",
      caption: "The harness turns a smart brain into a safe engineering workshop.",
      visualAnalogy: "Brain inside a guarded workbench",
    });
    expect(valid.success).toBe(true);

    const remoteUrl = CourseIllustrationSchema.safeParse({
      src: "https://evil.example.com/pic.png",
      alt: "Remote pic",
      caption: "Should fail",
      visualAnalogy: "Remote",
    });
    expect(remoteUrl.success).toBe(false);

    const traversal = CourseIllustrationSchema.safeParse({
      src: "/media/illustrations/../secrets.svg",
      alt: "Traversal pic",
      caption: "Should fail",
      visualAnalogy: "Traversal",
    });
    expect(traversal.success).toBe(false);
  });

  it("validates Eli5ConceptBlockSchema defaults (estimatedMinutes: 5) and bounds", () => {
    const baseEli5 = {
      everydayAnalogy: "A pilot pre-flight checklist taped to the dashboard",
      simpleExplanation:
        "A harness is the set of simple tools and rules wrapped around an AI helper.",
      whyItMatters:
        "Without rules and checks, even a smart helper can guess wrong or break files.",
      roleInProtocol:
        "It connects workspace rules, skills, and safety checks into one repeatable loop.",
      howToUseGoingForward:
        "Always check your workspace rules before starting a new coding task.",
      realWorldExample:
        "Like checking oven temperature and ingredients before baking a cake.",
      audioScript:
        "Think of an AI model like a bright chef, and the harness like the organized kitchen with timers and recipe cards.",
    };

    const parsedDefault = Eli5ConceptBlockSchema.safeParse(baseEli5);
    expect(parsedDefault.success).toBe(true);
    if (parsedDefault.success) {
      expect(parsedDefault.data.estimatedMinutes).toBe(5);
      expect(parsedDefault.data.audioUrl).toBeUndefined();
    }

    const parsedWithAudio = Eli5ConceptBlockSchema.safeParse({
      ...baseEli5,
      audioUrl: "/media/audio/step-1.mp3",
      estimatedMinutes: 8,
      diagramCaption: "How the harness guides every step.",
    });
    expect(parsedWithAudio.success).toBe(true);
    if (parsedWithAudio.success) {
      expect(parsedWithAudio.data.estimatedMinutes).toBe(8);
      expect(parsedWithAudio.data.audioUrl).toBe("/media/audio/step-1.mp3");
    }

    // Invalid audioUrl & out-of-range estimatedMinutes
    expect(
      Eli5ConceptBlockSchema.safeParse({
        ...baseEli5,
        audioUrl: "https://untrusted.example.com/step-1.mp3",
      }).success,
    ).toBe(false);
    expect(
      Eli5ConceptBlockSchema.safeParse({
        ...baseEli5,
        audioUrl: "/media/audio/../escape.wav",
      }).success,
    ).toBe(false);
    expect(
      Eli5ConceptBlockSchema.safeParse({
        ...baseEli5,
        estimatedMinutes: 0,
      }).success,
    ).toBe(false);
    expect(
      Eli5ConceptBlockSchema.safeParse({
        ...baseEli5,
        estimatedMinutes: 31,
      }).success,
    ).toBe(false);
  });

  it("CourseSchema accepts Course 00 (number: 0), eli5Tagline, illustration, and Eli5ConceptBlockSchema while rejecting negative numbers", () => {
    const course00 = {
      id: "zero-to-one-foundations",
      slug: "zero-to-one-foundations",
      number: 0,
      title: "Zero to One Foundations",
      subtitle: "Software, terminals, Git, and AI harnesses explained simply",
      eli5Tagline: "Start from zero coding experience with everyday analogies.",
      illustration: {
        src: "/media/illustrations/zero-to-one-foundations.png",
        alt: "Friendly studio workbench showing folders, save points, and recipe cards",
        caption: "Your beginner workbench for building software safely.",
        visualAnalogy: "A tidy kitchen before cooking your first meal",
      },
      level: "beginner" as const,
      estimatedMinutes: 30,
      threeScenePreset: "sdlc-orbital" as const,
      accentTone: "emerald" as const,
      tags: ["beginner", "eli5"],
      video: { title: "Intro", durationLabel: "05:00", provider: "coming_soon" as const },
      steps: [
        {
          id: "z0-1",
          order: 1,
          title: "What Software Actually Is",
          stageTag: "Foundations",
          summary: "Files, folders, and instructions executed step by step.",
          eli5: {
            everydayAnalogy: "A recipe book in an organized kitchen",
            simpleExplanation: "Software is a clear list of steps a computer follows.",
            whyItMatters: "Knowing how files fit together removes the mystery of coding.",
            roleInProtocol: "Forms the base layer before using rules, skills, or tests.",
            howToUseGoingForward: "Open one project folder at a time and read its map first.",
            realWorldExample: "A coffee machine following grind, heat, and pour steps.",
            audioScript: "Software is simply a recipe written so clearly that a computer can follow it every single time.",
          },
          keyTakeaways: ["Code lives in plain text files."],
          actionChecklist: ["Inspect your workspace directory."],
        },
      ],
    };

    const parsed = CourseSchema.safeParse(course00);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.number).toBe(0);
      expect(parsed.data.eli5Tagline).toBe(course00.eli5Tagline);
      expect(parsed.data.illustration?.src).toBe("/media/illustrations/zero-to-one-foundations.png");
      expect(parsed.data.steps[0].eli5?.estimatedMinutes).toBe(5);
    }

    const negativeCourse = CourseSchema.safeParse({
      ...course00,
      number: -1,
    });
    expect(negativeCourse.success).toBe(false);
  });

  it("LearnerProgressSchema and parseImportedProgress default legacy v1 JSON to learningDepthMode 'eli5', preserve 'pro', and reject invalid modes", () => {
    expect(createDefaultProgress("2026-11-25T00:00:00.000Z").learningDepthMode).toBe("eli5");

    // Legacy v1 payload missing learningDepthMode
    const legacyPayload = {
      schemaVersion: 1,
      completedStepIds: ["hm-1"],
      bookmarkedPromptIds: ["p-research"],
      promptVariableValues: {},
      activeHarnessMode: "code-factory-v3",
      updatedAt: "2026-11-24T10:00:00.000Z",
    };

    const schemaResult = LearnerProgressSchema.safeParse(legacyPayload);
    expect(schemaResult.success).toBe(true);
    if (schemaResult.success) {
      expect(schemaResult.data.learningDepthMode).toBe("eli5");
    }

    const importedLegacy = parseImportedProgress(JSON.stringify(legacyPayload));
    expect(importedLegacy.ok).toBe(true);
    if (importedLegacy.ok) {
      expect(importedLegacy.data.learningDepthMode).toBe("eli5");
      expect(importedLegacy.data.completedStepIds).toEqual(["hm-1"]);
    }

    // Legacy hydration through localStorage
    const store = new Map<string, string>();
    store.set(LEARNER_PROGRESS_STORAGE_KEY, JSON.stringify(legacyPayload));
    const hydratedFromStorage = loadLearnerProgress({
      getItem: (k: string) => store.get(k) ?? null,
    });
    expect(hydratedFromStorage.learningDepthMode).toBe("eli5");

    // Preserves explicit "pro" mode
    const proPayload = {
      ...legacyPayload,
      learningDepthMode: "pro" as const,
    };
    const importedPro = parseImportedProgress(JSON.stringify(proPayload));
    expect(importedPro.ok).toBe(true);
    if (importedPro.ok) {
      expect(importedPro.data.learningDepthMode).toBe("pro");
    }

    // Rejects invalid learningDepthMode strings
    const invalidModeSchema = LearnerProgressSchema.safeParse({
      ...legacyPayload,
      learningDepthMode: "expert",
    });
    expect(invalidModeSchema.success).toBe(false);

    const invalidModeImport = parseImportedProgress(
      JSON.stringify({
        ...legacyPayload,
        learningDepthMode: "senior-only",
      }),
    );
    expect(invalidModeImport.ok).toBe(false);
  });
});

describe("Pilot v2 optional ELI5 readability & discovery schema fields", () => {
  const validBaseEli5 = {
    everydayAnalogy: "A checklist taped next to the workbench",
    simpleExplanation: "Break work into small checked steps.",
    whyItMatters: "Small steps catch mistakes before they spread.",
    roleInProtocol: "Links daily tasks to automated verification.",
    howToUseGoingForward: "Run one step and check it off before moving on.",
    realWorldExample: "Checking luggage tags before boarding a flight.",
    audioScript: "Keep each coding task small, verifiable, and easy to follow.",
  };

  const validBasePrompt = {
    id: "p-pilot-v2",
    title: "Generate Locked Spec (cf-plan)",
    stage: "spec" as const,
    difficulty: "beginner" as const,
    skillRef: "cf-plan",
    description: "Turns requirements into a locked feature specification.",
    template: "Run cf-plan for {{feature_name}}.",
    variables: [
      {
        key: "feature_name",
        label: "Feature Name",
        placeholder: "checkout",
        defaultValue: "checkout",
      },
    ],
    expectedOutcome: "Creates plans/<feature>-spec.md",
  };

  const validBaseCourse = {
    id: "pilot-v2-course",
    slug: "pilot-v2-course",
    number: 0,
    title: "Foundations of Antigravity Engineering",
    subtitle: "Full technical overview of workspace tooling and safety gates.",
    level: "beginner" as const,
    estimatedMinutes: 25,
    threeScenePreset: "harness-constellation" as const,
    accentTone: "cyan" as const,
    tags: ["pilot-v2"],
    video: { title: "Intro", durationLabel: "04:00", provider: "coming_soon" as const },
    steps: [
      {
        id: "pv2-step-1",
        order: 1,
        title: "Deterministic Workspace Rules",
        stageTag: "Foundations",
        summary: "Configure static AGENTS.md guardrails and local verification.",
        keyTakeaways: ["Rules keep every session predictable."],
        actionChecklist: ["Review AGENTS.md."],
      },
    ],
  };

  it("validates optional Eli5ConceptBlock plainTitle, oneLineHook, and whenToUse including omission and length bounds", () => {
    const omitted = Eli5ConceptBlockSchema.safeParse(validBaseEli5);
    expect(omitted.success).toBe(true);
    if (omitted.success) {
      expect(omitted.data.plainTitle).toBeUndefined();
      expect(omitted.data.oneLineHook).toBeUndefined();
      expect(omitted.data.whenToUse).toBeUndefined();
    }

    const withPilotV2Fields = Eli5ConceptBlockSchema.safeParse({
      ...validBaseEli5,
      plainTitle: "How Rules Keep Your AI Helper On Track",
      oneLineHook: "Give your coding assistant a clear house-rules sheet so it never guesses.",
      whenToUse: "Whenever you start a new repo or notice the AI repeating the same mistake.",
    });
    expect(withPilotV2Fields.success).toBe(true);
    if (withPilotV2Fields.success) {
      expect(withPilotV2Fields.data.plainTitle).toBe("How Rules Keep Your AI Helper On Track");
      expect(withPilotV2Fields.data.oneLineHook).toBe(
        "Give your coding assistant a clear house-rules sheet so it never guesses.",
      );
      expect(withPilotV2Fields.data.whenToUse).toBe(
        "Whenever you start a new repo or notice the AI repeating the same mistake.",
      );
    }

    // Empty strings & max length boundary violations fail cleanly
    expect(Eli5ConceptBlockSchema.safeParse({ ...validBaseEli5, plainTitle: "" }).success).toBe(
      false,
    );
    expect(
      Eli5ConceptBlockSchema.safeParse({ ...validBaseEli5, plainTitle: "a".repeat(121) }).success,
    ).toBe(false);
    expect(Eli5ConceptBlockSchema.safeParse({ ...validBaseEli5, oneLineHook: "" }).success).toBe(
      false,
    );
    expect(
      Eli5ConceptBlockSchema.safeParse({ ...validBaseEli5, oneLineHook: "a".repeat(201) }).success,
    ).toBe(false);
    expect(Eli5ConceptBlockSchema.safeParse({ ...validBaseEli5, whenToUse: "" }).success).toBe(
      false,
    );
    expect(
      Eli5ConceptBlockSchema.safeParse({ ...validBaseEli5, whenToUse: "a".repeat(401) }).success,
    ).toBe(false);

    // Exact max boundaries pass
    expect(
      Eli5ConceptBlockSchema.safeParse({
        ...validBaseEli5,
        plainTitle: "a".repeat(120),
        oneLineHook: "b".repeat(200),
        whenToUse: "c".repeat(400),
      }).success,
    ).toBe(true);
  });

  it("validates optional PromptCard eli5Title and whenToUse including omission and length bounds", () => {
    const omitted = PromptCardSchema.safeParse(validBasePrompt);
    expect(omitted.success).toBe(true);
    if (omitted.success) {
      expect(omitted.data.eli5Title).toBeUndefined();
      expect(omitted.data.whenToUse).toBeUndefined();
    }

    const withPilotV2Fields = PromptCardSchema.safeParse({
      ...validBasePrompt,
      eli5Title: "Write a Clear Blueprint Before Coding",
      whenToUse: "Right before building any new feature so nothing gets forgotten mid-way.",
    });
    expect(withPilotV2Fields.success).toBe(true);
    if (withPilotV2Fields.success) {
      expect(withPilotV2Fields.data.eli5Title).toBe("Write a Clear Blueprint Before Coding");
      expect(withPilotV2Fields.data.whenToUse).toBe(
        "Right before building any new feature so nothing gets forgotten mid-way.",
      );
    }

    // Empty strings & max length violations rejected
    expect(PromptCardSchema.safeParse({ ...validBasePrompt, eli5Title: "" }).success).toBe(false);
    expect(
      PromptCardSchema.safeParse({ ...validBasePrompt, eli5Title: "x".repeat(121) }).success,
    ).toBe(false);
    expect(PromptCardSchema.safeParse({ ...validBasePrompt, whenToUse: "" }).success).toBe(false);
    expect(
      PromptCardSchema.safeParse({ ...validBasePrompt, whenToUse: "y".repeat(301) }).success,
    ).toBe(false);

    // Exact max boundaries pass
    expect(
      PromptCardSchema.safeParse({
        ...validBasePrompt,
        eli5Title: "x".repeat(120),
        whenToUse: "y".repeat(300),
      }).success,
    ).toBe(true);
  });

  it("validates optional Course.eli5Title alongside nested Pilot v2 step and prompt fields", () => {
    const omitted = CourseSchema.safeParse(validBaseCourse);
    expect(omitted.success).toBe(true);
    if (omitted.success) {
      expect(omitted.data.eli5Title).toBeUndefined();
    }

    const fullCourse = CourseSchema.safeParse({
      ...validBaseCourse,
      eli5Title: "Start From Zero: How AI Coding Works",
      steps: [
        {
          ...validBaseCourse.steps[0],
          eli5: {
            ...validBaseEli5,
            plainTitle: "Set Up Simple Guardrails",
            oneLineHook: "Write down project rules once so every run stays safe.",
            whenToUse: "At the start of any new codebase.",
          },
        },
      ],
      prompts: [
        {
          ...validBasePrompt,
          eli5Title: "Ask for a Step-by-Step Blueprint",
          whenToUse: "Before editing code files.",
        },
      ],
    });
    expect(fullCourse.success).toBe(true);
    if (fullCourse.success) {
      expect(fullCourse.data.eli5Title).toBe("Start From Zero: How AI Coding Works");
      expect(fullCourse.data.steps[0].eli5?.plainTitle).toBe("Set Up Simple Guardrails");
      expect(fullCourse.data.prompts[0].eli5Title).toBe("Ask for a Step-by-Step Blueprint");
    }

    // Empty & >140 chars rejected for Course.eli5Title
    expect(CourseSchema.safeParse({ ...validBaseCourse, eli5Title: "" }).success).toBe(false);
    expect(
      CourseSchema.safeParse({ ...validBaseCourse, eli5Title: "z".repeat(141) }).success,
    ).toBe(false);
    expect(
      CourseSchema.safeParse({ ...validBaseCourse, eli5Title: "z".repeat(140) }).success,
    ).toBe(true);
  });
});
