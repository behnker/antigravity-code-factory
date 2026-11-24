import type { HarnessDimension, RepoManifest, SdlcStageKey } from "./schemas";

export type HarnessMode = "raw" | "code-factory-v3";

export interface HarnessNodeSpec {
  id: string;
  label: string;
  shortLabel: string;
  role: string;
  statusRaw: "leader" | "parity" | "gap";
  statusCodeFactory: "leader" | "parity" | "gap";
  rawSummary: string;
  codeFactoryUpgrade: string;
  angleDeg: number;
  orbitRadius: number;
  elevation: number;
  colorHex: number;
}

export interface SdlcStageSpec {
  id: Exclude<SdlcStageKey, "meta">;
  order: number;
  title: string;
  skillCommand: string;
  persona: string;
  summary: string;
  artifactPath: string;
  gateChecklist: string[];
  colorHex: number;
}

export interface HarnessConstellationProps {
  mode: HarnessMode;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  className?: string;
}

export interface SdlcOrbitalSceneProps {
  activeStageId: Exclude<SdlcStageKey, "meta">;
  onSelectStage: (stageId: Exclude<SdlcStageKey, "meta">) => void;
  className?: string;
}

export interface AcademyShellProps {
  manifest: RepoManifest;
  harnessDimensions: HarnessDimension[];
}

