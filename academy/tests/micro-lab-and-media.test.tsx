import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InteractiveMicroLab } from "@/components/InteractiveMicroLab";
import { VideoStage } from "@/components/VideoStage";
import {
  classifyWcagContrast,
  computeContrastRatio,
  evaluateContextBudget,
  evaluateLoopAutonomy,
  evaluateScenarioDrill,
  evaluateSwarmPartition,
  evaluateWebsiteFactoryLab,
  findActiveChapterForTime,
  parseHexColor,
} from "@/lib/micro-lab-engine";
import {
  createDefaultProgress,
  parseImportedProgress,
} from "@/lib/prompt-engine";
import {
  CourseSchema,
  type ContextBudgetLab,
  type LoopAutonomyLab,
  type ScenarioDrillLab,
  type SwarmPartitionLab,
  type WebsiteFactoryLab,
} from "@/lib/schemas";

const COURSES_ROOT = path.resolve(process.cwd(), "content", "courses");
const PUBLIC_ROOT = path.resolve(process.cwd(), "public");

function loadAllCourseBundles() {
  return fs
    .readdirSync(COURSES_ROOT)
    .map((slug) => {
      const jsonPath = path.join(COURSES_ROOT, slug, "course.json");
      if (!fs.existsSync(jsonPath)) return null;
      return CourseSchema.parse(JSON.parse(fs.readFileSync(jsonPath, "utf8")));
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => a.number - b.number);
}

describe("micro-lab-engine pure functions", () => {
  it("computes W3C sRGB contrast ratios and WCAG grades accurately", () => {
    expect(parseHexColor("invalid")).toBeNull();
    expect(computeContrastRatio("bad", "#ffffff")).toBe(1);

    // Real GT-Alpaca Pass 1 fail vs Pass 2 AAA pass
    const pass1Fail = computeContrastRatio("#0F5E57", "#140F0D");
    expect(pass1Fail).toBeLessThan(4.5);
    expect(classifyWcagContrast(pass1Fail)).toBe("FAIL");

    const pass2Dark = computeContrastRatio("#6EE7D8", "#140F0D");
    expect(pass2Dark).toBeGreaterThanOrEqual(7);
    expect(classifyWcagContrast(pass2Dark)).toBe("AAA");

    expect(classifyWcagContrast(5.2)).toBe("AA");
  });

  it("finds the active video chapter deterministically from currentTime", () => {
    const chapters = [
      { id: "c1", title: "Ch 1", timestampSeconds: 0, summary: "Start" },
      { id: "c2", title: "Ch 2", timestampSeconds: 5, summary: "Mid" },
      { id: "c3", title: "Ch 3", timestampSeconds: 12, summary: "End" },
    ];
    expect(findActiveChapterForTime([], 5)).toBeNull();
    expect(findActiveChapterForTime(chapters, -1)?.id).toBe("c1");
    expect(findActiveChapterForTime(chapters, 4.2)?.id).toBe("c1");
    expect(findActiveChapterForTime(chapters, 5.0)?.id).toBe("c2");
    expect(findActiveChapterForTime(chapters, 14.5)?.id).toBe("c3");
  });

  it("evaluates scenario-drill, context-budget, loop-autonomy, swarm-partition, and website-factory labs", () => {
    const courses = loadAllCourseBundles();

    // Scenario drill (Course 00)
    const c00Lab = courses.find((c) => c.number === 0)?.microLab as ScenarioDrillLab;
    expect(c00Lab.kind).toBe("scenario-drill");
    expect(evaluateScenarioDrill(c00Lab, {}).passed).toBe(false);
    const allCorrect = Object.fromEntries(
      c00Lab.scenarios.map((s) => [
        s.id,
        s.options.find((o) => o.isCorrect)!.id,
      ]),
    );
    expect(evaluateScenarioDrill(c00Lab, allCorrect).passed).toBe(true);

    // Context budget (Course 03)
    const c03Lab = courses.find((c) => c.number === 3)?.microLab as ContextBudgetLab;
    expect(c03Lab.kind).toBe("context-budget");
    expect(evaluateContextBudget(c03Lab, {}).passed).toBe(false);
    const optimalPlacements = Object.fromEntries(
      c03Lab.modules.map((m) => [m.id, m.recommendedPlacement]),
    );
    const budgetEval = evaluateContextBudget(c03Lab, optimalPlacements);
    expect(budgetEval.withinBudget).toBe(true);
    expect(budgetEval.passed).toBe(true);

    // Loop autonomy (Course 04)
    const c04Lab = courses.find((c) => c.number === 4)?.microLab as LoopAutonomyLab;
    expect(c04Lab.kind).toBe("loop-autonomy");
    expect(evaluateLoopAutonomy(c04Lab, {}, 7, false).verdict).toBe("dark-factory-risk");
    const optimalModes = Object.fromEntries(
      c04Lab.tasks.map((t) => [t.id, t.expectedMode]),
    );
    const loopEval = evaluateLoopAutonomy(c04Lab, optimalModes, 4, true);
    expect(loopEval.verdict).toBe("lit-factory");
    expect(loopEval.passed).toBe(true);

    // Swarm partition (Course 07)
    const c07Lab = courses.find((c) => c.number === 7)?.microLab as SwarmPartitionLab;
    expect(c07Lab.kind).toBe("swarm-partition");
    expect(evaluateSwarmPartition(c07Lab, {}).collisionPaths.length).toBeGreaterThan(0);
    const cleanOwners = Object.fromEntries(
      c07Lab.files.map((f) => [f.id, [f.recommendedWorker]]),
    );
    expect(evaluateSwarmPartition(c07Lab, cleanOwners).passed).toBe(true);

    // Website factory lab (Course 08)
    const c08Lab = courses.find((c) => c.number === 8)?.microLab as WebsiteFactoryLab;
    expect(c08Lab.kind).toBe("website-factory-lab");
    expect(
      evaluateWebsiteFactoryLab(c08Lab, "pass1-dark-fail", [], ["ssr-h1-copy"]).passed,
    ).toBe(false);
    const passEval = evaluateWebsiteFactoryLab(
      c08Lab,
      "pass2-dark-aaa",
      c08Lab.glbOptimizations.map((o) => o.id),
      c08Lab.geoChecks.map((g) => g.id),
    );
    expect(passEval.contrastPass).toBe(true);
    expect(passEval.glbPass).toBe(true);
    expect(passEval.geoPass).toBe(true);
    expect(passEval.passed).toBe(true);
  });
});

describe("LearnerProgress backwards compatibility for completedLabIds", () => {
  it("defaults completedLabIds to [] when importing pre-v3.0.1 progress JSON", () => {
    const legacyJson = JSON.stringify({
      schemaVersion: 1,
      completedStepIds: ["step-1"],
      bookmarkedPromptIds: [],
      promptVariableValues: {},
      activeHarnessMode: "code-factory-v3",
      learningDepthMode: "eli5",
      updatedAt: "2026-11-24T00:00:00.000Z",
    });
    const imported = parseImportedProgress(legacyJson);
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.data.completedLabIds).toEqual([]);
    }
    expect(createDefaultProgress("2026-11-26T00:00:00.000Z").completedLabIds).toEqual([]);
  });
});

