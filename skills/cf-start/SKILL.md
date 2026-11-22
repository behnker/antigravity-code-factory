---
name: cf-start
description: >-
  Initializes workspace memory, verifies git working tree consistency against
  handover notes, and primes the agent for execution. Use at the start of a
  coding session or when resuming work in a Code Factory workspace.
---

# Skill: Start Session

1. Read workspace memory state:
   - `.memory/handover.md`
   - `.memory/tasks.md`
   - If `.memory/` does not exist yet, inform the user and offer to run `cf-bootstrap` first.
2. Verify repository state by running:
   - `git status -s`
   - `git diff --stat`
   - `git rev-parse --abbrev-ref HEAD && git rev-parse --short HEAD`
3. Check whether the current branch, commit, and dirty files match `.memory/handover.md`. Flag any discrepancy immediately before editing files.
4. Output a concise 3-bullet summary:
   - **Current Goal:** Brief description of the active milestone (and active spec path, if any).
   - **Last Status:** Key progress and any dead ends recorded from the previous session.
   - **Immediate Action:** The specific next step to execute now.
