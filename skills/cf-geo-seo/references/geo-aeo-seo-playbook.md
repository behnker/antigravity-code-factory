# Tri-Layer SEO, AEO & GEO Playbook (AI Search Discovery)

*Synthesized from GEO (Aggarwal et al., arXiv:2311.09735), AutoGEO (arXiv:2509.08919), Vercel/MERJ AI Crawler Studies, and 2026–2027 AI Search Engineering Guides.*

## 1. The Tri-Layer Discovery Stack
```
Layer 3: GEO (Generative Engine Optimization) -> Citations & synthesis in Gemini / ChatGPT / Perplexity / Claude
Layer 2: AEO (Answer Engine Optimization)     -> Zero-click snippets, 40-60 word Q&As, FAQPage & HowTo schema
Layer 1: SEO Foundation                       -> SSR raw HTML, 200-only sitemaps, CWV (LCP<2.5s, INP<200ms, CLS<0.1, TTFB<600ms)
```

## 2. The 7 AI Search Ranking Factors (Impact-Ranked)
1. **Entity Consistency (Highest):** Match canonical brand name, descriptors, URLs, and `sameAs` links across schema, homepage, LinkedIn, GitHub, Wikidata, and third-party profiles (+10%–30% citation lift).
2. **Schema Graph Completeness (Very High):** Emit a single connected `@graph` JSON-LD using `@id` references rather than isolated schema blocks.
3. **Citation-Ready Answer Paragraphs (High):** Place a direct, fluff-free **50–150 word** declarative answer in the first 100–200 words of every core page.
4. **Co-Citation Density (High):** Earn third-party mentions alongside target category terms (podcasts, guest articles, directories, press).
5. **Topical Depth & Query Fan-Out Clustering (Medium-High):** AI engines expand prompts into 5–15 sub-queries fused via Reciprocal Rank Fusion (RRF). Hub-and-spoke clusters (pillar hub + dedicated spoke routes within `<= 3` clicks) deliver up to **+161% citation lift**.
6. **Structural Clarity (Medium-High):** Use clean `H1 → H2 → H3` hierarchy, definition blocks (`"X is..."`), comparison tables (`"X vs Y"`), numbered steps, and FAQ accordions.
7. **Freshness & Maintenance (Medium):** Refresh core statistics and `dateModified` schema every 90 days.

## 3. Empirical GEO Content Tactics (arXiv:2311.09735 & AutoGEO)
- **Fluency + Statistics Addition:** **+35.8%** relative visibility lift (highest-performing single combination).
- **Cite Verifiable Sources:** **+26.0%** average lift (up to **+115.1%** for rank-5 pages).
- **Direct Expert Quotations:** **+29.7%** average lift.
- **Avoid Keyword Stuffing:** **-2.1% to -6.0%** visibility drop in generative engines.
- **Balanced & Self-Contained:** Acknowledge trade-offs honestly and keep every FAQ answer self-contained in **40–60 words**.

## 4. Required AI Crawler `robots.txt` Directives
```txt
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /
```
*Critical Warning:* Blocking `Google-Extended` does not affect classic Google Search, but silently delists your site from grounding in **Google Gemini Apps** and **Vertex AI Search**.

## 5. Connected JSON-LD `@graph` Blueprint
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://example.com/#organization",
      "name": "Brand Name",
      "url": "https://example.com",
      "sameAs": ["https://github.com/org"]
    },
    {
      "@type": "WebSite",
      "@id": "https://example.com/#website",
      "url": "https://example.com",
      "name": "Brand Name",
      "publisher": { "@id": "https://example.com/#organization" }
    },
    {
      "@type": "FAQPage",
      "@id": "https://example.com/#faq",
      "isPartOf": { "@id": "https://example.com/#website" },
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Concise natural question?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Direct, self-contained 40-60 word answer backed by verifiable facts."
          }
        }
      ]
    }
  ]
}
```
