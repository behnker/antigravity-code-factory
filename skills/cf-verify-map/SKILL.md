---
name: cf-verify-map
description: >-
  Deterministic Feature Map verification gate: reads .memory/feature-map.md,
  verifies routes, DOM selectors (data-testid), HTTP status codes, zero console
  or uncaught page errors, and multi-viewport overflow via headless Playwright
  (when installed) or falls back seamlessly to Antigravity's browser subagent.
  Use before opening a PR, during Stage 4 (cf-qa-review), or after UI/route/API edits.
---

# Skill: Feature Map Verification (`cf-verify-map`)

Verify that every UI route, `data-testid` selector, and API contract documented in `.memory/feature-map.md` passes deterministically without console errors, uncaught page exceptions, unexpected `4xx`/`5xx` network failures, or mobile/tablet/desktop horizontal overflow.

## Prerequisites
- `.memory/feature-map.md` exists in the workspace root (scaffold with `cf-bootstrap` if missing).
- Never store plaintext credentials in `.memory/feature-map.md`; read test credentials from `.env.test.local` / environment variables only.

## Execution Protocol

1. **Read `.memory/feature-map.md`:**
   - Inspect the `App Runtime` section (Frontend/Backend URLs, start commands, Health Check) and the fenced ```` ```json feature-map ```` contract block.
   - If the user scoped verification to one feature (e.g., `auth`), pass `--feature <slug>`. Otherwise verify all targets.

2. **Ensure Local Server Is Running:**
   - Check if the configured `baseUrl` (or `healthCheck`) is already responding with HTTP `200`.
   - If not running, start the dev server in the background (`IsDaemon: true`) using the start command in `.memory/feature-map.md` and confirm readiness before running verification. If boot fails, capture stderr, stop the server, and abort with a **BOOT FAILURE** report.

3. **Run Deterministic Verification (Dual-Mode):**
   - **Mode A — Fast Deterministic Runner (Playwright, when installed in target repo):**
     Run from the package directory containing `node_modules` (e.g., workspace root or `academy/`):
     ```bash
     node "<path-to-this-skill>/scripts/run-verify-map.mjs" \
       --map "<workspace-root>/.memory/feature-map.md" \
       --all-viewports \
       [--feature <slug>]
     ```
     - **Exit `0` (`PASS`):** All targets, selectors, console/pageerror/network checks, and overflow checks passed.
     - **Exit `1` (`FAIL`):** Review the structured JSON output and preserved screenshots under `.tmp/verify-screenshots/fail-*.png`. **Do NOT delete failure screenshots before reporting.**
     - **Exit `2` (`CONFIG_ERROR`):** Fix malformed JSON/schema in `.memory/feature-map.md` or invalid CLI flags.
     - **Exit `3` (`PLAYWRIGHT_UNAVAILABLE`):** Playwright or Chromium is not installed in this project — immediately execute **Mode B** below without forcing an unapproved install.
   - **Mode B — Zero-Dependency Fallback (Antigravity `browser` Subagent):**
     - Delegate the exact routes, `data-testid` selectors, and multi-step **Golden Happy Paths** from `.memory/feature-map.md` to the built-in `browser` subagent across **375px**, **768px**, and **1440px** viewports.
     - Report any missing selectors, console errors, failed network requests, or overflow defects identically.

4. **Multi-Step Golden Happy Paths (Optional Flows):**
   - For interactive mutations (forms, auth flows, modal imports), either run them via the `browser` subagent or execute a temporary Playwright flow script inside `.tmp/flows/` and remove `.tmp/flows/` after completion (keeping `.tmp/verify-screenshots/` whenever any check fails).

5. **Cleanup & Report:**
   - Stop any temporary dev server started solely for this verification run (leave pre-existing user dev servers untouched).
   - Output the structured **Verification Report** below. Never claim `PASS` if any console error, uncaught page error, unexpected `>= 400` response, missing selector, or horizontal overflow occurred.

## Required Output Format

```markdown
### Feature Map Verification Report: [PASS | FAIL]
- **Mode:** [Playwright Deterministic | Browser Subagent Fallback]
- **Scope:** [All Features | `<feature-slug>`]
- **Checks Passed:** X / Y (across viewports)
- **Console Errors:** [0 | exact text & route]
- **Uncaught Page Errors:** [0 | error message & route]
- **Unexpected Network Failures (4xx/5xx):** [0 | METHOD URL -> STATUS]
- **Missing Selectors:** [0 | missing selector & route]
- **Horizontal Overflow:** [0px | route, viewport & overflow px]
- **Failure Screenshots:** [None | `.tmp/verify-screenshots/fail-...png`]
```
