---
name: cf-loop-engineer
description: >-
  Operationalizes Practical Loop Engineering and Lit Software Factory
  governance: selects between Goals (/goal), Recurring Loops (/schedule),
  Swarms (/teamwork), and Typed Pipelines (run_workflow), enforces the
  Selective Autonomy Matrix, caps concurrency (3-5 active loops), and splits
  generator vs. verifier subagents. Use when designing autonomous or recurring
  agent workflows.
---

# Skill: Practical Loop Engineering & Lit Factory Control

Design bounded, self-correcting agent loops where agents own the **inner loop** (investigate → implement → verify → repeat) and engineers **own the outer loop** (**Quality**, **Verdict**, **Answerability**).

Read [references/project-examples.md](./references/project-examples.md) for concrete, runnable examples executed on `Project_Antigravity` (`antigravity-code-factory` + `academy/`).

## 1. Choose the Right Execution Primitive (Goals vs. Loops vs. Swarms)

| Need | Primitive | Stopping Condition / Oracle | Concurrency Guidance |
| :--- | :--- | :--- | :--- |
| One-shot deliverable that must run until verified | **Goal** (`/goal` or bounded subagent) | Independent machine-checkable completion oracle (tests, audit, schema, build) | 1 focused goal per workstream |
| Recurring maintenance, polling, or hygiene cadence | **Loop** (`/schedule` cron) | Fixed cadence + alert/escalation threshold; never auto-merge high-risk diffs | Low-frequency scheduled jobs |
| Multi-module feature from a locked spec | **Swarm** (`/teamwork` / `swarm`) | Task 0 shared interfaces locked; non-overlapping file partitions | **Max 3–5 concurrent loops** |
| Repeatable multi-gate pipeline with typed outputs | **Workflow** (`run_workflow`) | JSON-schema `finish` contract + independent verifier stage | Fan-out bounded by machine & review capacity |

> **Bundled Code Factory Pipelines (`workflows/`):** Use `run_workflow(ScriptPath="<plugin-root>/workflows/cf-implement-spec/workflow.py", ...)` for Stage 3 disjoint `workspace="share"` builds (`<= 5` partitions) and `run_workflow(ScriptPath="<plugin-root>/workflows/cf-qa-gate/workflow.py", ...)` for Stage 4 parallel `cf-reviewer` + `cf-tester` + `browser` `SHIP`/`BLOCK` gates. Recover failed turns safely via `cf-rewind` (`skills/cf-rewind/SKILL.md`).

## 2. Classify Selective Autonomy Before Launching

Classify every task into **Lights-Out** or **Human-Lit** before starting the loop:

- **Lights-Out Candidates (Short Loops + Crisp Oracles):**
  - Documentation updates, unit/property test expansion, deterministic lint/type fixes, Zod-validated JSON course/content bundles, static resource manifest regeneration.
  - Requirement: Must have a deterministic oracle (e.g., `pnpm typecheck && pnpm lint && pnpm test && pnpm build` or `pytest`) AND an independent verifier pass.
- **Human-Lit Mandatory (High Blast Radius — Never Dark Factory):**
  - Authentication, authorization, Postgres/Supabase RLS policies, billing/finance logic, secret management, `hooks/` security gates, infrastructure/production deployments, irreversible DB migrations, and core architectural contracts.
  - Requirement: Explicit Stage 2 spec lock, `cf-reviewer` clean-context audit, HITL approval gate, and human release verdict.

## 3. Loop Design Steps

1. **Define the Completion Oracle First (Shift Verification Left):**
   - Write down the exact shell command, Zod schema, Playwright/browser viewport check, or test assertion that proves completion *before* launching the generator.
   - If you cannot write an objective completion oracle, the task is not ready for an autonomous loop — run `cf-grill-me` first.
2. **Split Generator and Verifier ("Never Let the Generator Grade Its Own Homework"):**
   - Assign implementation to a builder (`cf-backend`, `cf-frontend`, or scoped worker).
   - Assign verification to a **separate, clean-context verifier** (`cf-reviewer`, `cf-tester`, or `browser`) that receives only the diff, locked spec, and oracle results—never the generator's rationalizations.
3. **Budget Context & Route Models Intentionally:**
   - Keep static rules lean (`rules/AGENTS.md` ≤ 10 KB); point loops to specific `@file` paths and progressive-disclosure skills.
   - Route `pro` to architecture, specs, and `cf-reviewer`; route `flash` to bounded parallel tasks, test runs, and `browser` viewport audits.
   - Cap active concurrent loops at **3–5** so human review never becomes a rubber-stamp bottleneck.
4. **Enforce Circuit Breakers & Escalation:**
   - Set explicit iteration caps (e.g., max 3 self-heal retries on a failing check) and escalate to the human with root-cause diagnostics rather than thrashing tokens.
   - For `/schedule` loops, define read-only audit vs. PR-draft boundaries; never schedule unapproved `git push --force` or `--prod` deploys.
5. **Outer-Loop Sign-Off (Quality / Verdict / Answerability):**
   - **Quality:** Confirm all automated gates + independent verifier passed.
   - **Verdict:** Present concise evidence so the human makes an informed Ship / Revise / Block call.
   - **Answerability:** Record *why* the change was made and *why* it is safe in `.memory/handover.md` or an ADR.
