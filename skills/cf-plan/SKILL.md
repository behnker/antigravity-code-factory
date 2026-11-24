---
name: cf-plan
description: >-
  Stage 2B of the Enterprise Code Factory SDLC: translates research and answered
  requirements into a formally locked Spec-Driven Development document at
  plans/<feature-name>-spec.md. Use after cf-research and cf-grill-me and before cf-implement.
---

# Skill: Stage 2B — System Design & Spec-Lock

Produce a self-contained, formally locked specification before any production code is written.

## Steps

1. Read `.memory/research.md`, `.memory/architecture.md`, `.memory/decisions/`, and the user's answered requirements from `cf-grill-me`.
2. Create `plans/<feature-name>-spec.md` (using `plans/templates/feature-spec-template.md` if present) with all required sections:
   - **Overview & Goals:** Context, success criteria, and explicit non-goals.
   - **System Architecture:** Mermaid sequence and/or component diagrams showing boundaries and data flow.
   - **API Contracts & Validation Schemas:** Fully typed request/response contracts (Zod / TypeScript / Pydantic / JSON Schema), pagination defaults/max limits, auth policies, and explicit error codes.
   - **Database & State Changes:** Schema additions/modifications, migration notes, foreign keys, and indexes.
   - **UI/UX & Accessibility Specs:** Component hierarchy, state diagrams (Loading / Error / Empty), design token usage, responsive behavior, and WCAG 2.1 AA criteria.
   - **Selective Autonomy & Verification Oracles:** Classify each task as **Lights-Out** (crisp machine oracle) vs. **Human-Lit** (auth, security/RLS, finance, infra, architecture) and declare the exact verification commands/schemas required before merge.
   - **Atomic Task Breakdown:** Decomposed into non-overlapping file partitions (max 3–5 concurrent worker loops) so parallel workers never edit the same file concurrently. If multiple modules share an interface/types file, list that shared interface as **Task 0 (Prerequisite)** to be completed first.
3. If the design introduces a significant architectural choice, record an ADR in `.memory/decisions/NNNN-<slug>.md`.
4. **Stage 2 Senior Engineer Sign-Off Gate** — Prompt the user to verify and sign off on `plans/<feature-name>-spec.md`:
   - Is the spec completely self-contained with no implicit assumptions?
   - Do API contracts include validation schemas and error codes?
   - Is the task checklist decomposed into atomic, non-overlapping subagent actions?
5. Do **not** proceed to `cf-implement` until the user explicitly locks/approves the spec.
