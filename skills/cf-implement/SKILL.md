---
name: cf-implement
description: >-
  Stage 3 of the Enterprise Code Factory SDLC: executes modular code
  implementation strictly from a locked plans/<feature-name>-spec.md using
  Orchestrator-Worker or Swarm partitioning, invariant checks, and local
  verification. Use only after a spec is approved in Stage 2.
---

# Skill: Stage 3 — Modular Implementation & Swarm Coding

Execute code implementation strictly from a formally locked specification.

## Prerequisites

1. Verify a locked spec exists at `plans/<feature-name>-spec.md`. If no spec is locked, stop and direct the user to `cf-plan` first.
2. Read the active spec, `.memory/tasks.md`, and any project-local rules in `.agents/rules/`.
3. State your planned execution approach in **3 concise bullet points** before modifying files.
4. For multi-module or parallel work, read [references/orchestration.md](./references/orchestration.md) for the Orchestrator-Worker, Swarm partitioning, persona routing, and Boost protocols.

## Steps

1. **Shared Interfaces First:** If multiple modules share types, contracts, or schemas (e.g., `src/types/index.ts`), write and finalize them **before** starting parallel worker streams.
2. **Execute Implementation (Single-Stream, Swarm, or `run_workflow`):**
   - For multi-file/modular features, delegate non-overlapping file partitions (e.g., `src/backend/*`, `src/frontend/*`, `tests/*`) to isolated subagents or swarm workers (`workspace: "share"` / isolated git branches). Never let two workers edit the same file concurrently.
   - **Bundled `run_workflow` Partitioner (`workflows/cf-implement-spec/workflow.py`):** For `<= 5` strictly disjoint `owned_files` partitions, invoke `run_workflow(ScriptPath="<plugin-root>/workflows/cf-implement-spec/workflow.py", Args={"spec_path": "plans/<feature>-spec.md", "partitions": [...], "verify_cmd": "..."}, Description="Stage 3 Partitioned Implementation")` to validate disjoint ownership, run `workspace="share"` builders, and verify out-of-scope edits.
   - **Safe Pre-Turn Recovery (`cf-rewind`):** If a multi-file edit or shell command corrupts tracked state, inspect or restore pre-turn `git stash create` snapshots using `skills/cf-rewind/SKILL.md` (`--dry-run` before `--apply`).
   - Follow this build order:
     1. Core domain logic and data models
     2. Runtime validation schemas and API/RPC handlers (with auth, pagination, parameterized queries, timeouts)
     3. UI components adhering strictly to design tokens, WCAG 2.1 AA, and Loading/Error/Empty states
     4. Comprehensive deterministic unit tests (happy path, invalid inputs, null/empty, network errors)
3. **Synthesize & Verify Locally:**
   - Review all worker diffs against the Code Factory invariants (Security, Scalability, UI/UX, Testing).
   - Run the project's typechecker, linter, and unit test suite. Fix all errors and test failures before completing.
   - Update `.memory/tasks.md` with completed items.
4. **Stage 3 Senior Engineer Sign-Off Gate** — Confirm before handing off to Stage 4 (`cf-qa-review`):
   - Does all code strictly follow global and `.agents/rules/` invariants?
   - Are 100% of unit tests passing locally?
   - Is code clean, modular, and typed with zero build/lint errors?
