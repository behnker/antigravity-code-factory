---
name: cf-bootstrap
description: >-
  Scaffolds the Antigravity Enterprise Code Factory workspace structure (.memory/,
  plans/templates/, and optional project AGENTS.md / .agents/rules/) in any new
  or existing repository without overwriting existing files. Use when initializing
  a project for the Code Factory protocol.
---

# Skill: Bootstrap Code Factory Workspace

Initialize the standardized `.memory/` Memory Bank and `plans/` Spec-Driven Development scaffolding in the current project repository.

## Steps

1. Confirm the target project root (the repository containing `.git`, or the active workspace root).
2. Run the bundled bootstrap script from this skill directory:
   ```bash
   bash "<path-to-this-skill>/scripts/bootstrap.sh" "<project-root>"
   ```
   The script is **non-destructive**: it skips any file that already exists so existing project memory, specs, or `AGENTS.md` files are never overwritten.
3. Inspect what was created (and what was preserved) and report a concise summary to the user:
   - `.memory/handover.md` (from [handover-template.md](./resources/handover-template.md))
   - `.memory/tasks.md` (from [tasks-template.md](./resources/tasks-template.md))
   - `.memory/architecture.md` (from [architecture-template.md](./resources/architecture-template.md))
   - `.memory/decisions/0001-record-template.md` (from [adr-template.md](./resources/adr-template.md))
   - `plans/templates/feature-spec-template.md` (from [feature-spec-template.md](./resources/feature-spec-template.md))
4. If the repository already has source code, offer to populate `.memory/architecture.md` by scanning the project's tech stack and directory structure.
5. Remind the user that global invariants (Security, Scalability, UI/UX, Testing) are already active via the `code-factory` plugin; project-specific overrides can optionally be added under `.agents/rules/`.
