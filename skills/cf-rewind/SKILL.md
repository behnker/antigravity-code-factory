---
name: cf-rewind
description: >-
  Git-shadow checkpoint recovery for Enterprise Code Factory: lists pre-turn
  and pre-restore safety snapshots, previews diffs, safely restores tracked
  files (--dry-run default, --apply with mandatory safety snapshot and zero
  untracked file deletion), and prunes expired checkpoint logs.
---

# Skill: Git-Shadow Checkpoint Recovery (`cf-rewind`)

Inspect, diff, restore, and prune pre-turn Git-shadow checkpoints captured by `hooks/checkpoint-hook.py` under `$PLUGIN_DATA/checkpoints/`. Unlike raw `git reset --hard`, `cf-rewind` **always defaults to `--dry-run`**, captures a mandatory `pre-restore-safety` snapshot before mutating tracked files, and **never deletes untracked or post-checkpoint files**.

## Prerequisites
- Target workspace is a valid non-symlink Git repository.
- Checkpoints exist in `$PLUGIN_DATA/checkpoints/<safe_cid>.jsonl` (or provide an explicit `--sha <commit>`).

## Commands

Run `<path-to-this-skill>/scripts/rewind.py` (pure Python 3 stdlib, `--json` supported on every subcommand):

1. **List Checkpoints (`list`):**
   ```bash
   python3 "<path-to-this-skill>/scripts/rewind.py" list \
     [--conversation-id <cid>] \
     [--cwd <repo-dir>] \
     [--limit 20] \
     [--json]
   ```
   - Returns newest-first checkpoint records (`limit` clamped `[1, 100]`, default `20`).

2. **Preview Diff (`diff`):**
   ```bash
   python3 "<path-to-this-skill>/scripts/rewind.py" diff \
     [--id <checkpointId> | --sha <sha> | --latest] \
     [--conversation-id <cid>] \
     [--cwd <repo-dir>] \
     [--stat] \
     [--json]
   ```
   - Strictly validates `<sha>` against `^[0-9a-f]{7,40}$` (rejects `-` flag injection) and runs `git --no-pager diff <sha>` with `shell=False`.

3. **Restore Tracked Files (`restore` — `--dry-run` default vs `--apply`):**
   ```bash
   # Preview (non-mutating default)
   python3 "<path-to-this-skill>/scripts/rewind.py" restore \
     [--id <checkpointId> | --sha <sha> | --latest] \
     [--cwd <repo-dir>] \
     [--json]

   # Apply restoration (captures mandatory pre-restore-safety snapshot first)
   python3 "<path-to-this-skill>/scripts/rewind.py" restore \
     --id <checkpointId> \
     --apply \
     [--conversation-id <cid>] \
     [--cwd <repo-dir>] \
     [--json]
   ```
   - **Safety guarantees on `--apply`:**
     1. Rejects non-git directories and symlinked repository roots.
     2. Captures a mandatory `pre-restore-safety` snapshot (`git stash create` or `HEAD`) in `<safe_cid>.jsonl`.
     3. Verifies `<sha>` resolves to a `commit` (`git cat-file -t <sha>`).
     4. Restores tracked files via `git --no-pager checkout <sha> -- .` (never `git reset --hard`).
     5. Reports all untouched untracked and post-checkpoint files and emits `checkpoint_restored` to the telemetry sidecar.

4. **Prune Expired Checkpoints (`prune`):**
   ```bash
   python3 "<path-to-this-skill>/scripts/rewind.py" prune \
     [--max-age-hours 168] \
     [--max-per-conv 200] \
     [--dry-run | --apply] \
     [--json]
   ```
   - Defaults to `--dry-run` (7-day / `168`-hour TTL, `200`-record per-conversation cap). Pass `--apply` to delete expired logs and trim oversized logs.
