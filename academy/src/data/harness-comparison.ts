import { z } from "zod";
import { HarnessDimensionSchema, type HarnessDimension } from "../lib/schemas";

const RAW_HARNESS_DIMENSIONS: HarnessDimension[] = [
  {
    id: "surfaces-topology",
    index: 1,
    name: "Surfaces & Topology",
    category: "platform",
    antigravityRawScore: 9.2,
    claudeCodeScore: 8.4,
    antigravityCodeFactoryScore: 9.5,
    antigravitySummary:
      "4 unified surfaces: Antigravity 2.0 Electron mission-control app, Antigravity IDE (VS Code fork with Tab/Supercomplete, Inline Cmd+I, Code Lenses, Diff Overlays), agy TUI CLI, and Python SDK.",
    claudeCodeSummary:
      "Terminal-first CLI (claude), VS Code & JetBrains extensions, Desktop app, Web/Remote Control, plus TypeScript and Python Agent SDKs.",
    gapAnalysis:
      "Antigravity leads in multi-surface visual mission control and IDE integration, while Claude Code still edges ahead in raw UNIX pipe composability inside headless terminal scripts.",
    howToPlugAndExceed:
      "Use agy -p --output-format stream-json for UNIX pipelines while pairing Antigravity 2.0's Swarm Overview & Artifacts pane with Code Factory's .memory/ handover continuity across IDE, Desktop, and CLI.",
    winnerRaw: "antigravity",
    winnerWithCodeFactory: "antigravity",
  },
  {
    id: "core-builtin-tools",
    index: 2,
    name: "Core Built-in Tools",
    category: "intelligence",
    antigravityRawScore: 7.4,
    claudeCodeScore: 9.2,
    antigravityCodeFactoryScore: 8.8,
    antigravitySummary:
      "Multimodal read_file (text/image/pdf/video/audio), edit_file, write_file, async/daemon run_command, search_web, schedule, browser, and image-generator. Missing native Glob, Grep, WebFetch, and LSP tools in App/CLI agent loop.",
    claudeCodeSummary:
      "Dedicated Read, Edit, MultiEdit, Write, Glob, Grep, Bash, WebSearch, WebFetch, NotebookEdit, and native LSP tools.",
    gapAnalysis:
      "Without dedicated Glob and Grep tools in the general agent loop, raw Antigravity falls back to shell invocations via run_command—adding latency and noisier terminal output.",
    howToPlugAndExceed:
      "Bundle a thin ripgrep/fd + ast-grep MCP server alongside Code Factory's companion LSP plugin so every agent surface gains deterministic structural search and AST codemods that surpass regex grep.",
    winnerRaw: "claude-code",
    winnerWithCodeFactory: "tie",
  },
  {
    id: "lifecycle-hooks-engine",
    index: 3,
    name: "Lifecycle Hooks Engine",
    category: "guardrails",
    antigravityRawScore: 6.5,
    claudeCodeScore: 9.4,
    antigravityCodeFactoryScore: 9.1,
    antigravitySummary:
      "6 synchronous command events (SessionStart, PreToolUse, PostToolUse, PreInvocation, PostInvocation, Stop). Unique force_ask & in-flight arg overwrite plus Pre/PostInvocation injectSteps; PostToolUse expects {} and cannot inject context directly.",
    claudeCodeSummary:
      "25–30+ events (UserPromptSubmit, PreCompact, PostCompact, SubagentStart/Stop, PostToolUseFailure, PermissionRequest, Worktree*, FileChanged) with 5 handler types (command, http, prompt, agent, mcp_tool), async: true, and PostToolUse additionalContext.",
    gapAnalysis:
      "Raw Antigravity lacks async/HTTP hooks, PreCompact triggers, and direct PostToolUse feedback injection—and returning {} from PreToolUse fails closed.",
    howToPlugAndExceed:
      "Shipped in Code Factory v3.1.0 (7 named hooks across 5 events, pure Python 3 stdlib): SessionStart .memory/ hydration, fail-closed PreToolUse force_ask + transparent overwrite (--no-pager, --max-time 5) + secret-guard + <=150ms checkpoint-hook.py, Two-Stage PostToolUse->PreInvocation <2s single-file lint bridge ($PLUGIN_DATA/conversations/<cid>.json -> injectSteps.systemMessage), bounded Stop verification gate, and <10ms fail-open 0600 Unix-socket sidecar emits.",
    winnerRaw: "claude-code",
    winnerWithCodeFactory: "tie",
  },
  {
    id: "multi-agent-orchestration",
    index: 4,
    name: "Multi-Agent Orchestration",
    category: "orchestration",
    antigravityRawScore: 9.6,
    claudeCodeScore: 7.8,
    antigravityCodeFactoryScore: 9.9,
    antigravitySummary:
      "3 native tiers: (1) dynamic define_subagent + reactive wakeup + workspace inherit|share|branch; (2) swarm shared board with fork, sharded tasks, and live worker model hot-switching; (3) embedded Python run_workflow with parallel(), pipeline(), trajectory(), and JSON-schema finish.",
    claudeCodeSummary:
      "Subagents (.claude/agents/*.md, worktree isolation, maxTurns, spawn depth/concurrency caps) plus experimental Agent Teams with shared task lists and peer messaging. No embedded Python workflow engine or live model hot-swap.",
    gapAnalysis:
      "Antigravity holds a decisive structural lead here, though v2.1.0 exposed a critical config footgun: omitting tools: in custom agents/*.md silently downgrades workers to read-only.",
    howToPlugAndExceed:
      "Explicitly declare subagent: true, mainAgent: false, and least-privilege tools: in agents/cf-*.md, pair Task 0 schema locking with non-overlapping Swarm partitions, and ship typed Python run_workflow SDLC engines with self-healing reviewer-fixer loops.",
    winnerRaw: "antigravity",
    winnerWithCodeFactory: "antigravity",
  },
  {
    id: "memory-rules-context",
    index: 5,
    name: "Memory, Rules & Context Hygiene",
    category: "intelligence",
    antigravityRawScore: 7.0,
    claudeCodeScore: 9.1,
    antigravityCodeFactoryScore: 9.3,
    antigravitySummary:
      "Hierarchical GEMINI.md/AGENTS.md + .agents/rules/*.md (always_on, glob, model_decision, manual), 24 KB/file cap, dedicated 20k-token rules budget with pointer demotion, progressive skill disclosure, /compact, and /rewind. No built-in Auto Memory or PreCompact hook.",
    claudeCodeSummary:
      "Hierarchical CLAUDE.md + .claude/rules/*.md + proactive Auto Memory (MEMORY.md) + PreCompact/PostCompact hooks + automatic per-prompt file checkpointing (100 snapshots) & Esc+Esc /rewind.",
    gapAnalysis:
      "Cross-session debugging lessons decay unless manually persisted, and compaction can silently evict active task state without a PreCompact warning.",
    howToPlugAndExceed:
      "Shipped in Code Factory v3.1.0: .memory/ Memory Bank (<= 3 KB handover.md, bounded <= 200-line / <= 3 KB auto-memory.md, tasks.md, ADRs), automatic SessionStart hydration, PreInvocation turn-15+/30+ compaction nudges, Git-Shadow git stash create checkpoints (hooks/checkpoint-hook.py + cf-rewind), and 0600 Unix-socket sidecar auto-memory distillation.",
    winnerRaw: "claude-code",
    winnerWithCodeFactory: "antigravity",
  },
  {
    id: "code-intelligence-lsp",
    index: 6,
    name: "Code Intelligence (LSP)",
    category: "intelligence",
    antigravityRawScore: 6.2,
    claudeCodeScore: 9.3,
    antigravityCodeFactoryScore: 8.9,
    antigravitySummary:
      "Available inside Antigravity IDE (VS Code diagnostics) and CLI /codesearch, but not exposed as structured semantic tools to the general App/CLI agent loop.",
    claudeCodeSummary:
      "Native LSP integration via official language-server plugins (vtsls, pyright, gopls, rust-analyzer) providing exact goToDefinition, findReferences, hover, and post-edit diagnostics.",
    gapAnalysis:
      "Large cross-file refactors in App or headless CLI rely on text search instead of compiler-backed symbol graphs and real-time diagnostics.",
    howToPlugAndExceed:
      "Pair an opt-in companion code-factory-lsp plugin (pinned mcp-language-server + ast-grep MCP over stdio) with single-file PostToolUse type/lint checks so App, CLI, and Headless sessions share IDE-grade semantic navigation.",
    winnerRaw: "claude-code",
    winnerWithCodeFactory: "tie",
  },
  {
    id: "permissions-sandboxing",
    index: 7,
    name: "Permissions & Sandboxing",
    category: "guardrails",
    antigravityRawScore: 7.3,
    claudeCodeScore: 9.0,
    antigravityCodeFactoryScore: 9.2,
    antigravitySummary:
      "OS-level Terminal Sandbox (workspace + tmp, no network by default), 4 autonomy presets (Request Review, Default, Auto, Turbo), Deny > Ask > Allow policy, action(target) rules, Browser Allowlist, and force_ask.",
    claudeCodeSummary:
      "Sandboxed Bash (bubblewrap/Seatbelt) + Sandbox Runtime enclosing file tools, hooks, and MCP servers + DevContainer support with a tighter default human-in-the-loop cadence.",
    gapAnalysis:
      "Auto and Turbo modes carry a higher autonomous blast radius without deterministic hooks guarding destructive shell commands or secret file writes.",
    howToPlugAndExceed:
      "Enforce Code Factory's fail-closed hooks/hitl-gate.py (11 high-impact classes with segment-aware --dry-run exemptions), expand PreToolUse to edit_file|write_file secret blocking, and enforce transparent PreToolUse overwrite guards (e.g., curl --max-time 5).",
    winnerRaw: "claude-code",
    winnerWithCodeFactory: "antigravity",
  },
  {
    id: "enterprise-governance",
    index: 8,
    name: "Enterprise Governance",
    category: "guardrails",
    antigravityRawScore: 7.2,
    claudeCodeScore: 9.2,
    antigravityCodeFactoryScore: 8.5,
    antigravitySummary:
      "Gemini Enterprise Admin Console provides seat licenses, pooled quotas, spend caps, and organization policies, with lighter documented local MDM/GPO lockouts for desktop/CLI configs.",
    claudeCodeSummary:
      "Mature Managed Settings across Server Admin Console, MDM (Jamf/Intune), Windows GPO/HKLM, and non-overridable local managed-settings.json (deniedMcpServers, allowed models, mandated sandbox).",
    gapAnalysis:
      "Regulated teams still rely on Claude Code's non-overridable local MDM/GPO config lockouts for strict endpoint compliance.",
    howToPlugAndExceed:
      "Standardize org-wide plugin distribution with signed Code Factory invariant rules, mandatory fail-closed PreToolUse hooks, and immutable audit trails via a 0600 Unix-socket telemetry sidecar.",
    winnerRaw: "claude-code",
    winnerWithCodeFactory: "claude-code",
  },
  {
    id: "multimodal-browser-ui",
    index: 9,
    name: "Multimodal, Browser & Rich UI",
    category: "ux",
    antigravityRawScore: 9.7,
    claudeCodeScore: 6.8,
    antigravityCodeFactoryScore: 9.9,
    antigravitySummary:
      "Built-in sandboxed browser subagent with tamper-resistant BROWSER_HOST_FACTS verification, image-generator, multimodal read_file, structured Artifacts (Mermaid/carousels), Generative UI, and MCP Apps.",
    claudeCodeSummary:
      "Terminal-centric TUI; live browser testing requires external Playwright or Chrome MCP servers; no native Artifact, Generative UI, or side-pane MCP App canvas.",
    gapAnalysis:
      "Antigravity dominates full-stack visual feedback out of the box—there is no parity gap to close, only untapped upside.",
    howToPlugAndExceed:
      "Automate Stage 4 visual WCAG 2.1 AA audits across 375px, 768px, and 1440px via the built-in browser subagent and ship an interactive Code Factory Mission Control MCP App pane.",
    winnerRaw: "antigravity",
    winnerWithCodeFactory: "antigravity",
  },
  {
    id: "background-automation",
    index: 10,
    name: "Background Automation & Persistence",
    category: "orchestration",
    antigravityRawScore: 9.1,
    claudeCodeScore: 7.4,
    antigravityCodeFactoryScore: 9.7,
    antigravitySummary:
      "Native schedule tool (one-shot TimerCondition + IsDaemon recurring cron), declarative sidecar.json process supervision (always/on-failure/never), and async daemon run_command with reactive wakeup.",
    claudeCodeSummary:
      "Background shell tasks and cloud/scheduled triggers, but lacks a declarative plugin-bundled local daemon supervisor equivalent to sidecar.json.",
    gapAnalysis:
      "Base Code Factory v2.1.0 did not yet exploit sidecar.json or bundled workflows/, leaving async telemetry and background memory distillation unbuilt.",
    howToPlugAndExceed:
      "Shipped in Code Factory v3.1.0: zero-dependency Python sidecar.json daemon (sidecars/telemetry-memory/sidecar.py) listening on a 0600 Unix socket under $PLUGIN_DATA for rotated audit logs, opt-in redacted HTTPS webhooks, and verified .memory/auto-memory.md distillation—paired with bundled workflows/cf-qa-gate and workflows/cf-implement-spec.",
    winnerRaw: "antigravity",
    winnerWithCodeFactory: "antigravity",
  },
  {
    id: "headless-cicd-sdks",
    index: 11,
    name: "Headless CI/CD, Cost Caps & SDKs",
    category: "platform",
    antigravityRawScore: 6.9,
    claudeCodeScore: 9.3,
    antigravityCodeFactoryScore: 8.7,
    antigravitySummary:
      "agy -p --output-format text|json|stream-json --sandbox --model and an async Python SDK (google-antigravity). Missing an official TypeScript SDK, --max-budget-usd hard cap, and explicit subagent depth env caps.",
    claudeCodeSummary:
      "-p/--bare headless mode, --input-format stream-json, --json-schema, hard maxBudgetUsd circuit breakers, CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH caps, and both TypeScript & Python Agent SDKs.",
    gapAnalysis:
      "Unattended CI runs risk runaway token spend or infinite retry loops without a hard cost/step circuit breaker, and JS/TS teams lack a first-party SDK.",
    howToPlugAndExceed:
      "Shipped in Code Factory v3.1.0: PreInvocation runaway loop-breaker (hooks/pre-invocation.py emits terminationBehavior: terminate after 5 consecutive identical tool failures); Phase 3 wraps agy -p --output-format stream-json / Python SDK in a budget-capped CI runner emitting SARIF & JUnit reports.",
    winnerRaw: "claude-code",
    winnerWithCodeFactory: "claude-code",
  },
  {
    id: "plugin-mcp-ecosystem",
    index: 12,
    name: "Plugin & MCP Ecosystem",
    category: "platform",
    antigravityRawScore: 8.3,
    claudeCodeScore: 8.8,
    antigravityCodeFactoryScore: 9.4,
    antigravitySummary:
      "Unified plugin bundle (plugin.json, rules/, skills/, agents/, hooks.json, mcp_config.json, sidecars/), Marketplace + multi-account OAuth (AGY_ACCOUNT), and built-in agy plugin import claude. Streamable HTTP only; plugin MCP requires declared variables.",
    claudeCodeSummary:
      "Larger third-party ecosystem with stdio, Streamable HTTP, and legacy SSE support, simpler environment variable interpolation, and forgiving frontmatter.",
    gapAnalysis:
      "Legacy 2024-11-05 SSE MCP endpoints require mcp-remote bridging, and raw OS env vars are ignored unless declared in plugin variables.",
    howToPlugAndExceed:
      "Shipped in Code Factory v3.1.0 as a self-contained portable plugin (<= 10 KB global rules + 20 skills including cf-rewind + 5 least-privilege personas + 7-hook, 5-event Core Hooks across 9 hook resources + 0600 Unix-socket sidecar + bundled workflows/cf-qa-gate and workflows/cf-implement-spec), with Phase 3 adding companion code-factory-lsp; bridge legacy SSE via pinned mcp-remote only when needed, and use AGY_ACCOUNT for clean multi-tenant cloud ops.",
    winnerRaw: "claude-code",
    winnerWithCodeFactory: "antigravity",
  },
];

export const HARNESS_DIMENSIONS: HarnessDimension[] = z
  .array(HarnessDimensionSchema)
  .parse(RAW_HARNESS_DIMENSIONS);
