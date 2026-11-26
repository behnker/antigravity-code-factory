# Stage 4 Dual-Axis Evaluation (`cf-eval`) — `code-factory` `v3.0.1` Upstream Dogfooding Fixes (`cf-learn`)

**Date:** 2026-11-26 (06:48 UTC)  
**Spec:** [`plans/code-factory-v3-0-1-dogfood-fixes-spec.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plans/code-factory-v3-0-1-dogfood-fixes-spec.md) · **Commit Reviewed:** `ce7ea0c` (+ working-tree `README.md`, spec, `.memory/{handover,tasks}.md`)  
**Reviewer Context:** Clean decoupled `cf-reviewer` (`cf-eval`) subagent context (zero source, test, skill, template, or config files modified)  
**Verdict:** **`SHIP`** *(Zero Blocking Defects; `3` Low Non-Blocking Observations logged below. Independently verified `38/38` Node plugin tests, `37/37` Python hook tests, `0` `ruff` issues, `6/6` `verify-stack.sh` gates incl. `82/82` Vitest & `depcruise` `0` violations, `0` High/Critical CVEs, `6/6` real symlinked CLI invocations, and live symlinked dogfood checks against `gt-alpaca-website` tokens & Next 16 `.next/server/app`.)*

---

## Executive Dual-Axis Scorecard (`v3.0.1`)

| Axis | Dimension | Status | Verified Evidence |
| :--- | :--- | :---: | :--- |
| **Axis 1** | **Symlink-Safe ESM Entrypoints (`6/6` Scripts)** | **PASS** | [`generate-tokens.mjs:398-413`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-design-tokens/scripts/generate-tokens.mjs#L398-L413), [`validate-tokens.mjs:234-249`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-design-tokens/scripts/validate-tokens.mjs#L234-L249), [`audit-geo-seo.mjs:495-510`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-geo-seo/scripts/audit-geo-seo.mjs#L495-L510), [`audit-threejs.mjs:349-364`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-threejs-craft/scripts/audit-threejs.mjs#L349-L364), [`optimize-glb.mjs:245-260`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-threejs-craft/scripts/optimize-glb.mjs#L245-L260), [`run-verify-map.mjs:672-689`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-verify-map/scripts/run-verify-map.mjs#L672-L689) all export `isDirectExecution()` backed by `safeRealpath()` (`fs.realpathSync` + `path.resolve` fallback); `6/6` `--help` probes via `~/.gemini/config/plugins/code-factory/skills/...` & `6/6` `fs.symlinkSync` tests pass. |
| **Axis 1** | **WCAG Contrast Matrix & Template Tokens** | **PASS** | [`checkSemanticContrast()`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-design-tokens/scripts/generate-tokens.mjs#L197-L238) enforces `>= 4.5:1` across `foreground`, `muted-foreground`, and `*-text` × `["background", "surface", "surface-elevated", "card"]` + `5` fill pairs in Light & Dark; [`tokens.template.json`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-design-tokens/resources/tokens.template.json#L68-L106) passes **`30/30`** (`5.22:1–17.28:1`); symlinked dogfood run on `gt-alpaca-website/design/tokens.json` passes **`40/40`**. |
| **Axis 1** | **Next.js 16 GEO/SEO Auditor Hardening** | **PASS** | [`collectHtmlFiles()`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-geo-seo/scripts/audit-geo-seo.mjs#L399-L417) excludes `_not-found.html`, `_global-error.html`, `_error.html`, `404.html`, and `500.html` during directory walks while keeping single-file audits intact; [`hasCanonicalLink()`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-geo-seo/scripts/audit-geo-seo.mjs#L93-L104) supports any `<link>` attribute order; symlinked run against `gt-alpaca-website/.next/server/app` audits `5` pages (`0` errors, `0` warnings). |
| **Axis 1** | **Security, Deps, Purity & Full-Stack Gates** | **PASS** | `0` external deps across all `6` `.mjs` scripts (`node:*` stdlib only); `0` shell string concatenation ([`optimize-glb.mjs:215`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-threejs-craft/scripts/optimize-glb.mjs#L215) uses `execFileSync` arg array); `0` `gt-alpaca`/`herd`/`ibiza` leakage across `skills/`; `0` new Academy deps (`package.json` & `pnpm-lock.yaml` unchanged); `0` High/Critical CVEs; [`rules/AGENTS.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/rules/AGENTS.md) = **`9,147` B** (`<= 10,240` B); [`generated-repo-manifest.json`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/data/generated-repo-manifest.json#L2-L13) reports `pluginVersion: "3.0.1"`. |
| **Axis 2** | **Trajectory, Spec Adherence & Oracle Honesty** | **PASS** | Bounded strictly to `plans/code-factory-v3-0-1-dogfood-fixes-spec.md`; `0` `@ts-ignore`/`eslint-disable`/`.skip`/`as any`; regression tests added across all `4` Node suites (`31 → 38`). Minor non-blocking spec deviations (`N1–N3`) logged transparently below. |

---

## 1. Automated Verification Oracles (Independently Executed)

| Check | Command | Result | Exact Observed Output |
| :--- | :--- | :---: | :--- |
| **Node Plugin Tests** | `node --test skills/cf-verify-map/scripts/test_run_verify_map.mjs skills/cf-design-tokens/scripts/tokens.test.mjs skills/cf-threejs-craft/scripts/threejs.test.mjs skills/cf-geo-seo/scripts/geo-seo.test.mjs` | **PASS** | **`38/38` passed** (`4` suites, `0` failed, `0` skipped — `256.61 ms`) |
| **Python Hooks & Lint** | `python3 -m unittest discover -s hooks -p "test_*.py" -v && ruff check hooks/` | **PASS** | **`37/37` passed** in `4.076 s`; `ruff check`: **`All checks passed!`** |
| **Symlinked CLI & Dogfood** | Symlinked `~/.gemini/config/plugins/code-factory/skills/...` invocations (`6/6` `--help`, `tokens.template.json`, `gt-alpaca-website/design/tokens.json`, `gt-alpaca-website/.next/server/app`) | **PASS** | `6/6` `--help` exit `0`; `tokens.template.json`: `PASS` (`33/18/5/12`, `30` WCAG pairs); `gt-alpaca`: `PASS` (`40/24/6/19`, `40` WCAG pairs); `gt-alpaca` `.next/server/app`: `PASS: Audited 5 HTML document(s) — 0 error(s), 0 warning(s).` |
| **Full-Stack Academy Gate** | `bash skills/cf-next-verify/scripts/verify-stack.sh academy --coverage` | **PASS** | **`6 passed, 0 failed, 0 skipped`**: `tsc --noEmit` (`0`), `next lint` (`0`), `vitest run --coverage` (**`4/4` files, `82/82` passed**), Static Scan (`0` leaks), `depcruise` (`0` violations across `47` modules / `125` deps), `pnpm run build` (`sync:resources`: `60` resources, `9` courses; `next build`: `7/7` routes) |
| **CVEs & Budget Checks** | `cd academy && pnpm audit --audit-level=high`; `wc -c rules/AGENTS.md`; `git diff f100de2..HEAD -- academy/package.json academy/pnpm-lock.yaml` | **PASS** | Exit `0` — **`0` High/Critical CVEs** (`1` low, `5` moderate); `rules/AGENTS.md` = **`9147` B**; `0` dependency diffs |

---

## 2. Findings Table (`v3.0.1`)

### Blocking Defects
*None (`0` Critical, `0` High, `0` Medium blocking defects).*

### Non-Blocking Observations

| ID | Severity | Location | Finding & Rationale |
| :---: | :---: | :--- | :--- |
| **N1** | **Low** | [`academy/tests/api-routes.test.ts:253,264`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/tests/api-routes.test.ts#L253-L264) | **Broadened version regex vs. Spec §2.4:** Spec §2.4 specified updating the assertion to `"3.0.1"`, whereas `ce7ea0c` used `.toMatch(/^3\.0\.\d+$/)` and kept `"v3.0.0"` in the test title (`:253`). While [`plugin.json:4`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plugin.json#L4) and [`generated-repo-manifest.json:3`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/data/generated-repo-manifest.json#L3) both genuinely carry `"3.0.1"`, asserting `.toBe("3.0.1")` (or reading `plugin.json`) prevents a stale `"3.0.0"` manifest from passing. |
| **N2** | **Low** | [`skills/cf-design-tokens/scripts/generate-tokens.mjs:203-208`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-design-tokens/scripts/generate-tokens.mjs#L203-L208) | **Un-sorted `textKeys` & `--color--text` check vs. Spec §2.2:** `checkSemanticContrast()` iterates `Object.keys(semanticMap)` insertion order without `.sort()` or explicit filtering of literal `"--color--text"`. No correctness or security impact (`SAFE_KEY_RE` requires valid key segments and contrast pass/fail is order-invariant). |
| **N3** | **Low** | [`.memory/tasks.md:20`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/tasks.md#L20), [`README.md:3,7`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/README.md#L3-L7), [`plans/code-factory-v3-0-1-dogfood-fixes-spec.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plans/code-factory-v3-0-1-dogfood-fixes-spec.md) | **Working-tree commit hygiene & manifest resource count:** `README.md`, `plans/code-factory-v3-0-1-dogfood-fixes-spec.md`, and `.memory/{handover,tasks}.md` remain uncommitted after `ce7ea0c`. Also, `.memory/tasks.md:20` cites `61 resources` recorded prior to deleting `.memory/next-start-prompt.md`; current `sync:resources` outputs **`60 resources, 9 courses`** (`memory: 16`, `plans: 7`). |

---

## 3. Outer-Loop Answerability Statement (`v3.0.1`)

1. **What Changed:** Shipped `code-factory` `v3.0.1` ([`plugin.json`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plugin.json), [`README.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/README.md)) closing three `gt-alpaca-website` dogfood findings: `fs.realpathSync`-backed `isDirectExecution()` across all `6` skill `.mjs` CLIs, Next.js 16 `_global-error.html` / `_error.html` directory exclusion plus attribute-order-agnostic `hasCanonicalLink()` in [`audit-geo-seo.mjs`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-geo-seo/scripts/audit-geo-seo.mjs), and Light + Dark `*-text` × `["background", "surface", "surface-elevated", "card"]` WCAG contrast verification in [`generate-tokens.mjs`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-design-tokens/scripts/generate-tokens.mjs) + [`tokens.template.json`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-design-tokens/resources/tokens.template.json), synced to `academy/` (`pluginVersion: "3.0.1"`).
2. **Why It Is Safe:** Zero external npm or Python dependencies were added (`0` High/Critical CVEs), zero shell concatenation or project-specific leakage exists in the skill scripts, `rules/AGENTS.md` remains `9,147 B <= 10,240 B`, and all `38/38` Node plugin tests (incl. real `fs.symlinkSync` subprocess probes), `37/37` Python hook tests, `6/6` `verify-stack.sh` gates (`82/82` Vitest, `0` `depcruise` violations), and live symlinked `gt-alpaca-website` checks pass independently.
3. **How to Roll Back:** Revert `ce7ea0c` cleanly with `git revert ce7ea0c` (and discard or adjust the uncommitted working-tree docs/memory files) to restore `v3.0.0` (`f100de2`), then run `cd academy && pnpm run sync:resources`.

---

# Stage 4 Dual-Axis Evaluation (`cf-eval`) — Pass 2: Antigravity Academy Course 08 (`vibe-website-factory`), Complete Proof Pack `01–09`, `19/19` Skill Traceability & 4-Domain Showcase

**Date:** 2026-11-26 (06:03 UTC)  
**Spec & ADR:** [`plans/academy-course-08-and-gap-closure-spec.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plans/academy-course-08-and-gap-closure-spec.md) · [`0007-academy-proof-gallery-and-four-domain-method.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/decisions/0007-academy-proof-gallery-and-four-domain-method.md)  
**Project Invariants:** [`.agents/rules/academy-invariants.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.agents/rules/academy-invariants.md)  
**Reviewer Context:** Clean decoupled `cf-reviewer` (`cf-eval`) subagent context (zero source, test, course, config, or asset files modified)  
**Verdict:** **`SHIP`** *(All Pass 1 blocking defects [`B1–B3`], `N1`, and final Step 4B Proof `#09` ingestion verified **CLOSED** in independent re-checks: `6/6` `verify-stack.sh` incl. `82/82` Vitest & `depcruise` `0` violations, `0` High/Critical CVEs, `9/9` live 3-viewport `verify:map` against freshly built production output, `19/19` Skill Traceability, `0` forbidden patterns, and 1:1 Proof Pack `01–09` metric/artifact parity.)*

---

## Executive Dual-Axis Scorecard (Pass 2)

| Axis | Dimension | Status | Verified Evidence |
| :--- | :--- | :---: | :--- |
| **Axis 1** | **Security Boundaries & Allowlists (`schemas.ts`, UI)** | **PASS (`N1` Closed)** | [`isAllowedProofImageUrl`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/lib/schemas.ts#L52-L55) & hardened [`isAllowedLiveUrl`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/lib/schemas.ts#L61-L79) reject `..`, leading/trailing dots, dotless hosts (`https://..`), `http://`, `javascript:`, `data:`, whitespace, and embedded credentials (verified by [`schemas-and-prompts.test.ts:716-721`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/tests/schemas-and-prompts.test.ts#L716-L721)); [`ProofGalleryPanel.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/ProofGalleryPanel.tsx#L54-L84,L199-L219) & [`FourDomainShowcase.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/FourDomainShowcase.tsx#L278-L307) fail closed to `role="alert"` and use `rel="noopener noreferrer"`. |
| **Axis 1** | **Design Tokens, `CLS = 0`, WCAG & Boundaries** | **PASS** | `0` hardcoded `#hex`, `0` `opacity-55`, and `0` arbitrary `text-[*]`/`p-[*]` brackets across all 13 new/modified `academy/src` & `academy/tests` files; [`ProofGalleryPanel.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/ProofGalleryPanel.tsx#L59-L133) reserves `aspect-video` across all states (`CLS = 0`); [`AcademyShell.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/AcademyShell.tsx#L255-L295) mounts `#four-domains`, `#courses`, and `#prompt-vault` without fractional `whileInView`; `depcruise`: `0` violations (`47` modules / `125` deps). |
| **Axis 1** | **Full-Stack Build, `19/19` Traceability & Live `verify:map`** | **PASS** | `verify-stack.sh`: **`6 passed, 0 failed, 0 skipped`** (`tsc` `0`, `next lint` `0`, **`82/82` Vitest** across `4` suites incl. filesystem-backed `19/19` Skill Traceability & `4/4` Domain checks, Static Scan `0`, `depcruise` `0`, `sync:resources` `60` resources / `9` courses + `next build` `7/7` pages); `pnpm audit --audit-level=high`: **`0` High/Critical CVEs**; `run-verify-map.mjs --all-viewports`: **`9/9` PASS** (`375/768/1440px`, `0px` overflow, `0` console/page/network errors). |
| **Axis 1** | **Course 08 ELI5 Rubric, PNG Parity & Proofs `01–09`** | **PASS (`B1–B3` Closed)** | `7/7` steps pass the 7-point ELI5 rubric (`audioScript` `115–129` words, `0` `**`/backticks/`#`/URLs; `everydayAnalogy` `120–155` chars; `0` HTML tags in Mermaid; `7/7` distinct 4-part cards); `9/9` PNGs match `gt-alpaca-website/proof-pack/` SHA-256 1:1; Step 2 matches Pass 2 `40/24/6/19` & `30/30` WCAG after Pass 1 `BLOCK` (`B1`); Step 1 `cliExcerpt` cites `@vitejs/plugin-react@5.2.0` (`B2`); Steps 5–7 & Domain 1 cleanly document completed Proofs `01–09` and `https://gt-alpaca-website.vercel.app` (`B3` + `N3`). |
| **Axis 2** | **Trajectory, Spec Adherence, Root Purity & Anti-Gaming** | **PASS** | `0` new dependencies (`academy/package.json` & lockfile untouched), `0` root plugin edits (`plugin.json`, `hooks.json`, `rules/AGENTS.md` [`9,147 B`], `hooks/`, `skills/`, `agents/` untouched), `0` `@ts-ignore`/`eslint-disable`/`it.skip`/`as any`, `.memory/feature-map.md` updated cleanly; Pass 1 `BLOCK` remediated transparently without weakening tests. |

---

## 1. Pass 1 Defect Closure Verification (`B1–B3`, `N1`, `N3`)

1. **[B1 — CLOSED]** [`academy/content/courses/vibe-website-factory/course.json:47,185-186,193,206`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/content/courses/vibe-website-factory/course.json#L47): Chapter 2 summary (`:47`), `eli5.realWorldExample` (`:185`), `eli5.audioScript` (`:186`, `125` words, `0` markdown/backticks/URLs), `keyTakeaways[2]` (`:193`), and `mermaidDiagram` (`:206`, `0` HTML tags) now accurately state **`40` primitive, `24` semantic, `6` component, and `19` dark overrides**, document Pass 1's dark-ink `BLOCK` (`1.52:1–3.65:1`), and report **30/30 Light+Dark WCAG pairs (`5.75:1–17.28:1` Light; `7.62:1–17.13:1` Dark)** with `0` literal violations across `27` files, matching [`03-tokens-and-glb.json`](file:///Users/ralphb/Projects_Personal/gt-alpaca-website/proof-pack/03-tokens-and-glb.json#L9-L16) and [`08-cf-eval-verdict.md:27`](file:///Users/ralphb/Projects_Personal/gt-alpaca-website/proof-pack/08-cf-eval-verdict.md#L27).
2. **[B2 — CLOSED]** [`academy/content/courses/vibe-website-factory/course.json:165`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/content/courses/vibe-website-factory/course.json#L165): Step 1 `cliExcerpt` now states `@vitejs/plugin-react@5.2.0` verbatim matching [`02-research-and-audit.txt:17`](file:///Users/ralphb/Projects_Personal/gt-alpaca-website/proof-pack/02-research-and-audit.txt#L17) and [`07-gates-summary.txt:7`](file:///Users/ralphb/Projects_Personal/gt-alpaca-website/proof-pack/07-gates-summary.txt#L7).
3. **[B3 + N3 — CLOSED]** [`academy/content/courses/vibe-website-factory/course.json:477,486,565,644-708`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/content/courses/vibe-website-factory/course.json#L644-L708) & [`academy/src/data/four-domain-cases.ts:12-60`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/data/four-domain-cases.ts#L12-L60): Removed all stale Step 4A future-tense phrasing (`0` residual matches via `rg`), populated Proof `#09` with exact live production metrics from [`live-smoke-tests.txt`](file:///Users/ralphb/Projects_Personal/gt-alpaca-website/proof-pack/09-launch-and-walkthrough/live-smoke-tests.txt) and [`phase-completion-matrix.md`](file:///Users/ralphb/Projects_Personal/gt-alpaca-website/proof-pack/09-launch-and-walkthrough/phase-completion-matrix.md) (`https://gt-alpaca-website.vercel.app`, commit `3b78ba7`, `12/12` live smoke checks, `872,868 B` immutable GLB cache, `GTA-20261126-4U00`), and set Domain 1 to `status: "shipped"` with `liveUrl: "https://gt-alpaca-website.vercel.app"`.
4. **[N1 — CLOSED]** [`academy/src/lib/schemas.ts:69-72`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/lib/schemas.ts#L69-L72) & [`academy/tests/schemas-and-prompts.test.ts:716-721`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/tests/schemas-and-prompts.test.ts#L716-L721): `isAllowedLiveUrl` now enforces `parsed.hostname.includes(".")`, `!startsWith(".")`, `!endsWith(".")`, and `!includes("..")`, backed by an explicit `"https://.."` rejection assertion in `ProofGallerySchema` tests.

---

## 2. Automated Verification Oracles (Pass 2 Independently Re-Executed)

| Check | Command | Result | Exact Observed Output |
| :--- | :--- | :---: | :--- |
| **Full-Stack Academy Gate** | `bash skills/cf-next-verify/scripts/verify-stack.sh academy --coverage` | **PASS** | **`6 passed, 0 failed, 0 skipped`**: `tsc --noEmit` (`0` errors); `next lint` (`✔ No ESLint warnings or errors`); `vitest run --coverage` (**`4/4` files, `82/82` tests passed** — `schemas.ts` `99.41%` stmts / `97.14%` branches, `contracts.ts` `100%`, `ProofGalleryPanel.tsx` `100%`, `FourDomainShowcase.tsx` `97.2%`, `CourseEmblem.tsx` `100%`); Static Boundary Scan (`0` leaks); `depcruise` (`0` violations across `47` modules, `125` deps); `pnpm run build` (`sync:resources`: `60` resources, `9` courses; `next build`: `7/7` pages) |
| **Dependency CVE Audit** | `cd academy && pnpm audit --audit-level=high` | **PASS** | Exit `0` — **`0` High/Critical CVEs** (`6 vulnerabilities found: 1 low \| 5 moderate`) |
| **Live 3-Viewport Map Gate** | `next start -p 3105` + `node ../skills/cf-verify-map/scripts/run-verify-map.mjs --map ../.memory/feature-map.md --all-viewports --base-url http://localhost:3105` | **PASS** | **`9/9` PASS** across `mobile (375x812)`, `tablet (768x1024)`, `desktop (1440x900)` on `/`, `/api/courses?limit=10&offset=0`, `/api/resources?limit=10&offset=0` (`0` consoleErrors, `0` pageErrors, `0` networkErrors, `0` missingSelectors incl. `#four-domains` & `#four-domains-heading`, `0px` horizontalOverflowPx) |
| **Forbidden Pattern Scan** | `rg -n "(#[0-9a-fA-F]{3,8}\b\|opacity-55\|text-\[\|p-\[\|m-\[\|@ts-ignore\|@ts-expect-error\|eslint-disable\|it\.skip\|describe\.skip\|test\.skip\|\bas any\b)" <13 modified/new TS/TSX files>` | **PASS** | **`CLEAN_ZERO_MATCHES`** (`0` violations in all modified/new source & test files) |
| **Course 08 Pass 2 Rubric & Stale Scan** | Python ELI5 check + `rg` stale-string scan over `vibe-website-factory/course.json` & `four-domain-cases.ts` | **PASS** | `7/7` steps valid (`audioScript` `115–129` words, `0` `**`/backticks/`#`/URLs; `everydayAnalogy` `120–155` chars; `0` HTML tags in Mermaid; `7/7` distinct 4-part cards; all `imageSrc` PNGs on disk); `0` stale Pass 1 / Step 4A text matches |

---

## 3. Findings Table (Pass 2)

### Blocking Defects
*None (`0` Critical, `0` High, `0` Medium blocking defects).*

### Remaining Non-Blocking Observations

| ID | Severity | Location | Finding & Rationale |
| :---: | :---: | :--- | :--- |
| **N2** | **Low** | [`HarnessConstellationScene.tsx:1234`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/three/HarnessConstellationScene.tsx#L1234), [`SdlcOrbitalScene.tsx:1046`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/three/SdlcOrbitalScene.tsx#L1046), [`WebGLFallbackCard.tsx:135`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/three/WebGLFallbackCard.tsx#L135) | **Pre-existing `validate-tokens.mjs` literals outside milestone diff:** Untouched `src/components/three/*` contains `7` pre-existing `text-[11px]`/`text-[10px]` literals (`0` in all new/modified files). |
| **N4** | **Low** | [`academy/src/data/four-domain-cases.ts:100-108`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/data/four-domain-cases.ts#L100-L108) | **Domain 2 branch reference clarity:** `build:poki`, `build:crazygames`, and `verify:sponsors` live on `herd_and_co` branch `feat/monetisation-sponsor-platform:package.json` (and `plans/monetisation-sponsor-platform-spec.md`) rather than the workspace's `feat/vinyl-clay-scene-poc` checkout. |
| **N5** | **Low** | [`CourseCurriculumStudio.tsx:1033-1038`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/CourseCurriculumStudio.tsx#L1033-L1038) | **Integration coverage note:** `ProofGalleryPanel` achieves `100%` line coverage standalone, while lines `1034–1037` inside `CourseCurriculumStudio.tsx` were exercised in live `verify:map` rather than an integration unit test. |

---

## 4. Outer-Loop Answerability Statement

1. **What Changed:** Shipped allowlisted [`ProofGallerySchema`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/lib/schemas.ts#L111-L125) and [`DomainCaseStudySchema`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/lib/schemas.ts#L129-L160) (`isAllowedProofImageUrl`, hardened `isAllowedLiveUrl`), [`ProofGalleryPanel.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/ProofGalleryPanel.tsx), [`FourDomainShowcase.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/FourDomainShowcase.tsx) (`#four-domains` wired via [`page.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/app/page.tsx) → [`AcademyShell.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/AcademyShell.tsx) → controlled [`CourseCurriculumStudio.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/CourseCurriculumStudio.tsx)), **Course 08 (`vibe-website-factory`)** with custom [`CourseEmblem.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/CourseEmblem.tsx#L121-L130,L590-L642), studio illustration, and complete verified GT-Alpaca **Proof Pack `01–09`** (`9` PNGs + live `https://gt-alpaca-website.vercel.app` smoke logs), Course 02 standalone `cf-learn` prompt (`cf-prompt-learn-distill`), [`.memory/feature-map.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/feature-map.md), and the filesystem-backed `19/19` Skill Traceability + `4`-Domain regression suite in [`schemas-and-prompts.test.ts:790-958`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/tests/schemas-and-prompts.test.ts#L790-L958).
2. **Why It Is Safe:** Zero new npm dependencies, zero High/Critical CVEs, zero root plugin changes, strict allowlisted local proof-pack/HTTPS URLs (`role="alert"` fail-closed UI), `0` `depcruise` boundary violations (`47` modules), `82/82` Vitest, `9/9` live 3-viewport `verify:map`, and Pass 2 closure of `B1–B3` + `N1` ensuring 100% factual alignment with `gt-alpaca-website` Proof Pack `01–09`.
3. **How to Roll Back:** Revert tracked edits via `git checkout -- academy/ .memory/feature-map.md` and remove untracked `academy/content/courses/vibe-website-factory/`, `academy/public/media/{illustrations/vibe-website-factory-studio.jpg,proof-pack/gt-alpaca/}`, `academy/src/components/{ProofGalleryPanel,FourDomainShowcase}.tsx`, `academy/src/data/four-domain-cases.ts` (or post-deploy via `cd academy && vercel rollback https://antigravity-academy-ten.vercel.app --yes --scope nexite-os`).

---

# Stage 4 Dual-Axis Evaluation (`cf-eval`) — Pass 1: Antigravity Academy Course 08 (`vibe-website-factory`), Proof Pack `01–08`, `19/19` Skill Traceability & 4-Domain Showcase

**Date:** 2026-11-26 (05:56 UTC)  
**Spec & ADR:** [`plans/academy-course-08-and-gap-closure-spec.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plans/academy-course-08-and-gap-closure-spec.md) · [`0007-academy-proof-gallery-and-four-domain-method.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/decisions/0007-academy-proof-gallery-and-four-domain-method.md)  
**Project Invariants:** [`.agents/rules/academy-invariants.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.agents/rules/academy-invariants.md)  
**Reviewer Context:** Clean decoupled `cf-reviewer` (`cf-eval`) subagent context (zero source, test, course, config, or asset files modified)  
**Verdict:** **`BLOCK`** *(Remediated and closed in Pass 2 above.)*

---

# Stage 4 Dual-Axis Evaluation (`cf-eval`) — `code-factory` `v3.0.0` Phase 1 Core Hooks & Academy Sync

**Date:** 2026-11-26 (04:55 UTC)  
**Spec & ADR:** [`plans/code-factory-v3-phase1-spec.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plans/code-factory-v3-phase1-spec.md) · [`0006-code-factory-v3-phase1-hook-bridge.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/decisions/0006-code-factory-v3-phase1-hook-bridge.md)  
**Hook Contract Grounding:** [`agy-customizations/docs/hooks.md`](file:///Users/ralphb/.gemini/antigravity/builtin/skills/agy-customizations/docs/hooks.md)  
**Reviewer Context:** Clean decoupled `cf-reviewer` (`cf-eval`) subagent context (zero source, hook, script, config, test, or course files edited)  
**Verdict:** **`SHIP`** *(Zero Blocking Defects; `3` Low Non-Blocking Observations logged below. All `7` deterministic verification suites—`37/37` Python hook tests, `0` `ruff` issues, `31/31` Node plugin tests, `6/6` `verify-stack.sh` gates incl. `71/71` Academy Vitest & `depcruise` `0` violations, `0` High/Critical CVEs, `9/9` live 3-viewport `verify:map`, and `9,147 B <= 10,240 B` `rules/AGENTS.md`—verified directly in clean context.)*

---

## Executive Scorecard (Dual-Axis Eval)

| Axis | Dimension | Status | Verified Evidence |
| :--- | :--- | :---: | :--- |
| **Axis 1** | **`docs/hooks.md` Schema & Lifecycle Contract** | **PASS** | [`hooks.json`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks.json#L1-L71) uses flat arrays for `SessionStart`/`PreInvocation`/`Stop` and grouped `{matcher, hooks}` arrays for `PreToolUse`/`PostToolUse` with relative `./hooks/*.py` commands (`timeout: 5`); [`session-start.py`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks/session-start.py#L183-L191) & [`pre-invocation.py`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks/pre-invocation.py#L119-L142) emit exact nested `systemMessage` / `errorMessage.userMessage` + `terminationBehavior: "terminate"`; [`post-tool-feedback.py`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks/post-tool-feedback.py#L523-L534) always outputs `{}`; [`stop-gate.py`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks/stop-gate.py#L30-L94) emits explicit `decision` (`allow` / `continue`) |
| **Axis 1** | **Hook Security, Isolation & Fail-Closed Separation** | **PASS** | `PreToolUse` gates ([`hitl-gate.py:438-466`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks/hitl-gate.py#L438-L466), [`secret-guard.py:224-250`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks/secret-guard.py#L224-L250)) fail closed to `ask` (never `{}`); DX hooks fail open; [`hook_state.py`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks/hook_state.py#L39-L502) enforces `\A[A-Za-z0-9_-]{1,128}\Z` / SHA-256 `cid-*`, canonical parent containment, symlink rejection, `0700` dirs / `0600` temp files BEFORE `os.replace`, `os.O_NOFOLLOW` + `fcntl.flock`, secret/ANSI redaction, bounded lists, and `24h` / `1h` TTL pruning; `0` `shell=True` calls |
| **Axis 1** | **`overwrite` Safety, `<2s` Lint Bridge & Bounded `Stop`** | **PASS** | [`hitl-gate.py:303-410`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks/hitl-gate.py#L303-L410) & [`hitl-evaluator.ts:355-519`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/lib/hitl-evaluator.ts#L355-L519) never rewrite `force_ask`/`ask`, subshells, heredocs, multiline, unbalanced quotes, or quoted args, and honor `GIT_PAGER=` + flags before `--` + short clusters (`-sSm`); [`post-tool-feedback.py:222-419`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks/post-tool-feedback.py#L222-L419) runs `shell=False` single-file checks (`<= 1.8s`, ESLint v9 `--format stylish`, quoted-string/comment-immune verification detection); [`stop-gate.py:44-94`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks/stop-gate.py#L44-L94) guards all 4 conditions + flips state atomically before `continue` |
| **Axis 1** | **Zero New Deps, Curriculum Sync & UI/WCAG/Boundaries** | **PASS** | Pure Python 3 stdlib across `hooks/*.py`; `0` new npm deps (`academy/package.json` & `pnpm-lock.yaml` untouched); `0` High/Critical CVEs; [`rules/AGENTS.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/rules/AGENTS.md) = **`9,147` B** (`<= 10,240` B); manifest synced (`pluginVersion: "3.0.0"`, `19` skills, `8` hooks, `5` agents, `8` courses); [`HitlGateSimulator.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/HitlGateSimulator.tsx) uses `@theme` tokens only (`0` literal `#hex`, `0` `opacity-55`); Course 01 fixed to `docs/hooks.md` + Course 02 Step 10 ELI5 rubric (`123`-char analogy, `137`-word `audioScript`, `0` HTML tags in Mermaid); `depcruise`: `0` violations (`44` modules / `113` deps); `verify:map`: **`9/9` PASS** (`375/768/1440px`) |
| **Axis 2** | **Trajectory, Spec Adherence & Oracle Honesty** | **PASS** | Strict adherence to [`plans/code-factory-v3-phase1-spec.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plans/code-factory-v3-phase1-spec.md) with zero Phase 2/3 scope creep (`cf-rewind`, `sidecar.json`, `code-factory-lsp`, `workflows/`, auth/DB absent); `0` `@ts-ignore`, `0` `eslint-disable`, `0` `.skip` tests; `.memory/feature-map.md:55` updated for `overwrite?`; existing `test_hitl_gate.py` updated transparently per Spec §3.2 alongside `+22` new v3 hook tests, `+6` HITL overwrite TS tests, `+4` API route tests, and `+1` UI simulator overwrite test |

---

## 1. Automated Verification Oracles (Independently Executed)

| Check | Command | Result | Exact Observed Output |
| :--- | :--- | :---: | :--- |
| **Python Hook Suite** | `python3 -m unittest discover -s hooks -p "test_*.py" -v` | **PASS** | **`37/37` passed** in `3.739s` (`8` `test_hitl_gate.py`, `7` `test_secret_guard.py`, `22` `test_v3_hooks.py`) |
| **Python Linter** | `ruff check hooks/` | **PASS** | **`All checks passed!`** (`0` errors, `0` warnings) |
| **Node Plugin Tests** | `node --test skills/cf-verify-map/scripts/test_run_verify_map.mjs skills/cf-design-tokens/scripts/tokens.test.mjs skills/cf-threejs-craft/scripts/threejs.test.mjs skills/cf-geo-seo/scripts/geo-seo.test.mjs` | **PASS** | **`31/31` passed** (`4` suites, `0` failed, `0` skipped) |
| **Rules Context Budget** | `wc -c rules/AGENTS.md` | **PASS** | **`9147` bytes** (`<= 10240` bytes hard cap) |
| **Dependency Audit** | `cd academy && pnpm audit --audit-level=high` | **PASS** | Exit `0` — **`0` High/Critical CVEs** (`6` advisories: `1` low, `5` moderate) |
| **Full-Stack Academy Gate** | `bash skills/cf-next-verify/scripts/verify-stack.sh academy --coverage` | **PASS** | **`6 passed, 0 failed, 0 skipped`**: `tsc --noEmit` PASS; `next lint` (`✔ No ESLint warnings or errors`) PASS; `vitest run --coverage` (**`4/4` files, `71/71` tests passed**, `lib/` `94.5%` stmts, `schemas.ts` `100%`, `contracts.ts` `100%`, `hitl-evaluator.ts` `85.74%`) PASS; Static Boundary Scan PASS (`0` `NEXT_PUBLIC_*` secret / client `service_role` leaks); `depcruise` (`0` violations across `44` modules, `113` deps) PASS; `pnpm run build` (`sync:resources` `[58 resources, 8 courses]` + `next build` `7/7` routes) PASS |
| **Manifest Counts Check** | `node -e '...generated-repo-manifest.json'` | **PASS** | `pluginVersion: "3.0.0"`, `pluginName: "code-factory"`, `counts: { skills: 19, agents: 5, rules: 1, hooks: 8, memory: 16, plans: 5, courses: 8 }` |
| **Live 3-Viewport Map Gate** | `cd academy && pnpm run verify:map` (against `next-server v15.5.29` on `http://localhost:3000`) | **PASS** | **`9/9` PASS** across `mobile (375x812)`, `tablet (768x1024)`, `desktop (1440x900)` on `/`, `/api/courses?limit=10&offset=0`, `/api/resources?limit=10&offset=0` (`0` consoleErrors, `0` pageErrors, `0` networkErrors, `0` missingSelectors, `0px` horizontalOverflowPx) |
| **Course & Static Scans** | Python inspection over modified `course.json`, `academy/src/**`, `hooks/*.py` | **PASS** | Step 10 `everydayAnalogy` `123` chars (`<= 160`), `audioScript` `137` words (`75–180`, `0` backticks/URLs), `0` HTML tags in Mermaid; `0` `#hex` / `opacity-55` / `@ts-ignore` / `eslint-disable` / `shell=True` |

---

## 2. Findings Table

### Blocking Defects
*None (`0` Critical, `0` High, `0` Medium blocking defects).*

### Non-Blocking Observations

| Severity | Location | Finding & Rationale |
| :---: | :--- | :--- |
| **Low** | [`academy/src/lib/hitl-evaluator.ts:265-286,402-410`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/lib/hitl-evaluator.ts#L265-L286) vs. [`hooks/hitl-gate.py:273-281`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks/hitl-gate.py#L273-L281) | **Minor `overwrite` quote/prefix parity edge case:** `hooks/hitl-gate.py` strictly rejects quoted/escaped command tokens (`"git" status`, `\git status`) and leading `-` paths (`-foo/git`) in `_match_target_executable()`, whereas `tokenizeSegment()` in `hitl-evaluator.ts` strips quotes/escapes into `cmdText` before matching `cmdText === "git" \|\| cmdText.endsWith("/git")`. No security impact (`force_ask`/`ask` precede `overwrite` in both implementations). |
| **Low** | [`hooks/hook_state.py:137-156`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks/hook_state.py#L137-L156) | **Shared-`/tmp` fallback directory hardening:** When `$PLUGIN_DATA` is unset on a multi-user POSIX host with a shared `/tmp`, `_ensure_private_dir()` ignores `os.chmod(path, 0o700)` `OSError` without checking `st_uid == os.getuid()`, and `_fallback_safe_root()` constructs a predictable `code-factory-safe-{uid}-{pid}` path instead of `tempfile.mkdtemp()`. Mitigated in practice because Antigravity sets `$PLUGIN_DATA` under the user's home directory, macOS `TMPDIR` is per-user `0700`, and file operations use `O_NOFOLLOW` + `NamedTemporaryFile` (`0600`). |
| **Low** | [`.memory/handover.md:1-26`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/handover.md#L1-L26) & [`.memory/tasks.md:7-10`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/tasks.md#L7-L10) | **Expected Stage 2 pre-handover state:** `.memory/handover.md` and `.memory/tasks.md` still reflect the Stage 2 checkpoint (`e562472`); run `cf-handover` and re-run `cd academy && pnpm run sync:resources` after Stage 4 sign-off so the manifest picks up this updated `qa-report.md` and closed task items before commit. |

---

## 3. Outer-Loop Answerability Statement

1. **What Changed:** `code-factory` advanced from `v2.5.0` to **`v3.0.0` Phase 1 Core Hooks** by adding an atomic, `0600`-permissioned Python 3 stdlib state store ([`hooks/hook_state.py`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks/hook_state.py)) and activating five native Antigravity lifecycle events in [`hooks.json`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks.json) (`SessionStart` `.memory/` hydration, fail-closed `PreToolUse` HITL with safe `git --no-pager` / `curl --max-time 5` `overwrite` + `secret-guard.py`, `PostToolUse` → `PreInvocation` `<2s` single-file lint bridge, turn-15/30 compaction warnings & 5-failure loop-breaker, and a bounded single-shot `Stop` verification gate), synced in lockstep across [`academy/`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy) (`19` skills, `8` hook resources, optional `HitlSimulateResponseSchema.overwrite`, simulator diff UI, Course 01 `docs/hooks.md` fixes, and Course 02 Step 10).
2. **Why It Is Safe:** Zero new runtime or dev dependencies were added (`pure Python 3 stdlib`; `0` High/Critical CVEs in `academy/`); all external process invocations use `shell=False` with bounded timeouts and canonical directory containment; `PreToolUse` gates remain strictly fail-closed (`ask`/`deny`/`force_ask`, never `{}` and never `overwrite` on `force_ask`/`ask`); `Stop` obeys all four `docs/hooks.md` termination guards with atomic single-shot flipping; and `37/37` Python tests, `31/31` Node plugin tests, `6/6` `verify-stack.sh` gates (`71/71` Vitest, `0` `depcruise` violations), and `9/9` live 3-viewport `verify:map` checks passed independently.
3. **How to Roll Back:** At runtime without touching code, disable any entry in [`hooks.json`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/hooks.json) (`"enabled": false`) or set `CF_HITL_OVERWRITE=off`, `CF_POST_TOOL_LINT=off`, `CF_LOOP_BREAKER_MAX=0`, `CF_CONTEXT_WARN_TURN=0`, or `CF_STOP_GATE_MODE=off`; in Git, revert the milestone commit via `git revert <sha>` (or pre-commit `git checkout --` modified tracked files and remove untracked `hooks/{hook_state,session-start,post-tool-feedback,pre-invocation,stop-gate,test_v3_hooks}.py`) to return cleanly to `e562472`.

---

# Stage 4 Dual-Axis Evaluation (`cf-eval`) — `code-factory` v2.5.0 Vibe Website Factory Pipeline

**Date:** 2026-11-26 (00:24 UTC)  
**Spec & ADR:** [`plans/cf-website-factory-spec.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plans/cf-website-factory-spec.md) · [`0005-vibe-website-factory-pipeline.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/decisions/0005-vibe-website-factory-pipeline.md)  
**Reviewer Context:** Clean decoupled `cf-reviewer` / `cf-eval` subagent context (zero production/skill files edited)  
**Verdict:** **`SHIP`** *(Re-verified after resolving all 7 Blocking Defects B1–B7 and all 5 Non-Blocking Polish Notes N1–N5; `31/31` Node tests, `12/12` Python hook tests, `7/7` adversarial CLI exit-code probes, and `academy/` dry-runs pass with zero remaining blockers.)*

---

## Executive Scorecard

| Axis | Dimension | Status | Verified Evidence |
| :--- | :--- | :---: | :--- |
| **Axis 1** | **Supply Chain, Secrets & Context Economics** | **PASS** | `0` root `package.json`/runtime npm deps; `0` outbound network calls (`fetch`/`http`/`https`); `0` `eval`/`new Function`/`exec`/`execSync`; `execFileSync` uses explicit arg arrays (`optimize-glb.mjs:215`); `hooks/secret-guard.py`: `21/21` `allow`; `rules/AGENTS.md`: `8,842` B (`<= 10,240`); `19/19` skills match `plugin.json` (`2.5.0`) & `README.md`; clean MIT/source attribution |
| **Axis 1** | **Security & Parser Hardening (B1–B6 Closed)** | **PASS** | `generate-tokens.mjs` enforces `isPlainObject`, `FORBIDDEN_KEYS` (`__proto__`/`constructor`/`prototype`), `Object.hasOwn()`, and blocks `/*`, `*/`, `\r`, `\n`, `\0`, `vbscript:`, `url(data:/javascript:/vbscript:)`; `audit-geo-seo.mjs` rejects `null`/primitive JSON-LD (`aeo-jsonld-invalid`), unwraps top-level arrays & array `@type`, quote-matches `<meta name="description">`, validates `--min-words`; `audit-threejs.mjs` uses comment/string-aware `extractUseFrameBlocks()` + catches `import "lil-gui"` / `require("stats-gl")` + checks `webglcontextlost`; all 5 CLIs enforce `readRequiredFlagValue` + `.isFile()` + `inputBytes > 0` |
| **Axis 1** | **Automated Test Oracles & Adversarial Probes** | **PASS** | `node --test`: **`31/31`** pass (`16` across `tokens.test.mjs` [8], `geo-seo.test.mjs` [4], `threejs.test.mjs` [4] + `15` `cf-verify-map` tests); `python3 -m unittest`: **`12/12`** pass (`0.179s`); `7/7` adversarial CLI `exit 2` probes pass; `audit-threejs.mjs --dir academy/src`: `passed: true` (`0` err, `0` warn); `validate-tokens.mjs --dir academy/src`: `30` files scanned cleanly; `audit-geo-seo.mjs --html academy/.next/server/app`: `1` `1.3 MB` HTML audited cleanly |
| **Axis 2** | **Plugin Purity & Spec Adherence (B7 Closed)** | **PASS** | `rg -i "gt-alpaca\|gtalpaca\|herd\|ibiza\|avalon\|academy"` across all 4 new skill directories returned **`0` matches**; `@theme inline` maps `--color-*`, `--font-*`, `--spacing-*`, and `--radius-*`; progressive disclosure preserved |

---

## 1. Blocking Defect Closure Log (B1–B7)

1. **B1 Closed (`generate-tokens.mjs:21,35-37,120-192,224-237`):** Added `isPlainObject()`, `FORBIDDEN_KEYS = Set(["__proto__", "constructor", "prototype"])` in both `getByPath()` and `flattenLayer()`, `Object.hasOwn(...)` checks throughout, and `Object.create(null)` accumulator. Verified `compileTokens([])`, `{"primitive":{"__proto__":...}}`, `{"dark":{"semantic":{"__proto__":...}}}`, and `{primitive.constructor.name}` all throw cleanly.
2. **B2 Closed (`generate-tokens.mjs:22-23,139-148,295-309`):** Expanded `UNSAFE_CSS_VALUE_RE` and explicit control-char check (`[\r\n\0]`) to reject `/*`, `*/`, `\r`, `\n`, `\0`, `vbscript:`, and `url(data:/javascript:/vbscript:)`, plus mapped `--font-*` and `--spacing-*` into `@theme inline`.
3. **B3 Closed (`audit-geo-seo.mjs:64-77,93-96,245-320,364-365`):** Added `null`/primitive JSON-LD handling (`aeo-jsonld-invalid`), top-level JSON-LD array unwrapping, array `@type` (`["WebPage", "FAQPage"]`) support, missing/non-string `acceptedAnswer.text` detection (`aeo-faq-empty-answer`), `<title>` and HTML comment stripping in `stripTagsToText()`, and empty `Disallow:` override support in `auditRobotsTxt()`.
4. **B4 Closed (All 5 CLI Scripts):** Added `readRequiredFlagValue()` to `generate-tokens.mjs:39-45`, `validate-tokens.mjs:78-84`, `audit-threejs.mjs:37-43`, `optimize-glb.mjs:23-29`, and `audit-geo-seo.mjs:22-28`, non-negative integer check on `--min-words` (`audit-geo-seo.mjs:44-50`), `.isFile()` checks on `--config`, `--robots`, and `--in`, plus `inputBytes === 0` guard in `optimize-glb.mjs:182-186`. Verified `7/7` adversarial missing/invalid flag & directory probes return exit `2` (`CONFIG_ERROR`).
5. **B5 Closed (`audit-geo-seo.mjs:79-91,150`):** Replaced attribute regex with `extractMetaDescription()` using quote-matched `content=(?:"([^"]*)"|'([^']*)')` so apostrophes inside double quotes never truncate descriptions.
6. **B6 Closed (`audit-threejs.mjs:32,67-137,208-222,253-262`):** Replaced raw paren counting in `extractUseFrameBlocks()` with a comment- & string-aware lexer (stripping `//` and `/* */` comments from extracted code body), added `.test.mjs`/`.spec.mjs` to `SKIP_FILES`, added `webglcontextlost`/`onDeviceLost` advisory check, and caught side-effect `import "lil-gui"` / `require("stats-gl")`.
7. **B7 Closed (`geo-seo.test.mjs`, `optimize-glb.mjs:12`, `cf-website-factory/SKILL.md:8`, `vibe-brief-template.md:21`):** Replaced all project-specific references (`gtalpaca`, `Herd of Ibiza`, `Herd & Co.`, `avalon.glb`, `Academy`) with generic fixtures/wording (`0` matches via `rg`).

## 2. Non-Blocking Observations

1. **String-Embedded `/*` in `validate-tokens.mjs` ([`validate-tokens.mjs:129-135`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-design-tokens/scripts/validate-tokens.mjs#L129-L135)):** A JS/TS string containing `"/*"` (e.g. a route glob) would trigger `inBlockComment = true` until a later `*/`; low likelihood in UI components.
2. **Canonical `<link>` Attribute Order ([`audit-geo-seo.mjs:168-171`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-geo-seo/scripts/audit-geo-seo.mjs#L168-L171)):** Expects `rel="canonical"` before `href="https://..."`; matches Next.js output but misses reversed `<link href="..." rel="canonical">` tags.
3. **Working-Tree Hygiene:** Pre-existing staged `academy/` v2.4.0 curriculum edits (`contracts.ts`, 5 `course.json` files) and unstaged `.memory/tasks.md` remain in the working tree alongside the untracked v2.5.0 files.

---

# Stage 4 Dual-Axis Evaluation (`cf-eval`) & 7-Point ELI5 Readability QA Report

**Date:** 2026-11-25  
**Stage:** 4 (`cf-qa-review` + `cf-eval`)  
**Scope:** Upgraded **8-Course Antigravity Academy** (`Courses 00–07`, `53` steps, `43` prompts, `8` bespoke studio illustrations, Course 06 live MP4, multimodal UI components, and 4-layer `AntigravityArchitectureExplorer`)  
**Reviewer Context:** Clean decoupled reviewer context (zero production files edited)  
**Verdict:** **`SHIP`** *(Updated after clearing both B1 & B2 + P0 `#prompt-vault` `whileInView` fix — all automated tests `70/70`, security/WCAG invariants, 7-point ELI5 readability across all 8 courses, and 3-viewport live browser QA passed with `0` blocking defects.)*

---

## Executive Scorecard

| Axis | Dimension | Status | Evidence Summary |
| :--- | :--- | :---: | :--- |
| **Axis 1** | **Schemas, Build, Types, Lint & Tests** | **PASS** | `sync:resources` (`39` resources, `8` courses), `tsc --noEmit` (`0` err), `next lint` (`0` warn/err), `vitest run --coverage` (**`58/58`** across 4 suites), `next build` (`7/7` routes), `12/12` Python hook tests |
| **Axis 1** | **Security, Secrets & CVEs** | **PASS** | `0` `NEXT_PUBLIC_*` secret leaks, `0` `service_role` client refs, `0` `as any` / `@ts-ignore` / `eslint-disable`, `0` High/Critical CVEs (`pnpm audit --audit-level=high`: 1 low, 5 moderate), allowlisted media paths |
| **Axis 1** | **Mermaid Strict XML/Parse & Media Assets** | **PASS** | `53/53` diagrams pass `mermaid.parse()` (`securityLevel: "strict"`, `htmlLabels: false`, `0` HTML tags); `8/8` bespoke `.jpg` illustrations on disk (`507–657 KB`) + `/media/gt-alpaca-teaser-16x9.mp4` (`12.8 MB`) intact |
| **Axis 1** | **Design Tokens, WAI-ARIA & WCAG 2.1 AA** | **PASS (B1 Fixed)** | `0` hardcoded hex in `academy/src/components/*.tsx`; valid `role="group"` + `aria-pressed`; removed `opacity-55` on `AntigravityArchitectureExplorer.tsx:939` & raised status badge to `text-ink-secondary` (`>= 12.6:1` contrast) |
| **Axis 1** | **3-Viewport Live Browser QA (`375/768/1440px`)** | **PASS (B2 Cleared)** | Host-verified `http://localhost:3000` (`0` console errors, `0` failed requests, `0` overflow across `1440/768/375px`): 8/8 courses, 8/8 studio cutaways, Course 06 MP4, 4-layer 7-mode explorer, and 43/43 `#prompt-vault` cards after removing fractional `whileInView` scroll-gating on tall sections (`AcademyShell.tsx`) |
| **Axis 2** | **7-Point ELI5 Readability Rubric (Courses 00–07)** | **PASS** | All `8` courses, `53` steps, `43` prompts, and `8` illustrations satisfy Criteria 1–6 (`0` markdown/backticks/URLs in `audioScript`, `0` undefined Part 1 jargon, concrete analogies `<= 143` chars, `0` broken refs) |
| **Axis 2** | **4-Layer Architecture Explorer Separation** | **PASS** | Clean separation: Layer 1 (5 Steering Commands) → Layer 2 (7 Agent Modes `01..07`) → Layer 3 (8 Shared Building Blocks across `Tools & Hands`, `Memory & Knowledge`, `Safety & Guardrails`) → Layer 4 (Inspector) |
| **Axis 2** | **Execution Trajectory & Spec Adherence** | **PASS** | Oracle honesty **PASS** (`0` weakened/skipped tests; `+31` new tests vs baseline `27`, incl. 8-course `api-routes.test.ts:25-114`); zero new deps; `100%` senior step/prompt content preserved in Courses 01–06 |

---

## 1. Automated Verification Commands (Axis 1)

| Check | Command | Result | Exact Output / Coverage |
| :--- | :--- | :---: | :--- |
| **Manifest & Zod Sync** | `cd academy && pnpm run sync:resources` | **PASS** | `[sync-resources] Generated academy/src/data/generated-repo-manifest.json (39 resources, 8 courses).` |
| **TypeScript** | `cd academy && pnpm run typecheck` | **PASS** | `tsc --noEmit` — `0` errors |
| **Linter** | `cd academy && pnpm run lint` | **PASS** | `next lint` — `✔ No ESLint warnings or errors` |
| **Unit & Component Tests** | `cd academy && pnpm run test --coverage` | **PASS** | `4/4` files, **`58/58` tests passing** (`schemas.ts` 100%, `contracts.ts` 100%, `CourseIllustrationBanner.tsx` 100%, `AntigravityArchitectureExplorer.tsx` 99.72%, `Eli5MicrolearningCard.tsx` 98.75%, `AudioExplainerBar.tsx` 87.50%, `PromptVault.tsx` 87.68%; `api-routes.test.ts` asserts courses `0..7` + ELI5 + disk artwork) |
| **Static Boundary Scan** | `verify-stack.sh` (Python AST/regex scan) | **PASS** | `0` `NEXT_PUBLIC_*` secret vars, `0` `service_role` in `'use client'` modules, `0` `as any`, `0` `@ts-ignore` / `eslint-disable`, `0` literal `#hex` in `academy/src/components/*.tsx` |
| **Production Build** | `cd academy && pnpm run build` | **PASS** | Compiled in `2.4s`; `7/7` routes built (`/` First Load JS `224 kB`; API routes `/api/courses`, `/api/hitl/simulate`, `/api/resources` at `104 kB` with `maxDuration = 10`) |
| **Dependency CVE Audit** | `cd academy && pnpm audit --audit-level=high` | **PASS** | Exit `0` — **`0` High/Critical CVEs** (`6` advisories: `1` low, `5` moderate) |
| **Plugin Hook Tests** | `python3 -m unittest discover -s hooks -p "test_*.py" -v` | **PASS** | **`12/12` tests passing** in `0.206s` (`test_hitl_gate.py` + `test_secret_guard.py`) |
| **All-53 Mermaid Parse** | `mermaid.parse()` (`securityLevel: "strict"`, `htmlLabels: false`) | **PASS** | `53/53` parse OK, `0` parse errors, `0` HTML tags (`<br/>`, `<b>`, etc.) |
| **API Catalog Order** | `queryCourses({ limit: 20, offset: 0 })` | **PASS** | `total: 8`, `numbers: [0, 1, 2, 3, 4, 5, 6, 7]`, `0` broken `promptId` or `repoArtifactPath` refs |

---

## 2. Blocking Defects (Must Fix Before Stage 5 Deploy)

### B1 — WCAG 2.1 AA Contrast Failure (`3.09:1 < 4.5:1`) on Dimmed Layer 3 Building Block Buttons
- **Location:** [`AntigravityArchitectureExplorer.tsx:939`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/AntigravityArchitectureExplorer.tsx#L939), [`AntigravityArchitectureExplorer.tsx:968`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/AntigravityArchitectureExplorer.tsx#L968)
- **Cause:** On initial load (`Just Ask` selected), **5 of 8** Layer 3 Building Block buttons enter `isDimmedByMode` and apply `opacity-55` to the entire button while rendering `<span className="shrink-0 font-mono text-xs text-ink-muted">` (`#94a3b8`) for `"Gap"` / `"Leader"` / `"Parity+"`.
- **Computed Contrast:** Compositing `ink-muted` (`#94a3b8`) at `0.55` opacity over `bg-void-950/55` on `bg-void-900/65` / `.glass-panel-elevated` yields **3.09:1** (`3.04:1` on `#080d1e`, `3.18:1` on `#040712`)—below the **4.5:1** WCAG 2.1 AA normal-text floor for `12px` (`text-xs`) interactive labels and violating [`plans/eli5-multimodal-academy-spec.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plans/eli5-multimodal-academy-spec.md#L376) §6.3 Criterion 7.
- **Remediation:** Remove container `opacity-55` on `:939` (relying on subtle border/background `border-glass-border bg-void-950/55 text-ink-secondary hover:border-violet-glow/60`) OR keep button opacity at `>= 0.78` with `text-ink-secondary`. Removing `opacity-55` restores `ink-muted` to **7.32:1** and `ink-secondary` to **12.63:1**.

### B2 — Mandatory Post-Build 3-Viewport Live Browser Verification Pending
- **Location:** [`plans/eli5-multimodal-academy-spec.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plans/eli5-multimodal-academy-spec.md#L363), [`eval-rubric.md`](file:///Users/ralphb/.gemini/config/plugins/code-factory/skills/cf-eval/references/eval-rubric.md#L12)
- **Requirement:** Execute live `browser` visual & DOM verification across **`375px`**, **`768px`**, and **`1440px`** on the rebuilt `next start` server after applying B1—confirming `0` console/page errors, `0px` horizontal overflow, full `<svg>` rendering across all 53 Mermaid diagrams (since jsdom lacks `CSSStyleSheet` / `getBBox` for full SVG layout), all 8 illustrations loading cleanly, Course 06 MP4 playback, `AudioExplainerBar`, ELI5/Pro toggles, and `AntigravityArchitectureExplorer` state transitions.

---

## 3. Non-Blocking Observations

1. **Course 01 Header & Coming-Soon Video Simplification ([`harness-mastery/course.json`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/content/courses/harness-mastery/course.json#L16-L69)):** All `6` steps' technical summaries, `keyTakeaways`, `actionChecklist`, `codeSnippet`s, `repoArtifactPath`s, `promptId`s, and all `6` `prompts[]` across Courses `01–06` are **100% preserved bit-for-bit** against `HEAD`. However, in Course `01` alone, `estimatedMinutes` changed from `65` to `35` and `video` (`provider: "coming_soon"`) chapters/transcriptSummary were simplified into plain English (whereas Courses `02–06` preserved `video` intact). Documented for transparency; no senior step or prompt material was lost.
2. **Unused Legacy 3D Component ([`HarnessConstellationScene.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/three/HarnessConstellationScene.tsx)):** Replacing the hero constellation with [`AntigravityArchitectureExplorer.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/AntigravityArchitectureExplorer.tsx) inside [`HeroShowcase.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/HeroShowcase.tsx) left `HarnessConstellationScene.tsx` unreferenced in production (`0` imports). Consider deleting or explicitly archiving it in a follow-up cleanup.
3. **Illustration Filename Extension Alignment ([`plans/eli5-multimodal-academy-spec.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plans/eli5-multimodal-academy-spec.md#L400-L434)):** Spec Section 7 listed `/media/illustrations/<slug>.png`; implementation shipped `-studio.jpg` / `product-video-studio.jpg` files (`507–657 KB` each). Fully allowed by `ALLOWED_IMAGE_URL_PATTERNS` (`schemas.ts:22-24`) and visually clean, though updating spec/ADR references keeps documentation 1:1.
4. **Pre-Existing Modal Focus & HTML5 Heading Nesting ([`CourseCurriculumStudio.tsx:745`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/CourseCurriculumStudio.tsx#L745), [`CourseCurriculumStudio.tsx:1018`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/CourseCurriculumStudio.tsx#L1018)):** Carried forward from prior QA report—step accordion `<button>` wraps `<h5>` (cleaner HTML5 puts `<button>` inside `<h5>`), and Export/Import Progress modal supports `Escape` close but lacks a full keyboard focus trap/return-focus hook.

---

## 4. Detailed Audit Findings

### 4.1 7-Point ELI5 Readability Rubric (Courses 00–07, 53 Steps, 43 Prompts)

| Criterion | Standard | Audit Result Across All 8 Courses |
| :--- | :--- | :--- |
| **1. Zero Undefined Jargon (Part 1 + Titles/Hooks)** | Plain everyday language for beginners; unavoidable terms immediately translated | **PASS** — Inspected all 8 `eli5Title`/`eli5Tagline`, 53 `plainTitle`/`oneLineHook`/`simpleExplanation` blocks, and 43 `prompt.eli5Title`s. `0` unexplained acronyms (`CI/CD`, `AST`, `IPC`, `RLS`, `hydration`, `stdout`, etc.); technical terms like `AGENTS.md`, `Skills`, `Hooks`, `subagents`, and `vibe coding` are explicitly introduced via everyday equivalents in Course 00/01/04/07. |
| **2. Concrete Everyday Analogy (`<= 160` chars)** | Physical, relatable real-world object/situation on every step & banner | **PASS** — All 53 `everydayAnalogy` values (`76–143` chars `<= 160`) and 8 `visualAnalogy` values (`72–106` chars `<= 160`) are concrete physical metaphors (e.g., *stack of written recipe cards*, *childproof breaker box*, *two-room studio with pass-through window*, *race-car pit crew*). |
| **3. All 4 Microlearning Parts Distinct + `whenToUse`** | Distinct `simpleExplanation`, `whyItMatters`, `roleInProtocol`, `howToUseGoingForward` + concrete triggers | **PASS** — `53/53` steps contain all 4 non-duplicated sections, `realWorldExample`, `estimatedMinutes`, and concrete `whenToUse`; `43/43` prompts include `eli5Title` and concrete `whenToUse` triggers. |
| **4. 100% Plain-English Mermaid Diagrams** | Every step has plain-English, quoted-label diagram with zero HTML tags | **PASS** — `53/53` steps include `mermaidDiagram`, `0` HTML tags (`<br/>`, `<b>`), `0` parse failures via `mermaid.parse()`, all labels plain English and quoted. |
| **5. Warm Ear-First `audioScript`** | Natural spoken cadence (~75–180 words), zero `**`, backticks, `#`, or URLs | **PASS** — `53/53` scripts range `99–143` words (~40–57s at 150 wpm) with conversational contractions/cadence and **`0` markdown syntax, `0` backticks, `0` URLs**. |
| **6. Bespoke Studio Illustrations & Video Integrity** | Allowlisted local files on disk, `aspect-video` CLS-safe, rich `alt`/`caption`/`visualAnalogy` | **PASS** — Visually inspected all `8` `.jpg` architectural studio cutaways via image inspection (`zero-to-one-foundations-studio.jpg`, `harness-mastery-studio.jpg`, `code-factory-sdlc-studio.jpg`, `pro-setup-playbook-studio.jpg`, `lit-software-factory-studio.jpg`, `notebooklm-antigravity-studio.jpg`, `product-video-studio.jpg`, `orchestration-showcase-studio.jpg`): zero garbled text, high legibility, descriptive `alt` (`213–269` chars). Course 06 `/media/gt-alpaca-teaser-16x9.mp4` (`12,826,471` B) intact. |
| **7. Design Tokens, WCAG 2.1 AA & Senior Preservation** | Zero hardcoded hex, contrast `>= 4.5:1`, valid ARIA, 100% senior content preserved | **REVISE (See B1)** — `0` hex literals, valid `role="group"` + `aria-pressed`, `100%` senior step/prompt preservation in Courses `01–06`, `"Go Deeper"` drawer intact; blocked solely on B1 (`opacity-55` + `text-ink-muted` = `3.09:1` in `AntigravityArchitectureExplorer.tsx:939,968`). |

### 4.2 4-Layer `AntigravityArchitectureExplorer` & Security Audit
- **Coherent 4-Layer Model ([`contracts.ts:66-420`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/lib/contracts.ts#L66-L420), [`AntigravityArchitectureExplorer.tsx`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/AntigravityArchitectureExplorer.tsx)):** Cleanly separates **Layer 1** (`5` Steering Commands: `/plan`, `/grill-me`, `/goal`, `/schedule`, `/learn`), **Layer 2** (`7` Agent Modes `01..07`: `Just Ask` → `Subagents` → `Orchestrator` → `Workflows` → `Swarm` → `Boost` → `Teamwork`), **Layer 3** (`8` Shared Building Blocks across `Tools & Hands` [3], `Memory & Knowledge` [2], `Safety & Guardrails` [3]), and **Layer 4** (`<aside>` Mode/Block Guide with bi-directional cross-jump chips and `Raw` vs. `+ Code Factory v3.0` toggle). Referential integrity (`0` orphaned blocks, valid mode-to-block edges) is enforced by [`components.test.tsx:1455-1512`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/tests/components.test.tsx#L1455-L1512).
- **Security & Runtime Boundaries:** [`schemas.ts:22-75`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/lib/schemas.ts#L22-L75) enforces strict allowlists (`isAllowedImageUrl`, `isAllowedAudioUrl`, `..` traversal rejection) backed by defensive component checks in [`CourseIllustrationBanner.tsx:74-113`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/CourseIllustrationBanner.tsx#L74-L113) and [`AudioExplainerBar.tsx:73`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/AudioExplainerBar.tsx#L73). [`AudioExplainerBar.tsx:97-106`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/AudioExplainerBar.tsx#L97-L106) guarantees `speechSynthesis.cancel()` and HTML `<audio>` pause cleanup on unmount/step change without SSR hydration mismatch. [`CourseCurriculumStudio.tsx:92-123`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/CourseCurriculumStudio.tsx#L92-L123) and [`prompt-engine.ts:13-35`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/lib/prompt-engine.ts#L13-L35) safely hydrate legacy v1 `localStorage` records to `learningDepthMode: "eli5"`.

---

## 5. Outer-Loop Answerability Statement

1. **What Changed:** The academy (`academy/`) expanded from 6 senior courses to **8 courses (`Courses 00–07`, `53` steps, `43` prompts)** featuring a Zod-validated `Eli5ConceptBlockSchema` (4-part microlearning + `everydayAnalogy` + `whenToUse` + `audioScript` + plain-English `mermaidDiagram`), `CourseIllustrationSchema` backed by `8` local studio cutaway `.jpg` illustrations, a global **Start Simple (ELI5) / Full Pro View** toggle preserving all senior technical specs in a collapsible drawer, client-side `AudioExplainerBar` (HTML `<audio>` + Web Speech API fallback), and a new interactive 4-layer `AntigravityArchitectureExplorer` separating 5 steering commands, 7 agent modes, and 8 shared building blocks.
2. **Why It Is Safe:** Zero new npm runtime dependencies, zero secrets/`NEXT_PUBLIC_*`/`service_role` leaks, zero High/Critical CVEs, strict local media URL allowlists (`schemas.ts`), fail-closed root plugin hooks (`12/12` Python tests), backward-compatible `localStorage` Zod hydration (`58/58` Vitest tests), and 100% preservation of senior technical step/prompt content across Courses `01–06`—pending only the 2-line Layer 3 contrast fix (**B1**) and post-build 3-viewport live browser QA (**B2**).
3. **How to Roll Back:** Because all changes live strictly inside `academy/`, `plans/eli5-multimodal-academy-spec.md`, and `.memory/decisions/0003-*.md` (zero root plugin or database changes), rolling back before commit requires only `git checkout -- academy/` (and removing untracked `academy/content/courses/{zero-to-one-foundations,orchestration-showcase}` and `academy/public/media/illustrations/`), or after Vercel deploy via `cd academy && vercel rollback https://antigravity-academy-iai5pp4q4-nexite-os.vercel.app --yes --scope nexite-os`.

---

## 6. Stage 4 Exit Gate Checklist

- [x] `sync:resources`, `tsc --noEmit`, `next lint`, `vitest run --coverage` (`58/58`), `next build`, `pnpm audit --audit-level=high` (`0` High/Critical), and `12/12` Python hook tests passed.
- [x] All `8` courses, `53` steps, `43` prompts, `53` Mermaid diagrams, `8` studio illustrations, and Course 06 MP4 verified against Zod schemas & the 7-point ELI5 Readability Rubric.
- [ ] **Fix B1:** Remove `opacity-55` (or raise contrast `>= 4.5:1`) on dimmed Layer 3 buttons in [`AntigravityArchitectureExplorer.tsx:939,968`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/academy/src/components/AntigravityArchitectureExplorer.tsx#L939-L968).
- [ ] **Verify B2:** Re-run `next build` and execute live `browser` visual/SVG/layout QA at **`375px`**, **`768px`**, and **`1440px`** before requesting Stage 5 HITL deploy approval.


---

# Stage 4 Dual-Axis Evaluation (`cf-eval`) — `code-factory` v2.4.0 (`cf-verify-map` + `academy/` Scope C)

**Date:** 2026-11-25 (23:02 UTC)  
**Spec & ADR:** [`plans/cf-verify-map-spec.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plans/cf-verify-map-spec.md) · [`0004-feature-map-and-architecture-boundary-verification.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/decisions/0004-feature-map-and-architecture-boundary-verification.md)  
**Reviewer Context:** Clean decoupled `cf-reviewer` / `cf-eval` subagent context (zero production files edited)  
**Verdict:** **`SHIP`** *(Re-verified after clearing Blocking Defects B1 & B2 and Non-Blocking N1–N4; zero remaining blockers.)*

## Executive Scorecard

| Axis | Dimension | Status | Verified Evidence |
| :--- | :--- | :---: | :--- |
| **Axis 1** | **SSRF & Path Containment (`run-verify-map.mjs`)** | **PASS (B1 Fixed)** | `assertSameOriginPath()` ([`run-verify-map.mjs:86-107`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-verify-map/scripts/run-verify-map.mjs#L86-L107)) blocks `//evil.com`, `/\evil.com`, `/\t/evil.com`, `/\n/evil.com`, and enforces same-origin `new URL(rawPath, parsedBase).origin === parsedBase.origin`; `buildSafeScreenshotPath()` uses `path.relative()` ([`run-verify-map.mjs:270-290`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-verify-map/scripts/run-verify-map.mjs#L270-L290)) |
| **Axis 1** | **Architecture Boundary Template (`depcruise`)** | **PASS (B2 Fixed)** | Conditional `tsConfig: { fileName: 'tsconfig.json' }` ([`dependency-cruiser.template.cjs:13,57`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/skills/cf-verify-map/resources/dependency-cruiser.template.cjs#L13-L57)) verified against `academy/src`: `Modules: 44`, `Violations: 0`, `Total @/ deps: 38`, `couldNotResolve: 0` |
| **Axis 1** | **Unit & Hook Verification Oracles** | **PASS** | `node --test skills/cf-verify-map/scripts/test_run_verify_map.mjs`: **`15/15`** pass (`4` suites); `python3 -m unittest -v hooks/test_hitl_gate.py hooks/test_secret_guard.py`: **`12/12`** pass (`0.217s`); `wc -c rules/AGENTS.md`: **`8842`** B (`<= 10240`) |
| **Axis 1** | **Full-Stack & Live Feature Map Gates (`academy/`)** | **PASS** | `verify-stack.sh academy --skip-build`: **`5 passed, 0 failed, 1 skipped`** (`tsc`, `eslint`, `61/61` Vitest, static scan, `depcruise` `44 modules / 113 deps`); `cd academy && pnpm run verify:map`: **`9/9`** checks (`375/768/1440px`, `0` console/page/network errors, `0px` overflow); `pnpm audit --audit-level=high`: `0` High/Critical CVEs (`dependency-cruiser@18.9.0` MIT, `playwright@1.65.1` Apache-2.0); `hooks/secret-guard.py`: `30/30` files allowed |
| **Axis 2** | **Trajectory, Oracle Honesty & HITL Compliance** | **PASS** | Strict adherence to locked spec Scope C; zero weakened assertions or silenced rules (`0` `@ts-ignore` / `eslint-disable` / `as any` / `.skip`); HITL-approved `devDependencies`. *(Note: Stage B emblem changes and `.memory/handover.md` remain uncommitted in the working tree alongside Scope C; `bootstrap.sh` was audited statically without temp-dir `rm -rf` execution.)* |
