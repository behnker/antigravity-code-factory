import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  CourseIllustrationSchema,
  CourseSchema,
  DomainCaseStudySchema,
  Eli5ConceptBlockSchema,
  HarnessDimensionSchema,
  LearnerProgressSchema,
  PromptCardSchema,
  ProofArtifactSchema,
  ProofGallerySchema,
  VideoConfigSchema,
  isAllowedAudioUrl,
  isAllowedImageUrl,
  isAllowedLiveUrl,
  isAllowedProofImageUrl,
  isAllowedVideoUrl,
  type Course,
  type LessonStep,
  type PromptCard,
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
import { FOUR_DOMAIN_CASES } from "@/data/four-domain-cases";

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

describe("Course 08 Proof Gallery & 4-Domain Case Study URL allowlists & schemas", () => {
  it("isAllowedProofImageUrl allows /media/proof-pack/<slug>/<file>.(png|webp|jpg|jpeg|svg) and blocks traversal, remote, javascript:, wrong dirs, and invalid extensions", () => {
    expect(isAllowedProofImageUrl("/media/proof-pack/gt-alpaca/hero-1440px.png")).toBe(true);
    expect(isAllowedProofImageUrl("/media/proof-pack/gt-alpaca/tokens_wcag.webp")).toBe(true);
    expect(isAllowedProofImageUrl("/media/proof-pack/site-01/frame.jpg")).toBe(true);
    expect(isAllowedProofImageUrl("/media/proof-pack/site-01/frame.jpeg")).toBe(true);
    expect(isAllowedProofImageUrl("/media/proof-pack/site-01/diagram.svg")).toBe(true);

    // Reject traversal, remote hosts, script/data URIs, wrong directories, bad extensions, empty
    expect(isAllowedProofImageUrl("/media/proof-pack/gt-alpaca/../secret.png")).toBe(false);
    expect(isAllowedProofImageUrl("/media/proof-pack/../gt-alpaca/hero.png")).toBe(false);
    expect(isAllowedProofImageUrl("https://cdn.example.com/media/proof-pack/gt-alpaca/hero.png")).toBe(false);
    expect(isAllowedProofImageUrl("http://localhost:3000/media/proof-pack/gt-alpaca/hero.png")).toBe(false);
    expect(isAllowedProofImageUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedProofImageUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isAllowedProofImageUrl("/media/illustrations/hero-1440px.png")).toBe(false);
    expect(isAllowedProofImageUrl("/media/proof-pack/hero-1440px.png")).toBe(false);
    expect(isAllowedProofImageUrl("/media/proof-pack/gt-alpaca/nested/hero.png")).toBe(false);
    expect(isAllowedProofImageUrl("/media/proof-pack/GT-Alpaca/hero.png")).toBe(false);
    expect(isAllowedProofImageUrl("/media/proof-pack/gt-alpaca/hero.gif")).toBe(false);
    expect(isAllowedProofImageUrl("/media/proof-pack/gt-alpaca/hero.html")).toBe(false);
    expect(isAllowedProofImageUrl("")).toBe(false);
  });

  it("isAllowedLiveUrl accepts strictly https:// origins and rejects http://, javascript:, whitespace, and embedded credentials", () => {
    expect(isAllowedLiveUrl("https://www.alpacas-ibiza.app")).toBe(true);
    expect(isAllowedLiveUrl("https://antigravity-academy-ten.vercel.app")).toBe(true);
    expect(isAllowedLiveUrl("https://www.alpacas-ibiza.app/game?mode=preview")).toBe(true);

    expect(isAllowedLiveUrl("http://www.alpacas-ibiza.app")).toBe(false);
    expect(isAllowedLiveUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedLiveUrl("https://www.alpacas-ibiza.app/my page")).toBe(false);
    expect(isAllowedLiveUrl(" https://www.alpacas-ibiza.app")).toBe(false);
    expect(isAllowedLiveUrl("https://user:pass@www.alpacas-ibiza.app")).toBe(false);
    expect(isAllowedLiveUrl("https://token@www.alpacas-ibiza.app")).toBe(false);
    expect(isAllowedLiveUrl("")).toBe(false);
    expect(isAllowedLiveUrl("not-a-url")).toBe(false);
    expect(isAllowedLiveUrl(`https://example.com/${"a".repeat(490)}`)).toBe(false);
  });

  it("validates ProofGallerySchema and requires accessible alt text whenever imageSrc is provided", () => {
    const validGallery = {
      title: "GT-Alpaca Proof #03 — Tokens & GLB",
      summary: "Verified real compilation and GLB reduction metrics.",
      pipelinePhase: "Stage 2 · Verified",
      skillsUsed: ["cf-design-tokens", "cf-threejs-craft"],
      promptsVerified: ["vwf-prompt-design-tokens"],
      metrics: [
        {
          label: "GLB Size",
          before: "4.52 MB",
          after: "852 KB (-81.57%)",
          status: "pass" as const,
        },
        {
          label: "Visual Capture",
          after: "Pending Step 4B",
          status: "info" as const,
        },
      ],
      artifacts: [
        {
          id: "gt-alpaca-hero-1440",
          label: "Desktop 1440px Hero",
          imageSrc: "/media/proof-pack/gt-alpaca/hero-1440px.png",
          alt: "Desktop hero showing Avalon 3D alpaca model and sunlit Ibiza palette",
          caption: "Verified 1440px desktop screenshot with 0px overflow.",
          command: "pnpm run verify:map",
        },
        {
          id: "gt-alpaca-cli-slot",
          label: "CLI Log Proof",
          caption: "Pending visual capture with CLI excerpt attached.",
          cliExcerpt: "6 passed, 0 failed",
        },
      ],
      liveUrl: "https://www.alpacas-ibiza.app",
    };

    const parsed = ProofGallerySchema.safeParse(validGallery);
    expect(parsed.success).toBe(true);

    // Missing alt when imageSrc is provided must fail with alt path
    const missingAlt = ProofArtifactSchema.safeParse({
      id: "missing-alt-artifact",
      label: "Missing Alt",
      imageSrc: "/media/proof-pack/gt-alpaca/hero-1440px.png",
      caption: "Should fail because alt is omitted.",
    });
    expect(missingAlt.success).toBe(false);
    if (!missingAlt.success) {
      expect(missingAlt.error.issues.some((issue) => issue.path.includes("alt"))).toBe(true);
    }

    // Disallowed imageSrc & liveUrl & empty artifacts fail cleanly
    expect(
      ProofGallerySchema.safeParse({
        ...validGallery,
        liveUrl: "http://www.alpacas-ibiza.app",
      }).success,
    ).toBe(false);
    expect(
      ProofGallerySchema.safeParse({
        ...validGallery,
        liveUrl: "https://..",
      }).success,
    ).toBe(false);
    expect(
      ProofGallerySchema.safeParse({
        ...validGallery,
        artifacts: [
          {
            id: "bad-img",
            label: "Bad Img",
            imageSrc: "https://evil.example.com/shot.png",
            alt: "Blocked",
            caption: "Should fail",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      ProofGallerySchema.safeParse({
        ...validGallery,
        artifacts: [],
      }).success,
    ).toBe(false);
  });

  it("validates DomainCaseStudySchema happy path and rejects invalid domain ids, order bounds, and unsafe liveUrl", () => {
    const validDomain = {
      id: "website" as const,
      order: 1,
      domainLabel: "Website",
      title: "The Herd of Ibiza: GT-Alpaca",
      eli5Title: "Interactive 3D Game Showcase Website",
      repoName: "gt-alpaca-website",
      status: "shipped" as const,
      accentTone: "amber" as const,
      summary: "Next.js App Router flagship site built with cf-website-factory.",
      eli5Summary: "A fast, sunlit 3D website that loads smoothly on phones.",
      stack: ["Next.js App Router", "Tailwind CSS v4"],
      skillsApplied: ["cf-website-factory", "cf-design-tokens"],
      verifiedMetrics: [
        { label: "GLB Compression", value: "81.57%" },
        { label: "WCAG AA Tokens", value: "12/12 >= 4.5:1" },
      ],
      proofArtifactPath: "gt-alpaca-website/proof-pack/03-tokens-and-glb.json",
      liveUrl: "https://www.alpacas-ibiza.app",
      linkedCourseSlug: "vibe-website-factory",
      linkedCourseNumber: 8,
    };

    expect(DomainCaseStudySchema.safeParse(validDomain).success).toBe(true);
    expect(
      DomainCaseStudySchema.safeParse({ ...validDomain, liveUrl: undefined, status: "in-progress" })
        .success,
    ).toBe(true);

    expect(DomainCaseStudySchema.safeParse({ ...validDomain, id: "mobile" }).success).toBe(false);
    expect(DomainCaseStudySchema.safeParse({ ...validDomain, order: 0 }).success).toBe(false);
    expect(DomainCaseStudySchema.safeParse({ ...validDomain, order: 5 }).success).toBe(false);
    expect(
      DomainCaseStudySchema.safeParse({ ...validDomain, liveUrl: "http://insecure.example.com" })
        .success,
    ).toBe(false);
    expect(
      DomainCaseStudySchema.safeParse({ ...validDomain, linkedCourseSlug: "INVALID SLUG" }).success,
    ).toBe(false);
    expect(DomainCaseStudySchema.safeParse({ ...validDomain, stack: ["OnlyOne"] }).success).toBe(
      false,
    );
    expect(
      DomainCaseStudySchema.safeParse({
        ...validDomain,
        verifiedMetrics: [{ label: "OnlyOne", value: "1" }],
      }).success,
    ).toBe(false);
  });
});

describe("Filesystem-Backed 19/19 Skill Traceability & 4-Domain Regression Gate (Spec §5.3)", () => {
  const REPO_SKILLS_DIR = path.resolve(__dirname, "../../skills");
  const COURSES_DIR = path.resolve(__dirname, "../content/courses");

  function loadAllCoursesFromDisk(): Course[] {
    const entries = fs.readdirSync(COURSES_DIR, { withFileTypes: true });
    const parsedCourses: Course[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const courseFile = path.join(COURSES_DIR, entry.name, "course.json");
      if (!fs.existsSync(courseFile)) continue;
      const rawJson = JSON.parse(fs.readFileSync(courseFile, "utf8")) as unknown;
      parsedCourses.push(CourseSchema.parse(rawJson));
    }
    return parsedCourses.sort((a, b) => a.number - b.number);
  }

  function stepReferencesSkill(
    step: LessonStep,
    skillSlug: string,
    promptById: ReadonlyMap<string, PromptCard>,
  ): boolean {
    if (step.repoArtifactPath?.includes(skillSlug)) return true;

    const linkedPrompt = step.promptId ? promptById.get(step.promptId) : undefined;
    if (linkedPrompt?.skillRef) {
      const tokens = linkedPrompt.skillRef
        .split("+")
        .map((part) => part.trim())
        .filter(Boolean);
      if (linkedPrompt.skillRef === skillSlug || tokens.includes(skillSlug)) {
        return true;
      }
    }

    if (step.proofGallery) {
      if (step.proofGallery.skillsUsed.includes(skillSlug)) return true;
      if (step.proofGallery.title.includes(skillSlug)) return true;
      if (step.proofGallery.summary.includes(skillSlug)) return true;
    }

    const textFields: Array<string | undefined> = [
      step.title,
      step.summary,
      ...step.keyTakeaways,
      ...step.actionChecklist,
      step.codeSnippet?.filename,
      step.codeSnippet?.code,
      ...(step.additionalCodeSnippets?.flatMap((s) => [s.filename, s.code]) ?? []),
      step.eli5?.plainTitle,
      step.eli5?.oneLineHook,
      step.eli5?.simpleExplanation,
      step.eli5?.whyItMatters,
      step.eli5?.roleInProtocol,
      step.eli5?.howToUseGoingForward,
      step.eli5?.whenToUse,
      step.eli5?.realWorldExample,
    ];

    return textFields.some((field) => typeof field === "string" && field.includes(skillSlug));
  }

  it("enforces 100% (19/19) standalone Prompt Vault + Curriculum step traceability and valid step.promptId resolution across all 9 courses", () => {
    const discoveredSkills = fs
      .readdirSync(REPO_SKILLS_DIR, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          entry.name.startsWith("cf-") &&
          fs.existsSync(path.join(REPO_SKILLS_DIR, entry.name, "SKILL.md")),
      )
      .map((entry) => entry.name)
      .sort();

    expect(discoveredSkills.length).toBeGreaterThanOrEqual(19);
    expect(discoveredSkills).toHaveLength(19);

    const courses = loadAllCoursesFromDisk();
    expect(courses.length).toBeGreaterThanOrEqual(9);
    expect(courses.map((c) => c.number)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);

    const allPrompts = courses.flatMap((course) => course.prompts);
    const promptById = new Map<string, PromptCard>();
    for (const prompt of allPrompts) {
      expect(
        promptById.has(prompt.id),
        `Duplicate prompt.id detected across courses: ${prompt.id}`,
      ).toBe(false);
      promptById.set(prompt.id, prompt);
    }

    const allSteps = courses.flatMap((course) =>
      course.steps.map((step) => ({ courseSlug: course.slug, step })),
    );

    // 3. Every defined step.promptId across all 9 courses must resolve to a real PromptCard.id
    for (const { courseSlug, step } of allSteps) {
      if (step.promptId) {
        expect(
          promptById.has(step.promptId),
          `Broken step.promptId "${step.promptId}" on ${courseSlug}/${step.id}`,
        ).toBe(true);
      }
    }

    // 1 & 2. Every discovered skill has a standalone PromptCard (skillRef === skillSlug) and >= 1 LessonStep
    for (const skillSlug of discoveredSkills) {
      const standalonePrompts = allPrompts.filter((prompt) => prompt.skillRef === skillSlug);
      expect(
        standalonePrompts.length,
        `Skill "${skillSlug}" is missing a standalone PromptCard (exact skillRef === "${skillSlug}")`,
      ).toBeGreaterThanOrEqual(1);

      const tokenizedPrompts = allPrompts.filter((prompt) =>
        (prompt.skillRef ?? "")
          .split("+")
          .map((token) => token.trim())
          .includes(skillSlug),
      );
      expect(
        tokenizedPrompts.length,
        `Skill "${skillSlug}" missing from tokenized skillRef membership`,
      ).toBeGreaterThanOrEqual(1);

      const referencingSteps = allSteps.filter(({ step }) =>
        stepReferencesSkill(step, skillSlug, promptById),
      );
      expect(
        referencingSteps.length,
        `Skill "${skillSlug}" is not explicitly referenced by any LessonStep across all 9 courses`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("validates FOUR_DOMAIN_CASES against DomainCaseStudySchema[4], canonical IDs/order, https:// liveUrls, and real linkedCourseSlugs", () => {
    const parsedCases = z.array(DomainCaseStudySchema).length(4).parse(FOUR_DOMAIN_CASES);
    expect(parsedCases.map((c) => c.id)).toEqual(["website", "game", "video", "harness"]);
    expect(parsedCases.map((c) => c.order)).toEqual([1, 2, 3, 4]);

    const courses = loadAllCoursesFromDisk();
    const courseBySlug = new Map(courses.map((course) => [course.slug, course]));

    for (const domain of parsedCases) {
      if (domain.liveUrl !== undefined) {
        expect(
          isAllowedLiveUrl(domain.liveUrl),
          `Domain "${domain.id}" has invalid liveUrl: ${domain.liveUrl}`,
        ).toBe(true);
      }

      if (domain.linkedCourseSlug !== undefined) {
        const matchedCourse = courseBySlug.get(domain.linkedCourseSlug);
        expect(
          matchedCourse,
          `Domain "${domain.id}" references unknown linkedCourseSlug "${domain.linkedCourseSlug}"`,
        ).toBeDefined();
        if (domain.linkedCourseNumber !== undefined && matchedCourse) {
          expect(domain.linkedCourseNumber).toBe(matchedCourse.number);
        }
      }
    }
  });
});
