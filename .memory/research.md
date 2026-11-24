# Stage 1 Research: Appraisal of Google Antigravity vs. Claude Code as an Engineering Agent Harness

**Date:** 2026-11-24  
**Stage:** 1 (`cf-research`) — Discovery, Comparative Harness Appraisal & Architectural Trade-Off Analysis  
**Workspace:** `antigravity-code-factory` (`v2.1.0`, `/Users/ralphb/Projects_Personal/Project_Antigravity`)  
**Status:** Pending Senior Engineer Sign-Off Gate (Stage 1)

---

## 1. Problem Statement & Constraints

### Objective
Produce an objective, primary-source-verified engineering appraisal of **Google Antigravity** as an agentic coding harness compared head-to-head against **Anthropic's Claude Code**, specifically answering:
1. What are the concrete architectural and primitive-level differences between the two harnesses?
2. What are Antigravity's genuine strengths and structural weaknesses as a harness?
3. How can a senior engineer systematically plug Antigravity's gaps—and leverage Antigravity's asymmetric platform capabilities—to match and exceed Claude Code (including concrete upgrades for `antigravity-code-factory`)?

### Scope & Evaluation Constraints
- **Harness vs. Model Separation:** Evaluate the *agent harness* (tool loop, lifecycle hooks, memory/context architecture, sandboxing, permissions, orchestration, code intelligence, UI/UX surfaces, headless CI/CD, and SDKs) distinct from underlying LLM weights, noting where harness-model co-design matters.
- **Evidence Standard:** Ground Antigravity capabilities in local official documentation (`antigravity_guide`, `agy-customizations`, `run-workflow`, `swarm_pane`, `migrate-agent-settings`), live official documentation (`antigravity.google/docs/*`), and direct workspace inspection. Ground Claude Code capabilities in official documentation (`code.claude.com`) as of late 2026.
- **Code Factory Invariants:** All recommended extensions must comply with `rules/AGENTS.md` (zero hardcoded secrets, schema-validated boundaries, fail-closed security, MIT/Apache-2.0/BSD dependencies, deterministic testing).

---

## 2. Codebase Findings (`antigravity-code-factory` v2.1.0)

Inspection of the current repository reveals that `code-factory` v2.1.0 already plugs several of Antigravity's baseline harness gaps, while exposing **three concrete structural defects/omissions** in the existing plugin:

### What `code-factory` v2.1.0 Already Plugs
| Antigravity Baseline Gap | Existing `code-factory` Mitigation | Location |
| :--- | :--- | :--- |
| High autonomous blast radius in `Auto`/`Turbo` modes | `PreToolUse` HITL safety gate (`force_ask`) on 11 high-impact command classes with segment-aware `--dry-run` exemptions | `hooks.json`, `hooks/hitl-gate.py` (5/5 unit tests) |
| Lack of enforced SDLC discipline & separation of concerns | 11 progressive-disclosure `cf-*` workflow skills + always-on 6.3 KB invariant rulebook (Security, Scalability, UI/UX WCAG 2.1 AA, Testing, Edge/RLS) | `rules/AGENTS.md`, `skills/cf-*/SKILL.md` |
| No native cross-session structured handover protocol | File-based `.memory/` Memory Bank (`handover.md`, `tasks.md`, `architecture.md`, `decisions/`, `research.md`, `qa-report.md`) | `skills/cf-bootstrap/`, `skills/cf-start/`, `skills/cf-handover/` |
| Role specialization & model routing guidance | 4 custom subagent personas + Orchestrator/Swarm partitioning playbook | `agents/cf-*.md`, `skills/cf-implement/references/orchestration.md` |