export const HARNESS_NODES: readonly HarnessNodeSpec[] = [
  {
    id: "orchestrator",
    label: "Orchestrator Core",
    shortLabel: "Core",
    role: "High-reasoning planner managing context hygiene, delegation, and spec locks.",
    statusRaw: "leader",
    statusCodeFactory: "leader",
    rawSummary: "Unified across Antigravity 2.0, IDE, CLI, and Python SDK.",
    codeFactoryUpgrade: "Enforced Separation of Concerns via cf-architect & locked plans/*-spec.md.",
    angleDeg: 0,
    orbitRadius: 0,
    elevation: 0,
    colorHex: 0x38bdf8,
  },
  {
    id: "swarm",
    label: "Swarm & Subagents",
    shortLabel: "Swarm",
    role: "Parallel multi-agent execution with shared message board & isolated share/branch workspaces.",
    statusRaw: "leader",
    statusCodeFactory: "leader",
    rawSummary: "Native 3-tier parallelism + live model hot-switching.",
    codeFactoryUpgrade: "Strict non-overlapping file partitions + fixed explicit least-privilege tools: in cf-*.md.",
    angleDeg: 0,
    orbitRadius: 3.1,
    elevation: 0.45,
    colorHex: 0xa78bfa,
  },
  {
    id: "workflows",
    label: "run_workflow Engine",
    shortLabel: "Workflows",
    role: "Embedded Python async orchestration with parallel(), pipeline(), trajectory(), and JSON-schema finish.",
    statusRaw: "leader",
    statusCodeFactory: "leader",
    rawSummary: "Decisive advantage over text-only subagent delegation.",
    codeFactoryUpgrade: "Reusable Stage 3 & Stage 4 typed SDLC workflows with self-healing reviewer-fixer loops.",
    angleDeg: 51,
    orbitRadius: 3.25,
    elevation: -0.35,
    colorHex: 0x38bdf8,
  },
  {
    id: "hooks",
    label: "Lifecycle Hooks Ring",
    shortLabel: "Hooks",
    role: "Deterministic interception at SessionStart, Pre/PostToolUse, Pre/PostInvocation, and Stop.",
    statusRaw: "gap",
    statusCodeFactory: "leader",
    rawSummary: "Only 6 sync command events; PostToolUse cannot inject context directly.",
    codeFactoryUpgrade: "Two-stage PostToolUse→PreInvocation feedback bridge + HITL force_ask + overwrite + Stop verification gate.",
    angleDeg: 102,
    orbitRadius: 3.0,
    elevation: 0.55,
    colorHex: 0xfbbf24,
  },
  {
    id: "sandbox",
    label: "Sandbox & Permissions",
    shortLabel: "Sandbox",
    role: "OS-level terminal containment (workspace+tmp, no net default) + Deny > Ask > Allow policy.",
    statusRaw: "gap",
    statusCodeFactory: "parity",
    rawSummary: "Higher autonomous blast radius in Auto/Turbo presets without explicit hooks.",
    codeFactoryUpgrade: "Fail-closed hitl-gate.py + secret-write blocker + Git-Shadow checkpoint rollback.",
    angleDeg: 154,
    orbitRadius: 3.2,
    elevation: -0.45,
    colorHex: 0x34d399,
  },
  {
    id: "lsp-mcp",
    label: "MCP & Semantic LSP",
    shortLabel: "MCP + LSP",
    role: "Model Context Protocol bridges, Marketplace OAuth, and companion semantic code intelligence.",
    statusRaw: "gap",
    statusCodeFactory: "parity",
    rawSummary: "App/CLI agent loop lacks native LSP, Glob, and Grep tools out of the box.",
    codeFactoryUpgrade: "Companion code-factory-lsp plugin (mcp-language-server + ast-grep) + MCP App Mission Control.",
    angleDeg: 205,
    orbitRadius: 3.15,
    elevation: 0.4,
    colorHex: 0xa78bfa,
  },
  {
    id: "browser",
    label: "Multimodal Browser Eye",
    shortLabel: "Browser",
    role: "Built-in sandboxed browser subagent with tamper-resistant BROWSER_HOST_FACTS verification.",
    statusRaw: "leader",
    statusCodeFactory: "leader",
    rawSummary: "Native visual DOM auditing, screenshots, Artifacts, and Generative UI.",
    codeFactoryUpgrade: "Automated Stage 4 WCAG 2.1 AA visual QA across 375px, 768px, and 1440px viewports.",
    angleDeg: 257,
    orbitRadius: 3.05,
    elevation: -0.3,
    colorHex: 0x38bdf8,
  },
  {
    id: "memory-sidecar",
    label: ".memory/ & Sidecar",
    shortLabel: "Memory",
    role: "Persistent workspace Memory Bank + declarative sidecar.json process supervision.",
    statusRaw: "gap",
    statusCodeFactory: "leader",
    rawSummary: "No built-in Auto Memory or PreCompact hook in base Antigravity.",
    codeFactoryUpgrade: "SessionStart handover auto-injection + Unix-socket sidecar distilling verified auto-memory.",
    angleDeg: 308,
    orbitRadius: 3.2,
    elevation: 0.25,
    colorHex: 0x34d399,
  },
];

