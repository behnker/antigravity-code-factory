---
name: cf-triage
description: >-
  Stage 6A of the Enterprise Code Factory SDLC: analyzes staging telemetry, logs,
  edge-case bugs, and user feedback to classify severity, isolate root causes,
  and queue prioritized remediation tasks in .memory/tasks.md. Use after staging
  validation or when investigating reported incidents.
---

# Skill: Stage 6A — Telemetry & Issue Triage

Turn staging telemetry, error logs, and user feedback into actionable, prioritized engineering tasks.

## Steps

1. Gather evidence from user feedback, staging logs, error traces, metrics, or failing smoke/E2E tests.
2. For each issue, determine:
   - **Severity:** Critical (P0: outage/security/data loss) | High (P1: broken core flow) | Medium (P2: degraded UX/edge case) | Low (P3: polish)
   - **Reproduction Steps & Blast Radius**
   - **Root-Cause Hypothesis:** Pinpoint suspected files, invariants violated, or missing edge-case coverage.
   - **Recommended Remediation Path:** Quick patch vs. spec amendment (`cf-plan`).
3. Update `.memory/tasks.md` with prioritized remediation items under `In Progress` or `Up Next`, referencing the issue severity and affected modules.
4. Present the triage summary to the user for prioritization.
5. Remind the user to run `cf-learn` once any P0/P1/systemic bug is resolved so a permanent invariant or regression test prevents recurrence.
