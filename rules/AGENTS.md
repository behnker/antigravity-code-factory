# Antigravity Enterprise Code Factory Protocol

You operate under the **Antigravity Enterprise Code Factory** protocol: **Spec-Driven Development (SDD)**, **Invariant-Driven Quality Gates**, file-based workspace memory, and bounded autonomy.

## 1. Core Operating Principles

1. **Separation of Concerns:** Keep design/specification work decoupled from implementation work. Prefer delegating implementation to clean subagent/worker contexts against a locked spec.
2. **File-Based Memory as Ground Truth:** Active session state, milestone tasks, architecture, and ADRs live in `.memory/`.
3. **Strict Invariant Guardrails:** All code must comply with the invariants below plus any project-local rules in `.agents/rules/`.
4. **Sandboxed & Gated Autonomy:** Execute read-only inspection, local linters, typecheckers, and unit tests autonomously. Require explicit human approval before destructive commands (`rm -rf`, force pushes), dependency additions/updates, database schema migrations, package publishing, or production deployments.

## 2. Workspace Memory & Session Protocol

- **When `.memory/` exists in the workspace:**
  1. Before starting work, read `.memory/handover.md` and `.memory/tasks.md`.
  2. Before architectural changes, read `.memory/architecture.md` and review `.memory/decisions/`.
  3. On session wrap-up (or via `cf-handover`), update `.memory/tasks.md` and overwrite `.memory/handover.md` (keep it ≤ 3 KB).
- **When `.memory/` does not exist yet:** Do not block on missing files; operate normally under the invariants below and offer to initialize the workspace with `cf-bootstrap` when starting substantial project work.
- **Communication:** Before executing multi-file or substantive code edits, state your planned approach in 3 concise bullet points.
- **Context Hygiene:** For long or complex workflows, proactively recommend `/compact` or `cf-handover` when context grows large (~65% saturation or ~15–20 turns) to preserve reasoning quality.

## 3. Security Invariants

1. **Zero Hardcoded Secrets:** Never commit credentials, API keys, private certificates, or tokens. Use environment variables via official configuration modules.
2. **Input Validation & Boundaries:** Validate all external boundary inputs (REST params, GraphQL args, RPC payloads, webhooks) at runtime using schema validation (e.g., Zod, Pydantic, Valibot).
3. **Data Access Safety:**
   - Use parameterized queries or ORM abstractions for all database access to prevent SQL injection.
   - Direct string concatenation in raw SQL or shell command execution is strictly forbidden.
4. **Dependency Security:** Before adding any third-party dependency, verify license compatibility (MIT / Apache-2.0 / BSD preferred) and confirm no known High/Critical CVEs.
5. **Auth & Privilege:** Default to least privilege across all endpoints. Explicitly apply authentication middleware and authorization policies to every new route.

## 4. Scalability & Performance Invariants

1. **Stateless Execution:** Keep application services stateless. Never store persistent session state in local process memory; use distributed caches (e.g., Redis) or database stores.
2. **Database Access Patterns:**
   - All list/collection endpoints must mandate pagination with explicit defaults and upper bounds (e.g., default `limit=20`, max `limit=100`).
   - Avoid N+1 query patterns; use eager loading or batching (e.g., DataLoader).
   - Include indexing considerations for foreign keys and filter columns on new queries/schemas.
3. **Compute & Network Bounds:**
   - Enforce explicit timeouts on external HTTP calls (default ≤ 5000ms) and retry policies with exponential backoff and jitter.
   - Offload heavy batch processing and asynchronous jobs to background queue workers, never request-handling threads.

## 5. UI/UX & Design Token Standards

1. **Design System Adherence:** Never hardcode arbitrary hex colors, inline font sizes, or magic pixel spacing. Use established design system tokens or utility theme classes (e.g., Tailwind theme classes).
2. **Accessibility (WCAG 2.1 AA):**
   - Ensure all interactive elements are keyboard accessible with explicit `:focus-visible` styles.
   - Maintain minimum text contrast ratios (4.5:1 for normal text, 3:1 for large text).
   - Associate form controls with explicit `<label>` elements and ARIA error attributes (`aria-invalid`, `aria-describedby`).
3. **Loading, Error, Empty & Layout Stability:**
   - Data-fetching UI components must explicitly handle **Loading** (skeletons/spinners), **Error** (alerts + retry), and **Empty** states.
   - Prevent Cumulative Layout Shift (CLS) by pre-allocating dimensions for images, dynamic widgets, and lists.

## 6. Testing & Quality Assurance Invariants

1. **Unit Test Coverage:** Every new business logic module, utility function, or state transformer must include dedicated unit tests.
2. **Mocking Boundaries:** Mock only external infrastructure or network dependencies (third-party APIs, email/queue providers). Test core domain logic and internal helpers with real inputs.
3. **Deterministic Assertions:** Flaky tests are prohibited. Inject deterministic clocks or RNG seeds whenever logic depends on time or randomness.
4. **Edge-Case Coverage:** Cover the happy path, invalid inputs (schema validation failures), null/empty responses, and network/downstream error scenarios.

## 7. Edge & Serverless Platform Invariants (Cloudflare, Vercel, Supabase)

When building on edge or serverless runtimes, enforce these platform guardrails:

1. **Cloudflare Workers:** Never rely on in-memory state across requests (use D1, KV, R2, or Durable Objects). Validate all incoming requests and webhook signatures; keep bindings typed and configured via `wrangler.jsonc`/`wrangler.toml`.
2. **Vercel Functions & Edge Runtime:** Keep Edge handlers strictly Web-API compatible (no Node-only APIs in Edge runtime), enforce explicit `maxDuration`/timeouts on serverless routes, and never expose server-only secrets via `NEXT_PUBLIC_*` or client bundles.
3. **Supabase Edge Functions & Postgres:** Enforce Row Level Security (RLS) on every public/user table—never ship a table without explicit RLS policies. Never expose `service_role` keys to clients or browser code; use Deno/Web-standard APIs and validate JWTs/inputs at every Edge Function boundary.

