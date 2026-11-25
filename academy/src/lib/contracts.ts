import type { HarnessDimension, RepoManifest, SdlcStageKey } from "./schemas";

export type HarnessMode = "raw" | "code-factory-v3";

export type AgentModeId =
  | "just-ask"
  | "subagents"
  | "orchestrator"
  | "workflows"
  | "swarm"
  | "boost"
  | "teamwork";

export type BuildingBlockCategory = "tools" | "memory" | "safety";

export type BuildingBlockId =
  | "terminal-sandbox"
  | "safety-hooks"
  | "rules-and-skills"
  | "workspace-memory"
  | "mcp-connectors"
  | "browser-eye"
  | "code-terminal"
  | "plugins-sidecars";

export interface SteeringCommandSpec {
  id: string;
  command: string;
  label: string;
  plainDescription: string;
}

export interface AgentModeSpec {
  id: AgentModeId;
  order: number;
  name: string;
  commandHint: string;
  shortTagline: string;
  eli5Analogy: string;
  plainDescription: string;
  useWhen: string;
  doNotUseWhen: string;
  scaleLabel: string;
  speedLabel: string;
  computeLevel: 1 | 2 | 3 | 4 | 5;
  buildingBlockIds: readonly BuildingBlockId[];
  rawBaseline: string;
  codeFactoryUpgrade: string;
}

export interface BuildingBlockSpec {
  id: BuildingBlockId;
  name: string;
  shortLabel: string;
  category: BuildingBlockCategory;
  categoryLabel: string;
  eli5Analogy: string;
  plainDescription: string;
  whyItMatters: string;
  statusRaw: "leader" | "parity" | "gap";
  statusCodeFactory: "leader" | "parity" | "gap";
  rawSummary: string;
  codeFactoryUpgrade: string;
}

export const ANTIGRAVITY_STEERING_COMMANDS: readonly SteeringCommandSpec[] = [
  {
    id: "plan",
    command: "/plan",
    label: "Blueprint First",
    plainDescription: "Draw the step-by-step plan and lock contracts before touching code.",
  },
  {
    id: "grill-me",
    command: "/grill-me",
    label: "Ask Questions First",
    plainDescription: "Have the AI interview you with up to 5 sharp questions to remove guesswork.",
  },
  {
    id: "goal",
    command: "/goal",
    label: "Verify Until Done",
    plainDescription: "Run until an independent automated check proves the job actually passes.",
  },
  {
    id: "schedule",
    command: "/schedule",
    label: "Recurring Checkups",
    plainDescription: "Run automatic weekly safety, dependency, and quality sweeps on a timer.",
  },
  {
    id: "learn",
    command: "/learn",
    label: "Lock In Lessons",
    plainDescription: "Turn a fixed bug into a permanent house rule so it can never happen again.",
  },
];

