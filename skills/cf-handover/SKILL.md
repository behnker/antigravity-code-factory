---
name: cf-handover
description: >-
  Validates workspace status, runs tests, updates .memory/tasks.md, and writes a
  concise (<= 3 KB) .memory/handover.md record for model-agnostic session
  switching or context compaction. Use when wrapping up a session or handing off work.
---

# Skill: Session Handover

1. Execute the project's test suite (e.g., `npm test`, `pytest`, `cargo test`, or project equivalent) and capture pass/fail results.
2. Inspect repository state:
   - `git status -s`
   - `git rev-parse --abbrev-ref HEAD && git rev-parse --short HEAD`
3. Update `.memory/tasks.md`:
   - Mark completed tasks as `[x]`.
   - Record newly identified subtasks under `In Progress` or `Up Next`.
4. Overwrite `.memory/handover.md` using the exact 5-section layout below. **Keep the file strictly ≤ 3 KB** so cold-start sessions load cleanly:

```markdown
# Session Handover Record

**Timestamp:** YYYY-MM-DD HH:MM UTC  
**Active Model:** [Human-Readable Model Name]  
**Git Branch & Commit:** `<branch>` (`<short-sha>`)  

## 1. Executive Summary
One to two sentences describing what was accomplished and current test status.

## 2. Completed Items
- Concrete completed deliverables and test results.

## 3. Failed Approaches & Dead Ends
- Approaches tried and rejected (so the next session does not repeat them).

## 4. Key Modified Files
- `path/to/file` (brief purpose)

## 5. Next Step Action Plan
1. Exact first action for the next cold-start agent.
2. Subsequent verification or milestone step.
```

5. Verify `.memory/handover.md` is ≤ 3,072 bytes (`wc -c .memory/handover.md`) and present a brief confirmation to the user.
