import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AntigravityArchitectureExplorer } from "@/components/AntigravityArchitectureExplorer";
import { AudioExplainerBar } from "@/components/AudioExplainerBar";
import { CourseCurriculumStudio } from "@/components/CourseCurriculumStudio";
import {
  CourseEmblem,
  getCourseVisualTheme,
  type CourseEmblemSize,
} from "@/components/CourseEmblem";
import { CourseIllustrationBanner } from "@/components/CourseIllustrationBanner";
import { Eli5MicrolearningCard } from "@/components/Eli5MicrolearningCard";
import { FourDomainShowcase } from "@/components/FourDomainShowcase";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { ProofGalleryPanel } from "@/components/ProofGalleryPanel";
import { RepoResourceExplorer } from "@/components/RepoResourceExplorer";
import { VideoStage } from "@/components/VideoStage";
import { PromptVault } from "@/components/PromptVault";
import { HitlGateSimulator } from "@/components/HitlGateSimulator";
import { FOUR_DOMAIN_CASES } from "@/data/four-domain-cases";
import {
  ANTIGRAVITY_AGENT_MODES,
  ANTIGRAVITY_BUILDING_BLOCKS,
  ANTIGRAVITY_STEERING_COMMANDS,
} from "@/lib/contracts";
import { createDefaultProgress } from "@/lib/prompt-engine";
import type {
  Course,
  CourseIllustration,
  DomainCaseStudy,
  Eli5ConceptBlock,
  LessonStep,
  PromptCard,
  ProofGallery,
  RepoResource,
  VideoConfig,
} from "@/lib/schemas";

const mermaidInitializeMock = vi.fn();
const mermaidRenderMock = vi.fn();

vi.mock("mermaid", () => ({
  default: {
    initialize: (...args: unknown[]) => mermaidInitializeMock(...args),
    render: (...args: unknown[]) => mermaidRenderMock(...args),
  },
}));

const originalSpeechSynthesisDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "speechSynthesis",
);
const originalSpeechUtteranceDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "SpeechSynthesisUtterance",
);

function restoreSpeechGlobals() {
  if (originalSpeechSynthesisDescriptor) {
    Object.defineProperty(window, "speechSynthesis", originalSpeechSynthesisDescriptor);
  } else {
    Reflect.deleteProperty(window, "speechSynthesis");
  }

  if (originalSpeechUtteranceDescriptor) {
    Object.defineProperty(
      globalThis,
      "SpeechSynthesisUtterance",
      originalSpeechUtteranceDescriptor,
    );
  } else {
    Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
  }
}

afterEach(() => {
  cleanup();
  restoreSpeechGlobals();
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

  it("HitlGateSimulator supports git status and curl presets, renders overwrite diff badge, and emits top-level PreToolUse JSON contract", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            decision: "allow",
            reason:
              "No high-impact pattern matched; command is allowed under standard Antigravity sandbox policies.",
            matchedRule: null,
            dryRunExempt: false,
            segments: [
              {
                segment: "git status",
                isDryRun: false,
                matchedRule: null,
                decision: "allow",
              },
            ],
            overwrite: { CommandLine: "git --no-pager status" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            decision: "allow",
            reason:
              "No high-impact pattern matched; command is allowed under standard Antigravity sandbox policies.",
            matchedRule: null,
            dryRunExempt: false,
            segments: [
              {
                segment: "curl -s https://example.com",
                isDryRun: false,
                matchedRule: null,
                decision: "allow",
              },
            ],
            overwrite: { CommandLine: "curl --max-time 5 -s https://example.com" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
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

    const { container } = render(<HitlGateSimulator />);

    const gitPresetBtn = screen.getByRole("button", { name: "git status" });
    const curlPresetBtn = screen.getByRole("button", {
      name: "curl -s https://example.com",
    });
    expect(gitPresetBtn).toBeInTheDocument();
    expect(curlPresetBtn).toBeInTheDocument();

    // 1. Click "git status" preset -> verify overwrite badge, diff status card, and top-level JSON contract
    fireEvent.click(gitPresetBtn);
    await waitFor(() => {
      expect(screen.getByText("overwrite applied")).toBeInTheDocument();
    });

    const gitDiffStatus = screen.getByRole("status", {
      name: "PreToolUse command overwrite diff",
    });
    expect(within(gitDiffStatus).getByText("git status")).toBeInTheDocument();
    expect(within(gitDiffStatus).getByText("git --no-pager status")).toBeInTheDocument();

    const preEl = container.querySelector("pre code");
    expect(preEl).not.toBeNull();
    const parsedGitContract = JSON.parse(preEl!.textContent ?? "{}");
    expect(parsedGitContract).toEqual({
      decision: "allow",
      overwrite: { CommandLine: "git --no-pager status" },
    });
    expect("reason" in parsedGitContract).toBe(false);
    expect("hookSpecificOutput" in parsedGitContract).toBe(false);

    // 2. Click "curl -s https://example.com" preset -> verify curl overwrite diff & top-level JSON
    fireEvent.click(curlPresetBtn);
    await waitFor(() => {
      expect(
        within(
          screen.getByRole("status", {
            name: "PreToolUse command overwrite diff",
          }),
        ).getByText("curl --max-time 5 -s https://example.com"),
      ).toBeInTheDocument();
    });

    const parsedCurlContract = JSON.parse(
      container.querySelector("pre code")?.textContent ?? "{}",
    );
    expect(parsedCurlContract).toEqual({
      decision: "allow",
      overwrite: { CommandLine: "curl --max-time 5 -s https://example.com" },
    });

    // 3. Click "git push origin main" preset -> no overwrite badge, top-level { decision, reason } JSON
    fireEvent.click(screen.getByRole("button", { name: "git push origin main" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("status", {
          name: "PreToolUse command overwrite diff",
        }),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText("overwrite applied")).not.toBeInTheDocument();

    const parsedForceAskContract = JSON.parse(
      container.querySelector("pre code")?.textContent ?? "{}",
    );
    expect(parsedForceAskContract).toEqual({
      decision: "force_ask",
      reason: "Matched git push",
    });
    expect("overwrite" in parsedForceAskContract).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("MermaidDiagram disables htmlLabels for XML-strict SVG parsing and renders valid SVG", async () => {
    mermaidInitializeMock.mockReset();
    mermaidRenderMock.mockReset();
    mermaidRenderMock.mockResolvedValueOnce({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text><tspan>1. Align</tspan><tspan>(/grill-me -&gt; /plan)</tspan></text></svg>',
    });

    render(
      <MermaidDiagram
        chart={'flowchart LR\n  A["1. Align\\n(/grill-me -> /plan)"] --> B["2. Build"]'}
        title="Step 7 Diagram"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Step 7 Diagram" })).toBeInTheDocument();
    });
    expect(mermaidInitializeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        securityLevel: "strict",
        htmlLabels: false,
        flowchart: expect.objectContaining({ htmlLabels: false }),
      }),
    );
  });

  it("CourseCurriculumStudio renders both primary codeSnippet and additionalCodeSnippets", () => {
    const courseWithMultiSnippets: Course = {
      ...SAMPLE_COURSES[0],
      steps: [
        {
          ...SAMPLE_COURSES[0].steps[0],
          codeSnippet: {
            language: "json",
            filename: ".agents/hooks.json",
            code: '{"hitl-safety-gate":{}}',
          },
          additionalCodeSnippets: [
            {
              language: "markdown",
              filename: "AGENTS.md (Engineering Starter)",
              code: "# Engineering Rules",
            },
          ],
        },
      ],
    };

    render(
      <CourseCurriculumStudio
        courses={[courseWithMultiSnippets]}
        completedStepIds={[]}
        onToggleStepComplete={vi.fn()}
        onJumpToPrompt={vi.fn()}
        onJumpToResource={vi.fn()}
        progressModalOpen={false}
        onOpenProgressModal={vi.fn()}
        onCloseProgressModal={vi.fn()}
        progress={createDefaultProgress("2026-11-24T00:00:00.000Z")}
        onImportProgress={vi.fn()}
        onResetProgress={vi.fn()}
      />,
    );

    expect(screen.getByText(".agents/hooks.json")).toBeInTheDocument();
    expect(screen.getByText("AGENTS.md (Engineering Starter)")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /copy snippet/i })).toHaveLength(2);
  });
});

const SAMPLE_ILLUSTRATION: CourseIllustration = {
  src: "/media/illustrations/harness-mastery.png",
  alt: "Editorial illustration of an AI brain surrounded by an organized workshop and safety gates",
  caption: "A disciplined harness surrounds the AI brain with tools, rules, and safety locks.",
  visualAnalogy: "A pilot cockpit with checklists and guarded switches",
};

const SAMPLE_ELI5_BLOCK: Eli5ConceptBlock = {
  everydayAnalogy: "A kitchen recipe card with safety timers",
  simpleExplanation:
    "A harness is the simple toolbox and rulebook that helps your AI assistant work cleanly without guessing.",
  whyItMatters:
    "Without clear guardrails, an AI assistant can overwrite important files or skip checks.",
  roleInProtocol:
    "It connects your project rules, skills, and automated checks into one reliable workflow.",
  howToUseGoingForward:
    "Start every session by opening your workspace rules and running the check script before saving.",
  realWorldExample:
    "Like a pilot running a printed pre-flight checklist before starting the engines.",
  audioScript:
    "Think of an AI model like a clever chef, and the harness like the organized kitchen around them with recipe cards and timers.",
  estimatedMinutes: 5,
  diagramCaption: "Plain-English flow showing how rules and checks wrap the AI helper.",
};

const SAMPLE_ELI5_STEP: LessonStep = {
  id: "hm-step-1",
  order: 1,
  title: "Model vs. Harness Separation",
  stageTag: "Foundations",
  summary: "Technical separation between LLM inference and deterministic workspace tooling.",
  eli5: SAMPLE_ELI5_BLOCK,
  keyTakeaways: [
    "Harness architecture accounts for 90% of day-to-day agent reliability.",
    "Static rules and runtime hooks enforce invariants consistently.",
  ],
  actionChecklist: [
    "Inspect rules/AGENTS.md in your repository.",
    "Verify hooks.json blocks destructive shell commands.",
  ],
  codeSnippet: {
    language: "json",
    filename: "hooks.json",
    code: '{"PostToolUse": ["verify-stack.sh"]}',
  },
  mermaidDiagram: 'flowchart LR\n  A["Your Idea"] --> B["Checked Result"]',
  promptId: "p1",
  repoArtifactPath: "rules/AGENTS.md",
};

interface MockUtteranceInstance {
  text: string;
  rate: number;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

function installSpeechSynthesisMock() {
  const utterances: MockUtteranceInstance[] = [];
  let isPaused = false;

  const speak = vi.fn((utterance: MockUtteranceInstance) => {
    utterances.push(utterance);
    isPaused = false;
    utterance.onstart?.();
  });
  const pause = vi.fn(() => {
    isPaused = true;
  });
  const resume = vi.fn(() => {
    isPaused = false;
  });
  const cancel = vi.fn(() => {
    isPaused = false;
  });

  const mockSpeechSynthesis = {
    speak,
    pause,
    resume,
    cancel,
    get paused() {
      return isPaused;
    },
  };

  class MockSpeechSynthesisUtterance implements MockUtteranceInstance {
    text: string;
    rate = 1;
    lang = "";
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;

    constructor(text: string) {
      this.text = text;
    }
  }

  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    writable: true,
    value: mockSpeechSynthesis,
  });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    writable: true,
    value: MockSpeechSynthesisUtterance,
  });

  return { speak, pause, resume, cancel, utterances };
}

