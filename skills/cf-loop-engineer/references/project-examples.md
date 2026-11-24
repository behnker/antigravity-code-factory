# Project Examples: Practical Loop Engineering on `Project_Antigravity`

Concrete, copy-ready examples applying `cf-loop-engineer` directly to this repository (`antigravity-code-factory` plugin + `academy/` Next.js app).

---

## Example 1: Bounded Goal Loop (`/goal`) — Zero-CVE & 4-Course Verification Convergence

**Autonomy Tier:** Lights-Out inner loop with Human-Lit merge verdict  
**Why a Goal (not a Cron Loop):** Has a crisp, finite, machine-checkable completion oracle.

### Prompt
```text
/goal Converge `academy/` to zero High/Critical CVEs and verified 4-course readiness:
1. Run `cd academy && pnpm run sync:resources && pnpm audit --audit-level=high`.
2. Verify all courses under `academy/content/courses/*/course.json` parse cleanly against `CourseSchema`.
3. Run `cf-next-verify` (`tsc --noEmit`, `eslint`, `vitest run`, `next build`) and root Python hook tests (`python3 -m unittest discover -s hooks -p "test_*.py"`).
4. Stop and invoke `cf-reviewer` in a clean context to audit the final diff before reporting completion.
Circuit breaker: Stop after 3 failed remediation attempts and report the exact blocker.
```

### Independent Oracle
- `pnpm audit --audit-level=high` → `0 high / 0 critical`
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` → exit `0`
- `python3 -m unittest discover -s hooks -p "test_*.py"` → all suites `OK`
- Separate `cf-reviewer` verdict → zero blocking defects

---

## Example 2: Recurring Hygiene Loop (`/schedule`) — Weekly Factory Drift & Security Sweep

**Autonomy Tier:** Read-only diagnostic loop (never auto-pushes or edits production code)  
**Why a Schedule Loop (not a Goal):** Runs on a recurring weekly cadence to catch silent drift early.

### Schedule Prompt (Mondays 09:00)
```text
/schedule every Monday at 09:00: Run a read-only Enterprise Code Factory hygiene sweep on Project_Antigravity:
1. Run `cd academy && pnpm audit --audit-level=high` to detect newly disclosed advisories.
2. Check `.memory/handover.md` byte size (must stay <= 3072 bytes) and `rules/AGENTS.md` size (must stay <= 12 KB / well below 24 KB cap).
3. Verify `academy/src/data/generated-repo-manifest.json` matches current `skills/`, `agents/`, `hooks/`, and `academy/content/courses/` without drift.
4. Post a concise status digest listing only actionable P0/P1 drift items; do NOT modify files or push commits automatically.
```

---

## Example 3: Parallel Lit-Factory Swarm (`/teamwork`) — Non-Overlapping Feature Delivery

**Autonomy Tier:** Task 0 Human-Lit → Workers Lights-Out on disjoint partitions → Independent Verifiers  
**Concurrency Cap:** 4 workers (within the 3–5 concurrent loop ceiling).

### Architecture Partition Used on `academy/`
1. **Task 0 (Coordinator — Human-Lit):** Freeze `academy/src/lib/schemas.ts`, `contracts.ts`, and `globals.css` `@theme` tokens.
2. **Parallel Workers (4 concurrent loops, zero file overlap):**
   - `cf-backend` → `academy/scripts/`, `academy/content/courses/`, `academy/src/app/api/`
   - `cf-frontend` (3D) → `academy/src/components/three/`
   - `cf-frontend` (UI) → `academy/src/components/*.tsx`
   - `cf-tester` → `academy/tests/`
3. **Independent Grading (Decoupled Contexts):**
   - `cf-reviewer` (model: `pro`) audits `git diff` against `rules/AGENTS.md` and `.agents/rules/academy-invariants.md`.
   - `browser` (model: `flash`) audits `375px`, `768px`, and `1440px` viewports so desktop optimizations never silently break mobile layouts.

---

## Example 4: Delegation Boundary Decision Table on This Repo

| Task on `Project_Antigravity` | Autonomy Tier | Required Oracle & Gate |
| :--- | :--- | :--- |
| Add/edit a course step in `academy/content/courses/*/course.json` | **Lights-Out** | `CourseSchema` Zod parse via `sync:resources` + Vitest + `next build` |
| Expand unit tests in `academy/tests/` or `hooks/test_*.py` | **Lights-Out** | Deterministic Vitest / `unittest` pass with zero flaky timers |
| Modify `hooks/hitl-gate.py` or `hooks/secret-guard.py` | **Human-Lit** | Unit test suite + independent `cf-reviewer` security audit + human approval |
| Update `academy/src/app/api/*` input boundaries or Vercel deployment | **Human-Lit** | Zod validation + `cf-reviewer` + rollback plan + HITL `force_ask` approval |
| Add a new npm dependency to `academy/package.json` | **Human-Lit** | Stage 1 license audit (reject proprietary EULAs like GSAP) + `pnpm audit` + human approval |
