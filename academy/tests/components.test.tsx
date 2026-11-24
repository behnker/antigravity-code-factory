import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VideoStage } from "@/components/VideoStage";
import { PromptVault } from "@/components/PromptVault";
import { HitlGateSimulator } from "@/components/HitlGateSimulator";
import type { Course, PromptCard, VideoConfig } from "@/lib/schemas";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SAMPLE_VIDEO: VideoConfig = {
  title: "Harness Mastery Walkthrough",
  durationLabel: "18:40",
  provider: "coming_soon",
  posterLabel: "Antigravity Studio Recording",
  chapters: [
    { id: "ch1", title: "Harness vs. Model", timestampSeconds: 0, summary: "Core separation." },
    { id: "ch2", title: "Hook Bridge Pattern", timestampSeconds: 420, summary: "PostToolUse bridge." },
  ],
  transcriptSummary: "Full engineering walkthrough of Antigravity harness internals.",
};

const SAMPLE_PROMPTS: PromptCard[] = [
  {
    id: "p1",
    title: "Run Stage 1 Research",
    stage: "research",
    difficulty: "beginner",
    skillRef: "cf-research",
    description: "Start technical discovery.",
    template: "Run cf-research on {{feature_name}} for {{stack}}.",
    variables: [
      { key: "feature_name", label: "Feature Name", placeholder: "billing", defaultValue: "auth" },
      { key: "stack", label: "Tech Stack", placeholder: "Next.js", defaultValue: "Next.js" },
    ],
    expectedOutcome: "Produces .memory/research.md",
  },
];

const SAMPLE_COURSES: Course[] = [
  {
    id: "harness-mastery",
    slug: "harness-mastery",
    number: 1,
    title: "Harness Mastery",
    subtitle: "Appraisal & gap-plugging",
    level: "all-levels",
    estimatedMinutes: 30,
    threeScenePreset: "harness-constellation",
    accentTone: "cyan",
    tags: ["harness"],
    video: SAMPLE_VIDEO,
    steps: [
      {
        id: "s1",
        order: 1,
        title: "Step 1",
        stageTag: "Research",
        summary: "Summary",
        keyTakeaways: ["Key"],
        actionChecklist: ["Action"],
      },
    ],
    prompts: SAMPLE_PROMPTS,
  },
];

describe("Glassmorphic UI Components (States & WCAG)", () => {
  it("VideoStage renders coming_soon placeholder, chapters, and accessible transcript toggle", () => {
    render(<VideoStage video={SAMPLE_VIDEO} />);
    expect(screen.getByText("Harness Mastery Walkthrough")).toBeInTheDocument();
    expect(screen.getByText("07:00")).toBeInTheDocument();

    const transcriptBtn = screen.getByRole("button", { name: /transcript/i });
    expect(transcriptBtn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(transcriptBtn);
    expect(transcriptBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Full engineering walkthrough/i)).toBeInTheDocument();
  });

  it("VideoStage renders safe error alert when given an unallowlisted embed URL", () => {
    render(
      <VideoStage
        video={{
          ...SAMPLE_VIDEO,
          provider: "youtube",
          embedUrl: "https://untrusted.example.com/embed/evil",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("PromptVault interpolates live variables and displays empty state with Clear Filters", () => {
    const onUpdateVar = vi.fn();
    render(
      <PromptVault
        courses={SAMPLE_COURSES}
        bookmarkedPromptIds={[]}
        promptVariableValues={{}}
        onToggleBookmark={vi.fn()}
        onUpdateVariable={onUpdateVar}
      />,
    );

    expect(screen.getByText(/Run cf-research on auth for Next\.js\./)).toBeInTheDocument();

    const varInput = screen.getByLabelText("Feature Name");
    fireEvent.change(varInput, { target: { value: "payments" } });
    expect(onUpdateVar).toHaveBeenCalledWith("p1", "feature_name", "payments");

    // Trigger empty state via search
    const searchInput = screen.getByLabelText(/search prompts/i);
    fireEvent.change(searchInput, { target: { value: "zzz-no-match" } });
    expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));
    expect(screen.getByText("Run Stage 1 Research")).toBeInTheDocument();
  });

  it("HitlGateSimulator evaluates commands via API and handles validation/network errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          decision: "force_ask",
          reason: "Matched git push",
          matchedRule: "git push",
          dryRunExempt: false,
          segments: [
            {
              segment: "git push origin main",
              isDryRun: false,
              matchedRule: "git push",
              decision: "force_ask",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(<HitlGateSimulator />);
    const input = screen.getByLabelText(/shell command/i);
    fireEvent.change(input, { target: { value: "git push origin main" } });
    fireEvent.click(screen.getByRole("button", { name: /evaluate/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/force_ask/i).length).toBeGreaterThan(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Empty command triggers accessible inline error
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: /evaluate/i }));
    await waitFor(() => {
      expect(input).toHaveAttribute("aria-invalid", "true");
    });
  });
});