describe("Multimodal ELI5 Components (Task 1C)", () => {
  describe("CourseIllustrationBanner", () => {
    it("renders Ready state with valid local image, visual analogy badge, caption, and graceful onError fallback", () => {
      render(
        <CourseIllustrationBanner
          courseTitle="Harness Mastery"
          accentTone="cyan"
          illustration={SAMPLE_ILLUSTRATION}
        />,
      );

      const img = screen.getByRole("img", { name: SAMPLE_ILLUSTRATION.alt });
      expect(img).toBeInTheDocument();
      expect(
        screen.getByText(`Visual Analogy: ${SAMPLE_ILLUSTRATION.visualAnalogy}`),
      ).toBeInTheDocument();
      expect(screen.getByText(SAMPLE_ILLUSTRATION.caption)).toBeInTheDocument();

      // Downstream image load failure transitions cleanly to visual fallback status card
      fireEvent.error(img);
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText("Visual Fallback")).toBeInTheDocument();
      expect(screen.getByText(SAMPLE_ILLUSTRATION.alt)).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("renders Blocked / Invalid URL alert (role='alert') for untrusted remote or traversal paths", () => {
      const { rerender } = render(
        <CourseIllustrationBanner
          courseTitle="Harness Mastery"
          illustration={{
            ...SAMPLE_ILLUSTRATION,
            src: "https://untrusted.example.com/evil.png",
          }}
        />,
      );

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(screen.getByText("Blocked Image URL")).toBeInTheDocument();
      expect(
        screen.getByText("Illustration blocked by local media allowlist"),
      ).toBeInTheDocument();
      expect(screen.getByText(SAMPLE_ILLUSTRATION.alt)).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();

      rerender(
        <CourseIllustrationBanner
          courseTitle="Harness Mastery"
          illustration={{
            ...SAMPLE_ILLUSTRATION,
            src: "/media/illustrations/../escape.png",
          }}
        />,
      );
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("renders Pending / Undefined state when illustration is omitted", () => {
      render(<CourseIllustrationBanner courseTitle="SDLC Reference Model" accentTone="violet" />);

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(
        screen.getByText("Editorial Illustration Ready for Phase 2"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Editorial Illustration Pending — SDLC Reference Model"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });

  describe("AudioExplainerBar", () => {
    it("shows fallback notice when speechSynthesis is absent and keeps 'Read Script' drawer interactive", async () => {
      Reflect.deleteProperty(window, "speechSynthesis");
      Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");

      render(
        <AudioExplainerBar
          stepId="hm-step-1"
          stepTitle="Model vs. Harness"
          audioScript={SAMPLE_ELI5_BLOCK.audioScript}
        />,
      );

      const playBtn = screen.getByRole("button", {
        name: /Play audio explainer for Model vs\. Harness/i,
      });
      await waitFor(() => {
        expect(playBtn).toBeDisabled();
      });
      expect(screen.getByRole("status")).toHaveTextContent(
        "Voice playback unavailable on this browser — read the script below.",
      );

      const readScriptBtn = screen.getByRole("button", { name: /read script/i });
      expect(readScriptBtn).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText(SAMPLE_ELI5_BLOCK.audioScript)).not.toBeInTheDocument();

      fireEvent.click(readScriptBtn);
      expect(readScriptBtn).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText(SAMPLE_ELI5_BLOCK.audioScript)).toBeInTheDocument();

      fireEvent.click(readScriptBtn);
      expect(readScriptBtn).toHaveAttribute("aria-expanded", "false");
    });

    it("supports Play/Pause/Stop, speed selector (0.9x, 1.0x, 1.25x), Read Script drawer, and speechSynthesis.cancel() on unmount", async () => {
      const mock = installSpeechSynthesisMock();

      const { unmount } = render(
        <AudioExplainerBar
          stepId="hm-step-1"
          stepTitle="Model vs. Harness"
          audioScript={SAMPLE_ELI5_BLOCK.audioScript}
        />,
      );

      const playBtn = screen.getByRole("button", {
        name: /Play audio explainer for Model vs\. Harness/i,
      });
      const stopBtn = screen.getByRole("button", {
        name: /Stop audio explainer for Model vs\. Harness/i,
      });

      await waitFor(() => {
        expect(playBtn).toBeEnabled();
      });
      expect(stopBtn).toBeDisabled();

      // Verify speed group defaults (1.0x active)
      const speedGroup = screen.getByRole("group", { name: "Playback speed" });
      const speed09 = within(speedGroup).getByRole("button", { name: "0.9x" });
      const speed10 = within(speedGroup).getByRole("button", { name: "1.0x" });
      const speed125 = within(speedGroup).getByRole("button", { name: "1.25x" });
      expect(speed09).toHaveAttribute("aria-pressed", "false");
      expect(speed10).toHaveAttribute("aria-pressed", "true");
      expect(speed125).toHaveAttribute("aria-pressed", "false");

      // Play at default 1.0x
      fireEvent.click(playBtn);
      expect(mock.speak).toHaveBeenCalledTimes(1);
      expect(mock.utterances[0].text).toBe(SAMPLE_ELI5_BLOCK.audioScript);
      expect(mock.utterances[0].rate).toBe(1.0);
      expect(screen.getByText("Playing at 1.0x")).toBeInTheDocument();
      expect(stopBtn).toBeEnabled();

      // Change speed to 1.25x while playing restarts playback at new rate
      fireEvent.click(speed125);
      expect(speed125).toHaveAttribute("aria-pressed", "true");
      expect(speed10).toHaveAttribute("aria-pressed", "false");
      expect(mock.speak).toHaveBeenCalledTimes(2);
      expect(mock.utterances[1].rate).toBe(1.25);
      expect(screen.getByText("Playing at 1.25x")).toBeInTheDocument();

      // Change speed to 0.9x while playing
      fireEvent.click(speed09);
      expect(speed09).toHaveAttribute("aria-pressed", "true");
      expect(mock.speak).toHaveBeenCalledTimes(3);
      expect(mock.utterances[2].rate).toBe(0.9);
      expect(screen.getByText("Playing at 0.9x")).toBeInTheDocument();

      // Pause & resume
      const pauseBtn = screen.getByRole("button", {
        name: /Pause audio explainer for Model vs\. Harness/i,
      });
      fireEvent.click(pauseBtn);
      expect(mock.pause).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Paused")).toBeInTheDocument();

      const resumeBtn = screen.getByRole("button", {
        name: /Play audio explainer for Model vs\. Harness/i,
      });
      fireEvent.click(resumeBtn);
      expect(mock.resume).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Playing at 0.9x")).toBeInTheDocument();

      // Stop cancels active speech and resets status
      mock.cancel.mockClear();
      fireEvent.click(stopBtn);
      expect(mock.cancel).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Stopped")).toBeInTheDocument();
      expect(stopBtn).toBeDisabled();

      // Restart playback and verify mandatory speechSynthesis.cancel() on unmount
      fireEvent.click(
        screen.getByRole("button", {
          name: /Play audio explainer for Model vs\. Harness/i,
        }),
      );
      mock.cancel.mockClear();
      unmount();
      expect(mock.cancel).toHaveBeenCalledTimes(1);
    });

    it("falls back safely to speechSynthesis when local HTML audio playback rejects", async () => {
      const mock = installSpeechSynthesisMock();
      const playSpy = vi
        .spyOn(HTMLMediaElement.prototype, "play")
        .mockRejectedValueOnce(new Error("Audio decode failed"));
      vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);

      render(
        <AudioExplainerBar
          stepId="hm-step-audio"
          stepTitle="Audio Fallback Step"
          audioScript={SAMPLE_ELI5_BLOCK.audioScript}
          audioUrl="/media/audio/step-01.mp3"
        />,
      );

      const playBtn = screen.getByRole("button", {
        name: /Play audio explainer for Audio Fallback Step/i,
      });
      await waitFor(() => {
        expect(playBtn).toBeEnabled();
      });

      fireEvent.click(playBtn);
      await waitFor(() => {
        expect(mock.speak).toHaveBeenCalledTimes(1);
      });
      expect(playSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Playing at 1.0x")).toBeInTheDocument();
    });
  });

  describe("Eli5MicrolearningCard", () => {
    it("renders all 4 numbered parts, analogy, real-world example, and collapsible Go Deeper drawer in eli5 vs pro modes", async () => {
      mermaidInitializeMock.mockReset();
      mermaidRenderMock.mockReset();
      mermaidRenderMock.mockResolvedValue({
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text>Your Idea to Checked Result</text></svg>',
      });

      const onCopySnippet = vi.fn();
      const onJumpToPrompt = vi.fn();
      const onJumpToResource = vi.fn();

      const { rerender } = render(
        <Eli5MicrolearningCard
          step={SAMPLE_ELI5_STEP}
          eli5={SAMPLE_ELI5_BLOCK}
          learningDepthMode="eli5"
          copiedSnippetKey={null}
          onCopySnippet={onCopySnippet}
          onJumpToPrompt={onJumpToPrompt}
          onJumpToResource={onJumpToResource}
        />,
      );

      // Analogy, duration, and 4 numbered microlearning parts
      expect(screen.getByText("Everyday Analogy")).toBeInTheDocument();
      expect(screen.getByText(SAMPLE_ELI5_BLOCK.everydayAnalogy)).toBeInTheDocument();
      expect(screen.getByText("~5 min")).toBeInTheDocument();

      expect(screen.getByText("1. Explain Like I'm 5")).toBeInTheDocument();
      expect(screen.getByText(SAMPLE_ELI5_BLOCK.simpleExplanation)).toBeInTheDocument();

      expect(screen.getByText("2. Why It Matters")).toBeInTheDocument();
      expect(screen.getByText(SAMPLE_ELI5_BLOCK.whyItMatters)).toBeInTheDocument();

      expect(screen.getByText("3. Role in the Protocol")).toBeInTheDocument();
      expect(screen.getByText(SAMPLE_ELI5_BLOCK.roleInProtocol)).toBeInTheDocument();

      expect(screen.getByText("4. How to Use It Going Forward")).toBeInTheDocument();
      expect(screen.getByText(SAMPLE_ELI5_BLOCK.howToUseGoingForward)).toBeInTheDocument();

      // Real-world example
      expect(screen.getByText("Real-World Example")).toBeInTheDocument();
      expect(screen.getByText(SAMPLE_ELI5_BLOCK.realWorldExample)).toBeInTheDocument();

      // Go Deeper drawer collapsed by default in "eli5" mode
      const goDeeperBtn = screen.getByRole("button", {
        name: /Go Deeper: Senior Technical Specs & Code/i,
      });
      expect(goDeeperBtn).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("Senior Technical Summary")).not.toBeInTheDocument();

      // Independently toggleable in "eli5" mode
      fireEvent.click(goDeeperBtn);
      expect(goDeeperBtn).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("Senior Technical Summary")).toBeInTheDocument();
      expect(screen.getByText(SAMPLE_ELI5_STEP.summary)).toBeInTheDocument();
      expect(screen.getByText("hooks.json")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /copy snippet/i }));
      expect(onCopySnippet).toHaveBeenCalledWith(
        "hm-step-1:hooks.json:0",
        '{"PostToolUse": ["verify-stack.sh"]}',
      );
      fireEvent.click(screen.getByRole("button", { name: /jump to linked prompt/i }));
      expect(onJumpToPrompt).toHaveBeenCalledWith("p1");
      fireEvent.click(screen.getByRole("button", { name: /inspect repo artifact/i }));
      expect(onJumpToResource).toHaveBeenCalledWith("rules/AGENTS.md");

      // Switching global mode to "pro" auto-expands Go Deeper drawer
      rerender(
        <Eli5MicrolearningCard
          step={SAMPLE_ELI5_STEP}
          eli5={SAMPLE_ELI5_BLOCK}
          learningDepthMode="pro"
          copiedSnippetKey={null}
          onCopySnippet={onCopySnippet}
          onJumpToPrompt={onJumpToPrompt}
          onJumpToResource={onJumpToResource}
        />,
      );
      const proGoDeeperBtn = screen.getByRole("button", {
        name: /Go Deeper: Senior Technical Specs & Code/i,
      });
      expect(proGoDeeperBtn).toHaveAttribute("aria-expanded", "true");

      // Still independently collapsible in "pro" mode
      fireEvent.click(proGoDeeperBtn);
      expect(proGoDeeperBtn).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("Senior Technical Summary")).not.toBeInTheDocument();
    });
  });

  describe("CourseCurriculumStudio ELI5/Pro Toggle, Course 00 & Legacy Fallback", () => {
    it("renders global ELI5/Pro toggle (role='group' + aria-pressed), zero-padded Course 00 badge, and legacy fallback notice", () => {
      mermaidInitializeMock.mockReset();
      mermaidRenderMock.mockReset();
      mermaidRenderMock.mockResolvedValue({
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text>Flow</text></svg>',
      });

      const course00: Course = {
        ...SAMPLE_COURSES[0],
        id: "zero-to-one-foundations",
        slug: "zero-to-one-foundations",
        number: 0,
        title: "Zero to One Foundations",
        subtitle: "Complete technical foundation for first-time builders.",
        eli5Tagline: "Zero coding experience needed — learn software with everyday analogies.",
        illustration: SAMPLE_ILLUSTRATION,
        steps: [
          SAMPLE_ELI5_STEP,
          {
            id: "legacy-step-2",
            order: 2,
            title: "Legacy Step Without ELI5",
            stageTag: "Build",
            summary: "Classic senior summary without an ELI5 block.",
            keyTakeaways: ["Classic takeaway item"],
            actionChecklist: ["Classic checklist item"],
          },
        ],
      };

      const onChangeDepthMode = vi.fn();

      render(
        <CourseCurriculumStudio
          courses={[course00, SAMPLE_COURSES[0]]}
          completedStepIds={[]}
          onToggleStepComplete={vi.fn()}
          onJumpToPrompt={vi.fn()}
          onJumpToResource={vi.fn()}
          progressModalOpen={false}
          onOpenProgressModal={vi.fn()}
          onCloseProgressModal={vi.fn()}
          progress={createDefaultProgress("2026-11-25T00:00:00.000Z")}
          onImportProgress={vi.fn()}
          onResetProgress={vi.fn()}
          onChangeLearningDepthMode={onChangeDepthMode}
        />,
      );

      // Zero-padded Course 00 badges & next course number calculation
      expect(screen.getByText("Course 00")).toBeInTheDocument();
      expect(screen.getByText("COURSE 00")).toBeInTheDocument();
      expect(screen.getByText("Course 01")).toBeInTheDocument();
      expect(
        screen.getByText("Add Course 02 via Future Conversation"),
      ).toBeInTheDocument();

      // CourseIllustrationBanner rendered in active Course 00 header
      expect(
        screen.getByRole("img", { name: SAMPLE_ILLUSTRATION.alt }),
      ).toBeInTheDocument();

      // Global depth mode toggle uses role="group" + aria-pressed
      const depthGroup = screen.getByRole("group", {
        name: "Choose learning explanation depth",
      });
      const eli5Btn = within(depthGroup).getByRole("button", {
        name: /Start Simple \(ELI5\)/i,
      });
      const proBtn = within(depthGroup).getByRole("button", {
        name: /Full Pro View/i,
      });

      expect(eli5Btn).toHaveAttribute("aria-pressed", "true");
      expect(proBtn).toHaveAttribute("aria-pressed", "false");
      expect(
        screen.getAllByText(course00.eli5Tagline as string).length,
      ).toBeGreaterThan(0);

      // Step 1 is expanded by default with ELI5 card & collapsed Go Deeper drawer
      const goDeeperBtn = screen.getByRole("button", {
        name: /Go Deeper: Senior Technical Specs & Code/i,
      });
      expect(goDeeperBtn).toHaveAttribute("aria-expanded", "false");

      // Switch to Full Pro View
      fireEvent.click(proBtn);
      expect(onChangeDepthMode).toHaveBeenCalledWith("pro");
      expect(eli5Btn).toHaveAttribute("aria-pressed", "false");
      expect(proBtn).toHaveAttribute("aria-pressed", "true");
      expect(goDeeperBtn).toHaveAttribute("aria-expanded", "true");
      expect(
        screen.getAllByText(course00.subtitle).length,
      ).toBeGreaterThan(0);

      // Expand Step 2 (legacy step without eli5) and verify fallback notice
      const legacyStepBtn = screen.getByRole("button", {
        name: /Legacy Step Without ELI5/i,
      });
      fireEvent.click(legacyStepBtn);
      expect(
        screen.getByText("Classic Pro View — ELI5 Beginner Guide arriving in Phase 2"),
      ).toBeInTheDocument();
      expect(screen.getByText("Classic takeaway item")).toBeInTheDocument();
    });
  });
});

describe("Pilot v2 UX & Readability Regressions", () => {
  describe("CourseCurriculumStudio (Pilot v2 navigation, accordion CTAs, footer advancement & coming_soon video)", () => {
    const pilotCourse00: Course = {
      ...SAMPLE_COURSES[0],
      id: "zero-to-one-pilot",
      slug: "zero-to-one-pilot",
      number: 0,
      title: "Zero to One Technical Foundations",
      eli5Title: "Start Here: Software Made Simple",
      subtitle: "Technical deep-dive into repositories, terminals, and harnesses.",
      eli5Tagline: "Plain-English starter path with zero jargon.",
      video: SAMPLE_VIDEO,
      steps: [
        {
          ...SAMPLE_ELI5_STEP,
          id: "pv2-s1",
          order: 1,
          title: "Model vs. Harness Architecture",
          eli5: {
            ...SAMPLE_ELI5_BLOCK,
            plainTitle: "Brain vs. Toolbox Explained",
            oneLineHook: "Learn why tools and rules matter more than raw AI cleverness.",
            whenToUse: "Before setting up your very first AI-assisted project.",
          },
        },
        {
          ...SAMPLE_ELI5_STEP,
          id: "pv2-s2",
          order: 2,
          title: "Git Version Control Checkpoints",
          eli5: {
            ...SAMPLE_ELI5_BLOCK,
            plainTitle: "Save Points for Your Code",
            oneLineHook: "Think of Git commits like video game checkpoints you can reload anytime.",
            whenToUse: "Right before making any big change to working files.",
          },
          promptId: undefined,
        },
      ],
    };

    const pilotCourse01: Course = {
      ...SAMPLE_COURSES[0],
      id: "harness-mastery-pilot",
      slug: "harness-mastery-pilot",
      number: 1,
      title: "Harness Mastery & Gap Plugging",
      eli5Title: "Upgrade Your Coding Assistant",
      subtitle: "Audit and close harness gaps across 12 dimensions.",
      eli5Tagline: "Turn a raw assistant into a safe teammate.",
      video: {
        ...SAMPLE_VIDEO,
        title: "Harness Upgrade Walkthrough",
      },
      steps: [
        {
          id: "pv2-c1-s1",
          order: 1,
          title: "Audit Your Harness",
          stageTag: "Audit",
          summary: "Score 12 harness dimensions.",
          keyTakeaways: ["Score before changing."],
          actionChecklist: ["Inspect hooks.json."],
        },
      ],
    };

    it("shows Viewing Now on active course tile vs Open Course on unselected tiles and updates CURRENTLY OPEN banner", () => {
      mermaidInitializeMock.mockReset();
      mermaidRenderMock.mockReset();
      mermaidRenderMock.mockResolvedValue({
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text>Flow</text></svg>',
      });

      render(
        <CourseCurriculumStudio
          courses={[pilotCourse00, pilotCourse01]}
          completedStepIds={[]}
          onToggleStepComplete={vi.fn()}
          onJumpToPrompt={vi.fn()}
          onJumpToResource={vi.fn()}
          progressModalOpen={false}
          onOpenProgressModal={vi.fn()}
          onCloseProgressModal={vi.fn()}
          progress={createDefaultProgress("2026-11-25T00:00:00.000Z")}
          onImportProgress={vi.fn()}
          onResetProgress={vi.fn()}
        />,
      );

      const trackGroup = screen.getByRole("group", { name: "Select a course track" });
      const course00Tile = within(trackGroup).getByRole("button", {
        name: /Course 00/i,
      });
      const course01Tile = within(trackGroup).getByRole("button", {
        name: /Course 01/i,
      });

      // Course 00 active by default -> Viewing Now vs Open Course
      expect(course00Tile).toHaveAttribute("aria-pressed", "true");
      expect(within(course00Tile).getByText(/Viewing Now/i)).toBeInTheDocument();
      expect(course01Tile).toHaveAttribute("aria-pressed", "false");
      expect(within(course01Tile).getByText(/Open Course/i)).toBeInTheDocument();

      // CURRENTLY OPEN banner reflects active Course 00 ELI5 title
      expect(
        screen.getByText(/CURRENTLY OPEN · COURSE 00 · Start Here: Software Made Simple/i),
      ).toBeInTheDocument();

      // Clicking Course 01 swaps Viewing Now / Open Course and updates CURRENTLY OPEN banner
      fireEvent.click(course01Tile);
      expect(course01Tile).toHaveAttribute("aria-pressed", "true");
      expect(within(course01Tile).getByText(/Viewing Now/i)).toBeInTheDocument();
      expect(course00Tile).toHaveAttribute("aria-pressed", "false");
      expect(within(course00Tile).getByText(/Open Course/i)).toBeInTheDocument();
      expect(
        screen.getByText(/CURRENTLY OPEN · COURSE 01 · Upgrade Your Coding Assistant/i),
      ).toBeInTheDocument();

      // Switching to Pro view updates CURRENTLY OPEN banner to technical course title
      fireEvent.click(screen.getByRole("button", { name: /Full Pro View/i }));
      expect(
        screen.getByText(/CURRENTLY OPEN · COURSE 01 · Harness Mastery & Gap Plugging/i),
      ).toBeInTheDocument();
    });

    it("flips Open Lesson / Close Lesson accordion CTAs and advances from Step 01 footer to Step 02", () => {
      mermaidInitializeMock.mockReset();
      mermaidRenderMock.mockReset();
      mermaidRenderMock.mockResolvedValue({
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text>Flow</text></svg>',
      });

      const onToggleStepComplete = vi.fn();

      const { rerender } = render(
        <CourseCurriculumStudio
          courses={[pilotCourse00]}
          completedStepIds={[]}
          onToggleStepComplete={onToggleStepComplete}
          onJumpToPrompt={vi.fn()}
          onJumpToResource={vi.fn()}
          progressModalOpen={false}
          onOpenProgressModal={vi.fn()}
          onCloseProgressModal={vi.fn()}
          progress={createDefaultProgress("2026-11-25T00:00:00.000Z")}
          onImportProgress={vi.fn()}
          onResetProgress={vi.fn()}
        />,
      );

      const step1Btn = screen.getByRole("button", {
        name: /Step 01.*Brain vs\. Toolbox Explained/i,
      });
      const step2Btn = screen.getByRole("button", {
        name: /Step 02.*Save Points for Your Code/i,
      });

      // Step 01 expanded by default -> Close Lesson; Step 02 collapsed -> Open Lesson
      expect(step1Btn).toHaveAttribute("aria-expanded", "true");
      expect(within(step1Btn).getByText(/Close Lesson/i)).toBeInTheDocument();
      expect(step2Btn).toHaveAttribute("aria-expanded", "false");
      expect(within(step2Btn).getByText(/Open Lesson/i)).toBeInTheDocument();

      // Toggle Step 01 closed and back open -> CTA flips cleanly
      fireEvent.click(step1Btn);
      expect(step1Btn).toHaveAttribute("aria-expanded", "false");
      expect(within(step1Btn).getByText(/Open Lesson/i)).toBeInTheDocument();
      expect(screen.queryByText(/End of Step 01/i)).not.toBeInTheDocument();

      fireEvent.click(step1Btn);
      expect(step1Btn).toHaveAttribute("aria-expanded", "true");
      expect(within(step1Btn).getByText(/Close Lesson/i)).toBeInTheDocument();

      // End of Step 01 footer & Mark Complete & Open Step 02 CTA
      expect(
        screen.getByText(/End of Step 01 · Brain vs\. Toolbox Explained/i),
      ).toBeInTheDocument();
      const advanceBtn = screen.getByRole("button", {
        name: /Mark Complete & Open Step 02/i,
      });
      fireEvent.click(advanceBtn);

      expect(onToggleStepComplete).toHaveBeenCalledTimes(1);
      expect(onToggleStepComplete).toHaveBeenCalledWith("pv2-s1");

      // Step 01 collapsed & Step 02 now expanded with final step footer
      expect(step1Btn).toHaveAttribute("aria-expanded", "false");
      expect(within(step1Btn).getByText(/Open Lesson/i)).toBeInTheDocument();
      expect(step2Btn).toHaveAttribute("aria-expanded", "true");
      expect(within(step2Btn).getByText(/Close Lesson/i)).toBeInTheDocument();
      expect(
        screen.getByText(/End of Step 02 · Save Points for Your Code/i),
      ).toBeInTheDocument();

      const finalCompleteBtn = screen.getByRole("button", {
        name: /Mark Final Step Complete/i,
      });
      fireEvent.click(finalCompleteBtn);
      expect(onToggleStepComplete).toHaveBeenCalledTimes(2);
      expect(onToggleStepComplete).toHaveBeenLastCalledWith("pv2-s2");

      // Once Step 02 is marked complete in props, footer displays static completion badge
      rerender(
        <CourseCurriculumStudio
          courses={[pilotCourse00]}
          completedStepIds={["pv2-s1", "pv2-s2"]}
          onToggleStepComplete={onToggleStepComplete}
          onJumpToPrompt={vi.fn()}
          onJumpToResource={vi.fn()}
          progressModalOpen={false}
          onOpenProgressModal={vi.fn()}
          onCloseProgressModal={vi.fn()}
          progress={createDefaultProgress("2026-11-25T00:00:00.000Z")}
          onImportProgress={vi.fn()}
          onResetProgress={vi.fn()}
        />,
      );
      expect(screen.getByText(/Course Step Complete/i)).toBeInTheDocument();

      // Re-opening already completed Step 01 and advancing does not un-complete Step 01
      fireEvent.click(step1Btn);
      fireEvent.click(screen.getByRole("button", { name: /Mark Complete & Open Step 02/i }));
      expect(onToggleStepComplete).toHaveBeenCalledTimes(2);
    });

    it("collapses coming_soon video behind a compact toggle bar in eli5 mode, expands on click, and shows VideoStage directly in pro mode", () => {
      mermaidInitializeMock.mockReset();
      mermaidRenderMock.mockReset();
      mermaidRenderMock.mockResolvedValue({
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text>Flow</text></svg>',
      });

      render(
        <CourseCurriculumStudio
          courses={[pilotCourse00]}
          completedStepIds={[]}
          onToggleStepComplete={vi.fn()}
          onJumpToPrompt={vi.fn()}
          onJumpToResource={vi.fn()}
          progressModalOpen={false}
          onOpenProgressModal={vi.fn()}
          onCloseProgressModal={vi.fn()}
          progress={createDefaultProgress("2026-11-25T00:00:00.000Z")}
          onImportProgress={vi.fn()}
          onResetProgress={vi.fn()}
        />,
      );

      // Collapsed by default in "eli5" mode
      const videoToggleBtn = screen.getByRole("button", {
        name: /Course Video Walkthrough \(Coming Soon\).*Show Chapters/i,
      });
      expect(videoToggleBtn).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("Harness Mastery Walkthrough")).not.toBeInTheDocument();

      // Expanding reveals VideoStage chapters and flips CTA label
      fireEvent.click(videoToggleBtn);
      expect(videoToggleBtn).toHaveAttribute("aria-expanded", "true");
      expect(videoToggleBtn).toHaveTextContent(/Hide Video Outline/i);
      expect(screen.getByText("Harness Mastery Walkthrough")).toBeInTheDocument();
      expect(screen.getByText("07:00")).toBeInTheDocument();

      // Collapsing again hides VideoStage
      fireEvent.click(videoToggleBtn);
      expect(videoToggleBtn).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("Harness Mastery Walkthrough")).not.toBeInTheDocument();

      // Switching to Full Pro View renders VideoStage directly without the collapsed toggle bar
      fireEvent.click(screen.getByRole("button", { name: /Full Pro View/i }));
      expect(
        screen.queryByRole("button", { name: /Course Video Walkthrough \(Coming Soon\)/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Harness Mastery Walkthrough")).toBeInTheDocument();
    });
  });

  describe("Eli5MicrolearningCard (Pilot v2 whenToUse, matching prompt CTA & drawer reset)", () => {
    const pilotEli5Block: Eli5ConceptBlock = {
      ...SAMPLE_ELI5_BLOCK,
      plainTitle: "Brain vs. Toolbox",
      oneLineHook: "Tools and checklists turn a smart model into a dependable teammate.",
      whenToUse:
        "Use this mental model whenever an AI suggestion looks plausible but breaks your repo rules.",
    };

    const pilotStepWithPrompt: LessonStep = {
      ...SAMPLE_ELI5_STEP,
      eli5: pilotEli5Block,
      promptId: "p-match-1",
    };

    it("renders Use This When..., Everyday Example, Try the Matching Prompt callback, and resets manually opened Go Deeper drawer across eli5 -> pro -> eli5", () => {
      mermaidInitializeMock.mockReset();
      mermaidRenderMock.mockReset();
      mermaidRenderMock.mockResolvedValue({
        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text>Flow</text></svg>',
      });

      const onJumpToPrompt = vi.fn();

      const { rerender } = render(
        <Eli5MicrolearningCard
          step={pilotStepWithPrompt}
          eli5={pilotEli5Block}
          learningDepthMode="eli5"
          copiedSnippetKey={null}
          onCopySnippet={vi.fn()}
          onJumpToPrompt={onJumpToPrompt}
          onJumpToResource={vi.fn()}
        />,
      );

      // Pilot v2 emerald callout shows Use This When... and Everyday Example (instead of Real-World Example)
      expect(screen.getByText("Use This When...")).toBeInTheDocument();
      expect(screen.getByText(pilotEli5Block.whenToUse as string)).toBeInTheDocument();
      expect(screen.getByText("Everyday Example")).toBeInTheDocument();
      expect(screen.queryByText("Real-World Example")).not.toBeInTheDocument();

      // Primary Try the Matching Prompt CTA works even while Go Deeper is collapsed
      const tryPromptBtn = screen.getByRole("button", {
        name: /Try the Matching Prompt/i,
      });
      fireEvent.click(tryPromptBtn);
      expect(onJumpToPrompt).toHaveBeenCalledTimes(1);
      expect(onJumpToPrompt).toHaveBeenCalledWith("p-match-1");

      // Manually open Go Deeper in eli5 mode
      const goDeeperBtn = screen.getByRole("button", {
        name: /Go Deeper: Senior Technical Specs & Code/i,
      });
      expect(goDeeperBtn).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(goDeeperBtn);
      expect(goDeeperBtn).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("Senior Technical Summary")).toBeInTheDocument();

      // Round-trip: eli5 (manually open) -> pro -> eli5 cleanly resets drawer back to collapsed
      rerender(
        <Eli5MicrolearningCard
          step={pilotStepWithPrompt}
          eli5={pilotEli5Block}
          learningDepthMode="pro"
          copiedSnippetKey={null}
          onCopySnippet={vi.fn()}
          onJumpToPrompt={onJumpToPrompt}
          onJumpToResource={vi.fn()}
        />,
      );
      expect(goDeeperBtn).toHaveAttribute("aria-expanded", "true");

      rerender(
        <Eli5MicrolearningCard
          step={pilotStepWithPrompt}
          eli5={pilotEli5Block}
          learningDepthMode="eli5"
          copiedSnippetKey={null}
          onCopySnippet={vi.fn()}
          onJumpToPrompt={onJumpToPrompt}
          onJumpToResource={vi.fn()}
        />,
      );
      expect(goDeeperBtn).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("Senior Technical Summary")).not.toBeInTheDocument();

      // Omitting promptId hides Try the Matching Prompt CTA
      rerender(
        <Eli5MicrolearningCard
          step={{ ...pilotStepWithPrompt, promptId: undefined }}
          eli5={pilotEli5Block}
          learningDepthMode="eli5"
          copiedSnippetKey={null}
          onCopySnippet={vi.fn()}
          onJumpToPrompt={onJumpToPrompt}
          onJumpToResource={vi.fn()}
        />,
      );
      expect(
        screen.queryByRole("button", { name: /Try the Matching Prompt/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("AudioExplainerBar (Pilot v2 canceled error & paused speed-change reset)", () => {
    it("resets status cleanly to idle on speechSynthesis 'canceled' error while reporting real errors", async () => {
      const mock = installSpeechSynthesisMock();

      render(
        <AudioExplainerBar
          stepId="pv2-audio-cancel"
          stepTitle="Brain vs. Toolbox"
          audioScript={SAMPLE_ELI5_BLOCK.audioScript}
        />,
      );

      const playBtn = screen.getByRole("button", {
        name: /Play audio explainer for Brain vs\. Toolbox/i,
      });
      await waitFor(() => {
        expect(playBtn).toBeEnabled();
      });

      // Start playback
      fireEvent.click(playBtn);
      expect(screen.getByText("Playing at 1.0x")).toBeInTheDocument();
      expect(mock.utterances).toHaveLength(1);

      // Fire browser-emitted "canceled" SpeechSynthesisErrorEvent -> cleanly resets to idle (NOT error)
      act(() => {
        mock.utterances[0].onerror?.({ error: "canceled" });
      });

      expect(
        screen.queryByText("Playback unavailable — read the script below"),
      ).not.toBeInTheDocument();
      expect(screen.getByText(/^Ready · ~\d+s$/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: /Play audio explainer for Brain vs\. Toolbox/i,
        }),
      ).toHaveTextContent("Listen (ELI5)");

      // Start playback again and trigger a genuine synthesis failure -> transitions to error state
      fireEvent.click(
        screen.getByRole("button", {
          name: /Play audio explainer for Brain vs\. Toolbox/i,
        }),
      );
      expect(mock.utterances).toHaveLength(2);
      act(() => {
        mock.utterances[1].onerror?.({ error: "synthesis-failed" });
      });
      expect(
        screen.getByText("Playback unavailable — read the script below"),
      ).toBeInTheDocument();
    });

    it("cancels and resets cleanly to idle when speed changes while paused so next Play uses updated speed", async () => {
      const mock = installSpeechSynthesisMock();

      render(
        <AudioExplainerBar
          stepId="pv2-audio-paused-speed"
          stepTitle="Save Points for Code"
          audioScript={SAMPLE_ELI5_BLOCK.audioScript}
        />,
      );

      const playBtn = screen.getByRole("button", {
        name: /Play audio explainer for Save Points for Code/i,
      });
      await waitFor(() => {
        expect(playBtn).toBeEnabled();
      });

      // Start playing at 1.0x, then pause
      fireEvent.click(playBtn);
      expect(mock.speak).toHaveBeenCalledTimes(1);
      expect(mock.utterances[0].rate).toBe(1.0);

      const pauseBtn = screen.getByRole("button", {
        name: /Pause audio explainer for Save Points for Code/i,
      });
      fireEvent.click(pauseBtn);
      expect(mock.pause).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Paused")).toBeInTheDocument();

      // Change speed to 1.25x while paused -> cancels speech, resets to idle without auto-playing
      mock.cancel.mockClear();
      const speed125 = within(screen.getByRole("group", { name: "Playback speed" })).getByRole(
        "button",
        { name: "1.25x" },
      );
      fireEvent.click(speed125);

      expect(speed125).toHaveAttribute("aria-pressed", "true");
      expect(mock.cancel).toHaveBeenCalledTimes(1);
      expect(mock.speak).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/^Ready · ~\d+s$/)).toBeInTheDocument();
      expect(screen.queryByText("Paused")).not.toBeInTheDocument();

      // Next Play starts a fresh utterance at 1.25x instead of calling resume() on stale 1.0x speech
      const nextPlayBtn = screen.getByRole("button", {
        name: /Play audio explainer for Save Points for Code/i,
      });
      fireEvent.click(nextPlayBtn);

      expect(mock.resume).not.toHaveBeenCalled();
      expect(mock.speak).toHaveBeenCalledTimes(2);
      expect(mock.utterances[1].rate).toBe(1.25);
      expect(screen.getByText("Playing at 1.25x")).toBeInTheDocument();
    });
  });

  describe("PromptVault (Pilot v2 eli5Title, Use This Prompt When banner & discovery search)", () => {
    const pilotPromptsCourse: Course = {
      ...SAMPLE_COURSES[0],
      id: "pilot-prompts-course",
      slug: "pilot-prompts-course",
      prompts: [
        {
          id: "pv2-p1",
          title: "Run Stage 2B Spec Lock (cf-plan)",
          eli5Title: "Write a Clear Feature Blueprint First",
          stage: "spec",
          difficulty: "beginner",
          skillRef: "cf-plan",
          description: "Converts discovery notes into a locked implementation spec.",
          whenToUse: "Right before writing any code so requirements stay crystal clear.",
          template: "Lock spec for {{module_name}}.",
          variables: [
            {
              key: "module_name",
              label: "Module",
              placeholder: "billing",
              defaultValue: "billing",
            },
          ],
          expectedOutcome: "Creates plans/billing-spec.md",
        },
        {
          id: "pv2-p2",
          title: "Run Stage 4 QA Verification",
          stage: "test",
          difficulty: "intermediate",
          skillRef: "cf-qa-review",
          description: "Executes typecheck, lint, tests, and visual checks.",
          template: "Run QA review on {{branch}}.",
          variables: [],
          expectedOutcome: "Generates .memory/qa-report.md",
        },
      ],
    };

    it("renders eli5Title in eli5 mode, technical title in pro mode, emerald Use This Prompt When banner, and searches by whenToUse and eli5Title", () => {
      const { rerender } = render(
        <PromptVault
          courses={[pilotPromptsCourse]}
          bookmarkedPromptIds={[]}
          promptVariableValues={{}}
          onToggleBookmark={vi.fn()}
          onUpdateVariable={vi.fn()}
          learningDepthMode="eli5"
        />,
      );

      // In "eli5" mode, card displays eli5Title as h3 and technical title as subtitle
      expect(
        screen.getByRole("heading", {
          level: 3,
          name: "Write a Clear Feature Blueprint First",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("Run Stage 2B Spec Lock (cf-plan)")).toBeInTheDocument();

      // Prompt without eli5Title falls back cleanly to its title
      expect(
        screen.getByRole("heading", {
          level: 3,
          name: "Run Stage 4 QA Verification",
        }),
      ).toBeInTheDocument();

      // Emerald Use This Prompt When banner renders only on prompts with whenToUse
      expect(screen.getAllByText(/Use This Prompt When:/i)).toHaveLength(1);
      expect(
        screen.getByText(/Right before writing any code so requirements stay crystal clear\./i),
      ).toBeInTheDocument();

      // Searching by a phrase unique to whenToUse filters strictly to pv2-p1
      const searchInput = screen.getByLabelText(/search prompts/i);
      fireEvent.change(searchInput, { target: { value: "crystal clear" } });
      expect(screen.getByText("1 / 2 prompts shown")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          level: 3,
          name: "Write a Clear Feature Blueprint First",
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { level: 3, name: "Run Stage 4 QA Verification" }),
      ).not.toBeInTheDocument();

      // Searching by a phrase unique to eli5Title (case-insensitive) also matches pv2-p1
      fireEvent.change(searchInput, { target: { value: "FEATURE BLUEPRINT" } });
      expect(screen.getByText("1 / 2 prompts shown")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          level: 3,
          name: "Write a Clear Feature Blueprint First",
        }),
      ).toBeInTheDocument();

      // Switching to "pro" mode displays technical title as h3 instead of eli5Title
      fireEvent.change(searchInput, { target: { value: "" } });
      rerender(
        <PromptVault
          courses={[pilotPromptsCourse]}
          bookmarkedPromptIds={[]}
          promptVariableValues={{}}
          onToggleBookmark={vi.fn()}
          onUpdateVariable={vi.fn()}
          learningDepthMode="pro"
        />,
      );
      expect(
        screen.getByRole("heading", {
          level: 3,
          name: "Run Stage 2B Spec Lock (cf-plan)",
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", {
          level: 3,
          name: "Write a Clear Feature Blueprint First",
        }),
      ).not.toBeInTheDocument();
    });
  });
});

describe("4-Layer Antigravity Architecture Explorer & Contracts", () => {
  it("enforces referential integrity and completeness across Agent Modes, Building Blocks, and Steering Commands contracts", () => {
    expect(ANTIGRAVITY_STEERING_COMMANDS).toHaveLength(5);
    expect(new Set(ANTIGRAVITY_STEERING_COMMANDS.map((cmd) => cmd.id)).size).toBe(5);
    for (const cmd of ANTIGRAVITY_STEERING_COMMANDS) {
      expect(cmd.command.startsWith("/")).toBe(true);
      expect(cmd.label.trim().length).toBeGreaterThan(0);
      expect(cmd.plainDescription.trim().length).toBeGreaterThan(0);
    }

    expect(ANTIGRAVITY_AGENT_MODES).toHaveLength(7);
    expect(ANTIGRAVITY_AGENT_MODES.map((mode) => mode.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(ANTIGRAVITY_AGENT_MODES.map((mode) => mode.name)).toEqual([
      "Just Ask",
      "Subagents",
      "Orchestrator",
      "Workflows",
      "Swarm",
      "Boost",
      "Teamwork",
    ]);
    expect(new Set(ANTIGRAVITY_AGENT_MODES.map((mode) => mode.id)).size).toBe(7);

    expect(ANTIGRAVITY_BUILDING_BLOCKS).toHaveLength(8);
    const validBlockIds = new Set(ANTIGRAVITY_BUILDING_BLOCKS.map((block) => block.id));
    expect(validBlockIds.size).toBe(8);
    expect(new Set(ANTIGRAVITY_BUILDING_BLOCKS.map((block) => block.categoryLabel))).toEqual(
      new Set(["Tools & Hands", "Memory & Knowledge", "Safety & Guardrails"]),
    );

    const validStatuses = new Set(["leader", "parity", "gap"]);
    for (const block of ANTIGRAVITY_BUILDING_BLOCKS) {
      expect(validStatuses.has(block.statusRaw)).toBe(true);
      expect(validStatuses.has(block.statusCodeFactory)).toBe(true);
      expect(block.whyItMatters.trim().length).toBeGreaterThan(0);
      expect(block.rawSummary.trim().length).toBeGreaterThan(0);
      expect(block.codeFactoryUpgrade.trim().length).toBeGreaterThan(0);

      // Every building block must be referenced by at least one Agent Mode (no orphans)
      const referencingModes = ANTIGRAVITY_AGENT_MODES.filter((mode) =>
        mode.buildingBlockIds.includes(block.id),
      );
      expect(referencingModes.length).toBeGreaterThan(0);
    }

    for (const mode of ANTIGRAVITY_AGENT_MODES) {
      expect(mode.computeLevel).toBeGreaterThanOrEqual(1);
      expect(mode.computeLevel).toBeLessThanOrEqual(5);
      expect(mode.useWhen.trim().length).toBeGreaterThan(0);
      expect(mode.doNotUseWhen.trim().length).toBeGreaterThan(0);
      expect(mode.rawBaseline.trim().length).toBeGreaterThan(0);
      expect(mode.codeFactoryUpgrade.trim().length).toBeGreaterThan(0);
      expect(mode.buildingBlockIds.length).toBeGreaterThan(0);
      expect(new Set(mode.buildingBlockIds).size).toBe(mode.buildingBlockIds.length);
      for (const blockId of mode.buildingBlockIds) {
        expect(validBlockIds.has(blockId)).toBe(true);
      }
    }
  });

  it("renders all 7 Agent Modes, all 5 Steering Commands, and all 3 Building Block categories with role='group' and aria-pressed", () => {
    render(<AntigravityArchitectureExplorer harnessMode="code-factory-v3" />);

    // Layer 1 steering commands group
    const steeringGroup = screen.getByRole("group", { name: "Layer 1 steering commands" });
    const steeringButtons = within(steeringGroup).getAllByRole("button");
    expect(steeringButtons).toHaveLength(5);
    expect(steeringButtons[0]).toHaveAttribute("aria-pressed", "true");
    for (const btn of steeringButtons.slice(1)) {
      expect(btn).toHaveAttribute("aria-pressed", "false");
    }

    // Switching Layer 1 steering command updates aria-pressed & live description
    const goalBtn = within(steeringGroup).getByRole("button", { name: /\/goal/i });
    fireEvent.click(goalBtn);
    expect(goalBtn).toHaveAttribute("aria-pressed", "true");
    expect(steeringButtons[0]).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText(/Run until an independent automated check proves the job actually passes\./i),
    ).toBeInTheDocument();

    // Layer 2: All 7 Antigravity Agent Modes with role="group" + aria-pressed
    const modeGroup = screen.getByRole("group", {
      name: "Select one of the 7 Antigravity Agent Modes",
    });
    const modeButtons = within(modeGroup).getAllByRole("button");
    expect(modeButtons).toHaveLength(7);

    const expectedModeNames = [
      "Just Ask",
      "Subagents",
      "Orchestrator",
      "Workflows",
      "Swarm",
      "Boost",
      "Teamwork",
    ];
    for (const name of expectedModeNames) {
      const btn = within(modeGroup).getByRole("button", { name: new RegExp(name, "i") });
      expect(btn).toHaveAttribute("aria-pressed", name === "Just Ask" ? "true" : "false");
    }

    // Layer 3: All 3 Building Block categories with role="group" + aria-pressed
    const expectedCategories: Array<{ title: string; count: number }> = [
      { title: "Tools & Hands", count: 3 },
      { title: "Memory & Knowledge", count: 2 },
      { title: "Safety & Guardrails", count: 3 },
    ];
    for (const category of expectedCategories) {
      expect(
        screen.getByRole("heading", { level: 3, name: category.title }),
      ).toBeInTheDocument();
      const group = screen.getByRole("group", {
        name: `${category.title} building blocks`,
      });
      const buttons = within(group).getAllByRole("button");
      expect(buttons).toHaveLength(category.count);
      for (const btn of buttons) {
        expect(btn).toHaveAttribute("aria-pressed", "false");
      }
    }
  });

  it("updates LAYER 2 AGENT MODE GUIDE when selecting Swarm/Boost and switches to LAYER 3 BUILDING BLOCK GUIDE when selecting Terminal Sandbox/MCP Connectors", () => {
    render(<AntigravityArchitectureExplorer harnessMode="code-factory-v3" />);

    const modeGroup = screen.getByRole("group", {
      name: "Select one of the 7 Antigravity Agent Modes",
    });
    const inspector = screen.getByRole("complementary", {
      name: "Selected architecture layer guide",
    });

    // Click Swarm -> updates right-side inspector to Swarm Mode Guide
    const swarmBtn = within(modeGroup).getByRole("button", { name: /Swarm/i });
    fireEvent.click(swarmBtn);
    expect(swarmBtn).toHaveAttribute("aria-pressed", "true");
    expect(
      within(modeGroup).getByRole("button", { name: /Just Ask/i }),
    ).toHaveAttribute("aria-pressed", "false");

    const swarmSpec = ANTIGRAVITY_AGENT_MODES.find((m) => m.id === "swarm")!;
    expect(within(inspector).getByText("LAYER 2 · AGENT MODE GUIDE")).toBeInTheDocument();
    expect(within(inspector).getByText("Mode 05 / 07")).toBeInTheDocument();
    expect(within(inspector).getByRole("heading", { level: 3, name: "Swarm" })).toBeInTheDocument();
    expect(within(inspector).getByText("Use This Mode When:")).toBeInTheDocument();
    expect(within(inspector).getByText(swarmSpec.useWhen)).toBeInTheDocument();
    expect(within(inspector).getByText("Do NOT Use When:")).toBeInTheDocument();
    expect(within(inspector).getByText(swarmSpec.doNotUseWhen)).toBeInTheDocument();
    expect(
      screen.getByText(`${swarmSpec.buildingBlockIds.length} of 8 highlighted for Swarm`),
    ).toBeInTheDocument();

    // Click Boost -> updates right-side inspector to Boost Mode Guide
    const boostBtn = within(modeGroup).getByRole("button", { name: /Boost/i });
    fireEvent.click(boostBtn);
    expect(boostBtn).toHaveAttribute("aria-pressed", "true");
    expect(swarmBtn).toHaveAttribute("aria-pressed", "false");

    const boostSpec = ANTIGRAVITY_AGENT_MODES.find((m) => m.id === "boost")!;
    expect(within(inspector).getByText("Mode 06 / 07")).toBeInTheDocument();
    expect(within(inspector).getByRole("heading", { level: 3, name: "Boost" })).toBeInTheDocument();
    expect(within(inspector).getByText(boostSpec.useWhen)).toBeInTheDocument();
    expect(within(inspector).getByText(boostSpec.doNotUseWhen)).toBeInTheDocument();
    expect(within(inspector).getByRole("img", { name: "Compute level 5 of 5" })).toBeInTheDocument();

    // Click Terminal Sandbox (shortLabel: "Sandbox") -> switches cleanly to LAYER 3 BUILDING BLOCK GUIDE
    const safetyGroup = screen.getByRole("group", {
      name: "Safety & Guardrails building blocks",
    });
    const sandboxBtn = within(safetyGroup).getByRole("button", { name: /Sandbox/i });
    fireEvent.click(sandboxBtn);
    expect(sandboxBtn).toHaveAttribute("aria-pressed", "true");
    expect(boostBtn).toHaveAttribute("aria-pressed", "false");

    const sandboxSpec = ANTIGRAVITY_BUILDING_BLOCKS.find((b) => b.id === "terminal-sandbox")!;
    expect(within(inspector).getByText("LAYER 3 · BUILDING BLOCK GUIDE")).toBeInTheDocument();
    expect(
      within(inspector).getByRole("heading", { level: 3, name: "Terminal Sandbox" }),
    ).toBeInTheDocument();
    expect(within(inspector).getByText("Why It Matters")).toBeInTheDocument();
    expect(within(inspector).getByText(sandboxSpec.whyItMatters)).toBeInTheDocument();
    expect(
      within(inspector).getByText(/Used By These Agent Modes/i),
    ).toBeInTheDocument();

    // Click MCP Connectors -> switches to MCP Connectors guide with Workflows, Boost, and Teamwork chips
    const toolsGroup = screen.getByRole("group", { name: "Tools & Hands building blocks" });
    const mcpBtn = within(toolsGroup).getByRole("button", { name: /MCP Connectors/i });
    fireEvent.click(mcpBtn);
    expect(mcpBtn).toHaveAttribute("aria-pressed", "true");
    expect(sandboxBtn).toHaveAttribute("aria-pressed", "false");

    const mcpSpec = ANTIGRAVITY_BUILDING_BLOCKS.find((b) => b.id === "mcp-connectors")!;
    expect(
      within(inspector).getByRole("heading", { level: 3, name: "MCP Connectors" }),
    ).toBeInTheDocument();
    expect(within(inspector).getByText(mcpSpec.whyItMatters)).toBeInTheDocument();

    const expectedMcpModes = ["Workflows", "Boost", "Teamwork"];
    for (const modeName of expectedMcpModes) {
      expect(
        within(inspector).getByRole("button", { name: new RegExp(modeName, "i") }),
      ).toBeInTheDocument();
      const modeCardBtn = within(modeGroup).getByRole("button", {
        name: new RegExp(modeName, "i"),
      });
      expect(within(modeCardBtn).getByText("Uses it")).toBeInTheDocument();
    }
  });

  it("supports cross-jumping between Mode Guide and Building Block Guide chips and highlights baseline vs upgrade card when toggling harnessMode", () => {
    const { rerender } = render(<AntigravityArchitectureExplorer harnessMode="raw" />);

    const modeGroup = screen.getByRole("group", {
      name: "Select one of the 7 Antigravity Agent Modes",
    });
    const safetyGroup = screen.getByRole("group", {
      name: "Safety & Guardrails building blocks",
    });
    const inspector = screen.getByRole("complementary", {
      name: "Selected architecture layer guide",
    });

    // In Mode Guide (default Just Ask), harnessMode="raw" highlights Raw Antigravity Baseline
    const rawBaselineCardInMode = within(inspector)
      .getByText("Raw Antigravity Baseline")
      .closest(".rounded-xl");
    const upgradeCardInMode = within(inspector)
      .getByText("+ Code Factory v3.0 Upgrade")
      .closest(".rounded-xl");

    expect(rawBaselineCardInMode).toHaveClass("border-amber-glow/55", "bg-amber-glow/10");
    expect(upgradeCardInMode).toHaveClass("border-glass-border", "bg-void-900/60");

    // Toggle harnessMode to "code-factory-v3" -> highlights + Code Factory v3.0 Upgrade card
    rerender(<AntigravityArchitectureExplorer harnessMode="code-factory-v3" />);
    expect(
      within(inspector).getByText("Raw Antigravity Baseline").closest(".rounded-xl"),
    ).toHaveClass("border-glass-border", "bg-void-900/60");
    expect(
      within(inspector).getByText("+ Code Factory v3.0 Upgrade").closest(".rounded-xl"),
    ).toHaveClass("border-cyan-glow/60", "bg-cyan-glow/10");

    // Cross-jump #1: Click "Sandbox" chip inside Mode Guide -> jumps to Terminal Sandbox Block Guide
    const sandboxChip = within(inspector).getByRole("button", { name: /^Sandbox$/i });
    fireEvent.click(sandboxChip);

    expect(within(inspector).getByText("LAYER 3 · BUILDING BLOCK GUIDE")).toBeInTheDocument();
    expect(
      within(inspector).getByRole("heading", { level: 3, name: "Terminal Sandbox" }),
    ).toBeInTheDocument();
    expect(
      within(safetyGroup).getByRole("button", { name: /Sandbox/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(modeGroup).getByRole("button", { name: /Just Ask/i }),
    ).toHaveAttribute("aria-pressed", "false");

    // In Block Guide, verify harnessMode="code-factory-v3" vs "raw" updates highlighted card & status badge
    expect(
      within(inspector).getByText("+ Code Factory v3.0 Upgrade").closest(".rounded-xl"),
    ).toHaveClass("border-cyan-glow/60", "bg-cyan-glow/10");
    expect(
      within(inspector).getByText("Raw Antigravity Baseline").closest(".rounded-xl"),
    ).toHaveClass("border-glass-border", "bg-void-900/60");
    // Terminal Sandbox has statusCodeFactory="parity" ("Parity+") and statusRaw="gap" ("Open Gap")
    expect(within(inspector).getAllByText("Parity+")).toHaveLength(2);
    expect(within(inspector).getAllByText("Open Gap")).toHaveLength(1);

    rerender(<AntigravityArchitectureExplorer harnessMode="raw" />);
    expect(
      within(inspector).getByText("Raw Antigravity Baseline").closest(".rounded-xl"),
    ).toHaveClass("border-amber-glow/55", "bg-amber-glow/10");
    expect(
      within(inspector).getByText("+ Code Factory v3.0 Upgrade").closest(".rounded-xl"),
    ).toHaveClass("border-glass-border", "bg-void-900/60");
    expect(within(inspector).getAllByText("Open Gap")).toHaveLength(2);
    expect(within(inspector).getAllByText("Parity+")).toHaveLength(1);

    // Cross-jump #2: Click "Teamwork" chip inside Building Block Guide -> jumps back to Mode Guide
    const teamworkChip = within(inspector).getByRole("button", { name: /07.*Teamwork/i });
    fireEvent.click(teamworkChip);

    expect(within(inspector).getByText("LAYER 2 · AGENT MODE GUIDE")).toBeInTheDocument();
    expect(within(inspector).getByText("Mode 07 / 07")).toBeInTheDocument();
    expect(
      within(inspector).getByRole("heading", { level: 3, name: "Teamwork" }),
    ).toBeInTheDocument();
    expect(
      within(modeGroup).getByRole("button", { name: /Teamwork/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(safetyGroup).getByRole("button", { name: /Sandbox/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("applies semantic mode accents (Swarm=cyan, Boost=rose, Teamwork=amber) in Layer 2 cards and the LAYER 2 AGENT MODE GUIDE inspector", () => {
    render(<AntigravityArchitectureExplorer harnessMode="code-factory-v3" />);

    const modeGroup = screen.getByRole("group", {
      name: "Select one of the 7 Antigravity Agent Modes",
    });
    const inspector = screen.getByRole("complementary", {
      name: "Selected architecture layer guide",
    });

    const semanticChecks = [
      {
        modeName: "Swarm",
        commandHint: "/swarm",
        computeLevel: 4,
        cardBorder: "border-cyan-glow",
        cardBg: "bg-cyan-glow/15",
        badgeBorder: "border-cyan-glow/60",
        badgeBg: "bg-cyan-glow/15",
        badgeText: "text-cyan-glow",
        analogyBorder: "border-cyan-glow/45",
        analogyBg: "bg-cyan-glow/10",
        pipActive: "bg-cyan-glow",
      },
      {
        modeName: "Boost",
        commandHint: "/boost",
        computeLevel: 5,
        cardBorder: "border-rose-glow",
        cardBg: "bg-rose-glow/15",
        badgeBorder: "border-rose-glow/60",
        badgeBg: "bg-rose-glow/15",
        badgeText: "text-rose-glow",
        analogyBorder: "border-rose-glow/45",
        analogyBg: "bg-rose-glow/10",
        pipActive: "bg-rose-glow",
      },
      {
        modeName: "Teamwork",
        commandHint: "/teamwork",
        computeLevel: 5,
        cardBorder: "border-amber-glow",
        cardBg: "bg-amber-glow/15",
        badgeBorder: "border-amber-glow/60",
        badgeBg: "bg-amber-glow/15",
        badgeText: "text-amber-glow",
        analogyBorder: "border-amber-glow/45",
        analogyBg: "bg-amber-glow/10",
        pipActive: "bg-amber-glow",
      },
    ] as const;

    for (const check of semanticChecks) {
      const modeButton = within(modeGroup).getByRole("button", {
        name: new RegExp(check.modeName, "i"),
      });
      fireEvent.click(modeButton);

      expect(modeButton).toHaveAttribute("aria-pressed", "true");
      expect(modeButton).toHaveClass(check.cardBorder, check.cardBg);

      const guideHeaderBadge = within(inspector).getByText("LAYER 2 · AGENT MODE GUIDE");
      expect(guideHeaderBadge).toHaveClass(
        check.badgeBorder,
        check.badgeBg,
        check.badgeText,
      );

      const guideCommandBadge = within(inspector).getByText(check.commandHint);
      expect(guideCommandBadge).toHaveClass(
        check.badgeBorder,
        check.badgeBg,
        check.badgeText,
      );

      const analogyLabel = within(inspector).getByText("Plain-English Analogy");
      expect(analogyLabel).toHaveClass(check.badgeText);
      const analogyBox = analogyLabel.closest(".rounded-xl");
      expect(analogyBox).toHaveClass(check.analogyBorder, check.analogyBg);

      const computeMeter = within(inspector).getByRole("img", {
        name: `Compute level ${check.computeLevel} of 5`,
      });
      const pips = Array.from(computeMeter.querySelectorAll("span"));
      expect(pips).toHaveLength(5);
      pips.forEach((pip, index) => {
        if (index < check.computeLevel) {
          expect(pip).toHaveClass(check.pipActive);
        } else {
          expect(pip).toHaveClass("bg-void-800");
        }
      });
    }
  });
});

describe("CourseEmblem & Course Visual Themes (Stage B)", () => {
  const CANONICAL_COURSES = [
    { slug: "zero-to-one-foundations", courseNumber: 0, expectedColorToken: "emerald" },
    { slug: "harness-mastery", courseNumber: 1, expectedColorToken: "cyan" },
    { slug: "code-factory-sdlc", courseNumber: 2, expectedColorToken: "violet" },
    { slug: "pro-setup-playbook", courseNumber: 3, expectedColorToken: "emerald" },
    { slug: "lit-software-factory", courseNumber: 4, expectedColorToken: "amber" },
    { slug: "notebooklm-antigravity", courseNumber: 5, expectedColorToken: "violet" },
    { slug: "enterprise-product-video-studio", courseNumber: 6, expectedColorToken: "rose" },
    { slug: "orchestration-showcase", courseNumber: 7, expectedColorToken: "cyan" },
    { slug: "vibe-website-factory", courseNumber: 8, expectedColorToken: "amber" },
  ] as const;

  it("renders clean decorative SVGs (aria-hidden='true') with distinct themes across all 9 canonical courses (00-08) and future Course 09 fallback", () => {
    const renderedSvgMarkup = new Set<string>();
    const observedColorFamilies = new Set<string>();

    for (const course of CANONICAL_COURSES) {
      const theme = getCourseVisualTheme(course.slug, course.courseNumber);
      expect(theme.iconColorClass).toContain(course.expectedColorToken);
      expect(theme.emblemContainerClass).toContain(course.expectedColorToken);
      expect(theme.badgeClass.length).toBeGreaterThan(0);
      expect(theme.borderClass.length).toBeGreaterThan(0);
      expect(theme.activeBorderClass.length).toBeGreaterThan(0);
      expect(theme.topBarClass.length).toBeGreaterThan(0);
      expect(theme.themeLabel.trim().length).toBeGreaterThan(0);
      observedColorFamilies.add(course.expectedColorToken);

      const { container, unmount } = render(
        <CourseEmblem slug={course.slug} courseNumber={course.courseNumber} />,
      );
      const wrapper = container.firstElementChild as HTMLElement | null;
      expect(wrapper).not.toBeNull();
      expect(wrapper).toHaveAttribute("aria-hidden", "true");
      expect(wrapper?.className).toContain(theme.iconColorClass);

      const svg = wrapper?.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("viewBox", "0 0 32 32");
      expect(svg?.querySelectorAll("path, rect, circle, line").length).toBeGreaterThan(0);

      renderedSvgMarkup.add(svg!.innerHTML);
      unmount();
    }

    // Course 08 (vibe-website-factory) uses the Amber & Emerald theme
    const course08Theme = getCourseVisualTheme("vibe-website-factory", 8);
    expect(course08Theme.themeLabel).toContain("Amber & Emerald");
    expect(course08Theme.topBarClass).toContain("amber-glow");
    expect(course08Theme.topBarClass).toContain("emerald-glow");

    // All 5 semantic theme families (emerald, cyan, violet, amber, rose) and 9 distinct artworks are present
    expect(observedColorFamilies).toEqual(
      new Set(["emerald", "cyan", "violet", "amber", "rose"]),
    );
    expect(renderedSvgMarkup.size).toBe(9);

    // Future Course 09 fallback (unknown slug) wraps deterministically via modulo to Course 00 (emerald)
    const course00Theme = getCourseVisualTheme("zero-to-one-foundations", 0);
    const course09FallbackTheme = getCourseVisualTheme("future-course-09", 9);
    expect(course09FallbackTheme).toEqual(course00Theme);

    const { container: fallbackContainer, unmount: unmountFallback } = render(
      <CourseEmblem slug="future-course-09" courseNumber={9} />,
    );
    const fallbackWrapper = fallbackContainer.firstElementChild as HTMLElement | null;
    expect(fallbackWrapper).toHaveAttribute("aria-hidden", "true");
    expect(fallbackWrapper?.className).toContain("emerald-glow");
    const fallbackSvg = fallbackWrapper?.querySelector("svg");
    expect(fallbackSvg).not.toBeNull();
    expect(fallbackSvg).toHaveAttribute("aria-hidden", "true");
    expect(fallbackSvg).toHaveAttribute("viewBox", "0 0 32 32");
    unmountFallback();

    // Negative boundary courseNumber with unknown slug also resolves safely without throwing
    const negativeFallbackTheme = getCourseVisualTheme("future-course-negative", -1);
    expect(negativeFallbackTheme).toEqual(
      getCourseVisualTheme("vibe-website-factory", 8),
    );
  });

  it("renders CourseEmblem cleanly across all supported sizes (xs, sm, md, lg) with expected container and SVG classes", () => {
    const sizeExpectations: ReadonlyArray<{
      size: CourseEmblemSize;
      containerClasses: readonly string[];
      svgClasses: readonly string[];
    }> = [
      { size: "xs", containerClasses: ["h-5", "w-5", "rounded-md"], svgClasses: ["h-4", "w-4"] },
      { size: "sm", containerClasses: ["h-8", "w-8", "rounded-lg"], svgClasses: ["h-5", "w-5"] },
      { size: "md", containerClasses: ["h-11", "w-11", "rounded-xl"], svgClasses: ["h-7", "w-7"] },
      { size: "lg", containerClasses: ["h-14", "w-14", "rounded-2xl"], svgClasses: ["h-9", "w-9"] },
    ];

    for (const spec of sizeExpectations) {
      const { container, unmount } = render(
        <CourseEmblem
          slug="orchestration-showcase"
          courseNumber={7}
          size={spec.size}
          className="custom-emblem-hook"
        />,
      );

      const wrapper = container.firstElementChild as HTMLElement | null;
      expect(wrapper).not.toBeNull();
      expect(wrapper).toHaveAttribute("aria-hidden", "true");
      expect(wrapper).toHaveClass(
        ...spec.containerClasses,
        "text-cyan-glow",
        "custom-emblem-hook",
      );

      const svg = wrapper?.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveClass(...spec.svgClasses);
      unmount();
    }
  });
});

describe("ProofGalleryPanel (Course 08 Proof Pack Evidence)", () => {
  const BASE_GALLERY: ProofGallery = {
    title: "GT-Alpaca Proof #03 — Tokens, GLB & Live Launch",
    summary: "Verified stage metrics and visual/CLI artifacts from gt-alpaca-website.",
    pipelinePhase: "Stage 2 · Verified",
    skillsUsed: ["cf-design-tokens", "cf-threejs-craft"],
    promptsVerified: ["vwf-prompt-design-tokens", "vwf-prompt-threejs-craft"],
    metrics: [
      {
        label: "GLB Size",
        before: "4.52 MB",
        after: "852 KB (-81.57%)",
        status: "pass",
      },
      {
        label: "Live Screenshot Capture",
        after: "Pending Step 4B",
        status: "info",
      },
    ],
    artifacts: [
      {
        id: "hero-shot",
        label: "1440px Desktop Hero",
        imageSrc: "/media/proof-pack/gt-alpaca/hero-1440px.png",
        alt: "Sunlit GT-Alpaca 3D hero at 1440px",
        caption: "Verified desktop hero screenshot.",
        command: "pnpm run verify:map",
        cliExcerpt: "9/9 targets passed across 375px, 768px, 1440px",
      },
      {
        id: "cli-proof-slot",
        label: "Bootstrap CLI Proof",
        caption: "Verified workspace bootstrap output.",
        command: "node skills/cf-bootstrap/scripts/init-workspace.mjs",
        cliExcerpt: "Antigravity Code Factory workspace initialized.",
      },
      {
        id: "pending-capture-slot",
        label: "Step 4B Pending Frame",
        caption: "Awaiting final live capture in Step 4B.",
      },
    ],
    liveUrl: "https://www.alpacas-ibiza.app",
  };

  it("renders pass & info metrics strip, allowlisted image with onError fallback, CLI/pending terminal slates, expandable CLI drawer, and allowlisted https:// liveUrl", () => {
    render(<ProofGalleryPanel gallery={BASE_GALLERY} stepId="vwf-step-3" />);

    // Metrics strip (pass & info)
    const metricsRegion = screen.getByLabelText("Proof metrics");
    expect(within(metricsRegion).getByText("GLB Size")).toBeInTheDocument();
    expect(within(metricsRegion).getByText("4.52 MB")).toBeInTheDocument();
    expect(within(metricsRegion).getByText("852 KB (-81.57%)")).toBeInTheDocument();
    expect(within(metricsRegion).getByText("Verified")).toBeInTheDocument();
    expect(within(metricsRegion).getByText("Live Screenshot Capture")).toBeInTheDocument();
    expect(within(metricsRegion).getByText("Pending Step 4B")).toBeInTheDocument();
    expect(within(metricsRegion).getByText("Pending")).toBeInTheDocument();

    // Allowlisted https:// liveUrl anchor with safe target/rel attributes
    const liveLink = screen.getByRole("link", { name: /Open Live Deployment/i });
    expect(liveLink).toHaveAttribute("href", "https://www.alpacas-ibiza.app");
    expect(liveLink).toHaveAttribute("target", "_blank");
    expect(liveLink).toHaveAttribute("rel", "noopener noreferrer");

    // CLI terminal slate & Pending Step 4B Capture slate (!imageSrc)
    expect(screen.getByText("CLI Proof")).toBeInTheDocument();
    expect(screen.getByText("Pending Step 4B Capture")).toBeInTheDocument();

    // Expandable CLI excerpt drawer (aria-expanded toggle)
    const cliToggleButtons = screen.getAllByRole("button", { name: /Inspect CLI Excerpt/i });
    expect(cliToggleButtons).toHaveLength(2);
    const firstCliBtn = cliToggleButtons[0];
    expect(firstCliBtn).toHaveAttribute("aria-expanded", "false");
    expect(firstCliBtn).toHaveAttribute("aria-controls", "proof-cli-vwf-step-3-hero-shot");
    expect(
      screen.queryByText("9/9 targets passed across 375px, 768px, 1440px"),
    ).not.toBeInTheDocument();

    fireEvent.click(firstCliBtn);
    expect(firstCliBtn).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText("9/9 targets passed across 375px, 768px, 1440px"),
    ).toBeInTheDocument();

    fireEvent.click(firstCliBtn);
    expect(firstCliBtn).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText("9/9 targets passed across 375px, 768px, 1440px"),
    ).not.toBeInTheDocument();

    // Allowlisted image renders and handles onError -> role="status" "Proof Preview Unavailable"
    const proofImg = screen.getByRole("img", {
      name: "Sunlit GT-Alpaca 3D hero at 1440px",
    });
    expect(proofImg).toBeInTheDocument();

    fireEvent.error(proofImg);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Proof Preview Unavailable")).toBeInTheDocument();
    const statusBlocks = screen.getAllByRole("status");
    expect(
      statusBlocks.some((el) => el.textContent?.includes("Proof Preview Unavailable")),
    ).toBe(true);
  });

  it("blocks disallowed imageSrc and liveUrl with role='alert' and renders zero <img> or outbound anchor tags", () => {
    const blockedGallery: ProofGallery = {
      ...BASE_GALLERY,
      liveUrl: "javascript:alert(1)",
      artifacts: [
        {
          id: "blocked-remote-img",
          label: "Untrusted Remote Screenshot",
          imageSrc: "https://evil.example.com/steal.png",
          alt: "Untrusted image",
          caption: "Must be blocked by allowlist.",
        },
        {
          id: "blocked-traversal-img",
          label: "Traversal Screenshot",
          imageSrc: "/media/proof-pack/gt-alpaca/../secret.png",
          alt: "Traversal image",
          caption: "Must be blocked by traversal check.",
        },
      ],
    };

    render(<ProofGalleryPanel gallery={blockedGallery} stepId="vwf-blocked" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open Live Deployment/i })).not.toBeInTheDocument();

    const alerts = screen.getAllByRole("alert");
    // 1 alert for blocked liveUrl + 2 alerts for blocked imageSrc artifacts
    expect(alerts).toHaveLength(3);
    expect(screen.getByText("Blocked Live URL")).toBeInTheDocument();
    expect(screen.getAllByText("Blocked Proof Image URL")).toHaveLength(2);
  });
});

describe("FourDomainShowcase (Step 5 Proven 4-Domain Method)", () => {
  it("renders #four-domains, #four-domains-heading, all 4 domain cards, switches ELI5 vs Pro copy, and invokes onOpenCourse('vibe-website-factory')", () => {
    const onOpenCourse = vi.fn();

    const { container, rerender } = render(
      <FourDomainShowcase
        domainCases={[...FOUR_DOMAIN_CASES]}
        learningDepthMode="eli5"
        onOpenCourse={onOpenCourse}
      />,
    );

    const section = container.querySelector("#four-domains");
    expect(section).not.toBeNull();
    const heading = container.querySelector("#four-domains-heading");
    expect(heading).not.toBeNull();
    expect(heading).toHaveTextContent(/One Code Factory Method · 4 Real Shipped Domains/i);

    const cards = container.querySelectorAll("#four-domains article");
    expect(cards).toHaveLength(4);
    expect(screen.getByText(/Domain 01 · Website/i)).toBeInTheDocument();
    expect(screen.getByText(/Domain 02 · Mobile \/ Web 3D Game/i)).toBeInTheDocument();
    expect(screen.getByText(/Domain 03 · Video Generation/i)).toBeInTheDocument();
    expect(screen.getByText(/Domain 04 · App & Harness Engineering/i)).toBeInTheDocument();

    // ELI5 mode shows eli5Title & eli5Summary
    expect(screen.getByText(FOUR_DOMAIN_CASES[0].eli5Title)).toBeInTheDocument();
    expect(screen.getByText(FOUR_DOMAIN_CASES[0].eli5Summary)).toBeInTheDocument();
    expect(screen.queryByText(FOUR_DOMAIN_CASES[0].title)).not.toBeInTheDocument();

    // Clicking "Open Course 08 →" invokes onOpenCourse("vibe-website-factory")
    const openCourse08Btn = screen.getByRole("button", { name: /Open Course 08 →/i });
    fireEvent.click(openCourse08Btn);
    expect(onOpenCourse).toHaveBeenCalledTimes(1);
    expect(onOpenCourse).toHaveBeenCalledWith("vibe-website-factory");

    // Switching to Pro mode swaps titles and summaries cleanly
    rerender(
      <FourDomainShowcase
        domainCases={[...FOUR_DOMAIN_CASES]}
        learningDepthMode="pro"
        onOpenCourse={onOpenCourse}
      />,
    );
    expect(screen.getByText(FOUR_DOMAIN_CASES[0].title)).toBeInTheDocument();
    expect(screen.getByText(FOUR_DOMAIN_CASES[0].summary)).toBeInTheDocument();
    expect(screen.queryByText(FOUR_DOMAIN_CASES[0].eli5Title)).not.toBeInTheDocument();

    // Allowlisted https:// live links carry safe target & rel attributes
    const liveLinks = screen.getAllByRole("link", { name: /Live Deployment/i });
    expect(liveLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of liveLinks) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
    }
  });

  it("handles empty domainCases with role='status' and blocks unsafe liveUrl with role='alert'", () => {
    const { rerender } = render(
      <FourDomainShowcase
        domainCases={[]}
        learningDepthMode="eli5"
        onOpenCourse={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/No domain case studies loaded/i);

    const unsafeCase: DomainCaseStudy = {
      ...FOUR_DOMAIN_CASES[1],
      liveUrl: "http://insecure.example.com",
    };
    rerender(
      <FourDomainShowcase
        domainCases={[unsafeCase]}
        learningDepthMode="pro"
        onOpenCourse={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Blocked Live URL/i);
    expect(screen.queryByRole("link", { name: /Live Deployment/i })).not.toBeInTheDocument();
  });
});

describe("RepoResourceExplorer (v3.1.0 Sidecars & Workflows Tabs)", () => {
  const SAMPLE_RESOURCES: RepoResource[] = [
    {
      id: "hook:checkpoint-hook-py",
      category: "hook",
      name: "checkpoint-hook.py",
      relativePath: "hooks/checkpoint-hook.py",
      summary: "PreToolUse git stash create checkpoint hook.",
      content: "# checkpoint-hook.py\nprint('{\"decision\": \"allow\"}')\n",
      sizeBytes: 512,
      stageRef: "Lifecycle Hooks",
    },
    {
      id: "sidecar:telemetry-json",
      category: "sidecar",
      name: "sidecar.json",
      relativePath: "sidecars/telemetry-memory/sidecar.json",
      summary: "0600 AF_UNIX telemetry and auto-memory sidecar manifest.",
      content: '{"display_name": "Code Factory Telemetry & Auto-Memory"}',
      sizeBytes: 320,
      stageRef: "Sidecar Daemon",
    },
    {
      id: "sidecar:telemetry-py",
      category: "sidecar",
      name: "sidecar.py",
      relativePath: "sidecars/telemetry-memory/sidecar.py",
      summary: "Pure Python 3 stdlib AF_UNIX telemetry daemon.",
      content: "# sidecar.py\n",
      sizeBytes: 2048,
      stageRef: "Sidecar Daemon",
    },
    {
      id: "workflow:qa-gate-py",
      category: "workflow",
      name: "cf-qa-gate/workflow.py",
      relativePath: "workflows/cf-qa-gate/workflow.py",
      summary: "Stage 4 parallel decoupled QA gate pipeline.",
      content: "# cf-qa-gate workflow.py\n",
      sizeBytes: 1536,
      stageRef: "Bundled Workflows",
    },
  ];

  it("renders Sidecars and Workflows category tabs with counts and filters sidecar and workflow items accurately", () => {
    render(
      <RepoResourceExplorer
        resources={SAMPLE_RESOURCES}
        syncedAt="2026-11-26T08:00:00.000Z"
      />,
    );

    const categoryGroup = screen.getByRole("group", {
      name: "Filter repository resources by category",
    });

    const sidecarsTab = within(categoryGroup).getByRole("button", {
      name: /Sidecars\s*\(2\)/i,
    });
    const workflowsTab = within(categoryGroup).getByRole("button", {
      name: /Workflows\s*\(1\)/i,
    });
    const allTab = within(categoryGroup).getByRole("button", {
      name: /All\s*\(4\)/i,
    });

    expect(sidecarsTab).toHaveAttribute("aria-pressed", "false");
    expect(workflowsTab).toHaveAttribute("aria-pressed", "false");
    expect(allTab).toHaveAttribute("aria-pressed", "true");

    // Click Sidecars tab -> shows only sidecar resources
    fireEvent.click(sidecarsTab);
    expect(sidecarsTab).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getAllByText("sidecars/telemetry-memory/sidecar.json").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("heading", {
        level: 4,
        name: "sidecars/telemetry-memory/sidecar.json",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("sidecars/telemetry-memory/sidecar.py"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("workflows/cf-qa-gate/workflow.py"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("hooks/checkpoint-hook.py"),
    ).not.toBeInTheDocument();

    // Click Workflows tab -> shows only workflow resources
    fireEvent.click(workflowsTab);
    expect(workflowsTab).toHaveAttribute("aria-pressed", "true");
    expect(sidecarsTab).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getAllByText("workflows/cf-qa-gate/workflow.py").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByText("sidecars/telemetry-memory/sidecar.json"),
    ).not.toBeInTheDocument();

    // Click All tab -> restores all resources
    fireEvent.click(allTab);
    expect(allTab).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getAllByText("hooks/checkpoint-hook.py").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("sidecars/telemetry-memory/sidecar.json").length,
    ).toBeGreaterThanOrEqual(1);
  });
});
