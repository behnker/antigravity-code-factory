# ADR-0007: Allowlisted Proof Pack Gallery, Course 08 (`vibe-website-factory`), Two-Phase Proof Ingestion & 4-Domain Showcase (`academy/`)

**Status:** Proposed — Pending Senior Engineer Sign-Off (`2026-11-26`)  
**Date:** 2026-11-26  
**Related Spec:** [`plans/academy-course-08-and-gap-closure-spec.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/plans/academy-course-08-and-gap-closure-spec.md)  
**Extends:** [`0002-academy-nextjs-glassmorphic-architecture.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/decisions/0002-academy-nextjs-glassmorphic-architecture.md), [`0003-eli5-multimodal-microlearning-architecture.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/decisions/0003-eli5-multimodal-microlearning-architecture.md), [`0005-vibe-website-factory-pipeline.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/decisions/0005-vibe-website-factory-pipeline.md), [`0006-code-factory-v3-phase1-hook-bridge.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/decisions/0006-code-factory-v3-phase1-hook-bridge.md)

---

## Context

`code-factory` (`v3.0.0`) ships **19 progressive-disclosure skills**, including four `v2.5.0` Website Factory skills (`cf-website-factory`, `cf-design-tokens`, `cf-threejs-craft`, `cf-geo-seo`) and `cf-learn` (`v2.0`). Inside `academy/`:
1. **Curriculum & Prompt Vault Coverage Gap:** Courses `00–07` cover `15` skills, leaving the four Website Factory skills unrepresented in both lesson steps and `PromptVault`, while `cf-learn` only appears in a compound `skillRef: "cf-learn + cf-handover"` string (`cf-prompt-learn-and-add-course`) without a dedicated standalone Prompt Vault card.
2. **Evidence & Proof Gallery Gap:** `LessonStepSchema` (`academy/src/lib/schemas.ts`) supports `codeSnippet` and `mermaidDiagram`, but has no structured, allowlisted schema for embedding real before/after pipeline metrics, CLI verification excerpts, live `https://` deployment links, and multi-viewport Proof Pack screenshots (`01–09`).
3. **4-Domain Method Traceability Gap:** While the repository and sibling workspaces already prove the Code Factory method across four distinct domains—Website (`gt-alpaca-website`), Mobile/Web 3D Game (`herd_and_co`), Video Generation (`product-video-studio`), and Application/Harness Development (`Project_Antigravity` / `academy/`)—the Academy homepage lacks a unified, schema-validated `#four-domains` showcase linking each domain to live artifacts and courses.
4. **Cross-Repo Timing Dependency:** Standalone `/Users/ralphb/Projects_Personal/gt-alpaca-website` is currently at Stage 0 Bootstrap (`proof-pack/01-bootstrap.txt` captured; Steps 2–3 execute in a parallel conversation). Academy Course 08 must ship immediately without fabricating unmeasured numbers or placeholder screenshots, then ingest real `01–09` Proof Pack media cleanly once `gt-alpaca-website` launches.

---

## Decisions & Trade-Off Analysis

### 1. Optional `proofGallery` on `LessonStepSchema` with Dual URL Allowlists
- **Decision:** Add optional `proofGallery: ProofGallerySchema.optional()` to `LessonStepSchema` in `academy/src/lib/schemas.ts`, protected by two strict runtime validators:
  - `isAllowedProofImageUrl(url)`: strictly matches `/^\/media\/proof-pack\/[a-z0-9-]+\/[A-Za-z0-9._-]+\.(?:png|webp|jpg|jpeg|svg)$/` and rejects `..` traversal, remote URLs, nested subdirectories, and `javascript:`/`data:` URIs.
  - `isAllowedLiveUrl(url)`: restricts optional live demo URLs to `https://` URLs parsed cleanly with zero whitespace and zero embedded `username:password` credentials.
- **Rejected Alternative:** Allowing arbitrary image URLs or reusing `isAllowedImageUrl` (`/media/illustrations/*`). Mixing editorial studio cutaways (`/media/illustrations/*`) with stage-by-stage project proof captures (`/media/proof-pack/<project>/*`) weakens organization and auditability; allowing external image URLs violates zero-external-media reliability and CSP hygiene.
- **Consequences:** 100% backward compatibility across Courses `00–07`, deterministic fail-closed rendering in `ProofGalleryPanel.tsx` (`role="alert"` on blocked URLs, `role="status"` on `<Image onError>`), and zero CLS via fixed `aspect-video` viewports.

### 2. Explicit Two-Step Proof Ingestion Protocol (Step 4A Scaffold -> Step 4B Final Lock)
- **Decision:** Split Course 08 proof population into **Step 4A** (ship schema, `ProofGalleryPanel`, Course 08 curriculum, `cf-learn` prompt, 4-domain showcase, and 19/19 traceability test using ONLY directly verified `gt-alpaca-website` facts—Proof `#01`, `4.5 MB` raw `avalon_poc.glb`, `22` alpacas, `7` routes, `23` tracks—while omitting `imageSrc` and marking unexecuted `02–09` metrics honestly as `"Pending Step 4B"`) and **Step 4B** (post-launch copy of verified PNG/WebP screenshots from `gt-alpaca-website/proof-pack/` into `academy/public/media/proof-pack/gt-alpaca/` and replacement of `"Pending Step 4B"` rows with real measured values).
- **Rejected Alternative:** Blocking Course 08 until `gt-alpaca-website` launches, or inventing plausible compressed byte sizes / Lighthouse metrics / mock screenshots ahead of time. Blocking stalls Academy completion unnecessarily; inventing metrics violates Code Factory Answerability and oracle honesty invariants.
- **Consequences:** Zero fabricated numbers in Git or Vercel production, graceful CLI/Pending card UI in Step 4A (`CLS = 0`), and a surgical 3-file diff for Step 4B.

### 3. Static Zod-Validated 4-Domain Registry Passed via Props (`src/data/four-domain-cases.ts` -> `page.tsx` -> `AcademyShell`)
- **Decision:** Store the 4-domain showcase dataset in `academy/src/data/four-domain-cases.ts`, validated at module load via `z.array(DomainCaseStudySchema).length(4).parse(...)` (mirroring `academy/src/data/harness-comparison.ts`), and pass `domainCases` from Server Component `src/app/page.tsx` into `AcademyShell` -> `FourDomainShowcase` (plus controlled optional `activeCourseId` selection on `CourseCurriculumStudio`).
- **Rejected Alternative:** Importing `four-domain-cases.ts` directly inside `FourDomainShowcase.tsx` or inspecting sibling local repo paths at runtime with `node:fs`. Direct `node:fs` reads from sibling directories break Vercel serverless deployments and violate `academy/.dependency-cruiser.cjs` (`no-server-or-db-in-ui`); prop injection preserves clean `lib/data` -> `app` -> `components` boundaries and enables parallel `/teamwork` authoring without file contention.
- **Consequences:** Zero `depcruise` boundary violations, zero runtime dependency on external repos, clean unit-testability, and 1-click navigation from Domain cards (`Website`, `Video`, `Harness`) into the matching Academy course.

### 4. Filesystem-Backed 19/19 Skill Traceability Regression Gate (`schemas-and-prompts.test.ts`)
- **Decision:** Add a Vitest test in `academy/tests/schemas-and-prompts.test.ts` that reads all `skills/cf-*/SKILL.md` directories directly from disk and asserts **100% (`19/19`)** coverage in BOTH (a) at least one `LessonStep` across `academy/content/courses/*/course.json` AND (b) at least one `PromptCard.skillRef` in `PromptVault`, alongside `DomainCaseStudySchema` validation across all 4 domains.
- **Rejected Alternative:** Hardcoding a static list of 19 skill names in tests or verifying Prompt Vault counts manually. Hardcoded lists silently drift whenever `skills/cf-*` expands (`N+1` skills).
- **Consequences:** Future skills added to `skills/cf-*` will automatically fail `pnpm test` until both curriculum training and a copyable Prompt Vault card exist—permanently closing skill-to-Academy drift.

---

## Verification & Rollback Summary

- **Verification Oracles:** `cd academy && pnpm run sync:resources` (`9` courses, `19` skills), `bash skills/cf-next-verify/scripts/verify-stack.sh academy --coverage` (`tsc`, `eslint`, `vitest`, static scan, `depcruise`, `next build`), `cd academy && pnpm audit --audit-level=high` (`0` High/Critical CVEs), `cd academy && pnpm run verify:map` (`375/768/1440px`), and decoupled `cf-reviewer` (`cf-eval`) + `browser` visual QA.
- **Rollback:** Clean `git revert <commit-sha>` (zero database migrations, zero new dependencies, zero plugin hook modifications), or Vercel production rollback to the last verified deployment via `cd academy && vercel rollback <previous-url> --yes --scope nexite-os`.