### Critical Codebase Findings & Open Gaps in v2.1.0
1. **Silent Tool-Access Footgun in `agents/cf-*.md`:** Antigravity's official agent spec (verified in `migrate-agent-settings/SKILL.md`) specifies that custom subagent definitions omitting a `tools:` list default to a **small read-only toolset**, and should explicitly declare `subagent: true` and `mainAgent: false`. Currently, `agents/cf-backend.md`, `agents/cf-frontend.md`, `agents/cf-architect.md`, and `agents/cf-reviewer.md` omit `tools:`, `subagent:`, and `mainAgent:`. Result: `cf-backend` and `cf-frontend` risk being silently stripped of `edit_file`, `write_file`, and `run_command` when invoked!
2. **Single-Event Hook Architecture:** `hooks.json` only hooks `PreToolUse` on `run_command`. It does not yet use `SessionStart`, `PreInvocation`, `PostToolUse`, `PostInvocation`, `Stop`, or `PreToolUse` on `edit_file|write_file` (leaving secret leaks in file writes, post-edit lint/typecheck feedback, automatic `.memory/` injection, context saturation alerts, and git-shadow checkpointing unautomated).
3. **Underutilization of Antigravity's Asymmetric Primitives:** `code-factory` does not yet ship bundled `run_workflow` Python orchestration scripts, a `sidecar.json` background daemon, a Code-Intelligence/LSP `mcp_config.json`, or an MCP App side-pane dashboard—meaning it currently uses Antigravity primarily like a stricter text CLI rather than unlocking its native advantages over Claude Code.

---

## 3. Technical Feasibility & Comparative Appraisal: Antigravity vs. Claude Code

### 3.1 Core Philosophy
- **Google Antigravity** is an **agent-first multi-surface orchestration platform** (App + VS Code IDE + CLI + Python SDK) built around asynchronous, parallel multi-agent execution (`swarm`, `run_workflow`, background daemons, sidecars) and rich multimodal/interactive UI (built-in browser, artifacts, Generative UI, MCP Apps).
- **Claude Code** is a **terminal-first, precision-engineered UNIX coding harness** built around deeply controlled serial collaboration, ultra-rich deterministic lifecycle hooks (30+ events, 5 handler types), IDE-grade semantic LSP navigation, automatic cross-session memory, and enterprise governance.

### 3.2 Head-to-Head Capability Matrix (12 Harness Dimensions)

