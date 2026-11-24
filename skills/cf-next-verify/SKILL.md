---
name: cf-next-verify
description: >-
  Deterministic full-stack verification runbook for Next.js (App Router),
  TypeScript, Tailwind CSS, Zod, and Vitest projects (including Vercel,
  Supabase, and Cloudflare Workers edge/serverless checks). Use before opening
  a PR, after completing Stage 3 implementation, during /swarm @verifier passes,
  or whenever validating a TypeScript/Next.js build and test suite.
---

# Skill: Next.js + TypeScript + Zod + Vitest Verification

Run a single, deterministic verification pass over any Next.js / TypeScript / Tailwind / Zod / Vitest project (root repo or monorepo sub-package such as `academy/`).

## Steps

1. **Identify the target package directory** (the directory containing `package.json` and `tsconfig.json`, e.g., `.` or `academy/`).
2. **Run the bundled verification runner:**
   - **Fast inner loop (skip production build):**
     ```bash
     bash "<path-to-this-skill>/scripts/verify-stack.sh" "<target-dir>" --skip-build
     ```
   - **Full pre-PR / Stage 4 verification (includes production build & coverage):**
     ```bash
     bash "<path-to-this-skill>/scripts/verify-stack.sh" "<target-dir>" --coverage
     ```
   The script auto-detects `pnpm`, `yarn`, `bun`, or `npm`, and runs:
   - TypeScript strict check (`tsc --noEmit`)
   - Linter (`lint` script or ESLint/Biome)
   - Unit & component tests (`vitest run` / `test` script, with `--coverage` when requested)
   - Static boundary scan (`NEXT_PUBLIC_*` secret-named vars, `service_role` in `'use client'` files, and raw `as any` count in `src/`)
   - Production build (`build` script unless `--skip-build` is set)
   - Optional platform hints when `wrangler.jsonc`/`wrangler.toml`, `supabase/`, or `vercel.json` are detected
3. **Review the stack invariant checklist:**
   Read [stack-checklist.md](./references/stack-checklist.md) when reviewing non-trivial diffs, API route handlers, database access, or UI components.
4. **Report structured verification evidence:**
   Summarize each check (Pass / Fail / Skipped), exact commands run, and any blocking remediation items before declaring the task complete.
