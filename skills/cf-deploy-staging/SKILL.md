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
4. **Execute & Verify Staging (Platform Runbooks — After Explicit Approval):**
   - **Cloudflare Workers:**
     - Preview / staging deploy: `npx wrangler versions upload` or `npx wrangler deploy --env staging` (or `npx wrangler d1 migrations apply <db> --env staging --remote` if D1 migrations exist).
     - Rollback command to record in `.memory/handover.md`: `npx wrangler rollback` (or `npx wrangler versions deploy <previous-version-id>`).
   - **Vercel:**
     - Preview / staging deploy: `npx vercel deploy` (never pass `--prod` during Stage 5 staging).
     - Rollback command to record in `.memory/handover.md`: `npx vercel rollback <previous-deployment-url>`.
   - **Supabase:**
     - Dry-run DB migrations first (`npx supabase db push --dry-run`), then apply to staging branch/project (`npx supabase db push`) and deploy Edge Functions (`npx supabase functions deploy <fn-name>`).
     - Record migration down-script / branch reset rollback steps in `.memory/handover.md`.
   - **Post-Deploy Verification:**
     - Capture build/deploy logs and verify zero runtime or schema errors.
     - Run automated smoke tests against the live staging URL (health check, authenticated route check, invalid-input 400 validation check).
     - Draft concise release notes (summary, commit range, migrations, verification results).
5. **Stage 5 Senior Engineer Sign-Off Gate** — Confirm with the user:
   - Did staging deployment complete with zero schema or runtime errors?
   - Are automated smoke tests green in live staging?
   - Is the verified rollback plan documented in `.memory/handover.md`?
