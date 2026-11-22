---
name: cf-deploy-staging
description: >-
  Stage 5 of the Enterprise Code Factory SDLC: gates staging deployment under
  strict human-in-the-loop approval, verifies Stage 4 QA clearance, documents a
  rollback plan, runs post-deploy smoke tests, and generates release notes. Use
  when promoting approved code to a staging environment.
---

# Skill: Stage 5 — Sandboxed Deployment & Staging Gate

Promote QA-approved code to staging with explicit human sign-off and a documented rollback path.

## Steps

1. **Pre-Flight Verification:**
   - Verify `.memory/qa-report.md` exists and shows Stage 4 passed with zero blocking defects.
   - Run `git status -s` and confirm the working tree is clean on the intended branch/commit.
   - Review pending database migrations, environment variable changes, or infrastructure diffs.
2. **Document Rollback Plan First:**
   - Record the exact rollback procedure (previous commit/image tag, migration down-step or backward-compatibility notes, feature flag toggle) in `.memory/handover.md`.
3. **Mandatory Human-in-the-Loop (HITL) Approval Gate:**
   - Present the exact deployment commands, target staging environment, commit SHA, migration plan, and rollback plan to the user.
   - **Stop and wait for explicit user approval** before executing any deployment, `git push`, container push, `kubectl apply`, or migration command.
4. **Execute & Verify Staging:**
   - Run the approved staging deployment command and capture build/deploy logs.
   - Execute automated smoke tests against the live staging endpoint (health checks, key API routes, auth check).
   - Draft concise release notes (summary, commit range, migrations, verification results).
5. **Stage 5 Senior Engineer Sign-Off Gate** — Confirm with the user:
   - Did staging deployment complete with zero schema or runtime errors?
   - Are automated smoke tests green in live staging?
   - Is the verified rollback plan documented in `.memory/handover.md`?
