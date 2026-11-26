# Feature Spec: Enterprise Code Factory v3.0.0 — Phase 1 Core Hooks & Antigravity Academy Sync

**Status:** Locked — Approved for Stage 3 Execution  
**Date:** 2026-11-26  
**Research Input:** [`.memory/research.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/research.md)  
**Related ADR:** [`.memory/decisions/0006-code-factory-v3-phase1-hook-bridge.md`](file:///Users/ralphb/Projects_Personal/Project_Antigravity/.memory/decisions/0006-code-factory-v3-phase1-hook-bridge.md)  
**Hook Contract Grounding:** [`agy-customizations/docs/hooks.md`](file:///Users/ralphb/.gemini/antigravity/builtin/skills/agy-customizations/docs/hooks.md)

---

## 1. Overview, Goals & Explicit Non-Goals

### Problem Statement
`antigravity-code-factory` (`v2.5.0`, `e562472`, 19 skills) enforces `PreToolUse` safety gates (`hooks/hitl-gate.py` on `run_command` and `hooks/secret-guard.py` on file writes), yet leaves four of Antigravity's six native lifecycle events (`SessionStart`, `PostToolUse`, `PreInvocation`, `Stop`) unused. As a result:
1. New sessions do not automatically hydrate `.memory/handover.md`, optional `.memory/auto-memory.md`, or current Git status.
2. Because Antigravity's `PostToolUse` expects `{}` and cannot inject context directly, post-edit syntax/lint errors are not surfaced deterministically back to the model.
3. Long sessions lack deterministic turn-count compaction reminders or runaway failure loop-breakers, and turns can terminate after editing source files without running verification checks.
4. `PreToolUse` does not yet leverage Antigravity's `overwrite` capability to enforce non-blocking `git --no-pager` and `curl --max-time 5` bounds automatically.
5. `academy/` still references `15` (or `11`) skills from `v2.1.0`/`v2.4.0`, omits the four `v2.5.0` Website Factory skills from `SKILL_STAGE_MAP`, ingests only `hooks.json` + 2 Python scripts, and contains hypothetical/outdated hook snippets in Course 01 that do not match `agy-customizations/docs/hooks.md`.

### Goals
1. **Complete Phase 1 Core Lifecycle Hooks (Pure Python 3 Stdlib, Zero External Dependencies):**
   - Implement `hooks/hook_state.py` for atomic, `0600`-permissioned per-conversation JSON state under `$PLUGIN_DATA` with strict `conversationId` sanitization and `24h` TTL cleanup.
   - Implement `hooks/session-start.py` (`SessionStart`) for safe `.memory/` auto-hydration (`<= 3 KB` handover + optional `<= 200`-line / `<= 3 KB` auto-memory + `git status --short --branch` with `1.0s` timeout).
   - Upgrade `hooks/hitl-gate.py` (`PreToolUse` `run_command`) with conservative, transparent `overwrite` (`--no-pager` on `git`, `--max-time 5` on `curl`) while preserving all 11 `force_ask` patterns, `--dry-run` exemptions, `ask` on `BypassSandbox`, and fail-closed safety.
   - Implement `hooks/post-tool-feedback.py` (`PostToolUse`) + `hooks/pre-invocation.py` (`PreInvocation`) as a deterministic two-stage single-file `<2s` lint/syntax feedback bridge, turn-15+ context-saturation warning, and 5-failure runaway loop-breaker (`terminationBehavior: "terminate"`).
   - Implement `hooks/stop-gate.py` (`Stop`) as a mathematically bounded verification gate guarding `terminationReason == "NO_TOOL_CALL"`, `continuationActive == false`, and `fullyIdle == true`.
   - Register all 5 lifecycle events in `hooks.json` using exact Antigravity flat vs. grouped structures and bump `plugin.json` to `3.0.0`.
2. **Lockstep Stateless Antigravity Academy Sync (`academy/`):**
   - Update `academy/scripts/sync-resources.ts` to ingest all 8 hook resources and map all 19 skills (`cf-website-factory`, `cf-design-tokens`, `cf-threejs-craft`, `cf-geo-seo`).
   - Add optional, backward-compatible `overwrite` metadata to `schemas.ts`, `hitl-evaluator.ts`, `/api/hitl/simulate`, and `HitlGateSimulator.tsx`.
   - Sync `contracts.ts`, `harness-comparison.ts`, `README.md`, and Courses `00`, `01`, `02`, `04` to `19` skills and implemented `v3.0.0` Phase 1 hooks (fixing inaccurate Course 01 snippets to match `docs/hooks.md`), while preserving `rules/AGENTS.md <= 10,240` bytes (`<= 10 KB`) and keeping `academy/` strictly stateless (`localStorage` + Zod).

### Explicit Non-Goals
- **Deferred to Phase 2 (`v3.x`):** Git-Shadow `git stash create` checkpoints & `cf-rewind` skill; `sidecar.json` `0600` Unix-socket daemon for async webhooks/OTel/auto-memory distillation; companion `code-factory-lsp` MCP plugin (`mcp-language-server` / `ast-grep`).
- **Deferred to Phase 3 (`v3.x`):** Bundled `workflows/*.py` (`run_workflow` pipelines), interactive MCP App Mission Control side pane, and budget-capped `agy -p` CI runner.
- **Deferred to Academy v2:** User authentication, Supabase Postgres tables, RLS policies, or adding any new runtime npm or PyPI dependencies.

---

## 2. System Architecture

### Component Architecture

```mermaid
flowchart TD
    AGY["Antigravity Agent Loop (hooks.json)"] --> SS["SessionStart: hooks/session-start.py"]
    AGY --> PRET1["PreToolUse (run_command): hooks/hitl-gate.py"]
    AGY --> PRET2["PreToolUse (write/edit): hooks/secret-guard.py"]
    AGY --> POSTT["PostToolUse (write/edit/run_command): hooks/post-tool-feedback.py"]
    AGY --> PREI["PreInvocation: hooks/pre-invocation.py"]
    AGY --> STOP["Stop: hooks/stop-gate.py"]

    SS --> STATE["hooks/hook_state.py ($PLUGIN_DATA/conversations/<cid>.json)"]
    POSTT --> STATE
    PREI --> STATE
    STOP --> STATE

    SYNC["academy/scripts/sync-resources.ts"] --> MANIFEST["academy/src/data/generated-repo-manifest.json"]
    ROOT["plugin.json, hooks.json, hooks/*.py, skills/*, courses/*"] --> SYNC
    MANIFEST --> API["Academy Next.js RSC & APIs (/api/courses, /api/resources)"]
    EVAL["academy/src/lib/hitl-evaluator.ts"] --> SIMAPI["POST /api/hitl/simulate"]
```

### 5-Hook Lifecycle Execution Sequence

```mermaid
sequenceDiagram
    participant User as Developer
    participant Loop as Antigravity Loop
    participant SS as session-start.py
    participant PreT as hitl-gate.py / secret-guard.py
    participant PostT as post-tool-feedback.py
    participant State as $PLUGIN_DATA/<cid>.json
    participant PreI as pre-invocation.py
    participant StopG as stop-gate.py

    User->>Loop: Start new session
    Loop->>SS: SessionStart (stdin JSON)
    SS->>State: Prune >24h state files
    SS-->>Loop: injectSteps.systemMessage (.memory/ + git status) or {}

    Loop->>PreI: PreInvocation (invocationNum)
    PreI->>State: Check loop-breaker / drain feedback / check turn >= 15
    PreI-->>Loop: {} or injectSteps / terminate

    Loop->>PreT: PreToolUse (run_command or write/edit)
    PreT-->>Loop: decision: allow (+ overwrite) / ask / force_ask / deny

    Loop->>PostT: PostToolUse (toolCall, error)
    PostT->>State: Update failure streak, editedSourceFiles, <2s single-file lint
    PostT-->>Loop: {} (always)

    Loop->>PreI: PreInvocation (next model call)
    PreI->>State: Drain pendingFeedback or trigger loop-breaker at >= 5 errors
    PreI-->>Loop: injectSteps.systemMessage or terminationBehavior: terminate

    Loop->>StopG: Stop (NO_TOOL_CALL, continuationActive, fullyIdle)
    StopG->>State: Check needsVerification and clear single-shot flag
    StopG-->>Loop: decision: continue (if unverified edits) or allow
```

---

## 3. Exact Hook, State Store & API Contracts

### 3.1 Shared State Store Contract (`hooks/hook_state.py`)

Pure Python 3 stdlib only (`fcntl`, `hashlib`, `json`, `os`, `pathlib`, `re`, `tempfile`, `time`).

#### `$PLUGIN_DATA` Resolution & Directory Security
- Read `os.environ.get("PLUGIN_DATA", "").strip()`.
- If unset or empty, resolve fallback root to `pathlib.Path(tempfile.gettempdir()) / f"code-factory-state-{uid}"` (where `uid = os.getuid()` on POSIX or `"user"` on Windows).
- Reject symlinked state root or `conversations/` subdirectory (`if path.is_symlink():` fall back to a dedicated PID/UID-isolated safe temp directory or abort state write safely without following symlinks).
- Create `<state_root>/conversations/` with `0o700` permissions (`os.chmod(dir_path, 0o700)` where supported).

#### `conversationId` Strict Sanitization
- Validation regex: `^[A-Za-z0-9_-]{1,128}$`.
- Resolution rules:
  1. If `conversationId` is missing, non-string, or whitespace-only -> `"default"`.
  2. If `conversationId` matches `^[A-Za-z0-9_-]{1,128}$` -> use verbatim.
  3. Otherwise (contains `/`, `\`, `..`, spaces, null bytes, or exceeds 128 chars) -> `f"cid-{hashlib.sha256(raw.encode('utf-8', 'replace')).hexdigest()[:32]}"`.
- Final defense: assert `target_path.resolve().parent == conversations_dir.resolve()`.

#### Atomic Read-Modify-Write & `0600` Permissions
- Wrap updates in best-effort advisory file lock (`fcntl.flock(lock_fd, fcntl.LOCK_EX)` on `<safe_cid>.lock` when `fcntl` is available).
- Write via `tempfile.NamedTemporaryFile(dir=conversations_dir, prefix=f".{safe_cid}.", suffix=".tmp", mode="w", encoding="utf-8", delete=False)`.
- Apply `os.chmod(tmp_path, 0o600)` BEFORE `os.replace(tmp_path, target_path)`. Flush and `os.fsync()` before closing; unlink `tmp_path` in `except` cleanup if `os.replace` fails.
- On corrupt or unreadable JSON in `<safe_cid>.json`, fail gracefully to a fresh default state object (never crash a hook).

#### State File JSON Schema (`schemaVersion: 1`)
```json
{
  "schemaVersion": 1,
  "conversationId": "ec33ebf9-0cba-4100-8142-c61503f6c587",
  "updatedAt": 1764125125.0,
  "pendingFeedback": [
    {
      "toolName": "edit_file",
      "filePath": "academy/src/lib/contracts.ts",
      "status": "error",
      "checker": "eslint",
      "summary": "line 42: Unexpected any (max-warnings=0)",
      "timestamp": 1764125124.5
    }
  ],
  "lastFailureSignature": "run_command:9f86d081884c7d65",
  "consecutiveFailures": 0,
  "editedSourceFiles": ["academy/src/lib/contracts.ts"],
  "needsVerification": true,
  "lastVerifiedAt": null,
  "lastVerificationCommand": null,
  "contextWarnedThresholds": [15],
  "stopContinuationCount": 0
}
```

#### Payload Bounds, Secret Sanitization & TTL Pruning
- **Bounds:** `pendingFeedback` max `8` items (`summary <= 600` chars each); `editedSourceFiles` deduplicated max `50` paths; `lastFailureSignature <= 256` chars; `contextWarnedThresholds` max `16` integers.
- **Secret Sanitization (`sanitize_text(text, max_chars=600)`):** Before persisting or injecting diagnostics, replace private key blocks, `AKIA...`, `gh[pousr]_...`, `github_pat_...`, `[sr]k_live_...`, `sk-ant-...`, `sk-[A-Za-z0-9_-]{20,}`, `AIza...`, `xox[baprs]-...`, `Bearer ...` JWT/tokens, and credentialed DB URIs (`postgres://user:pass@host`) with `[REDACTED_SECRET]`; strip ANSI escape sequences and null bytes.
- **Stale File TTL Pruning (`24h`):** `prune_stale_states(max_age_seconds=86400, now=None, max_scan=200)` unlinks `.json`/`.lock` files older than `86400s` (and orphan `.tmp` files older than `3600s`), accepting deterministic `now` for tests.

---

### 3.2 Hook Specifications (Exact Stdin / Stdout & Semantics)

#### Hook 1: `hooks/hitl-gate.py` (`PreToolUse` on `run_command`)
- **Latency Budget:** `< 50 ms` total (`< 5 ms` in-process, zero disk I/O, zero subprocesses).
- **Fail-Closed Semantics:** Empty stdin, invalid JSON, or non-dict stdin -> `{"decision": "ask", "reason": "..."}` (NEVER `{}`).
- **Decision Priority:**
  1. Split `CommandLine` on segment separators (`&&`, `||`, `;`, `\n`, `|`) and check all 11 `HIGH_IMPACT_PATTERNS` + `DRY_RUN_EXEMPT_LABELS` (`cloudflare deploy/delete`, `supabase deploy/db mutation`). Any match -> `{"decision": "force_ask", "reason": "..."}` (NO `overwrite`).
  2. If `BypassSandbox` (`bypassSandbox` / `bypass_sandbox`) is truthy -> `{"decision": "ask", "reason": "Command requested execution outside the sandbox."}` (NO `overwrite`).
  3. Otherwise -> `{"decision": "allow"}`, optionally with `"overwrite": {arg_key: rewritten_command}` (preserving whichever of `"CommandLine"`, `"commandLine"`, or `"command_line"` was provided, defaulting to `"CommandLine"`).
- **Transparent `overwrite` Rules (`--no-pager` on `git`, `--max-time 5` on `curl`):**
  - Opt-out env var: if `CF_HITL_OVERWRITE=off`, skip rewriting.
  - **Mandatory Safety Exclusions (Bail Out -> Return `None` / No `overwrite`):**
    1. Decision is anything other than `"allow"` (`force_ask`, `ask`, `deny`).
    2. Command contains compound subshells, command substitutions, heredocs, braces, or multiline scripts (`$(`, `` ` ``, `<<`, `(`, `)`, `{`, `}`, `\n`, `\r`, `\0`).
    3. Command has unbalanced single/double quotes.
    4. Command is a different executable passing `git` or `curl` inside quoted arguments (e.g., `echo "curl https://x"`, `python3 -c "print('git status')"`).
  - **Quote-Aware Segment Tokenization & Exact Offset Splicing:**
    - Split only on top-level unquoted `&&`, `||`, `;`, `|`.
    - Within each segment, skip leading whitespace and leading `VAR=VALUE` env assignments, identify the exact command token `(cmd_text, cmd_end_idx)`, and parse trailing args with `shlex.split()`.
    - For `git` (`/usr/bin/git` or `git`): skip if `GIT_PAGER=` is in leading env prefix or args before `--` already contain `--no-pager`, `-p`, `--paginate`, `--exec-path`, `-h`, `--help`, or `--version`. Otherwise splice `" --no-pager"` immediately at `cmd_end_idx` (preserving all trailing quotes, redirects, and spacing verbatim).
    - For `curl` (`/usr/bin/curl` or `curl`): skip if args before `--` already contain `--max-time`, `--max-time=*`, `-m`, `-m*`, any short option cluster containing `m` (e.g., `-sSm`), `-h`, `--help`, `-V`, or `--version`. Otherwise splice `" --max-time 5"` immediately at `cmd_end_idx`.
  - **Existing Test Alignment Note:** `hooks/test_hitl_gate.py` must be updated explicitly per this locked spec so benign `git status -s` / `git diff --stat` / `git commit -m 'prepare push fix'` verify `decision == "allow"` and exact `overwrite == {"CommandLine": "git --no-pager ..."}` alongside negative exclusion cases.

#### Hook 2: `hooks/session-start.py` (`SessionStart`)
- **Latency Budget:** `< 1.5 s` (`timeout: 5` in `hooks.json`).
- **Fail-Open Semantics:** Malformed stdin or missing `.memory/` directory emits `{}` (`exit 0`) silently so non-Code-Factory repos receive zero noise.
- **Stdin Contract (`docs/hooks.md`):** `{ "conversationId", "workspacePaths", "cwd", "modelName", "hookEventName" }`.
- **Execution Steps:**
  1. Resolve `project_dir` from `cwd` or `workspacePaths[0]`; verify directory exists and does not escape.
  2. Call `hook_state.prune_stale_states()` (`24h` TTL).
  3. If `<project_dir>/.memory/` does not exist or is not a real directory -> emit `{}` and exit `0`.
  4. Read `.memory/handover.md` (if regular file inside `project_dir`): cap at `<= 3072` bytes (`3 KB`), appending truncation notice if exceeded, and run `sanitize_text(..., max_chars=3072)`.
  5. Read optional `.memory/auto-memory.md` (if regular file inside `project_dir`): cap at `<= 200` lines AND `<= 3072` bytes, run `sanitize_text`.
  6. Execute `subprocess.run(["git", "--no-pager", "status", "--short", "--branch"], cwd=str(project_dir), shell=False, capture_output=True, text=True, timeout=1.0)`; ignore `FileNotFoundError` / `TimeoutExpired` / non-git repos; truncate output to `<= 30` lines / `1200` chars.
  7. Format compact header `[Code Factory SessionStart]` (`<= 8192` bytes total) and print exact nested `docs/hooks.md` schema:
     ```json
     {
       "injectSteps": [
         {
           "systemMessage": {
             "systemMessage": "[Code Factory SessionStart] ..."
           }
         }
       ]
     }
     ```

#### Hook 3: `hooks/post-tool-feedback.py` (`PostToolUse`)
- **Matcher:** `write_file|edit_file|write_to_file|replace_file_content|multi_replace_file_content|run_command`
- **Latency Budget:** `< 2.0 s` (`1.8 s` internal subprocess timeout cap; configurable via `CF_POST_TOOL_TIMEOUT_MS` clamped `[200, 2000]`).
- **Stdout Contract (`docs/hooks.md`):** **ALWAYS** prints `{}` and exits `0` (even on malformed stdin or internal timeouts).
- **Execution Steps (Atomic `hook_state.update_state`):**
  1. **Runaway Failure Streak Tracking:**
     - Inspect `error = payload.get("error")` (non-empty string).
     - Build normalized signature from `tool_name` + (`CommandLine` stripped for `run_command`, or `file_path` for write/edit) + normalized first 80 chars of `error`, hashed to `f"{tool_name}:{sha256[:16]}"`.
     - If `error` non-empty: increment `consecutiveFailures` if signature matches `lastFailureSignature`, else set `consecutiveFailures = 1` and `lastFailureSignature = sig`.
     - Else (`not error`): reset `consecutiveFailures = 0`, `lastFailureSignature = ""`.
  2. **Edited Source File vs. Green Verification Tracking (for `Stop` Gate):**
     - Tracked source extensions: `{".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java", ".rb", ".php", ".cs", ".vue", ".svelte", ".sh"}`.
     - Excluded directories (never require test verification on docs/specs/memory edits): `.memory/`, `plans/`, `docs/`, `.tmp/`, `node_modules/`, `.next/`.
     - On successful write/edit to a tracked source file: append relative path to `editedSourceFiles` (max 50), set `needsVerification = True`, reset `stopContinuationCount = 0`.
     - On successful `run_command` (`not error`): test segment-level command heads (ignoring quoted strings and comments) against `VERIFICATION_COMMAND_RE` (`pytest`, `python3 -m unittest`, `vitest`, `jest`, `mocha`, `node --test`, `npm|pnpm|yarn|bun` `test|lint|typecheck|check|build|verify|arch:check|verify:map`, `tsc`, `eslint`, `ruff`, `mypy`, `pyright`, `flake8`, `cargo test|check|clippy`, `go test`, `verify-stack.sh`, `run-verify-map.mjs`, `audit-threejs.mjs`, `audit-geo-seo.mjs`, `validate-tokens.mjs`). On match: clear `editedSourceFiles = []`, set `needsVerification = False`, `stopContinuationCount = 0`, record `lastVerifiedAt` and `lastVerificationCommand`.
  3. **Single-File Syntax & Lint Bridge (on successful write/edit, unless `CF_POST_TOOL_LINT=off`):**
     - Resolve `target_file` inside `project_dir` (verify regular file and canonical path containment; skip symlink escapes).
     - Run strictly single-file check (`shell=False`, `timeout <= 1.8s`):
       - `.py`: in-process `compile(source, str(target_file), "exec")` (zero `.pyc` disk clutter) + if syntax passes and `shutil.which("ruff")` exists, `["ruff", "check", "--no-fix", "--quiet", str(target_file)]`.
       - `.ts`/`.tsx`/`.js`/`.jsx`/`.mjs`/`.cjs`: walk up from `target_file.parent` to `project_dir` looking for local `node_modules/.bin/eslint`; if found, run `[eslint_bin, "--no-warn-ignored", "--max-warnings=0", "--format", "stylish", str(target_file)]` (`cwd=pkg_root`); else for `.js`/`.mjs`/`.cjs` run `["node", "--check", str(target_file)]` if `node` exists.
       - `.json`: in-process `json.loads(source)`.
       - `.sh`: `["bash", "-n", str(target_file)]` if `bash` exists.
     - If check fails: sanitize output (`sanitize_text(..., max_chars=600)`), upsert diagnostic into `pendingFeedback` (max 8 entries).
     - If check passes: remove any stale `pendingFeedback` entry for `filePath` so resolved diagnostics never replay.
     - On `TimeoutExpired`: skip quietly (never block or fail).

#### Hook 4: `hooks/pre-invocation.py` (`PreInvocation`)
- **Latency Budget:** `< 30 ms` (`timeout: 5` in `hooks.json`).
- **Fail-Open Semantics:** Malformed stdin or unreadable state -> prints `{}` and exits `0`.
- **Execution Steps (Priority Order inside Atomic `update_state`):**
  1. **Runaway Loop-Breaker (`CF_LOOP_BREAKER_MAX`, default `5`, `"0"`/`"off"` disables):**
     - If `max_failures > 0` and `state["consecutiveFailures"] >= max_failures`:
       - Capture `sig = state["lastFailureSignature"]` and `count = state["consecutiveFailures"]`.
       - Reset `consecutiveFailures = 0`, `lastFailureSignature = ""`, `pendingFeedback = []` so the user can modify guidance and resume cleanly without instant re-termination.
       - Emit exact `docs/hooks.md` termination contract:
         ```json
         {
           "injectSteps": [
             {
               "errorMessage": {
                 "userMessage": "Enterprise Code Factory Loop-Breaker: terminated execution after 5 consecutive identical tool failures (run_command:9f86d081884c7d65). Inspect the error and adjust guidance before resuming."
               }
             }
           ],
           "terminationBehavior": "terminate"
         }
         ```
  2. **Drain & Inject Pending `PostToolUse` Feedback:**
     - If `state["pendingFeedback"]` is non-empty: drain `pendingFeedback = []`, format compact single-file errors capped at `<= 3072` bytes (`3 KB`), and append `{"systemMessage": {"systemMessage": "[Code Factory PostToolUse Feedback]\n..."}}`.
  3. **Once-Per-Threshold Context-Hygiene Warning (`CF_CONTEXT_WARN_TURN`, default `15`, `"0"`/`"off"` disables):**
     - Read `invocation_num = payload.get("invocationNum")` (`int`, default `0`).
     - Check thresholds `[warn_turn, warn_turn * 2]` (default `[15, 30]`). If `invocation_num >= threshold` and `threshold not in state["contextWarnedThresholds"]`:
       - Record crossed threshold(s) in `contextWarnedThresholds` (emit at most 1 warning per invocation for the highest newly crossed threshold).
       - Append `{"systemMessage": {"systemMessage": "[Code Factory Context Hygiene — Turn <N>] Conversation reached <N> model invocations. Recommend /compact or cf-handover (<= 3 KB .memory/handover.md) before context saturation degrades quality."}}`.
  4. Output `{"injectSteps": steps}` if `steps` is non-empty, else `{}`.

#### Hook 5: `hooks/stop-gate.py` (`Stop`)
- **Latency Budget:** `< 30 ms` (`timeout: 5` in `hooks.json`).
- **Stdout Contract (`docs/hooks.md`):**
  - Allow stop: `{"decision": "allow"}` (satisfies `decision` required string with non-`"continue"` value).
  - Block stop once: `{"decision": "continue", "reason": "..."}`.
- **Loop-Safety Guards (ALL 4 MUST hold before inspecting state):**
  1. `os.environ.get("CF_STOP_GATE_MODE", "").strip().lower() != "off"`
  2. `payload.get("terminationReason") == "NO_TOOL_CALL"` (exits `allow` on `USER_CANCELED`, `ERROR`, `MAX_INVOCATIONS`, `MAX_FORCED_INVOCATIONS`, `MAX_TOKEN_BUDGET_EXCEEDED`, `TERMINAL_CUSTOM_HOOK`, `TERMINAL_STEP_TYPE`, `INJECTED_RESPONSE`)
  3. `bool(payload.get("continuationActive", False)) is False` (if `True`, Antigravity indicates a `Stop` hook already continued this turn)
  4. `bool(payload.get("fullyIdle", True)) is True` (Wait: if `fullyIdle` is `False`, emit `{"decision": "allow"}` cleanly per spec guard)
- **State Evaluation (Inside Atomic `update_state`):**
  - Only when `state["needsVerification"] is True`, `len(state["editedSourceFiles"]) > 0`, and `state.get("stopContinuationCount", 0) < 1`:
    - Set `state["needsVerification"] = False` and increment `state["stopContinuationCount"] += 1` BEFORE returning `"continue"` (guarantees at most **1** forced verification prompt per edit cycle even across user turns if the user accepts skipping tests).
    - Return `{"decision": "continue", "reason": "[Code Factory Stop Gate] Modified source files remain unverified (...). Run relevant typecheck/lint/test commands before stopping, or state why verification was skipped."}`.
  - Otherwise return `{"decision": "allow"}`.

---

### 3.3 Declarative Registry (`hooks.json`)

Follows exact `agy-customizations/docs/hooks.md` schemas: **flat arrays** for `SessionStart`, `PreInvocation`, `Stop`; **grouped `{matcher, hooks}` arrays** for `PreToolUse`, `PostToolUse`.

```json
{
  "code-factory-session-start": {
    "SessionStart": [
      {
        "type": "command",
        "command": "python3 ./hooks/session-start.py",
        "timeout": 5
      }
    ]
  },
  "code-factory-hitl-gate": {
    "PreToolUse": [
      {
        "matcher": "run_command",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ./hooks/hitl-gate.py",
            "timeout": 5
          }
        ]
      }
    ]
  },
  "code-factory-secret-guard": {
    "PreToolUse": [
      {
        "matcher": "write_file|edit_file|write_to_file|replace_file_content|multi_replace_file_content",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ./hooks/secret-guard.py",
            "timeout": 5
          }
        ]
      }
    ]
  },
  "code-factory-post-tool-feedback": {
    "PostToolUse": [
      {
        "matcher": "write_file|edit_file|write_to_file|replace_file_content|multi_replace_file_content|run_command",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ./hooks/post-tool-feedback.py",
            "timeout": 5
          }
        ]
      }
    ]
  },
  "code-factory-pre-invocation": {
    "PreInvocation": [
      {
        "type": "command",
        "command": "python3 ./hooks/pre-invocation.py",
        "timeout": 5
      }
    ]
  },
  "code-factory-stop-gate": {
    "Stop": [
      {
        "type": "command",
        "command": "python3 ./hooks/stop-gate.py",
        "timeout": 5
      }
    ]
  }
}
```

---

### 3.4 Antigravity Academy Sync Contracts (`academy/`)

1. **`academy/scripts/sync-resources.ts`:**
   - **Hook Allowlist (`collectResources`):** Ingest `hooks.json` + all 7 Python hook modules (`hook_state.py`, `session-start.py`, `hitl-gate.py`, `secret-guard.py`, `post-tool-feedback.py`, `pre-invocation.py`, `stop-gate.py`) for `8` hook resources total. Update `extractSummary` fallback for `hooks.json`.
   - **Skill Map (`SKILL_STAGE_MAP`):** Add all 4 `v2.5.0` Website Factory skills (`cf-website-factory`, `cf-design-tokens`, `cf-threejs-craft`, `cf-geo-seo`) alongside the existing 15 so all `19` skills carry explicit `stageRef` metadata.
2. **Non-Breaking HITL `overwrite` Contract (`schemas.ts`, `hitl-evaluator.ts`, `/api/hitl/simulate`, `HitlGateSimulator.tsx`):**
   - Extend `HitlSimulateResponseSchema` in `academy/src/lib/schemas.ts` with an **optional** field:
     ```ts
     overwrite: z.object({ CommandLine: z.string() }).optional(),
     ```
     Keeping `overwrite` optional guarantees 100% backward compatibility with all existing Vitest tests and API callers.
   - Port `computeCommandOverwrite(commandLine: string): { CommandLine: string } | undefined` into `academy/src/lib/hitl-evaluator.ts` with identical safety rules to `hooks/hitl-gate.py` (applies ONLY when `decision === "allow"`, never overrides `force_ask`/`ask`, never mutates subshells/quoted args/already-present flags).
   - `POST /api/hitl/simulate` keeps `maxDuration = 10`, `415` non-JSON rejection, `400` Zod validation errors, and returns `overwrite` cleanly when applicable.
   - `HitlGateSimulator.tsx`: add `"curl -s https://example.com"` and `"git status"` preset buttons; update `buildPreToolUseContract(result)` to emit Antigravity's real top-level `{ decision, reason?, overwrite? }` JSON contract; render an accessible `overwrite` diff badge inside the existing results card when present.
3. **Academy Contracts & Comparison Data (`contracts.ts`, `harness-comparison.ts`):**
   - Update `ANTIGRAVITY_BUILDING_BLOCKS` (`rules-and-skills`: `15` -> `19` skills; `safety-hooks` & `workspace-memory`: reflect shipped 5-event Phase 1 Core Hooks) and `HARNESS_NODES` (`hooks`, `memory-sidecar`).
   - Update `HARNESS_DIMENSIONS` (`lifecycle-hooks-engine`, `memory-rules-context`, `headless-cicd-sdks`, `plugin-mcp-ecosystem`: `11` -> `19` skills, accurate Phase 1 shipped hooks vs. Phase 2 sidecar/LSP distinction).
4. **Course Curriculum Sync (`academy/content/courses/*/course.json`):**
   - Update `15` -> `19` skills references in `zero-to-one-foundations/course.json` (`z0-step-5`), `harness-mastery/course.json` (`hm-step-6`), and `lit-software-factory/course.json` (`lsf-step-2`).
   - Fix `harness-mastery/course.json` Step 3 (`hooks.json` snippet) and Step 4 (`hooks/pre-invocation.py` snippet + `hm-prompt-feedback-bridge`) so code examples strictly conform to Antigravity's real `docs/hooks.md` format (top-level hook keys, nested `{"systemMessage": {"systemMessage": "..."}}`, real filenames `hooks/post-tool-feedback.py` and `hooks/pre-invocation.py`).
   - Add Step 10 (`cf-stage-10-core-hooks`) + Prompt Card (`cf-prompt-v3-core-hooks`) to `code-factory-sdlc/course.json` covering the `v3.0.0` Phase 1 5-event Core Hooks lifecycle, obeying all 7-point ELI5 microlearning rubric constraints (`plainTitle`, `oneLineHook`, `everydayAnalogy <= 160`, all 4 numbered parts, `whenToUse`, `realWorldExample`, `audioScript` 75–180 words with zero markdown/backticks/URLs, plain-English quoted-label `mermaidDiagram` with zero HTML tags, valid `repoArtifactPath` `"hooks.json"`, and valid `promptId`).

---

## 4. UI/UX, Accessibility & Feature Map Contracts

- **Stateless Architecture Preserved:** `academy/` remains 100% stateless (`localStorage` + `LearnerProgressSchema` Zod validation). Zero auth routes, cookies, or database writes added.
- **Design System & WCAG 2.1 AA:**
  - `HitlGateSimulator.tsx` uses strictly `@theme` tokens (`bg-void-950/90`, `border-emerald-glow/40`, `text-emerald-glow`, `text-cyan-glow`, `text-ink-primary`) — zero literal hex colors or arbitrary spacing.
  - Maintain contrast `>= 4.5:1`, `:focus-visible` outlines, `<label htmlFor="hitl-cmd">`, `aria-invalid`, `aria-describedby`, `role="alert"`, and `aria-live="polite"`.
  - Keep `overwrite` callout strictly inside the existing conditional `{result && (...)}` region with no layout shifts on initial load (`CLS = 0`).
- **Feature Map Contract (`.memory/feature-map.md`):**
  - Preserve all 13 target selectors (`#main-content`, `#hero-lab`, `#hero-heading`, `#courses`, `#courses-heading`, `#prompt-vault`, `#prompt-vault-search`, `#sdlc-loop`, `#comparison-lab`, `#repo-hitl`, `#repo-explorer`, `#hitl-simulator`, `#hitl-cmd`) and all 3 verification targets (`/`, `/api/courses`, `/api/resources`).
  - Update `.memory/feature-map.md` line 55 in the same milestone to document optional `overwrite?` on `POST /api/hitl/simulate`.
- **Project Invariants (`.agents/rules/academy-invariants.md`):**
  - Zero `opacity-55` dimming on readable labels; zero `whileInView` fractional thresholds on tall sections; zero UI-to-Node/server imports violating `academy/.dependency-cruiser.cjs`.

---

## 5. Security, Performance, Selective Autonomy & Verification Oracles

### Security & Performance Guardrails
- **Zero External Dependencies:** All `hooks/*.py` scripts use Python 3 stdlib only (`0` third-party PyPI/npm packages added to root or `academy/`).
- **No Shell String Concatenation:** All subprocess invocations (`git status` in `session-start.py`, single-file `ruff`/`eslint`/`node`/`bash` in `post-tool-feedback.py`) strictly use `subprocess.run(argv_list, shell=False, timeout=...)`.
- **Fail-Closed vs. Fail-Open Separation:** Security gates (`hitl-gate.py`, `secret-guard.py`) fail closed (`ask`/`deny`, never `{}`). Context/DX hooks (`session-start.py`, `post-tool-feedback.py`, `pre-invocation.py`, `stop-gate.py`) sanitize secrets before persisting, isolate per-conversation state under `0700`/`0600` directories/files with strict `conversationId` sanitization, and avoid bricking the agent loop on malformed stdin or timeouts.
- **Latency & Context Budget:**
  - `PreToolUse` (`hitl-gate.py`, `secret-guard.py`): `< 50 ms` (`< 20 ms` in-process).
  - `PostToolUse` (`post-tool-feedback.py`): strict `< 2.0 s` cap (`1.8 s` subprocess timeout).
  - `PreInvocation` & `Stop`: `< 30 ms`.
  - `rules/AGENTS.md`: strictly `<= 10,240` bytes (`<= 10 KB`).

### Selective Autonomy Classification

| Workstream | Tier | Rationale |
| :--- | :--- | :--- |
| **Task 0** (`hook_state.py`, `hooks.json`, `schemas.ts`, `plugin.json`) | **Human-Lit** | Core state isolation, filesystem permissions, hook registry, API schema boundaries |
| **Partition 1** (`hooks/*.py` implementation) | **Human-Lit** | Command interception (`overwrite`), secret redaction, loop termination, `Stop` gate |
| **Partition 2** (`sync-resources.ts`, `hitl-evaluator.ts`, `HitlGateSimulator.tsx`) | **Human-Lit** | Allowlist repo reader security boundary & HITL parity |
| **Partition 3** (`course.json` sync, `README.md`, `AGENTS.md` size check) | **Lights-Out** | Governed by deterministic `CourseSchema.parse`, `mermaid.parse()`, and `wc -c` oracles |
| **Partition 4** (`hooks/test_*.py`, `academy/tests/*.ts*`, `.memory/feature-map.md`) | **Lights-Out** | Deterministic unit/integration suites + Playwright 3-viewport `verify:map` oracle |

### Deterministic Verification Oracles & Acceptance Thresholds
1. **Python Hook Suite:** `python3 -m unittest discover -s hooks -p "test_*.py" -v` -> **100% pass** (existing 12 tests updated cleanly for `overwrite` + new `test_v3_hooks.py` covering `hook_state`, `session-start`, `post-tool-feedback`, `pre-invocation`, `stop-gate`, concurrency/atomic writes, `0600` perms, path traversal, secret redaction, `<50ms`/`<2s` latency bounds, and anti-infinite-loop invariants).
2. **Rules Size Budget:** `wc -c rules/AGENTS.md` -> strictly **`<= 10240` bytes**.
3. **Node Plugin Regression Suite:** `node --test skills/cf-verify-map/scripts/test_run_verify_map.mjs skills/cf-design-tokens/scripts/tokens.test.mjs skills/cf-threejs-craft/scripts/threejs.test.mjs skills/cf-geo-seo/scripts/geo-seo.test.mjs` -> **100% pass (`31/31`)**.
4. **Manifest Sync:** `cd academy && pnpm run sync:resources` -> `pluginVersion: "3.0.0"`, `counts.skills: 19`, `counts.hooks: 8`, `counts.agents: 5`, `counts.courses: 8`.
5. **Full-Stack Academy Gate:** `bash skills/cf-next-verify/scripts/verify-stack.sh academy --coverage` -> **0 failures** (`tsc`, `eslint`, `vitest --coverage`, static scan, `depcruise` `0` violations, `next build`).
6. **Dependency Audit:** `cd academy && pnpm audit --audit-level=high` -> **0 High/Critical CVEs**.
7. **Live Multi-Viewport Gate:** `cd academy && pnpm run verify:map` (against `next start` at `http://localhost:3000`) -> **9/9 pass** across `375px`, `768px`, `1440px` (`0` console/page/network errors, `0px` horizontal overflow).
8. **Independent Dual-Axis Audit:** Clean-context `cf-reviewer` (`cf-eval`) + `browser` QA -> explicit **`SHIP`** verdict recorded in `.memory/qa-report.md`.

### Concrete Rollback Plan
- **Plugin & Academy Git Rollback:** Revert milestone commit cleanly via `git revert <commit-sha>` (or pre-commit: restore modified files via `git checkout -- hooks.json hooks/hitl-gate.py plugin.json README.md rules/AGENTS.md academy/ .memory/feature-map.md` and delete untracked `hooks/{hook_state,session-start,post-tool-feedback,pre-invocation,stop-gate,test_v3_hooks}.py`), returning immediately to `e562472`.
- **Zero-Code Runtime Kill Switches:** Set `"enabled": false` on any named hook entry in `hooks.json`, or export `CF_HITL_OVERWRITE=off`, `CF_POST_TOOL_LINT=off`, `CF_LOOP_BREAKER_MAX=0`, or `CF_STOP_GATE_MODE=off`.
- **Production Vercel Rollback (if promoted later in Stage 5):** `cd academy && vercel rollback https://antigravity-academy-1s60sh98i-nexite-os.vercel.app --yes --scope nexite-os`.

---

## 6. Atomic Task Breakdown for `/teamwork` (Task 0 + Non-Overlapping Parallel File Partitions)

### Execution Ordering
1. **Task 0 (Coordinator Prerequisite — Execute Sequentially First)**
2. **Parallel Swarm Wave (Partitions 1, 2, and 3 Execute Concurrently — Zero File Overlap)**
3. **Coordinator Post-Swarm Synthesis (`cd academy && pnpm run sync:resources` Once)**
4. **Verification Wave (Partition 4 `cf-tester` -> Stage 4 `cf-reviewer` `cf-eval` + `browser`)**

### File Ownership Matrix

| Phase / Worker | Exclusive Owned Files (Allowed to Edit/Create) | Explicitly Forbidden Files |
| :--- | :--- | :--- |
| **Task 0 (`Coordinator`)** | `hooks/hook_state.py`, `hooks.json`, `plugin.json`, `academy/src/lib/schemas.ts` | Do not implement hook runners or edit courses/tests yet |
| **Partition 1 (`cf-backend` — Core Hooks)** | `hooks/hitl-gate.py`, `hooks/session-start.py`, `hooks/post-tool-feedback.py`, `hooks/pre-invocation.py`, `hooks/stop-gate.py`, `hooks/test_hitl_gate.py`, `hooks/test_v3_hooks.py` | `hooks/hook_state.py`, `hooks/secret-guard.py`, `hooks/test_secret_guard.py`, `hooks.json`, `plugin.json`, `academy/**`, `README.md`, `rules/**` |
| **Partition 2 (`cf-backend`/`cf-frontend` — Academy Engine)** | `academy/scripts/sync-resources.ts`, `academy/src/lib/contracts.ts`, `academy/src/lib/hitl-evaluator.ts`, `academy/src/data/harness-comparison.ts`, `academy/src/components/HitlGateSimulator.tsx` | `hooks/**`, `hooks.json`, `plugin.json`, `academy/src/lib/schemas.ts`, `academy/content/**`, `academy/tests/**`, `academy/src/data/generated-repo-manifest.json` |
| **Partition 3 (Curriculum & Docs)** | `README.md`, `rules/AGENTS.md`, `academy/content/courses/zero-to-one-foundations/course.json`, `academy/content/courses/harness-mastery/course.json`, `academy/content/courses/code-factory-sdlc/course.json`, `academy/content/courses/lit-software-factory/course.json` | `hooks/**`, `hooks.json`, `plugin.json`, `academy/src/**`, `academy/scripts/**`, `academy/tests/**` |
| **Coordinator Synthesis (Post-Wave)** | Runs `cd academy && pnpm run sync:resources` ONCE after Partitions 1–3 finish | — |
| **Partition 4 (`cf-tester` — Post-Synthesis)** | `academy/tests/hitl-evaluator.test.ts`, `academy/tests/api-routes.test.ts`, `academy/tests/components.test.tsx`, `.memory/feature-map.md` | All source/hook/course files (report defects instead of silently editing source) |
| **Stage 4 QA (`cf-reviewer` + `browser`)** | `.memory/qa-report.md` (read-only audit of all diffs + live `375/768/1440px` browser verification) | All code/test/content files |

---

## 7. Senior Engineer Sign-Off Gate Checklist

- [x] Phase 1 Core Hooks scope confirmed (`SessionStart`, `PreToolUse` `overwrite`, `PostToolUse` -> `PreInvocation` `<2s` single-file lint & loop-breaker, `Stop` bounded verification gate) with zero Phase 2/3 scope creep.
- [x] Every hook payload and `hooks.json` structure verified against `agy-customizations/docs/hooks.md`.
- [x] Zero new external dependencies (pure Python 3 stdlib core; stateless `localStorage` Academy).
- [x] Task 0 + Partitions 1–4 verified 100% disjoint with zero concurrent file overlap.
- [x] Approved to launch Stage 3 (`/teamwork`) against this locked specification.
