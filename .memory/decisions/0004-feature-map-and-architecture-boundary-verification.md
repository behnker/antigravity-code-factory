# ADR-0004: Living Feature Map Verification & Optional Architecture Boundary Gates

**Status:** Accepted (Locked with `plans/cf-verify-map-spec.md`)  
**Date:** 2026-11-25

## Context
Evaluating `project-antigravity-verification-kit.zip` against Enterprise Code Factory (`v2.3.0`) surfaced two high-leverage harness capabilities missing from our SDLC pipeline:
1. A living, machine-readable `.memory/feature-map.md` indexing shipped routes, API endpoints, `data-testid` selectors, and golden happy paths.
2. Automated module-graph boundary enforcement via `dependency-cruiser` (preventing circular imports, server/DB leaks into UI components, and layering violations).

However, adopting the kit verbatim would violate key Code Factory invariants:
- The raw template embedded plaintext test credentials (`test@example.com / TestPass123!`) in `.memory/`.
- The raw skill assumed project-local installation (`.agents/skills/`), root `package.json`, and a mandatory ~300 MB Playwright/Chromium install.
- The raw runner relied on LLM Markdown-to-JSON transcription, lacked `try/finally` cleanup and screenshot directory creation, defaulted to `networkidle` (prone to Next.js HMR hangs), and omitted multi-viewport checks.

## Decision
1. **Plugin-First, Zero-Dependency Architecture (`code-factory` v2.4.0):** Ship `skills/cf-verify-map/` globally inside the `code-factory` plugin using only Node.js built-ins and POSIX shell, keeping the plugin itself strictly zero-dependency.
2. **Embedded Machine Contract in `.memory/feature-map.md`:** Pair human-readable documentation with a deterministic ```` ```json feature-map ```` block parsed directly by `scripts/run-verify-map.mjs` (eliminating LLM transcription errors) and prohibit plaintext credentials in `.memory/`.
3. **Dual-Mode Execution (Playwright Fast Path + `browser` Fallback):** When `playwright` is installed in the target repo, `run-verify-map.mjs` runs fast headless route/selector/console/network/overflow checks across `375px / 768px / 1440px` and preserves failure screenshots in `.tmp/verify-screenshots/`. When Playwright is absent (exit code `3`), `cf-verify-map` cleanly delegates to Antigravity's built-in `browser` subagent.
4. **Opt-In Architectural Boundary Gate in `cf-next-verify`:** Generalized `.dependency-cruiser.cjs` templates (`no-circular`, `no-server-or-db-in-ui`, `no-lib-importing-app-or-ui`, optional `no-cross-feature-imports`) are auto-executed as Step 4b in `skills/cf-next-verify/scripts/verify-stack.sh` whenever both a config file and local `depcruise` binary exist, and skipped cleanly otherwise.

## Consequences
### Positive
- Every Code Factory workspace gains a living Feature Contract and deterministic smoke verifier without bloating global plugin dependencies or `rules/AGENTS.md` (stays `<= 10 KB`).
- Architectural boundary violations fail fast in the inner loop (`cf-next-verify`) rather than relying on manual code review.
- Eliminates all 7 runtime/security defects found in the raw verification kit.

### Negative / Trade-offs
- Teams must keep `.memory/feature-map.md` updated in the same commit as route, endpoint, or `data-testid` changes (enforced via `cf-qa-review` and `cf-eval` drift checks).
- Headless Playwright mode still requires projects that want CI-speed local browser smoke runs to opt into installing `playwright` as a `devDependency` (Human-Lit approval).
