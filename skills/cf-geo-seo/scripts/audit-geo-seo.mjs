#!/usr/bin/env node
/**
 * Tri-Layer SEO, AEO & GEO Automated Auditor (Zero Dependencies)
 *
 * Audits SSR/built HTML files and robots.txt against AI Search invariants:
 *   - Crawlable SSR HTML outside <script>/<style>/<canvas>/<title>/comments
 *   - Valid <html lang>, single <h1>, <title> (<=60 chars recommended), <meta name="description">
 *   - Valid JSON-LD <script type="application/ld+json"> with connected @graph @id resolution
 *   - FAQPage answer word-count quality check
 *   - robots.txt verification ensuring GPTBot, ClaudeBot, PerplexityBot, Google-Extended are not blocked
 *
 * Usage:
 *   node audit-geo-seo.mjs --html <fileOrDir> [--robots <robots.txt>] [--min-words 120] [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_AI_BOTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];

function readRequiredFlagValue(argv, index, flag) {
  const val = argv[index];
  if (val === undefined || val === "" || val.startsWith("-")) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return val;
}

export function parseArgs(argv) {
  const opts = {
    html: null,
    robots: null,
    minWords: 120,
    allowAiBlock: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--html") {
      opts.html = readRequiredFlagValue(argv, ++i, arg);
    } else if (arg === "--robots") {
      opts.robots = readRequiredFlagValue(argv, ++i, arg);
    } else if (arg === "--min-words") {
      const raw = readRequiredFlagValue(argv, ++i, arg);
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`Invalid --min-words "${raw}". Expected a non-negative integer.`);
      }
      opts.minWords = parsed;
    } else if (arg === "--allow-ai-block") {
      opts.allowAiBlock = true;
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function stripTagsToText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<canvas\b[^>]*>[\s\S]*?<\/canvas>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-zA-Z0-9#]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMetaDescription(html) {
  const metaTagRe = /<meta\b[^>]*>/gi;
  let tagMatch;
  while ((tagMatch = metaTagRe.exec(html)) !== null) {
    const tag = tagMatch[0];
    if (!/\bname=(?:"description"|'description')/i.test(tag)) continue;
    const contentMatch = /\bcontent=(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    if (contentMatch) {
      return (contentMatch[1] ?? contentMatch[2] ?? "").trim();
    }
  }
  return "";
}

function hasCanonicalLink(html) {
  const linkTagRe = /<link\b[^>]*>/gi;
  let tagMatch;
  while ((tagMatch = linkTagRe.exec(html)) !== null) {
    const tag = tagMatch[0];
    if (!/\brel=(?:"canonical"|'canonical')/i.test(tag)) continue;
    if (/\bhref=(?:"https?:\/\/[^"]+"|'https?:\/\/[^']+')/i.test(tag)) {
      return true;
    }
  }
  return false;
}

function hasFaqType(typeVal) {
  if (typeVal === "FAQPage") return true;
  return Array.isArray(typeVal) && typeVal.includes("FAQPage");
}

function collectIdRefs(node, refs = new Set()) {
  if (!node || typeof node !== "object") return refs;
  if (Array.isArray(node)) {
    for (const item of node) collectIdRefs(item, refs);
    return refs;
  }
  const keys = Object.keys(node);
  if (keys.length === 1 && keys[0] === "@id" && typeof node["@id"] === "string") {
    refs.add(node["@id"]);
    return refs;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === "@id") continue;
    collectIdRefs(v, refs);
  }
  return refs;
}

export function auditHtmlDocument(html, fileLabel, options = {}) {
  const minWords = options.minWords ?? 120;
  const findings = [];

  // 1. <html lang="...">
  if (!/<html\b[^>]*\blang=(?:"[a-zA-Z-]+"|'[a-zA-Z-]+')/i.test(html)) {
    findings.push({
      severity: "error",
      ruleId: "seo-html-lang",
      file: fileLabel,
      message: 'Missing lang attribute on <html> element (e.g., <html lang="en">)',
    });
  }

  // 2. <title>
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const titleText = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
  if (!titleText) {
    findings.push({
      severity: "error",
      ruleId: "seo-title-required",
      file: fileLabel,
      message: "Missing or empty <title> tag in raw SSR HTML",
    });
  } else if (titleText.length > 65) {
    findings.push({
      severity: "warn",
      ruleId: "seo-title-length",
      file: fileLabel,
      message: `<title> is ${titleText.length} chars (target <= 60 chars): "${titleText.slice(0, 70)}"`,
    });
  }

  // 3. <meta name="description"> (quote-matched so apostrophes inside double quotes never truncate)
  const descText = extractMetaDescription(html);
  if (!descText) {
    findings.push({
      severity: "error",
      ruleId: "seo-meta-description",
      file: fileLabel,
      message: 'Missing <meta name="description"> in raw SSR HTML',
    });
  } else if (descText.length < 110 || descText.length > 165) {
    findings.push({
      severity: "warn",
      ruleId: "seo-meta-description-length",
      file: fileLabel,
      message: `Meta description is ${descText.length} chars (optimal 140-155 chars)`,
    });
  }

  // 4. Canonical URL (attribute-order agnostic)
  if (!hasCanonicalLink(html)) {
    findings.push({
      severity: "warn",
      ruleId: "seo-canonical",
      file: fileLabel,
      message: 'Missing absolute <link rel="canonical" href="https://..."> tag',
    });
  }

  // 5. Crawlable SSR H1 & body copy (anti WebGL/CSR Black Box)
  const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const nonEmptyH1 = h1Matches
    .map((m) => stripTagsToText(m[1]))
    .filter((t) => t.length > 0);
  if (nonEmptyH1.length === 0) {
    findings.push({
      severity: "error",
      ruleId: "geo-ssr-h1-required",
      file: fileLabel,
      message: "No crawlable <h1> found in raw SSR HTML (possible WebGL/CSR Black Box)",
    });
  } else if (nonEmptyH1.length > 1) {
    findings.push({
      severity: "warn",
      ruleId: "seo-single-h1",
      file: fileLabel,
      message: `Found ${nonEmptyH1.length} <h1> elements; prefer one primary <h1> per route`,
    });
  }

  const visibleText = stripTagsToText(html);
  const wordCount = visibleText ? visibleText.split(/\s+/).length : 0;
  if (wordCount < minWords) {
    findings.push({
      severity: "error",
      ruleId: "geo-ssr-text-minimum",
      file: fileLabel,
      message: `Only ${wordCount} crawlable SSR words found outside scripts/canvas (minimum ${minWords})`,
    });
  }

  // 6. JSON-LD Schema Graph verification
  const jsonLdMatches = [
    ...html.matchAll(
      /<script\b[^>]*type=(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];
  if (jsonLdMatches.length === 0) {
    findings.push({
      severity: "error",
      ruleId: "aeo-jsonld-required",
      file: fileLabel,
      message: 'Missing <script type="application/ld+json"> structured data block',
    });
  } else {
    const definedIds = new Set();
    const referencedIds = new Set();
    const faqEntries = [];

    for (let i = 0; i < jsonLdMatches.length; i += 1) {
      let parsed;
      try {
        parsed = JSON.parse(jsonLdMatches[i][1]);
      } catch (err) {
        findings.push({
          severity: "error",
          ruleId: "aeo-jsonld-invalid",
          file: fileLabel,
          message: `Invalid JSON-LD block #${i + 1}: ${err.message}`,
        });
        continue;
      }

      if (!parsed || typeof parsed !== "object") {
        findings.push({
          severity: "error",
          ruleId: "aeo-jsonld-invalid",
          file: fileLabel,
          message: `JSON-LD block #${i + 1} must be a JSON object or array of objects`,
        });
        continue;
      }

      const topObjects = Array.isArray(parsed) ? parsed : [parsed];
      for (const obj of topObjects) {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
          findings.push({
            severity: "error",
            ruleId: "aeo-jsonld-invalid",
            file: fileLabel,
            message: `JSON-LD block #${i + 1} contains a non-object item`,
          });
          continue;
        }
        if (!obj["@context"]) {
          findings.push({
            severity: "error",
            ruleId: "aeo-jsonld-context",
            file: fileLabel,
            message: `JSON-LD block #${i + 1} is missing "@context": "https://schema.org"`,
          });
        }

        const nodes = Array.isArray(obj["@graph"]) ? obj["@graph"] : [obj];
        for (const node of nodes) {
          if (node && typeof node === "object" && !Array.isArray(node)) {
            if (typeof node["@id"] === "string") definedIds.add(node["@id"]);
            collectIdRefs(node, referencedIds);

            if (hasFaqType(node["@type"]) && Array.isArray(node.mainEntity)) {
              for (const q of node.mainEntity) {
                faqEntries.push(q?.acceptedAnswer?.text);
              }
            }
          }
        }
      }
    }

    for (const refId of referencedIds) {
      if (!definedIds.has(refId)) {
        findings.push({
          severity: "error",
          ruleId: "geo-jsonld-broken-id-ref",
          file: fileLabel,
          message: `JSON-LD @graph references unresolved "@id": "${refId}"`,
        });
      }
    }

    for (const rawAnswer of faqEntries) {
      const answer = typeof rawAnswer === "string" ? rawAnswer.trim() : "";
      const words = answer ? answer.split(/\s+/).length : 0;
      if (words === 0) {
        findings.push({
          severity: "error",
          ruleId: "aeo-faq-empty-answer",
          file: fileLabel,
          message: "FAQPage contains a missing or empty acceptedAnswer.text",
        });
      } else if (words > 120) {
        findings.push({
          severity: "warn",
          ruleId: "aeo-faq-answer-length",
          file: fileLabel,
          message: `FAQPage answer has ${words} words (target 40-60 words for clean AEO extraction)`,
        });
      }
    }
  }

  return { file: fileLabel, wordCount, findings };
}

export function auditRobotsTxt(content, fileLabel = "robots.txt", allowAiBlock = false) {
  const findings = [];
  const lines = content.split(/\r?\n/);

  const blocks = new Map();
  let currentAgents = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) {
      currentAgents = [];
      continue;
    }
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const val = line.slice(colon + 1).trim();

    if (key === "user-agent") {
      currentAgents.push(val.toLowerCase());
      if (!blocks.has(val.toLowerCase())) {
        blocks.set(val.toLowerCase(), { allow: [], disallow: [] });
      }
    } else if (key === "disallow" || key === "allow") {
      for (const agent of currentAgents) {
        blocks.get(agent)[key].push(val);
      }
    }
  }

  if (!allowAiBlock) {
    const wildcard = blocks.get("*");
    const wildcardBlocksRoot =
      wildcard && wildcard.disallow.includes("/") && !wildcard.allow.includes("/");

    for (const bot of REQUIRED_AI_BOTS) {
      const entry = blocks.get(bot.toLowerCase());
      const explicitlyBlocked =
        entry && entry.disallow.includes("/") && !entry.allow.includes("/");
      const explicitlyAllowed =
        entry && (entry.allow.includes("/") || entry.disallow.includes(""));

      if (explicitlyBlocked || (wildcardBlocksRoot && !explicitlyAllowed)) {
        findings.push({
          severity: "error",
          ruleId: "geo-robots-ai-blocked",
          file: fileLabel,
          message: `AI crawler "${bot}" is blocked by Disallow: / in ${fileLabel}`,
        });
      }
    }
  }

  if (!/^\s*sitemap:\s*https?:\/\//im.test(content)) {
    findings.push({
      severity: "warn",
      ruleId: "seo-robots-sitemap",
      file: fileLabel,
      message: `No Sitemap: https://... directive declared in ${fileLabel}`,
    });
  }

  return findings;
}

export function collectHtmlFiles(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return [targetPath];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!["node_modules", ".git"].includes(entry.name)) walk(full);
      } else if (entry.isFile() && /\.html?$/i.test(entry.name)) {
        if (!/^(_not-found|_global-error|_error|404|500)\.html$/i.test(entry.name)) {
          out.push(full);
        }
      }
    }
  };
  walk(targetPath);
  return out;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`CONFIG_ERROR: ${err.message}`);
    process.exit(2);
  }

  if (opts.help) {
    console.log(
      "Usage: node audit-geo-seo.mjs --html <fileOrDir> [--robots <robots.txt>] [--min-words 120] [--json]"
    );
    process.exit(0);
  }

  if (!opts.html && !opts.robots) {
    console.error("CONFIG_ERROR: Provide at least --html <fileOrDir> or --robots <robots.txt>.");
    process.exit(2);
  }

  const allFindings = [];
  let htmlCount = 0;

  if (opts.html) {
    const htmlTarget = path.resolve(process.cwd(), opts.html);
    if (!fs.existsSync(htmlTarget)) {
      console.error(`CONFIG_ERROR: HTML path not found: ${htmlTarget}`);
      process.exit(2);
    }
    const htmlFiles = collectHtmlFiles(htmlTarget);
    if (htmlFiles.length === 0) {
      console.error(`CONFIG_ERROR: No .html files found in ${htmlTarget}`);
      process.exit(2);
    }
    htmlCount = htmlFiles.length;
    for (const file of htmlFiles) {
      const raw = fs.readFileSync(file, "utf8");
      const label = path.relative(process.cwd(), file);
      const res = auditHtmlDocument(raw, label, { minWords: opts.minWords });
      allFindings.push(...res.findings);
    }
  }

  if (opts.robots) {
    const robotsPath = path.resolve(process.cwd(), opts.robots);
    if (!fs.existsSync(robotsPath) || !fs.statSync(robotsPath).isFile()) {
      console.error(`CONFIG_ERROR: robots.txt file not found: ${robotsPath}`);
      process.exit(2);
    }
    const rawRobots = fs.readFileSync(robotsPath, "utf8");
    allFindings.push(
      ...auditRobotsTxt(rawRobots, path.relative(process.cwd(), robotsPath), opts.allowAiBlock)
    );
  }

  const errors = allFindings.filter((f) => f.severity === "error");
  const warnings = allFindings.filter((f) => f.severity === "warn");
  const passed = errors.length === 0;

  if (opts.json) {
    console.log(JSON.stringify({ passed, htmlCount, errors, warnings }, null, 2));
  } else {
    console.log(
      `${passed ? "PASS" : "FAIL"}: Audited ${htmlCount} HTML document(s)${
        opts.robots ? " + robots.txt" : ""
      } — ${errors.length} error(s), ${warnings.length} warning(s).`
    );
    for (const f of [...errors, ...warnings]) {
      console.log(`  [${f.severity.toUpperCase()}] ${f.file} (${f.ruleId}) ${f.message}`);
    }
  }

  process.exit(passed ? 0 : 1);
}

function safeRealpath(targetPath) {
  try {
    return fs.realpathSync(targetPath);
  } catch {
    return path.resolve(targetPath);
  }
}

export function isDirectExecution(argv1 = process.argv[1], metaUrl = import.meta.url) {
  if (!argv1) return false;
  return safeRealpath(argv1) === safeRealpath(fileURLToPath(metaUrl));
}

if (isDirectExecution()) {
  main();
}
