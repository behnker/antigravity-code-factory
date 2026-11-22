---
name: cf-learn
description: >-
  Stage 6B of the Enterprise Code Factory SDLC: distills resolved bugs and
  post-mortem lessons into permanent invariant rules (project .agents/rules/ or
  global plugin rules) and regression test requirements. Use after fixing a bug
  or completing a post-mortem so the same failure cannot recur.
---

# Skill: Stage 6B — Continuous Learning & Rule Extraction

Convert hard-won debugging lessons into permanent system guardrails.

## Steps

1. Analyze the resolved bug, incident, or post-mortem described by the user (and inspect the fix diff if available).
2. Identify the **systemic root-cause pattern** — not just the one-off symptom (e.g., missing boundary schema validation, unindexed filter column, unguarded null response, missing `:focus-visible` style, nondeterministic clock in tests).
3. Determine the right scope for the new rule:
   - **Project-specific invariant** → draft an entry in `<project-root>/.agents/rules/<category>.md`.
   - **Cross-project / universal invariant** → draft an update to the global `code-factory` plugin's `rules/AGENTS.md`.
4. Verify a **regression test** exists (or draft one) covering the exact failure mode.
5. Present the proposed rule addition and regression test check to the user for **explicit approval** before editing rule files or committing.
6. **Stage 6 Senior Engineer Sign-Off Gate** — Confirm:
   - Was the true root cause identified and addressed?
   - Was a permanent invariant rule and/or regression test added to prevent recurrence?
