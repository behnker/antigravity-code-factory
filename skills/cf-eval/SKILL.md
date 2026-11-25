---
name: cf-eval
description: >-
  Runs dual-axis Agentic Verification (Output Quality + Execution Trajectory
  Evaluation) in a clean, decoupled context ("never let the generator grade its
  own homework"). Operationalizes Day 4 Agent Security & Evaluation, Agentic
  Code Quality, and Outer-Loop Accountability. Use after implementation or
  before merging/deploying any agent-authored change.
---

# Skill: Dual-Axis Output & Trajectory Evaluation (`cf-eval`)

Verification is the line between **vibe coding** and **agentic engineering**. Traditional code review only checks the final diff—and breaks down when agents generate hundreds of lines per minute. `cf-eval` moves quality into the harness and grades **both** the final output and the agent's execution trajectory in a clean context.

Read [references/eval-rubric.md](./references/eval-rubric.md) for the full scoring rubric and real `Project_Antigravity` failure catches.

## Core Rule: Never Let the Generator Grade Its Own Homework

Always run `cf-eval` in a **decoupled subagent context** (`cf-reviewer` / `cf-tester`) or fresh session—never ask the same builder turn that wrote the code to self-certify it.

## Axis 1 — Deterministic Output Evaluation (The Artifact)

Verify machine-checkable quality gates first so human reviewers never waste cycles on mechanical issues:

1. **Contract & Schema Integrity:** All external boundaries (API routes, webhooks, JSON content bundles, hook payloads) validate at runtime with Zod / Pydantic / JSON Schema. Zero unsafe `as` casts.
2. **Build, Types, Lint & Architecture Boundaries:** `tsc --noEmit`, linter (0 warnings), `depcruise` architectural boundary rules (when `.dependency-cruiser.*` is configured), production build (`next build` / `wrangler deploy --dry-run`), and `pnpm audit --audit-level=high` (0 High/Critical CVEs).
3. **Deterministic Test & Edge-Case Coverage:** Happy path, invalid inputs, null/empty states, downstream error states, and regression tests for previously discovered bugs.
4. **Security & Platform Invariants:** Zero hardcoded secrets, zero `NEXT_PUBLIC_*` / `service_role` leaks, explicit Postgres RLS on new tables, parameterized queries, fail-closed hooks (never `{}` in `PreToolUse`).
5. **Multi-Viewport & Accessibility (if UI changed):** Verify **375px**, **768px**, and **1440px** via the `browser` subagent—catching desktop-only bias, contrast `< 4.5:1`, invalid WAI-ARIA roles, CLS, and console errors.

## Axis 2 — Execution Trajectory Evaluation (How the Agent Got There)

Audit the agent's process (git diff, tool calls, `.memory/` trail, and spec adherence):

1. **Spec & Scope Discipline:** Did the agent stay strictly inside the locked `plans/<feature>-spec.md` and file partition, or did it invent unapproved routes, dependencies, or silent refactors?
2. **Context & Token Hygiene:** Did it keep always-on rules lean, load progressive skills on demand, and avoid redundant full-file rewrites or context thrashing?
3. **Oracle Honesty (Anti-Gaming Check):** Did the agent *weaken tests, silence lint rules, bypass hooks, or add `@ts-ignore` / `eslint-disable`* to force a green build? (Automatic **FAIL**.)
4. **Cross-Surface Blind-Spot Check:** Did optimizing one dimension break another (e.g., improving desktop layout while breaking 375px mobile, changing routes/selectors without updating `.memory/feature-map.md`, or adding a new agent/skill file without updating manifest/tests)?
5. **HITL & Delegation Compliance:** Were high-blast-radius tasks (auth, security, finance, infra, deps, deploys) kept Human-Lit with explicit approval rather than run lights-out?

## Output Format: Dual-Axis Eval Verdict

Produce a concise scorecard (in `.memory/qa-report.md` or review output):
- **Output Score (Pass / Fail):** Exact command outputs + `file:line` findings.
- **Trajectory Score (Pass / Warn / Fail):** Spec adherence, oracle honesty, blind-spot audit, HITL compliance.
- **Outer-Loop Answerability Statement:** 2–3 sentences a human engineer can stand behind explaining *what changed*, *why it is safe*, and *how to roll it back*.
- **Verdict:** `SHIP` (zero blockers) | `REVISE` (blocking defects listed) | `BLOCK` (security/oracle violation).