describe("VideoStage poster & live timeupdate chapter sync", () => {
  it("renders allowlisted poster image and syncs active chapter on timeupdate", () => {
    render(
      <VideoStage
        video={{
          title: "Test Course Explainer",
          durationLabel: "00:24",
          provider: "mp4",
          embedUrl: "/media/zero-to-one-foundations-explainer.mp4",
          posterSrc: "/media/illustrations/zero-to-one-foundations-studio.jpg",
          chapters: [
            { id: "ch1", title: "Chapter One", timestampSeconds: 0, summary: "First" },
            { id: "ch2", title: "Chapter Two", timestampSeconds: 10, summary: "Second" },
          ],
        }}
      />,
    );

    const videoEl = screen.getByTestId("video-player") as HTMLVideoElement;
    expect(videoEl.getAttribute("poster")).toBe(
      "/media/illustrations/zero-to-one-foundations-studio.jpg",
    );

    const ch2Btn = screen.getByRole("button", { name: /Chapter Two/i });
    expect(ch2Btn.getAttribute("aria-current")).toBeNull();

    Object.defineProperty(videoEl, "currentTime", {
      writable: true,
      value: 11.2,
    });
    fireEvent.timeUpdate(videoEl);
    expect(ch2Btn.getAttribute("aria-current")).toBe("true");
  });
});