| # | Harness Dimension | Google Antigravity | Claude Code | Advantage |
| :- | :--- | :--- | :--- | :--- |
| **1** | **Surfaces & Topology** | 4 unified surfaces: Antigravity 2.0 (Electron mission-control app), Antigravity IDE (VS Code fork w/ Tab/Supercomplete, Inline `Cmd+I`, Code Lenses, Diff Overlays), `agy` TUI CLI, Python SDK. | Terminal-first CLI (`claude`), VS Code/JetBrains extensions, Desktop app, Web/Remote Control, TS & Python SDKs. | **Antigravity** (breadth & visual UX) / **Claude Code** (UNIX composability) |
| **2** | **Core Built-in Tools** | `read_file` (text/img/pdf/video/audio), `edit_file`, `write_file`, `run_command` (async/daemon), `search_web`, `schedule`, `browser`, `image-generator`. **Missing native `Glob`, `Grep`, `WebFetch`, and `LSP` tools** in App/CLI agent loop (falls back to shell). | Dedicated `Read`, `Edit`, `MultiEdit`, `Write`, `Glob`, `Grep`, `Bash`, `WebSearch`, `WebFetch`, `NotebookEdit`, and official **`LSP`** tools (`goToDefinition`, `findReferences`, diagnostics). | **Claude Code** |
| **3** | **Lifecycle Hooks Engine** | **6 events** (`SessionStart`, `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`). Sync `command` only. `PostToolUse` expects `{}` (cannot inject context directly). **Unique strengths:** `PreToolUse` `force_ask` (ignores Allow cache) & `overwrite` (rewrites tool args in-flight); `Pre/PostInvocation` `injectSteps` + `force_continue`/`terminate`. | **25–30+ events** (adds `UserPromptSubmit`, `PreCompact`, `PostCompact`, `SubagentStart/Stop`, `PostToolUseFailure`, `PermissionRequest`, `SessionEnd`, `WorktreeCreate/Remove`, `FileChanged`, `Notification`). **5 handler types** (`command`, `http`, `prompt`, `agent`, `mcp_tool`), `"async": true`, and `PostToolUse` `additionalContext` injection. | **Claude Code** (breadth, async, handler diversity) / **Antigravity** (`overwrite` + `force_ask`) |
| **4** | **Multi-Agent Orchestration** | **3 native tiers:** (1) Subagents w/ dynamic `define_subagent`, reactive wakeup, `workspace: inherit\|share\|branch`; (2) `swarm` shared message board, `fork`, sharded `tasks`, live `model` hot-switching; (3) **`run_workflow`** embedded Python async orchestration (`parallel`, `pipeline`, `phase`, `trajectory()` mining, JSON-schema-validated `finish`). | Subagents (`.claude/agents/*.md`, `isolation: worktree`, `maxTurns`, spawn depth/concurrency caps) + experimental Agent Teams (shared task list, peer messaging). No embedded Python typed-schema workflow engine or live worker model hot-swapping. | **Antigravity (decisive)** |
| **5** | **Memory, Rules & Context Hygiene** | Hierarchical `GEMINI.md`/`AGENTS.md` + `.agents/rules/*.md` (`always_on`, `glob`, `model_decision`, `manual`), 24 KB/file cap, dedicated 20k-token rules budget w/ pointer demotion, progressive skill disclosure, `/compact`, `/rewind`. **No built-in Auto Memory** or `PreCompact` hook. | Hierarchical `CLAUDE.md` + `.claude/rules/*.md` + **Auto Memory (`MEMORY.md`)** proactively distilled across sessions + `PreCompact`/`PostCompact` hooks + automatic per-prompt file checkpointing (100 snapshots) & `Esc+Esc` `/rewind` (code/chat/both). | **Claude Code** |
| **6** | **Code Intelligence (LSP)** | Available inside Antigravity IDE (VS Code diagnostics) and CLI `/codesearch`, but **not exposed as structured semantic tools** to the general agent loop. | Native LSP integration via official language-server plugins (`vtsls`, `pyright`, `gopls`, `rust-analyzer`) giving exact symbol refs and post-edit diagnostics. | **Claude Code** |
| **7** | **Permissions & Sandboxing** | OS-level Terminal Sandbox (workspace+tmp, no net by default), 4 presets (`Request Review`, `Default`, `Auto`, `Turbo`), `Deny > Ask > Allow`, `action(target)` rules, Browser Allowlist, `force_ask`. Higher blast radius in `Auto`/`Turbo` without hooks. | Sandboxed Bash (bubblewrap/Seatbelt) + **Sandbox Runtime** (enclosing file tools, hooks, and MCP servers) + DevContainer support. Tighter default human-in-the-loop cadence. | **Claude Code** (containment depth) |
| **8** | **Enterprise Governance** | Gemini Enterprise Admin Console (licenses, pooled quotas, spend caps, org policies). Less documented local MDM/GPO enforcement for CLI/desktop config lockouts. | Mature **Managed Settings** via Server Admin Console, MDM (Jamf/Intune), Windows GPO/HKLM, and non-overridable local `managed-settings.json` (`deniedMcpServers`, allowed models, mandated sandbox). | **Claude Code** |
| **9** | **Multimodal, Browser & Rich UI** | Built-in sandboxed **`browser`** subagent with tamper-resistant `BROWSER_HOST_FACTS`, `image-generator`, multimodal `read_file`, **Artifacts** (Mermaid/carousels), **Generative UI** (inline HTML), and **MCP Apps** (interactive UI panes). | Terminal-centric TUI; browser requires external Playwright/Chrome MCP; no native Artifact/Generative UI/MCP Apps rendering pane. | **Antigravity (decisive)** |
| **10** | **Background Automation & Persistence** | Built-in `schedule` tool (one-shot `TimerCondition` + `IsDaemon` cron), declarative **`sidecar.json`** process supervisor (`always`/`on-failure`/`never`), async daemon `run_command` with reactive wakeup. | Background shell tasks and cloud/scheduled triggers, but no declarative plugin-bundled local process supervisor like `sidecar.json`. | **Antigravity** |
| **11** | **Headless CI/CD, Cost Caps & SDKs** | `agy -p --output-format text\|json\|stream-json --sandbox --model`; **Python SDK only** (`google-antigravity`, async thoughts + typed tool calls). **Missing:** official TypeScript SDK, `--max-budget-usd` hard circuit breaker, explicit subagent depth/concurrency env caps, direct `-p --json-schema`. | `-p`/`--bare`, `--input-format stream-json`, `--json-schema`, **hard `maxBudgetUsd` / `max_budget_usd` circuit breakers**, `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` & concurrency caps, **both TypeScript and Python Agent SDKs**. | **Claude Code** |
| **12** | **Plugin & MCP Ecosystem** | Clean plugin bundle (`plugin.json`, `rules/`, `skills/`, `agents/`, `hooks.json`, `mcp_config.json`, `sidecars/`), Marketplace + multi-account OAuth (`AGY_ACCOUNT`), built-in Claude/Gemini importer (`agy plugin import claude`). **Constraints:** Streamable HTTP only (no legacy SSE without `mcp-remote`); plugin MCP ignores raw OS env vars (requires `variables` declaration). | Larger mature third-party ecosystem; supports stdio + Streamable HTTP + legacy SSE; simpler env interpolation; forgiving skill/agent frontmatter. | **Claude Code** (ecosystem) / **Antigravity** (unified packaging & OAuth) |

