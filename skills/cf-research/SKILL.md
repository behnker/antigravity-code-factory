---
name: cf-research
description: >-
  Stage 1 of the Enterprise Code Factory SDLC: conducts technical discovery,
  codebase inspection, dependency license/CVE evaluation, and architectural
  trade-off analysis, producing .memory/research.md. Use before system design
  and spec authoring.
---

# Skill: Stage 1 — Discovery & Technical Research

Conduct thorough technical discovery before locking requirements or writing code.

## Steps

1. Gather context:
   - Read `.memory/architecture.md` and `.memory/decisions/` (if present).
   - Inspect relevant codebase modules (delegate broad surveys to a `research` subagent when scanning many files).
   - Use web search and available MCP documentation servers to verify current APIs, library versions, and constraints.
2. Evaluate dependencies and risk:
   - Check third-party dependency licenses (prefer MIT / Apache-2.0 / BSD; flag restrictive licenses).
   - Check for known High/Critical CVEs and maintenance health.
   - Identify upfront security, scalability, and migration impacts.
3. Write `.memory/research.md` containing:
   - **Problem Statement & Constraints**
   - **Codebase Findings** (existing patterns, integration points, constraints)
   - **Technical Feasibility & Trade-Offs** (explicit options compared with pros/cons)
   - **Dependency Evaluation** (licenses, security posture, alternatives)
   - **Security & Performance Impact Assessment**
   - **Recommended Direction**
4. **Stage 1 Senior Engineer Sign-Off Gate** — Present `.memory/research.md` and explicitly verify with the user:
   - Are technical trade-offs explicitly enumerated?
   - Are dependency licenses verified for compliance?
   - Is security impact identified upfront?
5. Do not move to Stage 2 (`cf-grill-me` / `cf-plan`) until the user signs off on the research direction.
