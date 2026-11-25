---
name: cf-qa-review
description: >-
  Stage 4 of the Enterprise Code Factory SDLC: runs static analysis, type
  checking, test coverage, independent security/invariant review, and browser
  visual UI/UX auditing (375px, 768px, 1440px), producing .memory/qa-report.md.
  Use after Stage 3 implementation and before staging deployment.
---

# Skill: Stage 4 — QA, Security Scan & UI/UX Visual Audit

Verify quality, security, accessibility, and visual fidelity before staging deployment.

## Steps

1. **Automated Code Quality & Security Checks:**
   Run the project's applicable checks:
   - **TypeScript / Zod Core:**
     - Linter: `npm run lint` (or `npx eslint .` / `npx biome check .`)
     - Typechecker: `npx tsc --noEmit`
     - Unit & integration tests with coverage: `npm test -- --coverage` (or `npx vitest run --coverage`)
     - Dependency / SAST audit: `npm audit --audit-level=high` (or `ruff check` / `pytest --cov` / `pip-audit` for Python; `cargo clippy` / `cargo test` for Rust)
     - Architecture boundary check *(when `.dependency-cruiser.*` is present)*: `npx depcruise src --config .dependency-cruiser.cjs` (also run automatically by `cf-next-verify`).
     - Verify every external API/webhook/RPC boundary validates payloads with Zod (or Pydantic/Valibot) schemas rather than raw `as` type assertions.
   - **Cloudflare Workers** *(when `wrangler.jsonc` / `wrangler.toml` is present)*:
     - Regenerate & verify typed bindings: `npx wrangler types` followed by `npx tsc --noEmit`
     - Bundle & binding dry-run check: `npx wrangler deploy --dry-run`
     - Confirm zero in-memory cross-request state and valid webhook signature verification.
   - **Vercel Functions / Next.js** *(when `vercel.json` / `next.config.*` is present)*:
     - Production build verification: `npx vercel build` (or `npm run build`)
     - Verify Edge routes avoid Node-only APIs, serverless routes declare `maxDuration`, and no server secrets leak via `NEXT_PUBLIC_*`.
   - **Supabase Edge Functions & Postgres** *(when `supabase/` is present)*:
     - Schema drift check: `npx supabase db diff`
     - Typecheck Edge Functions: `deno check supabase/functions/**/*.ts` (when Deno is installed)
     - Verify every public/user table has `ENABLE ROW LEVEL SECURITY` with explicit RLS policies and zero `service_role` keys in client code.
2. **Independent Dual-Axis Review (Output + Trajectory via `cf-eval`):**
   - Never let the generator grade its own homework: inspect `git diff` via a fresh `cf-reviewer` subagent decoupled from the implementation context.
   - Grade **Output Quality** against every invariant in `rules/AGENTS.md` (zero hardcoded secrets, runtime schema validation at boundaries, parameterized queries / no shell concat, pagination limits, HTTP timeouts/retries, WCAG 2.1 AA, deterministic tests, edge-case coverage).
   - Grade **Execution Trajectory** per `skills/cf-eval/SKILL.md`: verify strict spec/partition adherence, anti-gaming oracle honesty (zero weakened tests or silenced lint/type rules), cross-viewport blind-spot protection, and Human-Lit compliance on security/auth/infra/dependency changes.
3. **Feature Map Smoke Gate & Visual UI/UX Audit (if UI/route/API files were modified):**
   - Verify `.memory/feature-map.md` was updated in the same commit whenever routes, endpoints, or `data-testid` selectors changed.
   - Run `cf-verify-map` against `.memory/feature-map.md` (`--all-viewports`) as the deterministic pre-flight gate (Playwright headless runner when installed, or `browser` subagent fallback).
   - Start the local dev server (as a daemon/background process if not already running).
   - Delegate visual inspection to the **`browser` subagent** to open the modified pages and verify:
     - Responsive rendering at **Mobile (375px)**, **Tablet (768px)**, and **Desktop (1440px)**
     - Loading, Error, and Empty UI states + layout stability (no obvious CLS)
     - Keyboard focus visibility, labels, and contrast (WCAG 2.1 AA)
     - Zero uncaught JavaScript console errors or failed network requests
4. **Write `.memory/qa-report.md`:**
   Include:
   - Command results summary (lint, typecheck, tests & coverage, SAST/audit)
   - Invariant compliance checklist (Pass / Fail with file:line citations)
   - Browser visual QA summary & screenshot references (or "N/A — no UI changes")
   - Blocking defects (must fix before Stage 5) vs. non-blocking observations
5. **Stage 4 Outer-Loop Sign-Off Gate (Quality / Verdict / Answerability)** — Confirm with the user:
   - **Quality:** Are all unit, integration, build, SAST, and 3-viewport browser checks 100% green?
   - **Trajectory & Verdict:** Did independent `cf-reviewer` / `cf-eval` verification confirm zero oracle-gaming and zero blocking defects?
   - **Answerability:** Can the engineer clearly explain why this change exists, why it is safe, and how to roll it back?