---

### 3.3 Summary of Antigravity's Strengths & Weaknesses

#### Core Strengths (Where Antigravity Already Leads)
1. **Unmatched Multi-Agent Primitives:** `run_workflow` (code-as-orchestration with JSON-schema contracts and `trajectory()` inspection) + `swarm` (shared board, `share`/`branch` workspaces, live model hot-switching) are structurally ahead of text-only subagent delegation.
2. **First-Class Visual & Multimodal Verification:** Native `browser` subagent with host-verified `BROWSER_HOST_FACTS`, multimodal file reading, Artifacts, Generative UI, and MCP Apps make full-stack/UI verification dramatically stronger out of the box.
3. **Active Hook Interception (`overwrite` + `force_ask` + `Pre/PostInvocation`):** Antigravity can *mutate* tool arguments before execution and inject structured UI-only markdown (`metadata.user_markdown`) or force loop continuation/termination at invocation boundaries.
4. **Declarative Local Infrastructure (`sidecar.json` + `schedule`):** Plugins can ship supervised background daemons alongside rules, skills, hooks, and MCP servers in one portable bundle.
5. **Multi-Surface Continuity:** Seamless progression from IDE inline edits (`Cmd+I`/Tab) to parallel Desktop mission control to headless CLI (`agy -p`) and Python SDK.

#### Structural Weaknesses (Gaps vs. Claude Code)
1. **Hook Engine Gaps:** Only 6 events (missing `PreCompact`, `SubagentStart/Stop`, `PostToolUseFailure`, `SessionEnd`, `Worktree*`), synchronous `command`-only execution (no `async`, `http`, `prompt`, `agent`), and **`PostToolUse` cannot return context directly to the model**.
2. **No Native Semantic Code Intelligence (LSP) or Dedicated `Glob`/`Grep`/`WebFetch` Tools** in the general App/CLI agent loop—causing excess shell invocations, noisier outputs, and weaker symbol-level refactoring precision.
3. **No Built-In Auto Memory or Pre-Compaction Guardrails:** Cross-session gotchas and debugging lessons decay unless manually written via `cf-handover` / `cf-learn`; compaction can silently evict working state without a `PreCompact` trigger.
4. **No Hard Cost/Recursion Circuit Breakers or Native TypeScript SDK:** Risk of runaway loops/spend in unattended headless or high-fan-out multi-agent runs; TS/JS shops lack a native SDK.
5. **Higher Autonomy Blast Radius & Silent Config Footguns:** `Auto`/`Turbo` presets require explicit hook guardrails (`hitl-gate.py`) to prevent unintended destructive actions or secret exfiltration; omitted `tools:` in custom `agents/*.md` silently downgrades workers to read-only.