describe("InteractiveMicroLab UI rendering & completion persistence", () => {
  it("completes ScenarioDrill, ContextBudget, LoopAutonomy, SwarmPartition, and WebsiteFactory labs interactively", () => {
    const courses = loadAllCourseBundles();

    // 1. Scenario drill (Course 00)
    const onComplete0 = vi.fn();
    const lab0 = courses.find((c) => c.number === 0)!.microLab as ScenarioDrillLab;
    const { unmount: unmount0 } = render(
      <InteractiveMicroLab
        lab={lab0}
        learningDepthMode="eli5"
        isCompleted={false}
        onMarkComplete={onComplete0}
      />,
    );
    for (const s of lab0.scenarios) {
      const correct = s.options.find((o) => o.isCorrect)!;
      fireEvent.click(screen.getByRole("button", { name: correct.label }));
    }
    expect(onComplete0).toHaveBeenCalledWith(lab0.id);
    fireEvent.click(screen.getByRole("button", { name: /Reset Lab/i }));
    unmount0();

    // 2. Context budget (Course 03)
    const onComplete3 = vi.fn();
    const lab3 = courses.find((c) => c.number === 3)!.microLab as ContextBudgetLab;
    const { unmount: unmount3 } = render(
      <InteractiveMicroLab
        lab={lab3}
        learningDepthMode="pro"
        isCompleted={false}
        onMarkComplete={onComplete3}
      />,
    );
    const skillButtons = screen.getAllByRole("button", { name: "Skill (On-Demand)" });
    fireEvent.click(skillButtons[3]);
    fireEvent.click(skillButtons[4]);
    expect(onComplete3).toHaveBeenCalledWith(lab3.id);
    unmount3();

    // 3. Loop autonomy (Course 04)
    const onComplete4 = vi.fn();
    const lab4 = courses.find((c) => c.number === 4)!.microLab as LoopAutonomyLab;
    const { unmount: unmount4 } = render(
      <InteractiveMicroLab
        lab={lab4}
        learningDepthMode="pro"
        isCompleted={false}
        onMarkComplete={onComplete4}
      />,
    );
    fireEvent.change(screen.getByLabelText("Active Concurrent Loops"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Self-Graded/i }));
    const humanLitButtons = screen.getAllByRole("button", { name: "Human-Lit" });
    const lightsOutButtons = screen.getAllByRole("button", { name: "Lights-Out" });
    fireEvent.click(humanLitButtons[1]);
    fireEvent.click(lightsOutButtons[2]);
    fireEvent.click(humanLitButtons[3]);
    expect(onComplete4).toHaveBeenCalledWith(lab4.id);
    unmount4();

    // 4. Swarm partition (Course 07)
    const onComplete7 = vi.fn();
    const lab7 = courses.find((c) => c.number === 7)!.microLab as SwarmPartitionLab;
    const { unmount: unmount7 } = render(
      <InteractiveMicroLab
        lab={lab7}
        learningDepthMode="pro"
        isCompleted={false}
        onMarkComplete={onComplete7}
      />,
    );
    const frontendButtons = screen.getAllByRole("button", { name: "@frontend" });
    const verifierButtons = screen.getAllByRole("button", { name: "@verifier" });
    fireEvent.click(frontendButtons[0]); // remove collision on schemas.ts
    fireEvent.click(verifierButtons[2]); // remove verifier write on InteractiveMicroLab.tsx
    expect(onComplete7).toHaveBeenCalledWith(lab7.id);
    unmount7();

    // 5. Website factory lab (Course 08)
    const onComplete8 = vi.fn();
    const lab8 = courses.find((c) => c.number === 8)!.microLab as WebsiteFactoryLab;
    const { unmount: unmount8 } = render(
      <InteractiveMicroLab
        lab={lab8}
        learningDepthMode="pro"
        isCompleted={false}
        onMarkComplete={onComplete8}
      />,
    );
    expect(screen.getByTestId("wcag-ratio-badge").textContent).toContain("FAIL");
    fireEvent.click(screen.getByRole("button", { name: /Pass 2 SHIP · Dark primary-text/i }));
    fireEvent.click(screen.getByRole("button", { name: /Meshopt/i }));
    fireEvent.click(screen.getByRole("button", { name: /1024px WebP/i }));
    fireEvent.click(screen.getByRole("button", { name: /Connected JSON-LD/i }));
    fireEvent.click(screen.getByRole("button", { name: /Permissive AI robots\.txt/i }));
    expect(onComplete8).toHaveBeenCalledWith(lab8.id);
    unmount8();
  });
});

describe("All 9 Course Bundles — MP4 Media Assets & Micro-Lab Coverage", () => {
  it("verifies all 9 courses have playable MP4 files and posters on disk, and Courses 00–05, 07, 08 include Micro-Labs", () => {
    const courses = loadAllCourseBundles();
    expect(courses).toHaveLength(9);

    for (const course of courses) {
      expect(course.video.provider).toBe("mp4");
      expect(course.video.embedUrl).toBeTruthy();
      expect(course.video.posterSrc).toBeTruthy();

      const mp4DiskPath = path.join(
        PUBLIC_ROOT,
        course.video.embedUrl!.replace(/^\//, ""),
      );
      const posterDiskPath = path.join(
        PUBLIC_ROOT,
        course.video.posterSrc!.replace(/^\//, ""),
      );
      expect(fs.existsSync(mp4DiskPath)).toBe(true);
      expect(fs.statSync(mp4DiskPath).size).toBeGreaterThan(50_000);
      expect(fs.existsSync(posterDiskPath)).toBe(true);

      // Monotonic chapter timestamps
      for (let i = 1; i < course.video.chapters.length; i += 1) {
        expect(course.video.chapters[i].timestampSeconds).toBeGreaterThanOrEqual(
          course.video.chapters[i - 1].timestampSeconds,
        );
      }

      if (course.number !== 6) {
        expect(course.microLab).toBeDefined();
      }
    }
  });
});