export const ANTIGRAVITY_AGENT_MODES: readonly AgentModeSpec[] = [
  {
    id: "just-ask",
    order: 1,
    name: "Just Ask",
    commandHint: "Single Chat",
    shortTagline: "1 AI helper, 1 conversation",
    eli5Analogy: "Asking one smart friend a quick question over coffee.",
    plainDescription:
      "You type a request in one chat and one AI agent reads, explains, or edits directly without spinning up extra helpers.",
    useWhen:
      "Quick questions, explaining unfamiliar code, small 1-file tweaks, or drafting a short note.",
    doNotUseWhen:
      "Building multi-file features, running big audits, or doing work that needs an independent reviewer.",
    scaleLabel: "Tiny (1 file)",
    speedLabel: "Seconds",
    computeLevel: 1,
    buildingBlockIds: ["code-terminal", "rules-and-skills", "terminal-sandbox"],
    rawBaseline: "Fast direct chat with terminal and file tools in one thread.",
    codeFactoryUpgrade:
      "Always-on lean AGENTS.md rules + fail-closed safety hooks prevent accidental destructive edits even in quick chats.",
  },
  {
    id: "subagents",
    order: 2,
    name: "Subagents",
    commandHint: "invoke_subagent",
    shortTagline: "Delegate a focused side job",
    eli5Analogy: "Asking a kitchen helper to chop onions in the corner while you keep cooking.",
    plainDescription:
      "Your main AI hands a single self-contained job (like researching files, running tests, creating artwork, or checking a webpage) to a fresh specialist helper.",
    useWhen:
      "Isolated side tasks—codebase research, visual browser QA, independent code review, or generating media without cluttering your main chat.",
    doNotUseWhen:
      "Multiple helpers need to message each other back and forth as peers on a shared board.",
    scaleLabel: "Focused Task",
    speedLabel: "1–3 min",
    computeLevel: 2,
    buildingBlockIds: [
      "code-terminal",
      "browser-eye",
      "rules-and-skills",
      "terminal-sandbox",
      "safety-hooks",
    ],
    rawBaseline: "Spawns background helpers with reactive wakeup when done.",
    codeFactoryUpgrade:
      "5 least-privilege Code Factory personas (cf-architect, cf-backend, cf-frontend, cf-tester, cf-reviewer) with explicit tool belts.",
  },
  {
    id: "orchestrator",
    order: 3,
    name: "Orchestrator",
    commandHint: "Planner + Builder",
    shortTagline: "Deep thinker plans, fast worker builds",
    eli5Analogy: "An architect drawing exact blueprints while a fast carpenter builds each wall.",
    plainDescription:
      "Pairs a high-reasoning model (like Gemini Neon/Pro) to plan, lock schemas, and check results with faster worker models (like Flash/Hydrogen) to execute cleanly.",
    useWhen:
      "Structured multi-step features where getting the architecture right upfront matters just as much as fast implementation.",
    doNotUseWhen:
      "Tiny 1-line typo fixes where planning takes longer than the edit itself.",
    scaleLabel: "Multi-Step Feature",
    speedLabel: "5–15 min",
    computeLevel: 3,
    buildingBlockIds: [
      "workspace-memory",
      "rules-and-skills",
      "code-terminal",
      "terminal-sandbox",
      "safety-hooks",
      "browser-eye",
    ],
    rawBaseline: "Manual prompt delegation between strong and fast models.",
    codeFactoryUpgrade:
      "Formal Separation of Concerns: Task 0 freezes shared contracts before builders start, and .memory/ persists every decision cleanly.",
  },
  {
    id: "workflows",
    order: 4,
    name: "Workflows",
    commandHint: "run_workflow",
    shortTagline: "Repeatable code-driven assembly line",
    eli5Analogy: "A factory conveyor belt running the exact same checklist on 50 boxes at once.",
    plainDescription:
      "A Python workflow script fans the exact same steps across many files, items, or review angles in parallel and refuses to finish until a strict pass/fail contract succeeds.",
    useWhen:
      "Repeatable batch jobs: auditing 20 pages, running identical QA pipelines, or processing structured lists deterministically.",
    doNotUseWhen:
      "Open-ended creative exploration where you do not know the exact steps ahead of time.",
    scaleLabel: "Batch / Pipeline",
    speedLabel: "3–10 min",
    computeLevel: 3,
    buildingBlockIds: [
      "code-terminal",
      "mcp-connectors",
      "browser-eye",
      "terminal-sandbox",
      "safety-hooks",
      "plugins-sidecars",
    ],
    rawBaseline: "Embedded Python async orchestration with parallel(), pipeline(), and JSON-schema finish gates.",
    codeFactoryUpgrade:
      "Standardized Stage 4 self-healing QA gates pairing static checks, independent review, and multi-viewport browser checks.",
  },
  {
    id: "swarm",
    order: 5,
    name: "Swarm",
    commandHint: "/swarm",
    shortTagline: "Parallel mini-team + cross-checker",
    eli5Analogy: "A race-car pit crew changing all four tires at once while a crew chief double-checks every bolt.",
    plainDescription:
      "A small team of agents works side by side on a shared message board across separate file partitions, with a cross-checker catching mistakes and live model swapping if anyone stalls.",
    useWhen:
      "Building several independent modules (like Backend + UI + 6 Courses) in parallel with zero overlapping file edits.",
    doNotUseWhen:
      "Two workers need to edit the exact same file simultaneously, or the job is small enough for 1 helper.",
    scaleLabel: "Parallel Modules",
    speedLabel: "5–20 min",
    computeLevel: 4,
    buildingBlockIds: [
      "workspace-memory",
      "rules-and-skills",
      "code-terminal",
      "browser-eye",
      "terminal-sandbox",
      "safety-hooks",
    ],
    rawBaseline: "Shared Swarm Board, isolated share/branch workspaces, and live model hot-switching.",
    codeFactoryUpgrade:
      "Strict 3–5 concurrent loop cap, mandatory Task 0 interface lock, zero-overlap file partitions, and decoupled cf-eval grading.",
  },
  {
    id: "boost",
    order: 6,
    name: "Boost",
    commandHint: "/boost",
    shortTagline: "Multi-brain focus on 1 super-hard puzzle",
    eli5Analogy: "Pulling three senior specialists into one room to crack the toughest puzzle on the whiteboard.",
    plainDescription:
      "Throws deep, multi-perspective reasoning and rigorous verification at one narrow, high-stakes technical blocker or complex architectural design decision.",
    useWhen:
      "Stubborn bugs, tricky race conditions, security architecture, or high-impact system designs where standard chat loops get stuck.",
    doNotUseWhen:
      "Routine everyday tasks—Boost thinks much deeper, so it is slower and uses more compute.",
    scaleLabel: "Deep Bottleneck",
    speedLabel: "5–15 min",
    computeLevel: 5,
    buildingBlockIds: [
      "workspace-memory",
      "rules-and-skills",
      "code-terminal",
      "mcp-connectors",
      "safety-hooks",
    ],
    rawBaseline: "High-compute multi-perspective deep thinking and verification pass.",
    codeFactoryUpgrade:
      "Paired with cf-research, ADR logging (.memory/decisions/), and cf-learn so every hard-won breakthrough becomes a permanent rule.",
  },
  {
    id: "teamwork",
    order: 7,
    name: "Teamwork",
    commandHint: "/teamwork",
    shortTagline: "Full project team from interview to delivery",
    eli5Analogy: "Hiring a full building firm that interviews you first, drafts blueprints, builds every room, and inspects the house.",
    plainDescription:
      "Starts with a structured scoping interview to lock requirements, sets up a shared workspace, and deploys autonomous teams that propose, critique, and refine large projects over hours or days.",
    useWhen:
      "Massive end-to-end projects, full repository migrations, multi-milestone apps, or building an entire multi-course academy.",
    doNotUseWhen:
      "Quick tweaks or single features you can finish in two minutes using Just Ask or Subagents.",
    scaleLabel: "Full Project (Hours–Days)",
    speedLabel: "Hours / Days",
    computeLevel: 5,
    buildingBlockIds: [
      "workspace-memory",
      "rules-and-skills",
      "code-terminal",
      "mcp-connectors",
      "browser-eye",
      "terminal-sandbox",
      "safety-hooks",
      "plugins-sidecars",
    ],
    rawBaseline: "Long-horizon autonomous multi-agent project execution with upfront interview.",
    codeFactoryUpgrade:
      "Lit Software Factory governance: Human-Lit gates on security/deploys, <= 3 KB handover.md hygiene, and Outer-Loop Verdict.",
  },
];

