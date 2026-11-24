# Senior Engineer Stack Checklist (Next.js + TS + Tailwind + Zod + Vitest)

Use this checklist alongside `scripts/verify-stack.sh` during code review, `/swarm` verification, and `cf-qa-review`.

## 1. Next.js App Router & Vercel
- [ ] **Server vs. Client boundary:** Keep data fetching, secrets, and DB clients in Server Components or Route Handlers; never import server-only modules into `'use client'` files.
- [ ] **Explicit route bounds:** Serverless Route Handlers declare `export const maxDuration = ...` (or platform timeout bounds) and never rely on local in-memory state across requests.
- [ ] **Edge Runtime safety:** Any route with `export const runtime = 'edge'` uses strictly Web-standard APIs (no Node `fs`, `net`, or Node-only crypto).
- [ ] **Zero client env leaks:** Never expose secrets, private keys, or DB URLs via `NEXT_PUBLIC_*`.

## 2. TypeScript & Zod Boundaries
- [ ] **Zero `as any` at trust boundaries:** Validate every external input (Route Handler params/body/query, Server Action args, webhooks, `localStorage` hydration, build-time JSON) with Zod `.safeParse()` / `.parse()`.
- [ ] **Explicit pagination bounds:** Collection/list endpoints enforce defaults and upper caps (e.g., `limit` default `20`, max `100`).
- [ ] **Structured error responses:** Return clean HTTP status codes (`400`, `401`, `403`, `404`, `500`) without leaking stack traces or internal SQL errors.

## 3. Tailwind CSS & WCAG 2.1 AA UI/UX
- [ ] **Design token discipline:** Use Tailwind theme tokens (`@theme` / CSS variables) instead of ad-hoc hex colors or magic pixel values.
- [ ] **Accessibility:** Keyboard navigation works end-to-end with visible `:focus-visible` rings; normal text contrast ≥ 4.5:1 (large text ≥ 3:1); form inputs have `<label>`, `aria-invalid`, and `aria-describedby`.
- [ ] **Complete UI states:** Every async view handles **Loading** (skeleton/spinner), **Error** (actionable retry), and **Empty** states with stable layout dimensions (no CLS).

## 4. Vitest & Testing Library
- [ ] **Deterministic tests:** Inject fake timers (`vi.useFakeTimers()`) or fixed seeds whenever logic depends on time or randomness.
- [ ] **Boundary mocking only:** Mock external HTTP/SDK/browser I/O—test domain logic, Zod schemas, and state reducers with real inputs.
- [ ] **Four-path coverage:** Cover happy path, invalid schema input, null/empty response, and downstream/network failure.

## 5. Supabase & Cloudflare Workers (When Present)
- [ ] **Supabase:** Every public/user table has `ENABLE ROW LEVEL SECURITY` with explicit policies; `service_role` keys exist only in server/Edge Function secrets, never browser code.
- [ ] **Cloudflare Workers:** Bindings typed via `wrangler types`, dry-run verified (`npx wrangler deploy --dry-run`), webhook signatures verified, zero cross-request in-memory state.