---

### 3.4 Architectural Options & Trade-Offs for Plugging Gaps

| Problem Domain | Option A (Lightweight / Plugin-Native) | Option B (Full Control-Plane Architecture) | Recommended Trade-Off |
| :--- | :--- | :--- | :--- |
| **Post-Edit Feedback Loop** (`PostToolUse` can't inject context) | Rely on rules/prompts telling the agent to run `tsc`/`eslint` after edits. *(Pro: zero code. Con: non-deterministic; model forgets under load.)* | **Two-Stage Hook Bridge:** `PostToolUse` runs fast incremental checks (or captures `error` from failed tools) and writes to `$PLUGIN_DATA/pending-feedback/<cid>.json`; `PreInvocation` reads, clears, and injects via `injectSteps.systemMessage`. *(Pro: 100% deterministic; zero manual prompting. Con: adds ~100–300ms per edit unless scoped to modified file.)* | **Option B** — Scoped to the single modified file (`eslint <file>` / `ruff check <file>`) with strict `<2s` timeout. |
| **Async / HTTP / Telemetry Hooks** (Antigravity hooks are sync-only) | Run `curl` / logging inline in hooks with short timeouts. *(Pro: simple. Con: blocks agent loop, adds latency, fails on network hiccups.)* | **Local Hook Sidecar (`sidecar.json`):** Thin `<10ms` hook shim sends fire-and-forget JSON over local Unix domain socket (or appends to SQLite/WAL) to a supervised Python/Go sidecar that handles HTTP webhooks, OTel traces, and async auto-memory distillation. *(Pro: zero loop latency; survives crashes via `restart_policy: always`. Con: small daemon maintenance.)* | **Option B** for telemetry/webhooks/auto-memory; keep security gates (`PreToolUse`) strictly synchronous. |
| **Semantic Code Intelligence (LSP)** | Continue using `rg` / `find` via `run_command` + IDE Problems pane. *(Pro: zero dependencies. Con: imprecise cross-file refactors, misses type hierarchy.)* | Bundle an **LSP-over-MCP Server** (e.g., `mcp-language-server` or Serena / `ast-grep` MCP) in `mcp_config.json` exposing `definition`, `references`, `hover`, `diagnostics`, and `ast_search`. *(Pro: parity with Claude Code LSP plugins across App/CLI/Headless. Con: requires language binaries like `vtsls`/`pyright`/`gopls` installed on host.)* | **Option B** (opt-in companion plugin `code-factory-lsp` so base `code-factory` stays zero-external-binary). |
| **Checkpointing & Rollback** | Rely on Antigravity's built-in `/rewind` and manual `git stash`. *(Pro: built-in. Con: `/rewind` doesn't reliably snapshot arbitrary shell-mutated files; no audit trail.)* | **Git-Shadow Checkpoint Hook:** `PreToolUse` on `edit_file\|write_file\|run_command` (once per turn) runs `git stash create` (non-destructive, zero working-tree mutation) and logs `{stepIdx, sha, timestamp}` to `$PLUGIN_DATA/checkpoints/<cid>.jsonl`, paired with a `cf-rewind` skill. *(Pro: captures even shell mutations; instant `git checkout <sha>`. Con: ~50ms on large repos—skip if repo > threshold.)* | **Option B** with repo-size guard and per-turn deduplication. |
| **Exceeding Claude Code on Multi-Agent SDLC** | Keep `cf-implement` and `cf-qa-review` as prose skill instructions. *(Pro: readable. Con: coordinator manually babysits subagents and parses free-form text.)* | Ship **`run_workflow` Python Orchestration Pipelines** (`workflows/cf_implement.py`, `workflows/cf_qa_gate.py`) using `parallel()`, `workspace="share"`, `trajectory()` error mining, and JSON-schema `finish` gates + an **MCP App Mission Control Pane**. *(Pro: deterministic, typed, self-healing reviewer↔fixer loops impossible in Claude Code. Con: requires Python 3.8+ and schema maintenance.)* | **Option B** — This is Antigravity's single highest-leverage differentiator. |

