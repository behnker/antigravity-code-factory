import { describe, expect, it } from "vitest";
import {
  CourseSchema,
  HarnessDimensionSchema,
  VideoConfigSchema,
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
