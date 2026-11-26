# Locked Feature Specification: `code-factory` `v3.0.1` Upstream Dogfooding Fixes (`cf-learn`)

**Status:** Locked (Stage 2A Decisions `A1–A4` Approved)  
**Target Version:** `code-factory` `v3.0.1`  
**Dependencies Added:** `0` (pure Node.js stdlib)

---

## 1. Problem Statement & Scope

Dogfooding `code-factory` `v3.0.0` during the live production build of `gt-alpaca-website` (`https://gt-alpaca-website.vercel.app`) surfaced three concrete defects in the global symlinked plugin scripts plus one non-blocking QA observation from `.memory/qa-report.md`:

1. **ESM Symlink Entrypoint Bug (6 scripts across 4 skills):** Invoking skill CLI scripts through the standard symlinked plugin path (`~/.gemini/config/plugins/code-factory/skills/...`) causes `path.resolve(process.argv[1])` to retain the symlink path while `import.meta.url` resolves to the canonical realpath, causing the entrypoint guard to evaluate `false` and exit `0` silently with no output.
2. **Next.js 16 System Error Pages & Canonical `<link>` Order (`audit-geo-seo.mjs`):** Scanning `.next/server/app` audits Next.js 16's generated `_global-error.html` (and legacy `_error.html`), triggering false-positive GEO failures; additionally, `<link href="..." rel="canonical">` (reversed attribute order) triggers a false-positive `seo-canonical` warning.
3. **Text-on-Surface WCAG Contrast Gap (`generate-tokens.mjs`):** `checkSemanticContrast()` only checked 6 fixed pairs (`foreground`/`muted-foreground` on `background` and 4 `*-foreground` fill pairs), missing `foreground`/`muted-foreground` on `surface`/`surface-elevated` and dynamic `--color-*-text` semantic tokens across Light and Dark surfaces.

---

## 2. Exact Contracts & File Ownership

### 2.1 Symlink-Safe ESM Entrypoint Helper (All 6 Scripts)
Apply to:
- `skills/cf-design-tokens/scripts/generate-tokens.mjs`
- `skills/cf-design-tokens/scripts/validate-tokens.mjs`
- `skills/cf-geo-seo/scripts/audit-geo-seo.mjs`
- `skills/cf-threejs-craft/scripts/audit-threejs.mjs`
- `skills/cf-threejs-craft/scripts/optimize-glb.mjs`
- `skills/cf-verify-map/scripts/run-verify-map.mjs`

Contract:
- Export `isDirectExecution(argv1 = process.argv[1], metaUrl = import.meta.url)` using a `safeRealpath(targetPath)` helper (`fs.realpathSync(targetPath)` with fallback to `path.resolve(targetPath)` on error).
- Compare `safeRealpath(argv1) === safeRealpath(fileURLToPath(metaUrl))`.
- Guard CLI execution via `if (isDirectExecution()) { ... }`.

### 2.2 Expanded WCAG 2.1 AA Contrast Matrix (`generate-tokens.mjs` + `tokens.template.json`)
- Surface keys: `["background", "surface", "surface-elevated", "card"]`.
- Text keys: `["foreground", "muted-foreground"]` plus all sorted semantic `--color-*-text` tokens present in `semanticMap` (excluding bare `--color--text`).
- Fill pairs: `["primary-foreground", "primary"]`, `["secondary-foreground", "secondary"]`, `["accent-foreground", "accent"]`, `["highlight-foreground", "highlight"]`, `["destructive-foreground", "destructive"]`.
- Deduplicate pairs and enforce `contrastRatio(fg, bg) >= minContrast` (`4.5` default) in both Light (`semantic`) and Dark (`{ ...semantic, ...darkSemantic }`) modes.
- Update `skills/cf-design-tokens/resources/tokens.template.json` with Light + Dark `primary-text` and `accent-text` semantic tokens that pass `>= 4.5:1` across all 3 surfaces in both modes.

### 2.3 GEO/SEO Auditor Hardening (`audit-geo-seo.mjs`)
- Export `collectHtmlFiles(targetPath)` and skip `/^(_not-found|_global-error|_error|404|500)\.html$/i` during directory traversal (explicit single-file `--html <file>` still audits that file).
- Replace order-dependent canonical `<link>` regex with `hasCanonicalLink(html)` verifying any `<link\b[^>]*>` element containing both `rel="canonical"`/`'canonical'` and `href="https?://..."`/`'https?://...'` in any attribute order.

### 2.4 Version Bump, Docs, Tests & Workspace Hygiene
- Bump `plugin.json` (`"version": "3.0.1"`), update `README.md`, `skills/cf-design-tokens/SKILL.md`, and `skills/cf-geo-seo/SKILL.md`.
- Keep `rules/AGENTS.md` strictly `<= 10,240` bytes (untouched).
- Add regression tests across all 4 suites (`tokens.test.mjs`, `geo-seo.test.mjs`, `threejs.test.mjs`, `test_run_verify_map.mjs`), including real temporary `fs.symlinkSync` subprocess `--help` invocations for all 6 scripts.
- Sync Academy manifest (`cd academy && pnpm run sync:resources`) and update the version assertion in `academy/tests/api-routes.test.ts` to `"3.0.1"`.
- Remove stale untracked `.memory/next-start-prompt.md` and update `.memory/{tasks,handover}.md`.

---

## 3. Verification Acceptance Criteria

1. `node --test skills/cf-verify-map/scripts/test_run_verify_map.mjs skills/cf-design-tokens/scripts/tokens.test.mjs skills/cf-threejs-craft/scripts/threejs.test.mjs skills/cf-geo-seo/scripts/geo-seo.test.mjs` — 100% PASS (including real symlink CLI tests on all 6 scripts, `_global-error.html`/`_error.html` exclusion, reversed canonical `<link>`, and `*-text` Light+Dark surface contrast enforcement).
2. Real-world dogfood smoke check: run symlinked `~/.gemini/config/plugins/code-factory/skills/cf-design-tokens/scripts/generate-tokens.mjs` against `/Users/ralphb/Projects_Personal/gt-alpaca-website/design/tokens.json` (stdout dry check) — PASS with all Light + Dark pairs verified.
3. `python3 -m unittest discover -s hooks -p "test_*.py" -v` & `ruff check hooks/` — 100% PASS (`37/37`, `0` ruff errors).
4. `bash skills/cf-next-verify/scripts/verify-stack.sh academy --coverage` & `cd academy && pnpm audit --audit-level=high` — `6/6` PASS, `0` High/Critical CVEs.
5. Independent decoupled `cf-reviewer` audit verdict: **`SHIP`**, logged in `.memory/qa-report.md`.