---

## 4. Dependency & Tooling Evaluation

All proposed extensions to `antigravity-code-factory` prioritize **Python 3 standard library** (zero third-party runtime dependencies for core hooks/sidecars) plus vetted, permissive-license ecosystem tools for optional companion modules:

| Component / Tool | Purpose | License | Security / Maintenance Posture | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Python 3 stdlib** (`json`, `re`, `sqlite3`, `socket`, `subprocess`, `pathlib`) | Core hooks (`hitl-gate.py`, feedback bridge, git-shadow checkpoints, loop breaker, sidecar daemon) | PSF License (Permissive) | Zero supply-chain risk; pre-installed on macOS/Linux; already required by `run_workflow`. | **Approve (Core)** |
| **ripgrep (`rg`) & `fd`** | Fast structured search if exposed via thin MCP search wrapper | MIT / Apache-2.0 | Industry-standard Rust binaries; active maintenance; no known High/Critical CVEs. | **Approve (Optional MCP)** |
| **ast-grep (`sg` / `ast-grep-mcp`)** | Structural AST search & codemods (surpasses regex grep) | MIT | Actively maintained Rust AST engine; read-only queries safe in sandbox. | **Approve (Optional MCP)** |
| **LSP-over-MCP** (`isaacphi/mcp-language-server` or `oraios/serena`) + Language Servers (`vtsls`, `pyright`, `gopls`) | IDE-grade `goToDefinition`, `findReferences`, `diagnostics` in App/CLI | BSD-3-Clause (`mcp-language-server`), MIT (`serena`, `vtsls`, `pyright`), BSD-3-Clause (`gopls`) | Run locally over stdio; verify pinned release tags/SHAs before bundling; avoid unpinned `npx @latest` in production configs. | **Approve as Companion Plugin** (pinned versions) |
| **`mcp-remote`** (only if bridging legacy SSE MCP servers) | Stdio bridge for legacy 2024-11-05 SSE endpoints | MIT | Official bridge referenced in Antigravity docs; pin exact version if used. | **Conditional (only for legacy SSE)** |
| **`@modelcontextprotocol/sdk` + `@modelcontextprotocol/ext-apps`** (for MCP App dashboard) | Interactive Code Factory Mission Control side-pane UI | MIT | Official Anthropic/MCP packages; audit with `npm audit --audit-level=high` before pinning. | **Approve (Phase 3)** |

---

## 5. Security & Performance Impact Assessment

### Security Impact
1. **Fail-Closed Hook Contract:** As learned in `code-factory` v2.1.0, returning `{}` from Antigravity's `PreToolUse` hook fails closed (hard denies the tool). Every `PreToolUse` handler MUST emit an explicit `"decision"` (`"allow"`, `"ask"`, `"force_ask"`, or `"deny"`) and default to `"ask"` on malformed stdin.
2. **Closing Secret-Exfiltration & File-Boundary Gaps:** Expanding `PreToolUse` to match `edit_file|write_file` and `run_command` allows hard-`"deny"` rules on writing/reading sensitive credential paths (`.env.production`, `~/.ssh/*`, `~/.aws/credentials`, private keys) and `force_ask` on outbound data-piping commands (`curl -d`, `nc`, `scp`, `rsync` to remote hosts).
3. **Active Command Sanitization (`overwrite`):** Using `PreToolUse` `overwrite` must remain strictly transparent and minimal (e.g., enforcing `--max-time 5` on `curl` or `--no-pager` on `git`), because Antigravity logs the rewrite notice back to the agent; never silently alter destructive intent—use `deny` or `force_ask` instead.
4. **Sidecar & Local Socket Security:** Any `sidecar.json` local IPC listener MUST bind to a `0600`-permissioned Unix domain socket under `$PLUGIN_DATA` (never `0.0.0.0` TCP), validate JSON schemas on input, and never persist secret values into audit logs or `.memory/auto-memory.md`.
5. **Custom Agent Least Privilege:** Fixing `agents/cf-*.md` to declare explicit `tools:` ensures `cf-architect` and `cf-reviewer` cannot accidentally mutate production source code or run destructive shell commands, enforcing hardware-level Separation of Concerns rather than prompt-only honor-system rules.

