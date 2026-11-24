# Stage 4 QA, Security Scan & UI/UX Visual Audit Report

**Date:** 2026-11-24  
**Stage:** 4 (`cf-qa-review`)  
**Target:** `antigravity-academy` (`academy/` Next.js App Router) + Root Plugin (`hooks/test_hitl_gate.py`)  
**Verdict:** **PASS (0 Blocking Code/UI Defects)** — 3 transitive/direct dependency CVE updates queued for explicit HITL approval before Stage 5 deploy.

---

## 1. Automated Command Results Summary

| Check | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **Repo Resource Sync** | `pnpm run sync:resources` | **PASS** | 28 allowlisted repo resources + 2 Zod-validated courses (`harness-mastery`, `code-factory-sdlc`) |
| **TypeScript** | `pnpm run typecheck` (`tsc --noEmit`) | **PASS** | 0 errors (strict mode) |
| **ESLint** | `pnpm run lint` (`next lint`) | **PASS** | 0 errors, 0 warnings |
| **Unit & Component Tests** | `pnpm run test:coverage` (`vitest`) | **PASS** | **27/27 tests passing** (4/4 files): `schemas.ts` 100%, `hitl-evaluator.ts` 98.44%, `prompt-engine.ts` 90.69%, `repository.ts` 90%, API routes 68–81% |
| **Production Build** | `pnpm run build` (`next build`) | **PASS** | Compiled in 4.3s; 7/7 routes built; `/` First Load JS `189 kB` (Three.js & Mermaid code-split) |
| **Plugin HITL Hook Tests** | `python3 -m unittest -v hooks/test_hitl_gate.py` | **PASS** | **5/5 suites passing** in 0.161s (root plugin unaffected) |
| **Dependency CVE Audit** | `pnpm audit --audit-level=high` | **3 CVEs Flagged** | `tinypool < 2.1.2` (Critical, devDep via `vitest`), `postcss <= 8.5.17` (High, via `next`), `zod < 4.6.6` (High, direct). Requires explicit human approval to update dependencies (`AGENTS.md` §1.4). |

---

## 2. Independent Security & Invariant Audit (`cf-reviewer`)

All **3 Blocking Defects** discovered across the initial `cf-reviewer` and `browser` QA passes were fixed and re-verified before closing Stage 4:

| # | Defect Found in Initial Pass | Location | Remediation Applied & Re-Verified |
| :- | :--- | :--- | :--- |
| **1** | **Runtime JS `TypeError` on load** (`Cannot read properties of undefined (reading 'x')` in Three.js `CatmullRomCurve3.getPointAt` caused by negative `dt = now - lastTimestamp` on first rAF) | `academy/src/components/three/HarnessConstellationScene.tsx:915-925,1066`, `SdlcOrbitalScene.tsx:742,899` | Clamped `dt = Math.max(0, Math.min(...))`, wrapped modular spline `t` strictly into `[0, 1]`, and added `contextLost` rAF stop guard. Verified **0 console errors** on hard reload. |
| **2** | **WCAG 2.1 AA Normal-Text Contrast Failure** (`#0284c7` on `#f8fafc` = `3.91:1 < 4.5:1`) | `academy/src/app/globals.css:20` | Updated `--color-cyan-deep` to `#0369a1` (**5.70:1** on `#f8fafc`, passing AA ≥ 4.5:1) and tokenized `.text-gradient-plasma` with `var(--color-*)`. |
| **3** | **Invalid WAI-ARIA `tablist` Ownership & Missing Relationships** | `CourseCurriculumStudio.tsx:216-352`, `RepoResourceExplorer.tsx:181-194`, `SdlcReferenceShowcase.tsx:144-195` | Switched non-tabpanel selectors to semantic `role="group"` + `aria-pressed`; wired `id`/`aria-controls`/`aria-labelledby` on `SdlcReferenceShowcase` `role="tab"`/`role="tabpanel"`. |

