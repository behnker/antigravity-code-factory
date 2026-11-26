import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  auditHtmlDocument,
  auditRobotsTxt,
  collectHtmlFiles,
  parseArgs,
} from "./audit-geo-seo.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GOOD_HTML = `<!doctype html>
<html lang="en">
<head>
  <title>Acme Studio — Interactive 3D Web & Design Platform</title>
  <meta name="description" content="Explore Acme Studio's interactive 3D web platform with token-first design, SSR crawlability, verified schemas, and fast mobile performance." />
  <link rel="canonical" href="https://example.com/" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://example.com/#org",
        "name": "Acme Studio"
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://example.com/#app",
        "name": "Acme Interactive Stage",
        "publisher": { "@id": "https://example.com/#org" }
      },
      {
        "@type": ["WebPage", "FAQPage"],
        "@id": "https://example.com/#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How does server-side rendering improve AI search citation rates?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Server-side rendering places headlines, summaries, comparison tables, and connected JSON-LD structured data directly inside raw HTML so AI crawlers that do not execute JavaScript can index and cite your content accurately."
            }
          }
        ]
      }
    ]
  }
  </script>
</head>
<body>
  <main>
    <h1>Acme Studio Interactive 3D Web & Design Platform</h1>
    <p>${"Build fast server-rendered websites combining token-first design systems, optimized 3D scenes, connected structured data graphs, and verified accessibility across desktop, tablet, and mobile viewports worldwide. ".repeat(6)}</p>
    <canvas id="hero-3d"></canvas>
  </main>
</body>
</html>`;

test("auditHtmlDocument passes compliant SSR + JSON-LD @graph HTML including apostrophe descriptions", () => {
  const result = auditHtmlDocument(GOOD_HTML, "index.html", { minWords: 120 });
  const errors = result.findings.filter((f) => f.severity === "error");
  assert.equal(errors.length, 0);
  assert.ok(!result.findings.some((f) => f.ruleId === "seo-meta-description-length"));
  assert.ok(result.wordCount >= 120);
});

test("auditHtmlDocument handles null/primitive JSON-LD cleanly and catches blank CSR shells", () => {
  const badHtml = `<!doctype html>
  <html>
    <head>
      <script type="application/ld+json">null</script>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[
          {"@type":"WebSite","publisher":{"@id":"https://example.com/#missing"}},
          {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Q","acceptedAnswer":{}}]}
        ]}
      </script>
    </head>
    <body><!-- hidden comment words should not count --><canvas id="only-webgl"></canvas></body>
  </html>`;
  const result = auditHtmlDocument(badHtml, "csr.html", { minWords: 100 });
  const ids = result.findings.map((f) => f.ruleId);
  assert.ok(ids.includes("seo-html-lang"));
  assert.ok(ids.includes("seo-title-required"));
  assert.ok(ids.includes("seo-meta-description"));
  assert.ok(ids.includes("geo-ssr-h1-required"));
  assert.ok(ids.includes("geo-ssr-text-minimum"));
  assert.ok(ids.includes("aeo-jsonld-invalid"));
  assert.ok(ids.includes("geo-jsonld-broken-id-ref"));
  assert.ok(ids.includes("aeo-faq-empty-answer"));
});

test("parseArgs rejects missing flag values and non-integer --min-words", () => {
  assert.throws(() => parseArgs(["--html", "dist", "--min-words"]), /Missing value for --min-words/);
  assert.throws(() => parseArgs(["--html", "dist", "--min-words", "abc"]), /Invalid --min-words/);
  assert.throws(() => parseArgs(["--html", "dist", "--robots"]), /Missing value for --robots/);
});

test("auditRobotsTxt detects blocked Google-Extended and supports empty Disallow override", () => {
  const blocked = `
    User-agent: *
    Allow: /

    User-agent: Google-Extended
    Disallow: /
  `;
  const blockedFindings = auditRobotsTxt(blocked, "robots.txt");
  assert.ok(blockedFindings.some((f) => f.ruleId === "geo-robots-ai-blocked"));

  const allowed = `
    User-agent: *
    Disallow: /

    User-agent: GPTBot
    Allow: /

    User-agent: ClaudeBot
    Disallow:

    User-agent: PerplexityBot
    Allow: /

    User-agent: Google-Extended
    Allow: /

    Sitemap: https://example.com/sitemap.xml
  `;
  const okFindings = auditRobotsTxt(allowed, "robots.txt");
  assert.equal(okFindings.length, 0);
});

test("collectHtmlFiles excludes Next.js 16 _global-error.html, _error.html, and _not-found.html (v3.0.1 cf-learn)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-geo-html-"));
  try {
    for (const name of [
      "index.html",
      "faq.html",
      "_not-found.html",
      "_global-error.html",
      "_error.html",
      "404.html",
      "500.html",
    ]) {
      fs.writeFileSync(path.join(tmpDir, name), "<html></html>", "utf8");
    }
    const collected = collectHtmlFiles(tmpDir).map((f) => path.basename(f)).sort();
    assert.deepEqual(collected, ["faq.html", "index.html"]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("auditHtmlDocument accepts <link href=... rel=canonical> regardless of attribute order", () => {
  const reversedCanonical = GOOD_HTML.replace(
    '<link rel="canonical" href="https://example.com/" />',
    '<link href="https://example.com/" rel="canonical" />'
  );
  const result = auditHtmlDocument(reversedCanonical, "index.html", { minWords: 120 });
  assert.equal(
    result.findings.some((f) => f.ruleId === "seo-canonical"),
    false
  );
});

test("audit-geo-seo CLI executes main() when invoked via a symlinked plugin path (v3.0.1 cf-learn)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-geo-symlink-"));
  try {
    const symlinkPath = path.join(tmpDir, "audit-geo-seo-link.mjs");
    fs.symlinkSync(path.join(__dirname, "audit-geo-seo.mjs"), symlinkPath);
    const res = spawnSync(process.execPath, [symlinkPath, "--help"], { encoding: "utf8" });
    assert.equal(res.status, 0);
    assert.match(res.stdout, /Usage: node audit-geo-seo\.mjs/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
