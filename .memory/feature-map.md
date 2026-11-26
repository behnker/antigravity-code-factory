# Feature Map — Antigravity Academy (`academy/`)

> **Agent Directive:** Read this before running `cf-verify-map`, `cf-qa-review`, or debugging Academy UI/API flows. Update this file in the same commit whenever routes, API endpoints, or key DOM selectors change.
>
> **Security Rule:** Zero plaintext secrets or tokens here. Academy v1 is stateless (`localStorage` progress) with no authentication credentials required.

## App Runtime
- **Frontend URL:** `http://localhost:3000` (Start: `cd academy && pnpm run dev`)
- **Backend URL:** Same-origin Next.js App Router API routes (`http://localhost:3000/api/*`)
- **Health Check:** `GET /api/courses?limit=1` -> `200 OK`
- **Test Account Source:** N/A (stateless public learning platform; progress stored client-side in Zod-validated `localStorage`)

---

## Feature Index

### 1. Academy Home & Hero Showcase (`academy-home`)
- **Directory:** `academy/src/app/`, `academy/src/components/AcademyShell.tsx`, `HeroShowcase.tsx`, `AntigravityArchitectureExplorer.tsx`
- **Routes:** `/`
- **Key DOM Selectors:**
  - Main container: `#main-content`
  - Hero showcase: `#hero-lab`, `#hero-heading`
- **Golden Happy Path:**
  1. Navigate to `/`
  2. Assert `#main-content`, `#hero-lab`, and `#hero-heading` render with zero console/page errors and zero `5xx` responses
  3. Assert zero horizontal overflow at `375px`, `768px`, and `1440px`

### 2. Multi-Course Curriculum Studio (`course-curriculum`)
- **Directory:** `academy/src/components/CourseCurriculumStudio.tsx`, `CourseEmblem.tsx`, `Eli5MicrolearningCard.tsx`, `MermaidDiagram.tsx`
- **Routes:** `/#courses`
- **API Endpoints:**
  - `GET /api/courses?limit=20&offset=0` -> `200 { items[8], total: 8, limit, offset }`
- **Key DOM Selectors:**
  - Courses section: `#courses`, `#courses-heading`
- **Golden Happy Path:**
  1. Scroll to `#courses`
  2. Switch between Courses `00–07` and verify active banner, ELI5 cards, and Mermaid SVGs render without `parsererror` or console errors

### 3. Parameterized Prompt Vault (`prompt-vault`)
- **Directory:** `academy/src/components/PromptVault.tsx`
- **Routes:** `/#prompt-vault`
- **Key DOM Selectors:**
  - Vault section: `#prompt-vault`, `#prompt-vault-heading`
  - Search input: `#prompt-vault-search`
  - Difficulty selector: `#prompt-difficulty-select`
- **Golden Happy Path:**
  1. Type a query in `#prompt-vault-search`
  2. Assert prompt cards filter deterministically and zero console errors occur

### 4. SDLC Loop, Comparison Lab, Repo Explorer & HITL Simulator (`academy-labs`)
- **Directory:** `academy/src/components/SdlcReferenceShowcase.tsx`, `HarnessComparisonLab.tsx`, `RepoResourceExplorer.tsx`, `HitlGateSimulator.tsx`
- **Routes:** `/#repo-hitl`
- **API Endpoints:**
  - `GET /api/resources?limit=20&offset=0` -> `200 { items, total, syncedAt }`
  - `POST /api/hitl/simulate` (Body: `{ commandLine, bypassSandbox }`) -> `200 { decision, matchedRule, reason, overwrite? }` (400 on invalid input, 415 on non-JSON)
- **Key DOM Selectors:**
  - SDLC section: `#sdlc-loop`, `#sdlc-heading`
  - Comparison lab: `#comparison-lab`, `#comparison-heading`
  - Repo & HITL wrapper: `#repo-hitl`, `#repo-explorer`, `#repo-explorer-search`
  - HITL simulator: `#hitl-simulator`, `#hitl-cmd`, `#hitl-bypass`
- **Golden Happy Path:**
  1. Fill `#hitl-cmd` with `git push origin main` and submit
  2. Assert `force_ask` decision badge renders and `POST /api/hitl/simulate` returns `200`

---

## Machine-Readable Verification Contract

```json feature-map
{
  "baseUrl": "http://localhost:3000",
  "healthCheck": "/api/courses?limit=1",
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
      "feature": "academy-home",
      "route": "/",
      "expectedStatus": 200,
      "waitUntil": "domcontentloaded",
      "waitForSelector": "#main-content",
      "selectors": [
        "#main-content",
        "#hero-lab",
        "#hero-heading",
        "#courses",
        "#courses-heading",
        "#prompt-vault",
        "#prompt-vault-search",
        "#sdlc-loop",
        "#comparison-lab",
        "#repo-hitl",
        "#repo-explorer",
        "#hitl-simulator",
        "#hitl-cmd"
      ],
      "checkOverflow": true,
      "timeoutMs": 15000
    },
    {
      "feature": "api-courses",
      "route": "/api/courses?limit=10&offset=0",
      "expectedStatus": 200,
      "waitUntil": "domcontentloaded",
      "selectors": [],
      "checkOverflow": false,
      "timeoutMs": 10000
    },
    {
      "feature": "api-resources",
      "route": "/api/resources?limit=10&offset=0",
      "expectedStatus": 200,
      "waitUntil": "domcontentloaded",
      "selectors": [],
      "checkOverflow": false,
      "timeoutMs": 10000
    }
  ]
}
```
