# Research Synthesis: The New SDLC, Lit Software Factories & Practical Loop Engineering

**Stage:** 1 (`cf-research`)  
**Date:** 2026-11-24  
**Source Corpus:**
1. **Google & Kaggle — *5-Day AI Agents: Intensive Vibe Coding Course* (May–June 2026)** *(Addy Osmani, Shubham Saboo, Sokratis Kartakis)*
   - Day 1: *The New SDLC With Vibe Coding: From Ad-hoc Prompting to Agentic Engineering* (51-page whitepaper)
   - Day 2: *Agent Tools & Interoperability* (external APIs, code execution, MCP servers, A2A)
   - Day 3: *Agent Skills* (long-term memory, state, token optimization, reusable progressive-disclosure skills)
   - Day 4: *Vibe Coding Agent Security and Evaluation* (HITL triage, automated threat scans, guardrails, eval suites)
   - Day 5: *Spec-Driven Production Grade Development in the Age of Vibe Coding* (governed cloud deployments & scaled PR reviews)
2. **Addy Osmani — *The New Software Lifecycle*** *(June 16, 2026 [blog](https://addyosmani.com/blog/new-sdlc-vibe-coding/) / July 15, 2026 [O'Reilly Radar](https://www.oreilly.com/radar/the-new-software-lifecycle/))*
3. **Addy Osmani — Fall 2026 O'Reilly Radar Arc**
   - *Own the Outer Loop* (Sept 9, 2026)
   - *Software Factories, Light and Dark* (Sept 18, 2026) — [oreilly.com/radar/software-factories-light-and-dark/](https://www.oreilly.com/radar/software-factories-light-and-dark/)
   - *Human Judgment Doesn't Leave the Software Factory, It Relocates* (Sept 25, 2026) — [oreilly.com/radar/human-judgment-doesnt-leave-the-software-factory-it-relocates/](https://www.oreilly.com/radar/human-judgment-doesnt-leave-the-software-factory-it-relocates/)
   - *Agentic Code Quality* (Oct 15, 2026)
   - *Practical Loop Engineering* (Nov 2, 2026) — [oreilly.com/radar/practical-loop-engineering/](https://www.oreilly.com/radar/practical-loop-engineering/)

---

## 1. Core Architectural Pillars Extracted

### Pillar A: `Agent = Model + Harness` (10% Model / 90% Harness)
- Raw LLM weights (~10%) supply syntax generation and reasoning; the **harness (~90%)** supplies instruction files (`rules/AGENTS.md`), tools & MCP servers, OS sandboxes, orchestration loops, deterministic hooks (`PreToolUse`, `PostToolUse`, `Stop`), and observability.
- Most production failures are **harness failures** (noisy context, missing tools, weak oracles, unguarded shell actions), not model failures.

### Pillar B: Context Engineering & Economics (Static vs. Dynamic)
- **Static Context** (`rules/AGENTS.md`, `.agents/rules/*.md`) loads on every turn—reliable, but expensive if bloated (degrades reasoning via lost-in-the-middle and inflates token spend).
- **Dynamic Context** (`skills/*/SKILL.md` progressive disclosure, `.memory/` retrieval, MCP lookups) loads strictly on demand.
- **Model Routing as a Financial Lever:** Pair high-reasoning models (`pro`) with upstream architecture/spec design and independent review; route fast, cost-efficient models (`flash`) to bounded parallel implementation and browser visual sweeps.

### Pillar C: `Loop -> Harness -> Factory` (Light vs. Dark Factories)
- Generation is wide and cheap; **verification is the narrow neck**. Speeding up generation without scaling automated verification only deepens the human review pile.
- **Dark Factory:** Autonomous loops ship code verified purely by machines with zero human oversight—high throughput, but accumulates silent architectural debt and optimizes the wrong product intent.
- **Lit Factory:** Uses the exact same high-leverage automated inner loops while keeping the lights on—relocating human judgment **upstream** (intent, specs, architecture, verification oracles) and **downstream** (governance, verdict, release accountability).

### Pillar D: Own the Outer Loop (Quality, Verdict, Answerability)
Agents own the **inner loop** (investigate → implement → verify → iterate). Humans own the **outer loop** across three non-negotiable obligations:
1. **Quality:** Installing deterministic harness gates (types, lint, unit/property tests, SAST, browser checks) before delegating work.
2. **Verdict:** Making the explicit ship / block / revise call using structured verification evidence.
3. **Answerability:** Being able to explain *why* every shipped change exists and *why* it is safe.

### Pillar E: Practical Loop Engineering & Selective Autonomy
- **Goals vs. Loops:**
  - **Goals (`/goal`):** Run-until-done deliverables backed by an independent, machine-checkable completion oracle (e.g., fix all High/Critical CVEs and verify `pnpm audit` + full test suite pass).
  - **Loops (`/schedule`):** Recurring cadence jobs like cron (e.g., weekly hygiene sweep, log polling, dependency drift monitoring) with explicit escalation rules.
- **Concurrency Ceiling:** Humans can oversee roughly **3–5 concurrent loops** (5–10 daily runs) before review quality collapses.
- **Never Let the Generator Grade Its Own Homework:** Always split execution and verification across separate subagent contexts (`cf-backend`/`cf-frontend` vs. `cf-reviewer`/`cf-tester`/`browser`) so blind spots (such as fixing desktop while breaking 375px mobile) get caught.
- **Output + Trajectory Evaluation:** Verification must evaluate *both* the final code artifact and the agent's execution trajectory (did it respect constraints, avoid skipping tests, obey HITL gates, and stay within scope?).
- **Selective Autonomy Matrix:**
  - *Lights-Out Candidates (crisp oracles):* Docs, unit/property tests, lint/type fixes, Zod-validated JSON content bundles, repetitive migrations with deterministic diffs.
  - *Human-Lit Mandatory (high blast radius):* Authentication, security/RLS policies, billing/finance, infrastructure/system access, irreversible schema migrations, core architectural contracts.

---

## 2. Direct Mapping to `Project_Antigravity` (`code-factory` v2.3.0 + `academy/`)

| Framework Concept | Concrete Implementation in This Repository |
| :--- | :--- |
| `Agent = Model + Harness` (10/90) | `rules/AGENTS.md`, `hooks/hitl-gate.py`, `hooks/secret-guard.py`, `agents/cf-*.md` (least-privilege `tools:`), `skills/cf-*/` |
| Static vs. Dynamic Context Engineering | Lean always-on `rules/AGENTS.md` (< 10 KB) + 14 progressive-disclosure `skills/cf-*/SKILL.md` + `references/` + <= 3 KB `.memory/handover.md` |
| `Loop -> Harness -> Factory` (Lit Factory) | 8-stage SDD pipeline (`cf-research` -> `cf-grill-me` -> `cf-plan` -> `cf-implement` -> `cf-qa-review` -> `cf-deploy-staging` -> `cf-triage` -> `cf-learn`) |
| Own the Outer Loop (Quality / Verdict / Answerability) | Mandatory Senior Engineer Sign-Off Gates in `cf-research`, `cf-plan`, `cf-qa-review`, `cf-deploy-staging` + `.memory/decisions/` ADRs |
| Never Let the Generator Grade Its Own Homework | Clean-context `cf-reviewer` + `cf-tester` + multimodal `browser` subagent + `skills/cf-eval/SKILL.md` |
| Goals (`/goal`) vs. Loops (`/schedule`) | `skills/cf-loop-engineer/SKILL.md` + `skills/cf-loop-engineer/references/project-examples.md` |
| Output + Trajectory Evals (Day 4 Security & Eval) | `skills/cf-eval/SKILL.md` + `skills/cf-eval/references/eval-rubric.md` + `skills/cf-next-verify/` |
| Day 5 Spec-Driven Cloud Graduation | `plans/antigravity-academy-spec.md` -> Vercel staging preview + `cf-deploy-staging` smoke tests + rollback plan |
| Curriculum Integration | Woven into Courses 01 (`harness-mastery`), 02 (`code-factory-sdlc`), 03 (`pro-setup-playbook`), and new Course 04 (`lit-software-factory`) |