export const ANTIGRAVITY_BUILDING_BLOCKS: readonly BuildingBlockSpec[] = [
  {
    id: "code-terminal",
    name: "Code & Terminal Tools",
    shortLabel: "Code & Terminal",
    category: "tools",
    categoryLabel: "Tools & Hands",
    eli5Analogy: "The carpenter's actual hammer, saw, and tape measure.",
    plainDescription:
      "Lets agents read files, make precise edits, run test suites, and check build output directly inside your project folder.",
    whyItMatters:
      "Without real file and test tools, an AI can only talk about code—it cannot actually build or verify anything.",
    statusRaw: "parity",
    statusCodeFactory: "leader",
    rawSummary: "Read/edit/write and terminal execution built in; App/CLI loops lack native LSP.",
    codeFactoryUpgrade: "Backed by cf-next-verify deterministic scripts and optional companion LSP-over-MCP.",
  },
  {
    id: "mcp-connectors",
    name: "MCP Connectors",
    shortLabel: "MCP Connectors",
    category: "tools",
    categoryLabel: "Tools & Hands",
    eli5Analogy: "Universal power adapters plugging your workshop into Google Drive, cloud hosts, and databases.",
    plainDescription:
      "Standardized bridges (Model Context Protocol) that connect Antigravity safely to external services like Vercel, Supabase, Cloudflare, and Google Workspace.",
    whyItMatters:
      "Stops you from copy-pasting data out of 10 browser tabs—agents inspect real cloud logs, docs, and databases with scoped permissions.",
    statusRaw: "parity",
    statusCodeFactory: "leader",
    rawSummary: "Native Marketplace OAuth + Streamable HTTP MCP support.",
    codeFactoryUpgrade: "Namespaced team configs, read-only DB tokens, and zero committed secrets.",
  },
  {
    id: "browser-eye",
    name: "Live Browser Eye",
    shortLabel: "Browser Eye",
    category: "tools",
    categoryLabel: "Tools & Hands",
    eli5Analogy: "Real eyes opening your website on a phone, tablet, and laptop to click every button.",
    plainDescription:
      "A built-in sandboxed browser subagent that clicks buttons, fills forms, captures screenshots, and checks layouts across phone, tablet, and desktop widths.",
    whyItMatters:
      "Code can compile cleanly and still look broken on a phone screen. Visual proof catches layout bugs before users ever see them.",
    statusRaw: "leader",
    statusCodeFactory: "leader",
    rawSummary: "Built-in multimodal browser subagent with host-verified visit facts.",
    codeFactoryUpgrade: "Mandatory Stage 4 visual audit at 375px, 768px, and 1440px with zero console errors.",
  },
  {
    id: "rules-and-skills",
    name: "Rules & Skills",
    shortLabel: "Rules & Skills",
    category: "memory",
    categoryLabel: "Memory & Knowledge",
    eli5Analogy: "A 1-page house rule card taped to your desk plus detailed cookbooks waiting neatly on the shelf.",
    plainDescription:
      "Always-on house rules (AGENTS.md) enforce non-negotiable standards, while modular Skills (SKILL.md) load step-by-step playbooks only when needed.",
    whyItMatters:
      "Keeps the AI's working memory sharp and affordable—never repeating instructions or cluttering every prompt.",
    statusRaw: "leader",
    statusCodeFactory: "leader",
    rawSummary: "20k-token rules budget with progressive-disclosure skill discovery.",
    codeFactoryUpgrade: "Lean <= 10 KB global invariants + 14 specialized Code Factory SDLC skills.",
  },
  {
    id: "workspace-memory",
    name: "Workspace Memory (.memory/)",
    shortLabel: "Workspace Memory",
    category: "memory",
    categoryLabel: "Memory & Knowledge",
    eli5Analogy: "A shared project binder where every teammate writes what's finished, why decisions were made, and what comes next.",
    plainDescription:
      "Plain Markdown files inside your repository (handover.md, tasks.md, architecture.md, decisions/) that survive across fresh chats and model switches.",
    whyItMatters:
      "Chats fade and get long; file-based memory keeps every subagent, swarm worker, and new session aligned on ground truth.",
    statusRaw: "gap",
    statusCodeFactory: "leader",
    rawSummary: "No built-in auto-memory file structure out of the box.",
    codeFactoryUpgrade: "Structured .memory/ binder + <= 3 KB handover.md + ADRs + locked plans/*-spec.md.",
  },
  {
    id: "terminal-sandbox",
    name: "Terminal Sandbox",
    shortLabel: "Sandbox",
    category: "safety",
    categoryLabel: "Safety & Guardrails",
    eli5Analogy: "A padded practice room where helpers can test ideas freely without breaking the rest of your house.",
    plainDescription:
      "OS-level containment restricting terminal commands to your project workspace and blocking unexpected internet or outside-folder access by default.",
    whyItMatters:
      "Lets agents run automated tests and builds fast on their own while protecting the rest of your computer.",
    statusRaw: "gap",
    statusCodeFactory: "parity",
    rawSummary: "OS sandbox available, but broad auto-approval presets widen blast radius.",
    codeFactoryUpgrade: "Locked proceed-in-sandbox defaults + explicit allowlist/denylist boundaries.",
  },
  {
    id: "safety-hooks",
    name: "Safety Hooks (Door Guards)",
    shortLabel: "Safety Hooks",
    category: "safety",
    categoryLabel: "Safety & Guardrails",
    eli5Analogy: "An automatic door guard that pauses risky moves and blocks anyone from writing passwords into code.",
    plainDescription:
      "Deterministic scripts running automatically before/after tool calls—splitting chained commands, forcing human approval before deploys/deletes, and blocking secret leaks.",
    whyItMatters:
      "Written rules are polite requests; executable hooks are guaranteed locks that cannot be talked past.",
    statusRaw: "gap",
    statusCodeFactory: "leader",
    rawSummary: "6 synchronous lifecycle hook events; returning {} fails closed.",
    codeFactoryUpgrade: "Fail-closed hitl-gate.py + secret-guard.py (<20ms) + two-stage post-edit lint bridge.",
  },
  {
    id: "plugins-sidecars",
    name: "Plugins & Sidecars",
    shortLabel: "Plugins & Sidecars",
    category: "safety",
    categoryLabel: "Safety & Guardrails",
    eli5Analogy: "A portable toolbox you can hand any teammate in 60 seconds, plus quiet background helpers.",
    plainDescription:
      "Bundles rules, skills, custom subagents, hooks, MCP servers, and background sidecar processes into one versioned Git package shared across your whole team.",
    whyItMatters:
      "Instead of everyone copy-pasting prompts in Slack, one git pull upgrades the entire team's workshop at once.",
    statusRaw: "leader",
    statusCodeFactory: "leader",
    rawSummary: "Native plugin discovery (~/.gemini/config/plugins/) and declarative sidecar.json.",
    codeFactoryUpgrade: "Globally installed code-factory plugin syncing every skill, agent, rule, and hook live.",
  },
];

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