### Performance & Context Budget Impact
1. **Synchronous Hook Latency Budget:** Because Antigravity hooks block the agent loop, every `PreToolUse` hook must stay **≤ 50ms** (pure Python stdlib regex/JSON + fast `git` check), and `PostToolUse` lint checks must target **only the single edited file** with a strict **2–3s timeout** (never whole-repo builds).
2. **20,000-Token Rules Budget Discipline:** Antigravity enforces a 24 KB per-file cap and 20,000-token aggregate rules budget. Keep `rules/AGENTS.md` lean (~6–8 KB), cap auto-injected `.memory/handover.md` at ≤ 3 KB and `.memory/auto-memory.md` at ≤ 200 lines (~2–3 KB), and place detailed workflows/playbooks in progressive-disclosure `skills/` and `workflows/`.
3. **Model Tier Economics:** Routing `flash_lite` / `flash` to high-fan-out `run_workflow` / `swarm` workers and reserving `pro` for `cf-architect` and `cf-reviewer` offsets the extra turns added by deterministic `Stop`-hook verification gates.

---

## 6. Recommended Direction: Phased Blueprint to Match & Exceed Claude Code

We recommend evolving `antigravity-code-factory` from **v2.1.0 → v3.0.0** in **3 concrete phases**, ordered by ROI and risk reduction:

### Phase 1: Close Critical Parity Gaps & Fix v2.1.0 Footguns (High Immediate ROI)
1. **Fix `agents/cf-*.md` Frontmatter (Immediate Bugfix):** Add explicit `subagent: true`, `mainAgent: false`, and least-privilege `tools:` lists (`cf-backend`/`cf-frontend`: full dev toolset; `cf-architect`/`cf-reviewer`: read-only + spec/report write).
2. **Expand `PreToolUse` Security & Hygiene Gate (`hooks/hitl-gate.py`):**
   - Add matcher coverage for `edit_file|write_file` to hard-`deny` writes to sensitive credential files (`.env*`, private keys, `~/.ssh`, `.git/config`) and detect hardcoded secret patterns (AWS keys, `sk-`, JWTs, `service_role`) *before* they hit disk.
   - Use `PreToolUse` **`overwrite`** strategically (e.g., auto-injecting `--no-pager` on `git` and `--max-time 5` on `curl` to enforce the `≤ 5000ms` HTTP invariant automatically).
3. **Implement the Two-Stage `PostToolUse` → `PreInvocation` Feedback Bridge:**
   - `PostToolUse` (`edit_file|write_file|run_command`): on file edits, run fast single-file lint/type/syntax check (`ruff`, `eslint`, `tsc` fast check, `python3 -m py_compile`) and capture tool `error` payloads; write compact diagnostics to `$PLUGIN_DATA/feedback/<conversationId>.json`.
   - `PreInvocation`: read & clear pending feedback and inject it via `injectSteps.systemMessage`—giving Antigravity deterministic post-edit self-correction equal to Claude Code's `PostToolUse` `additionalContext`.
4. **Automate Session Memory, Compaction Guardrails & Verification Stop Gate:**
   - `SessionStart` hook: auto-inject `.memory/handover.md`, `.memory/auto-memory.md` (≤ 200 lines), and `git status --short` + branch name at session start.
   - `PreInvocation` context-hygiene monitor: inspect `invocationNum` / `initialNumSteps` and inject a context-saturation warning + `cf-handover` reminder at turn 15+ (plugging the missing `PreCompact` hook) plus a hard runaway loop-breaker (`terminationBehavior: "terminate"` + `errorMessage`) if identical failing tool calls repeat ≥ 5 times.
   - `Stop` Verification Gate: when `terminationReason == "NO_TOOL_CALL"` and `continuationActive == false`, verify whether source files were modified since the last green test/lint run; if unverified, return `{"decision": "continue", "reason": "..."}` to enforce deterministic test verification before ending a turn.

