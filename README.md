# Antigravity Enterprise Code Factory Plugin

Global Antigravity plugin implementing the **Enterprise Code Factory Blueprint (v2.1.0)** — Spec-Driven Development (SDD), invariant quality gates (Security, Scalability, UI/UX, Testing, and Edge/Serverless runtimes), persistent `.memory/` handovers, custom subagent personas, a `PreToolUse` HITL safety gate, and an 11-skill SDLC pipeline across all projects.

## Structure

- `plugin.json` — Plugin manifest and metadata
- `assets/logo.svg` — Plugin icon
- `rules/AGENTS.md` — Always-on global invariants (Security, Scalability, UI/UX, Testing, Cloudflare/Vercel/Supabase edge & serverless guardrails) and `.memory/` session protocol
- `agents/` — 4 custom Blueprint subagent personas (`cf-architect`, `cf-backend`, `cf-frontend`, `cf-reviewer`; Stage 4 visual QA uses Antigravity's built-in `browser` subagent)
- `hooks.json` & `hooks/hitl-gate.py` — `PreToolUse` HITL safety gate enforcing `force_ask` confirmation on high-impact commands (`git push`, `npm/yarn/pnpm publish`, `rm -rf`, `docker/podman push`, `kubectl apply/delete`, Cloudflare `wrangler`/`cf deploy`, Vercel `--prod`/`rm`, Supabase `db push/reset`/`functions deploy`, `terraform apply/destroy`, `gh repo delete`, and database migrations)
- `skills/` — 11 `cf-*` workflow skills covering workspace bootstrapping (`cf-bootstrap`), session continuity (`cf-start`, `cf-handover`), and the full 6-stage SDLC (`cf-research`, `cf-grill-me`, `cf-plan`, `cf-implement`, `cf-qa-review`, `cf-deploy-staging`, `cf-triage`, `cf-learn`)

## Installation (Global Across All Projects)

Clone and symlink this repository into `~/.gemini/config/plugins/code-factory` so edits in Git stay live across every Antigravity workspace:

```bash
git clone https://github.com/behnker/antigravity-code-factory.git
ln -s "$(pwd)/antigravity-code-factory" ~/.gemini/config/plugins/code-factory
```

## Testing the HITL Safety Hook

```bash
python3 -m unittest -v hooks/test_hitl_gate.py
```
