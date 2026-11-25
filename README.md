# Antigravity Enterprise Code Factory Plugin

Global Antigravity plugin implementing the **Enterprise Code Factory Blueprint (v2.4.0)** — Spec-Driven Development (SDD), invariant quality gates (Security, Scalability, UI/UX, Testing, Edge/Serverless runtimes, and Lit Software Factory / Loop Engineering), persistent `.memory/` handovers & living Feature Maps, 5 least-privilege subagent personas, dual `PreToolUse` HITL + secret/leak guard hooks, and a 15-skill SDLC, Feature Map Verification, Architectural Boundary, and Dual-Axis Eval pipeline across all projects.

## Structure

- `plugin.json` — Plugin manifest and metadata
- `assets/logo.svg` — Plugin icon
- `rules/AGENTS.md` — Always-on global invariants (Security, Scalability, UI/UX, Testing, Cloudflare/Vercel/Supabase edge & serverless guardrails) and `.memory/` session protocol
- `agents/` — 5 least-privilege subagent personas with explicit `tools:` frontmatter (`cf-architect`, `cf-backend`, `cf-frontend`, `cf-reviewer`, `cf-tester`; Stage 4 visual QA uses Antigravity's built-in `browser` subagent)
- `hooks.json`, `hooks/hitl-gate.py`, & `hooks/secret-guard.py` — Dual `PreToolUse` safety hooks:
  - **HITL Safety Gate (`run_command`):** enforces `force_ask` confirmation on high-impact commands (`git push`, `npm/yarn/pnpm publish`, `rm -rf`, `docker/podman push`, `kubectl apply/delete`, Cloudflare `wrangler`/`cf deploy`, Vercel `--prod`/`rm`, Supabase `db push/reset`/`functions deploy`, `terraform apply/destroy`, `gh repo delete`, and database migrations)
  - **Secret & Client-Leak Guard (`write_file|edit_file|...`):** <20ms pure-stdlib Python guard blocking hardcoded credentials/private keys, `NEXT_PUBLIC_*`/`VITE_*` secret env leaks, and Supabase `service_role` usage in client code
- `skills/` — 15 `cf-*` workflow skills covering workspace bootstrapping (`cf-bootstrap`), session continuity (`cf-start`, `cf-handover`), the full 6-stage SDLC (`cf-research`, `cf-grill-me`, `cf-plan`, `cf-implement`, `cf-qa-review`, `cf-deploy-staging`, `cf-triage`, `cf-learn`), Loop Engineering & Dual-Axis Eval (`cf-loop-engineer`, `cf-eval`), deterministic Next.js/TypeScript + `dependency-cruiser` verification (`cf-next-verify`), and Feature Map Playwright/browser verification (`cf-verify-map`)

## Installation (Global Across All Projects)

Clone and symlink this repository into `~/.gemini/config/plugins/code-factory` so edits in Git stay live across every Antigravity workspace:

```bash
git clone https://github.com/behnker/antigravity-code-factory.git
ln -s "$(pwd)/antigravity-code-factory" ~/.gemini/config/plugins/code-factory
```

## Testing the Plugin Hooks & Stack Verifier

```bash
python3 -m unittest -v hooks/test_hitl_gate.py hooks/test_secret_guard.py
node --test skills/cf-verify-map/scripts/test_run_verify_map.mjs
bash skills/cf-next-verify/scripts/verify-stack.sh academy --skip-build
```
