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
   Run the project's equivalents of:
   - Linter (e.g., `npm run lint`, `ruff check`, `cargo clippy`)
   - Typechecker (e.g., `npx tsc --noEmit`, `mypy`, `pyright`)
   - Unit & integration test suite with coverage (e.g., `npm test -- --coverage`, `pytest --cov`)
   - Dependency / SAST audit if configured (e.g., `npm audit`, `pip-audit`, `bandit`, `semgrep`)
2. **Independent Invariant & Security Review:**
   - Inspect `git diff` (preferably via a fresh reviewer subagent to preserve separation of concerns).
   - Verify compliance with every invariant: zero hardcoded secrets, runtime schema validation at boundaries, parameterized queries / no shell concat, pagination limits, HTTP timeouts/retries, WCAG 2.1 AA, deterministic tests, and edge-case coverage.
3. **Visual UI/UX Audit (if UI files were modified):**
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
5. **Stage 4 Senior Engineer Sign-Off Gate** — Confirm with the user:
   - Are all unit, integration, and E2E tests passing?
   - Did browser inspection confirm WCAG AA accessibility and responsive layouts (if UI changed)?
   - Are static analysis and security scans 100% clean?
