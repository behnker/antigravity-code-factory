---
name: cf-geo-seo
description: >-
  Tri-Layer Search Discovery skill covering SEO, Answer Engine Optimization
  (AEO), and Generative Engine Optimization (GEO) for Google Gemini, ChatGPT,
  Perplexity, and Claude. Enforces SSR crawlable HTML outside WebGL canvases,
  connected JSON-LD @graph schemas, AI crawler robots.txt permissions, and
  automated pre-launch HTML/schema auditing.
---

# Skill: Tri-Layer SEO, AEO & GEO Optimization (`cf-geo-seo`)

Ensure every website is crawlable, extractable, and citable across traditional search engines and generative AI answer engines (Google Gemini, ChatGPT Search, Perplexity, Claude).

## Reference Playbook
- Complete 7 AI Search Ranking Factors, Tri-Layer Matrix & JSON-LD `@graph` Templates: [references/geo-aeo-seo-playbook.md](./references/geo-aeo-seo-playbook.md)

## Non-Negotiable Discovery Invariants
1. **SSR HTML Imperative (Zero WebGL/CSR Black Box):** AI crawlers (569M GPTBot fetches) execute **0% JavaScript**. Every H1, opening summary, feature table, FAQ answer, and JSON-LD block must exist in raw server-rendered HTML.
2. **Permissive AI `robots.txt`:** Explicitly allow `GPTBot`, `ClaudeBot`, `PerplexityBot`, and `Google-Extended` (blocking `Google-Extended` silently removes your domain from Gemini Apps & Vertex AI grounding).
3. **Connected JSON-LD `@graph`:** Link `Organization` ↔ `Product`/`VideoGame`/`Service` ↔ `WebPage` ↔ `FAQPage` ↔ `HowTo` ↔ `BreadcrumbList` via consistent `@id` IRIs so AI engines resolve entities unambiguously.
4. **Conclusion-First + Verifiable Evidence:** Lead core pages with a direct **50–150 word** declarative answer in the opening 200 words, pair H2/H3 questions with **40–60 word** self-contained answers, and ground claims in concrete numbers/citations (never keyword stuffing).
5. **Metadata Bounds:** `<title>` `<= 60` characters, `<meta name="description">` `140–155` characters (hard bounds `110–165`), explicit `<link rel="canonical">`, and `html[lang]`.

## Executable Audit Gate
Run against built static HTML, saved SSR responses, or a directory of HTML captures:
```bash
node "<path-to-this-skill>/scripts/audit-geo-seo.mjs" \
  --html .next/server/app \
  --robots public/robots.txt
```
- **Exit `0` (`PASS`):** All SSR crawlability, JSON-LD `@graph`, metadata, and AI `robots.txt` invariants passed.
- **Exit `1` (`FAIL`):** Blocking SEO/AEO/GEO error detected.
- **Exit `2` (`CONFIG_ERROR`):** Invalid flags or missing paths.