export const SDLC_STAGES: readonly SdlcStageSpec[] = [
  {
    id: "research",
    order: 1,
    title: "Research",
    skillCommand: "cf-research",
    persona: "cf-architect",
    summary: "Audit the codebase, evaluate architectural trade-offs, verify dependency licenses (MIT/Apache-2.0/BSD), and surface upfront security impacts.",
    artifactPath: ".memory/research-academy-platform.md",
    gateChecklist: [
      "Technical trade-offs explicitly enumerated",
      "Dependency licenses verified (flagged GSAP EULA -> chose MIT Motion)",
      "Upfront security & performance impacts documented",
    ],
    colorHex: 0x38bdf8,
  },
  {
    id: "spec",
    order: 2,
    title: "Spec",
    skillCommand: "cf-grill-me + cf-plan",
    persona: "cf-architect",
    summary: "Interrogate ambiguities with up to 5 high-impact questions, then freeze a self-contained feature specification with Zod contracts and error codes.",
    artifactPath: "plans/antigravity-academy-spec.md",
    gateChecklist: [
      "Zero implicit assumptions after cf-grill-me interrogation",
      "All API boundaries carry runtime Zod schemas & pagination bounds",
      "Non-overlapping file partitions locked before coding",
    ],
    colorHex: 0x60a5fa,
  },
  {
    id: "architecture",
    order: 3,
    title: "Architecture",
    skillCommand: "cf-plan (ADR + System Map)",
    persona: "cf-architect",
    summary: "Document system boundaries, Mermaid sequence/component diagrams, and durable Architecture Decision Records (ADRs) in .memory/decisions/.",
    artifactPath: ".memory/decisions/0002-academy-nextjs-glassmorphic-architecture.md",
    gateChecklist: [
      "System boundaries isolated (academy/ decoupled from root plugin)",
      "ADR captures decision, rejected alternatives, and consequences",
      "Design tokens & WCAG 2.1 AA accessibility spec frozen",
    ],
    colorHex: 0x818cf8,
  },
  {
    id: "build",
    order: 4,
    title: "Build",
    skillCommand: "cf-implement",
    persona: "cf-backend + cf-frontend (Swarm)",
    summary: "Finalize Task 0 shared interfaces first, then fan out non-overlapping parallel worker partitions strictly against the locked specification.",
    artifactPath: "skills/cf-implement/references/orchestration.md",
    gateChecklist: [
      "Shared Zod schemas & design tokens completed in Task 0",
      "Zero overlapping file edits across parallel workers",
      "100% adherence to global AGENTS.md invariants",
    ],
    colorHex: 0xa78bfa,
  },
  {
    id: "test",
    order: 5,
    title: "Test",
    skillCommand: "cf-qa-review",
    persona: "cf-reviewer + browser subagent",
    summary: "Run lint, typecheck, deterministic Vitest coverage, independent diff security audit, and live browser visual QA at 375px / 768px / 1440px.",
    artifactPath: ".memory/qa-report.md",
    gateChecklist: [
      "tsc --noEmit, ESLint, Vitest, and next build 100% green",
      "Independent reviewer certifies zero blocking security defects",
      "Browser visual audit confirms responsive layout & zero console errors",
    ],
    colorHex: 0x34d399,
  },
  {
    id: "deploy",
    order: 6,
    title: "Deploy",
    skillCommand: "cf-deploy-staging",
    persona: "Orchestrator (HITL Gate)",
    summary: "Verify QA report, document rollback procedure in handover.md, obtain explicit human approval, deploy staging preview, and run live smoke tests.",
    artifactPath: "skills/cf-deploy-staging/SKILL.md",
    gateChecklist: [
      "Stage 4 QA report shows zero blocking defects",
      "Exact rollback command documented prior to deploy",
      "Explicit human approval granted before remote deployment",
    ],
    colorHex: 0x2dd4bf,
  },
  {
    id: "feedback",
    order: 7,
    title: "User Feedback",
    skillCommand: "cf-triage",
    persona: "Orchestrator + cf-reviewer",
    summary: "Capture learner telemetry, staging findings, UX edge cases, and feature requests into severity-ranked remediation items in .memory/tasks.md.",
    artifactPath: "skills/cf-triage/SKILL.md",
    gateChecklist: [
      "Incidents & UX observations classified by severity (P0–P3)",
      "Root causes isolated with concrete reproduction steps",
      "Prioritized next-course and bugfix backlog queued in tasks.md",
    ],
    colorHex: 0xfbbf24,
  },
  {
    id: "optimise",
    order: 8,
    title: "Optimise",
    skillCommand: "cf-learn + cf-handover",
    persona: "Orchestrator",
    summary: "Distill post-mortem lessons into permanent invariant rules, tighten tests, and write a <= 3 KB handover.md so the next course cycle starts hot.",
    artifactPath: ".memory/handover.md",
    gateChecklist: [
      "Recurring lessons promoted into permanent rules & regression tests",
      "handover.md updated (<= 3 KB) for instant cross-model resumption",
      "Platform ready for the next conversation to add Course N+1",
    ],
    colorHex: 0xf472b6,
  },
];