### Phase 2: Add Semantic Code Intelligence, Git-Shadow Checkpoints & Async Sidecar
5. **Git-Shadow Checkpoint Engine + `cf-rewind` Skill:**
   - Once per user turn before the first mutating tool call, snapshot working state via `git stash create` into `$PLUGIN_DATA/checkpoints/<conversationId>.jsonl`—surpassing Claude Code's `/rewind` by capturing shell-mutated files as well as tool edits.
6. **Async Sidecar Daemon (`sidecars/telemetry-memory/sidecar.json`):**
   - Local Unix-socket Python daemon (`restart_policy: "on-failure"`) providing non-blocking (`<10ms` hook emit) structured audit logs, optional HTTP webhook forwarding (plugging missing `type: "http"` + `"async": true` hooks), and background distillation of verified session lessons into `.memory/auto-memory.md` (plugging Claude Code's Auto Memory).
7. **Companion Code-Intelligence Plugin (`code-factory-lsp`):**
   - Separate toggleable plugin shipping pinned `mcp_config.json` for LSP-over-MCP (`mcp-language-server` / `ast-grep-mcp`) so Antigravity gains IDE-grade `goToDefinition`, `findReferences`, and structural AST refactoring across App, CLI, and Headless modes.

### Phase 3: Leapfrog Claude Code Using Antigravity's Asymmetric Superpowers
8. **Typed `run_workflow` SDLC Engines (`workflows/`):**
   - Ship reusable Python workflow scripts for Stage 3 (`cf_implement_workflow.py`: parallel `workspace="share"` workers per locked spec partition + automated merge/test gate) and Stage 4 (`cf_qa_workflow.py`: parallel static-analysis + `cf-reviewer` + `browser` 375/768/1440px visual audit + iterative fixer loop until JSON-schema `{"passed": true, "blocking_defects": []}` succeeds).
9. **Interactive Code Factory Mission Control (`MCP App`):**
   - Build a lightweight MCP App UI rendered directly inside Antigravity's side pane displaying live SDLC stage progress, invariant pass/fail badges, git-shadow checkpoint timeline with one-click rollback, and hook/budget telemetry—an engineering control plane impossible in a terminal-only harness.
10. **Headless CI/CD & Cost-Guarded Runner (`scripts/cf-ci-runner.py`):**
    - Wrap the Antigravity Python SDK (`google-antigravity`) / `agy -p --output-format stream-json` with a hard token/USD budget circuit breaker, schema validation, and JUnit/SARIF output for GitHub Actions PR review and automated remediation.

---

## 7. Stage 1 Senior Engineer Sign-Off Gate

Before advancing to **Stage 2** (`cf-grill-me` / `cf-plan` to lock a formal specification for `code-factory` v3.0.0), please confirm:
1. **Technical Trade-Offs:** Are the harness differences and architectural trade-offs (Two-Stage Hook Bridge, Local Sidecar, Companion LSP Plugin, Git-Shadow Checkpoints, `run_workflow` Pipelines) explicitly enumerated and aligned with your priorities?
2. **Dependency Compliance:** Are the zero-dependency Python stdlib core + MIT/BSD-3-Clause optional companions (`ast-grep`, `mcp-language-server`, `@modelcontextprotocol/sdk`) approved for license and supply-chain compliance?
3. **Security Posture:** Are the upfront security impacts (fail-closed `PreToolUse`, secret write blocking, transparent `overwrite` bounds, `0600` Unix-socket IPC, least-privilege `agents/*.md` tool grants) acceptable?
4. **Scope Selection:** Which phases (Phase 1 only, Phases 1–2, or Phases 1–3) should we lock into Stage 2?