### Additional Hardening Applied from Reviewer Observations
- `academy/next.config.ts`: Added `outputFileTracingIncludes` for `/api/**` to guarantee `generated-repo-manifest.json` is traced into Vercel serverless bundles.
- `academy/src/lib/repository.ts`: Added module-level caching for validated `RepoManifest`.
- `academy/scripts/sync-resources.ts`: Added `fs.lstatSync().isSymbolicLink()` rejection, `fs.realpathSync()` containment guard, and case-insensitive `.git`/`.env` checks.
- `academy/src/components/MermaidDiagram.tsx`: Added async cancellation guards after every `await` and blocked top-level `<iframe>` tags in `sanitizeSvgTree`.
- `academy/src/components/VideoStage.tsx`: Hid `Retry Media` on statically invalid URLs and removed empty `<track>` element.
- `academy/src/components/HitlGateSimulator.tsx`: Added `5000ms` `AbortController` timeout (`AGENTS.md` §4.3) with `finally` cleanup.

### Remaining Non-Blocking Observations (Queued for Stage 6 / Next Iteration)
1. Upgrade `zod` (`>= 4.6.6`) and add pnpm overrides for `tinypool >= 2.1.2` and `postcss >= 8.5.18` (pending explicit dependency-update approval).
2. Add keyboard focus trap & return-focus management inside the Export/Import Progress modal (`CourseCurriculumStudio.tsx:638`).
3. Replace nested block headings inside `<button>` accordions (`HarnessComparisonLab.tsx`, `CourseCurriculumStudio.tsx`) with `<button>` wrapped inside `<h3>` for strict HTML5 content-model purity.
4. Expand unit test coverage to `MermaidDiagram`, `CourseCurriculumStudio`, `RepoResourceExplorer`, and `HarnessComparisonLab`.

---

## 3. Live Browser Visual & Accessibility Audit (`browser` Subagent)

Verified live against `http://localhost:3000` (production `next start` build, host-observed origin `http://localhost:3000`, `blocked_origins: none`):

| Viewport | Overflow (`scrollWidth` vs `innerWidth`) | Console Errors | Failed Network | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Desktop (`1440×900`)** | `1440px / 1440px` (**0px**) | **0** | **0 / 44** | **PASS** |
| **Tablet (`768×1024`)** | `768px / 768px` (**0px**) | **0** | **0 / 44** | **PASS** |
| **Mobile (`375×812`)** | `375px / 375px` (**0px**) | **0** | **0 / 44** | **PASS** |

- **Interactive Flows Verified Live:** Hero 3D Constellation before/after `"Raw Antigravity"` ↔ `"+ Code Factory v3.0"` & node selection; 12-dimension Comparison Lab radar & `items-start` grid alignment (`D02` collapsed `166px` beside `D01` expanded `832.5px`); 8-Stage SDLC 3D orbital with 2×4 wrapped pill bar (zero clipping) & live artifact viewer; `VideoStage` chapter switching + Transcript drawer; `PromptVault` live variable interpolation; and `HitlGateSimulator` live `POST /api/hitl/simulate` (`git push origin main` → HTTP `200`, `force_ask`).
- **Host-Verified Visual Evidence:**
  - Mobile Prompt Vault: `final_step_18.png`
  - Tablet Comparison Lab (post-fix `items-start`): `final_step_28.png`

---

## 4. Stage 4 Senior Engineer Sign-Off Gate
- [x] Unit, API, and hook tests passing (`27/27` Vitest + `5/5` Python `unittest`).
- [x] Browser inspection verified WCAG AA contrast, zero console/network errors, and responsive 375px / 768px / 1440px layouts.
- [ ] Approve optional Stage 4 security patch updates (`zod`, `tinypool`, `postcss` CVEs) and proceed to **Stage 5 (`cf-deploy-staging`)** Vercel preview deployment.
