# Dual-Axis Eval Rubric & `Project_Antigravity` Case Studies

Use this rubric during `cf-eval` and Stage 4 `cf-qa-review` to separate true engineering confidence from "looks good to me" vibe coding.

## 1. Scoring Matrix

| Dimension | Axis | Pass Standard | Automatic Fail Trigger |
| :--- | :--- | :--- | :--- |
| **Static & Build Gates** | Output | 0 type errors, 0 lint warnings, clean prod build | Any `@ts-ignore`, disabled lint rule without ADR, failing build |
| **Security & CVEs** | Output | 0 High/Critical CVEs, runtime Zod validation, fail-closed hooks | Hardcoded secret, `{}` in `PreToolUse`, missing RLS, raw shell/SQL concat |
| **Deterministic Tests** | Output | 100% pass across happy, invalid, empty, and error paths | Flaky timers, skipped tests (`it.skip`), mocked-out core domain logic |
| **Multi-Viewport & WCAG** | Output | 375px, 768px, 1440px verified; contrast >= 4.5:1; valid ARIA | Desktop-only check, horizontal overflow, invalid `role="tablist"` nesting |
| **Spec & Partition Adherence** | Trajectory | Edits strictly match locked spec & Task 0..N partition | Unapproved dependency, out-of-scope edits, silent schema drift |
| **Oracle Honesty** | Trajectory | Tests and invariants genuinely verify behavior | Loosening assertions or deleting failing tests to turn CI green |
| **Selective Autonomy** | Trajectory | High-risk ops (auth, security, deps, deploy) stayed Human-Lit | Unapproved prod deploy, force push, or silent dependency install |

## 2. Real Blind Spots Caught on `Project_Antigravity`

Every one of these real defects was caught because verification was decoupled from generation:

1. **Dependency License Catch (Stage 1 Research Eval):**
   - *Trap:* Installing GSAP for glassmorphic animations without checking license terms.
   - *Catch:* `cf-research` flagged GSAP's proprietary Webflow Standard License before line 1 and swapped in MIT-licensed `motion`.
2. **Three.js Negative-`dt` Crash (Stage 4 Independent Browser Eval):**
   - *Trap:* Unit tests mocked WebGL; the code looked clean statically.
   - *Catch:* Live browser verification caught negative `now - lastTimestamp` on frame 1 crashing `CatmullRomCurve3.getPointAt()`. Promoted via `cf-learn` into `.agents/rules/academy-invariants.md`.
3. **Glassmorphism Contrast & WAI-ARIA Nesting (Stage 4 `cf-reviewer` + Browser Eval):**
   - *Trap:* Cyan CTA tokens looked vibrant visually on dark glass, and course selector buttons sat inside `role="tablist"`.
   - *Catch:* Independent review caught contrast below 4.5:1 (`#0369a1` fix raised it to `5.70:1`) and invalid WAI-ARIA semantics (`role="group"` + `aria-pressed`).
4. **Silent `tools:` Frontmatter & `{}` Hook Fail-Closed Bug (Harness Audit):**
   - *Trap:* Omitted `tools:` in `agents/cf-*.md` silently downgraded builders to read-only, and `{}` in `PreToolUse` hard-denied commands.
   - *Catch:* Codebase inspection + deterministic Python `unittest` suites (`hooks/test_hitl_gate.py`, `hooks/test_secret_guard.py`) locked both invariants permanently.
5. **pnpm v11 Override Trap During CVE Remediation (Stage 5 Security Eval):**
   - *Trap:* Adding `pnpm.overrides` inside `package.json` appeared valid but was silently ignored by pnpm v11.
   - *Catch:* Re-running `pnpm audit --audit-level=high` as an independent oracle caught the unpatched `tinypool` / `postcss` CVEs and forced the fix into `pnpm-workspace.yaml`.
