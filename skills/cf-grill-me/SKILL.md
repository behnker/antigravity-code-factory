---
name: cf-grill-me
description: >-
  Stage 2A of the Enterprise Code Factory SDLC: interrogates requirements against
  project architecture to surface ambiguities before authoring a locked feature
  specification. Use before cf-plan whenever requirements have gaps or unstated assumptions.
---

# Skill: Stage 2A — Grill Me (Ambiguity Discovery)

Interrogate the problem space so the locked spec contains zero implicit assumptions.

## Steps

1. Analyze the user's request against `.memory/architecture.md`, `.memory/research.md` (if present), and `.memory/decisions/`.
2. Audit for missing or ambiguous specifications across:
   - **Data Models & Migrations:** Entities, relationships, constraints, backwards compatibility, indexing.
   - **API Contracts & Errors:** Inputs, outputs, pagination bounds, validation schemas, error codes, idempotency.
   - **Authentication & Access Control:** Roles, tenant isolation, least-privilege boundaries, rate limits.
   - **UI/UX States:** Loading, error, empty states, responsive breakpoints (375px / 768px / 1440px), WCAG 2.1 AA details.
   - **Operational Bounds:** Timeouts, retries, background jobs, rollback expectations.
3. Ask the user **up to 5 clear, numbered, high-impact questions** to resolve the most important ambiguities (group related sub-decisions concisely; include a recommended default where helpful).
4. **Hard Gate:** Do **NOT** write implementation code or lock a spec until the questions are answered and confirmed by the user. Once answered, proceed to `cf-plan`.
