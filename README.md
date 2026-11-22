# Antigravity Enterprise Code Factory Plugin

Global Antigravity plugin implementing the **Enterprise Code Factory Blueprint (v2.0.0)** — Spec-Driven Development (SDD), invariant quality gates, file-based `.memory/` handovers, and a 6-stage SDLC skill pipeline across all projects.

## Structure

- `plugin.json` — Plugin manifest
- `assets/logo.svg` — Plugin icon
- `rules/AGENTS.md` — Always-on global invariants (Security, Scalability, UI/UX, Testing) and `.memory/` session protocol
- `hooks.json` & `hooks/hitl-gate.py` — `PreToolUse` HITL safety gate enforcing `force_ask` confirmation on high-impact commands (`git push`, `npm/yarn/pnpm publish`, `rm -rf`, `docker/podman push`, `kubectl apply/delete`, and database migrations)
- `skills/` — 11 `cf-*` workflow skills covering the full 6-stage SDLC + workspace bootstrapping

## Installation (Global Across All Projects)

Symlink this repository into `~/.gemini/config/plugins/code-factory` so edits in Git stay live across every Antigravity workspace:

```bash
ln -s "$(pwd)" ~/.gemini/config/plugins/code-factory
```
