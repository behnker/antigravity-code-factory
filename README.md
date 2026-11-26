# Antigravity Enterprise Code Factory Plugin

Global Antigravity plugin implementing the **Enterprise Code Factory Blueprint (v3.1.0)** — Spec-Driven Development (SDD), invariant quality gates (Security, Scalability, UI/UX, Testing, Edge/Serverless runtimes, and Lit Software Factory / Loop Engineering), persistent `.memory/` handovers & living Feature Maps, 5 least-privilege subagent personas, a **7-hook, 5-event Core Lifecycle Hooks** engine (pure Python 3 stdlib, zero external dependencies, including pre-turn Git-Shadow checkpoints), a `0600` Unix-socket telemetry & auto-memory sidecar, bundled `run_workflow` SDLC pipelines, and a **20-skill** SDLC, Git-Shadow Rewind, Website Factory (Token-First Design, Three.js Craft, SEO/AEO/GEO), Feature Map Verification, Architectural Boundary, and Dual-Axis Eval pipeline across all projects.

## Structure

- `plugin.json` — Plugin manifest and metadata (`v3.1.0`)
- `assets/logo.svg` — Plugin icon
- `rules/AGENTS.md` — Always-on global invariants (`<= 10 KB` budget covering Security, Scalability, UI/UX, Testing, Cloudflare/Vercel/Supabase edge & serverless guardrails, and Lit Software Factory governance) and `.memory/` session protocol
- `agents/` — 5 least-privilege subagent personas with explicit `tools:` frontmatter (`cf-architect`, `cf-backend`, `cf-frontend`, `cf-reviewer`, `cf-tester`; Stage 4 visual QA uses Antigravity's built-in `browser` subagent)
- `hooks.json` & `hooks/` — **7 Named Hooks Across 5 Lifecycle Events** (pure Python 3 stdlib) + atomic state store:
  - **Atomic Per-Conversation State (`hooks/hook_state.py`):** `0700`/`0600`-permissioned JSON state under `$PLUGIN_DATA/conversations/<cid>.json` with strict `conversationId` sanitization, secret redaction, `24h` TTL pruning, checkpoint JSONL storage, and `<10ms` fail-open sidecar event emitter + local spool
  - **`SessionStart` (`hooks/session-start.py`):** auto-hydrates `.memory/handover.md` (`<= 3 KB`), optional `.memory/auto-memory.md` (`<= 200` lines / `<= 3 KB`), and `git status --short --branch` (`1.0s` timeout)
  - **`PreToolUse` (`hooks/hitl-gate.py` + `hooks/secret-guard.py` + `hooks/checkpoint-hook.py`):** fail-closed `<50ms` HITL `force_ask` gate on 11 high-impact command classes with transparent safe `overwrite` (`git --no-pager`, `curl --max-time 5`), `<20ms` secret & `NEXT_PUBLIC_*`/`VITE_*`/`service_role` leak blocker, and `<=150ms` per-turn deduplicated `git stash create` snapshots (`cf-rewind`)
  - **`PostToolUse` -> `PreInvocation` (`hooks/post-tool-feedback.py` + `hooks/pre-invocation.py`):** deterministic two-stage `<2s` single-file syntax/lint feedback bridge (`compile`/`PyCF_ALLOW_TOP_LEVEL_AWAIT` for `workflows/`/`ruff`/`eslint`/`node`/`json`/`bash -n`), turn-15+ context-hygiene compaction reminder, 5-failure runaway loop-breaker (`terminationBehavior: "terminate"`), and non-blocking sidecar telemetry emits
  - **`Stop` (`hooks/stop-gate.py`):** mathematically bounded single-shot verification gate prompting for typecheck/lint/test runs on unverified source edits (`terminationReason == "NO_TOOL_CALL"`, `continuationActive == false`, `fullyIdle == true`) and advancing `turnEpoch`
  - **Zero-Code Runtime Kill Switches:** disable any named hook via `"enabled": false` in `hooks.json` or export `CF_HITL_OVERWRITE=off`, `CF_DISABLE_CHECKPOINTS=1`, `CF_CHECKPOINT_TIMEOUT_MS`, `CF_DISABLE_SIDECAR=1`, `CF_AUTO_MEMORY=off`, `CF_POST_TOOL_LINT=off`, `CF_POST_TOOL_TIMEOUT_MS`, `CF_LOOP_BREAKER_MAX=0`, `CF_CONTEXT_WARN_TURN=0`, or `CF_STOP_GATE_MODE=off`
- `sidecars/telemetry-memory/` — `sidecar.json` + pure Python 3 stdlib `0600` `AF_UNIX` socket daemon (`sidecar.py`, with macOS `104`-byte `sun_path` fallback) for rotated JSONL audit logs, optional redacted `https://` webhooks (`CF_TELEMETRY_WEBHOOK_URL`), and bounded `<= 200`-line / `<= 3 KB` `.memory/auto-memory.md` distillation (`serve`, `status`, `flush`, `distill`, `stop`)
- `workflows/` — Self-contained `run_workflow` SDLC pipelines (`workflows/cf-qa-gate/{workflow.json,workflow.py}`, `workflows/cf-implement-spec/{workflow.json,workflow.py}`) + `workflows/validate_workflows.py` (JSON Schema + `ast.PyCF_ALLOW_TOP_LEVEL_AWAIT` validator)
- `skills/` — 20 `cf-*` workflow skills covering workspace bootstrapping (`cf-bootstrap`), session continuity (`cf-start`, `cf-handover`, `cf-rewind` Git-Shadow rollback), the full 6-stage SDLC (`cf-research`, `cf-grill-me`, `cf-plan`, `cf-implement`, `cf-qa-review`, `cf-deploy-staging`, `cf-triage`, `cf-learn`), Loop Engineering & Dual-Axis Eval (`cf-loop-engineer`, `cf-eval`), deterministic Next.js/TypeScript + `dependency-cruiser` verification (`cf-next-verify`), Feature Map Playwright/browser verification (`cf-verify-map`), and the 4-skill **Vibe Website Factory** pipeline (`cf-website-factory`, `cf-design-tokens`, `cf-threejs-craft`, `cf-geo-seo`)

## Installation (Global Across All Projects)

Clone and symlink this repository into `~/.gemini/config/plugins/code-factory` so edits in Git stay live across every Antigravity workspace:

```bash
git clone https://github.com/behnker/antigravity-code-factory.git
ln -s "$(pwd)/antigravity-code-factory" ~/.gemini/config/plugins/code-factory
```

## Testing the Plugin Hooks, Sidecar, Workflows & Stack Verifier

```bash
python3 -m unittest discover -s hooks -p "test_*.py" -v
python3 -m unittest hooks/test_phase2_checkpoints.py hooks/test_phase2_sidecar_workflows.py -v
python3 workflows/validate_workflows.py
ruff check hooks/ sidecars/ workflows/ skills/cf-rewind/
node --test skills/cf-verify-map/scripts/test_run_verify_map.mjs \
  skills/cf-design-tokens/scripts/tokens.test.mjs \
  skills/cf-threejs-craft/scripts/threejs.test.mjs \
  skills/cf-geo-seo/scripts/geo-seo.test.mjs
bash skills/cf-next-verify/scripts/verify-stack.sh academy --skip-build
```
