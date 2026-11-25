# Feature Map (Living Runtime & Verification Contract)

> **Agent Directive:** Read this before running `cf-verify-map`, `cf-qa-review`, or debugging UI/API flows. Use the exact `data-testid` selectors, routes, and endpoints listed below. Whenever you add or modify a route, endpoint, or `data-testid` selector, update this file in the same commit.
>
> **Security Rule:** Never store plaintext passwords, API keys, or tokens in this file. Reference environment variables (e.g. `$TEST_USER_EMAIL` / `$TEST_USER_PASSWORD` from `.env.test.local`) or ephemeral seed scripts only.

## App Runtime
- **Frontend URL:** `http://localhost:3000` (Start: `pnpm run dev` or `npm run dev`)
- **Backend URL:** `N/A` (or e.g. `http://localhost:8000`, Start: `uvicorn app.main:app --reload`)
- **Health Check:** `GET /api/health` -> `200 OK`
- **Test Account Source:** Seeded via `npm run db:seed`; credentials loaded from `.env.test.local` (`$TEST_USER_EMAIL`, `$TEST_USER_PASSWORD`) — never hardcoded here.

---

## Feature Index

### 1. Home / Core Shell (`home-shell`)
- **Directory:** `src/app/`
- **Routes:** `/`
- **API Endpoints:**
  - `GET /api/health` -> `200 { status: "ok" }`
- **Key DOM Selectors:**
  - Main shell: `[data-testid="app-shell"]` (or `#main-content`)
  - Primary navigation: `[data-testid="primary-nav"]`
- **Golden Happy Path:**
  1. Navigate to `/`
  2. Assert primary navigation and main content render with zero console/page errors and zero `5xx` responses
  3. Assert zero horizontal overflow across `375px`, `768px`, and `1440px`

### 2. [Next Feature Name] (`feature-slug`)
- **Directory:** `src/features/<feature-slug>/`
- **Routes:** `/<route>`
- **API Endpoints:**
  - `GET /api/<resource>?limit=20&offset=0` -> `200 { items, total, limit, offset }`
- **Key DOM Selectors:**
  - Form / trigger: `[data-testid="<feature>-submit-btn"]`
  - Error alert: `[data-testid="<feature>-error-alert"]`
- **Golden Happy Path:**
  1. Navigate to `/<route>`
  2. Execute primary user flow using `data-testid` selectors
  3. Assert expected state transition and zero console/network errors

---

## Machine-Readable Verification Contract

> Parsed directly by `skills/cf-verify-map/scripts/run-verify-map.mjs --map .memory/feature-map.md`. Keep the fenced block identifier exact (`json feature-map`).

```json feature-map
{
  "baseUrl": "http://localhost:3000",
  "healthCheck": "/api/health",
  "viewports": [
    { "name": "mobile", "width": 375, "height": 812 },
    { "name": "tablet", "width": 768, "height": 1024 },
    { "name": "desktop", "width": 1440, "height": 900 }
  ],
  "ignoreUrls": [
    "/favicon.ico"
  ],
  "targets": [
    {
      "feature": "home-shell",
      "route": "/",
      "expectedStatus": 200,
      "waitUntil": "domcontentloaded",
      "waitForSelector": "#main-content",
      "selectors": [
        "#main-content"
      ],
      "checkOverflow": true,
      "timeoutMs": 15000
    }
  ]
}
```
