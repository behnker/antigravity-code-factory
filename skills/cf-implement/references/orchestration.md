# Advanced Orchestration Engine & Execution Protocols

Reference playbook from **Antigravity Enterprise Code Factory Blueprint v2.0.0 (Section 4)**.

## 1. Orchestrator-Worker Protocol

The **Orchestrator** runs in a high-reasoning context window responsible for decomposing goals, managing context consumption, and delegating non-overlapping work to specialized worker subagents.

### Orchestrator Responsibilities
1. **Separation of Concerns:** The context window that designs/locks a spec should not directly write bulk implementation code in the same bloated session.
2. **Context Management:** Monitor context saturation. Around **~65% token saturation**, every **15–20 turns**, or whenever consumption crosses ~100k tokens, recommend `/compact <Summary Goal>` or run `cf-handover`.
3. **Task Decomposition:** Deconstruct specs into atomic file operations so no two worker subagents edit the exact same file concurrently.
4. **Synthesis & Verification:** Audit worker outputs against global and `.agents/rules/` invariants before checking off tasks in `.memory/tasks.md`.

## 2. Subagent Persona Profiles & Model Routing

| Persona | Primary Role | Model Class / Strategy | Context & Tool Access |
| :--- | :--- | :--- | :--- |
| **Technical Architect** | System design, API contracts, schema design, ADRs | High-Reasoning / Deep Thinking (`pro` / `inherit`) | Read-only workspace tools, `.memory/`, `plans/` |
| **Backend Engineer** | Domain logic, data models, API endpoints, services | Fast / High-Throughput Coding | Terminal execution, file read/write, local test tools |
| **Frontend/UI Engineer** | Components, CSS/Tailwind, UI state, accessibility | Fast Coding with UI awareness | Terminal, UI component code, preview tools |
| **Visual QA Auditor** | E2E user flow verification, visual regressions, layout | Multimodal Vision (`browser` subagent) | Built-in `browser` subagent, screenshot & console audit |
| **Security & Reviewer** | Code review, vulnerability scanning, boundary audit | High-Reasoning (fresh context / distinct reviewer) | Static analysis outputs, `git diff`, SAST tools |

## 3. Swarm Protocol (Parallel Subagent Execution)

Use parallel subagents or `swarm` workers for large multi-file refactors or modular features under two strict guardrails:

1. **Strict File Partitioning (Zero Overlap):**
   - Worker A: `src/backend/*`
   - Worker B: `src/frontend/*`
   - Worker C: `tests/*`
   - **Shared Interface Rule:** If multiple workers depend on a shared interface/types file (e.g., `src/types/index.ts`), the Orchestrator **must finalize that interface file first** before launching parallel workers.
2. **Git Branch / Share Isolation:**
   - Run parallel writing workers in isolated working copies (`workspace: "share"` or dedicated feature sub-branches such as `feat/<feature>-api` and `feat/<feature>-ui`).
   - The Orchestrator merges completed work back into the feature root branch, resolves any conflicts, and runs full verification.

## 4. Boost Protocol (Performance & Token Optimization)

- **Spec & Planning Phase:** Use deep reasoning mode.
- **Batch Implementation Phase:** Delegate modular implementation chunks to fast parallel workers with tight, spec-grounded briefs.
- **QA & Verification Phase:** Use an independent reviewer context + multimodal `browser` subagent for visual inspection.

## 5. Human-in-the-Loop (HITL) Execution Boundaries

- **Autonomous (Low-Friction):** `git status`, `git diff`, `npm test`, `pytest`, `npx eslint`, `cargo check`, typechecking, read-only inspection.
- **Explicit Human Approval Required:** `git push`, `npm publish`, `rm -rf`, `docker push`, `kubectl apply`, database schema migration execution, production deployments, and third-party dependency additions.
