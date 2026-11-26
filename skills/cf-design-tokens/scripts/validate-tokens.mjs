#!/usr/bin/env node
/**
 * Design Token Usage Validator (Zero Dependencies)
 *
 * Detects hardcoded color values and arbitrary Tailwind bracket values
 * (e.g., bg-[#123456], text-[13px], color: #ff0000, rgb(...)) while
 * safely ignoring #anchor links, comments (including multiline /* ... * /),
 * SVG data, and token definition files.
 *
 * Usage:
 *   node validate-tokens.mjs --dir src/ [--ignore generated] [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCAN_EXTENSIONS = new Set([".css", ".scss", ".tsx", ".jsx", ".ts", ".js"]);
const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".tmp",
]);

const SKIP_FILE_PATTERNS = [
  /\.min\.(css|js)$/,
  /\.test\.(ts|tsx|js|jsx|mjs)$/,
  /\.spec\.(ts|tsx|js|jsx|mjs)$/,
  /(?:^|[\\/])tailwind\.config\./,
  /(?:^|[\\/])tokens\.(css|json)$/,
  /(?:^|[\\/])globals\.css$/,
];

const IGNORE_FILE_DIRECTIVE_RE = /^\s*(?:\/\/|\/\*)\s*@tokens-ignore-file\b/m;
const IGNORE_LINE_DIRECTIVE_RE = /(?:\/\/|\/\*)\s*@tokens-ignore-line\b/;

const RULES = [
  {
    id: "tailwind-arbitrary-color",
    regex:
      /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|shadow)-\[(?:#[0-9a-fA-F]{3,8}|rgba?\([^[\]]+\)|hsla?\([^[\]]+\))\]/g,
    message: "Arbitrary Tailwind color literal bypasses design tokens",
    suggestion: "Bind a semantic color in design/tokens.json and use the theme utility class",
  },
  {
    id: "tailwind-arbitrary-size",
    regex: /\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|text|rounded)-\[\d+(?:\.\d+)?px\]/g,
    message: "Arbitrary Tailwind pixel bracket bypasses spacing/typography scale",
    suggestion: "Use a standard Tailwind spacing/type scale token or semantic token",
  },
  {
    id: "css-raw-hex",
    regex:
      /(?:^|[\s{;])(?:color|background|background-color|border-color|outline-color|fill|stroke)\s*:\s*#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/gi,
    message: "Hardcoded CSS hex color declaration",
    suggestion: "Replace with var(--color-*) semantic token",
  },
  {
    id: "css-raw-rgb-hsl",
    regex:
      /(?:^|[\s{;])(?:color|background|background-color|border-color|fill|stroke)\s*:\s*(?:rgba?|hsla?)\s*\([^)]+\)/gi,
    message: "Hardcoded CSS rgb/hsl color declaration",
    suggestion: "Replace with var(--color-*) semantic token",
  },
  {
    id: "inline-style-hex",
    regex:
      /\b(?:color|backgroundColor|borderColor|outlineColor)\s*:\s*["']#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})["']/g,
    message: "Hardcoded hex color in JSX inline style object",
    suggestion: "Use a Tailwind semantic utility class or var(--color-*) token",
  },
];

function readRequiredFlagValue(argv, index, flag) {
  const val = argv[index];
  if (val === undefined || val === "" || val.startsWith("-")) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return val;
}

export function parseArgs(argv) {
  const opts = {
    dir: null,
    ignore: new Set(DEFAULT_IGNORE_DIRS),
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dir" || arg === "-d") {
      opts.dir = readRequiredFlagValue(argv, ++i, arg);
    } else if (arg === "--ignore" || arg === "-i") {
      opts.ignore.add(readRequiredFlagValue(argv, ++i, arg));
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

export function scanSourceText(content, filePath) {
  if (IGNORE_FILE_DIRECTIVE_RE.test(content)) {
    return [];
  }

  const violations = [];
  const lines = content.split(/\r?\n/);
  let inBlockComment = false;

  for (let idx = 0; idx < lines.length; idx += 1) {
    let line = lines[idx];

    if (inBlockComment) {
      const closeIdx = line.indexOf("*/");
      if (closeIdx === -1) continue;
      line = line.slice(closeIdx + 2);
      inBlockComment = false;
    }

    // Strip inline /* ... */ segments and detect unclosed /* opening
    line = line.replace(/\/\*[\s\S]*?\*\//g, "");
    const openIdx = line.indexOf("/*");
    if (openIdx !== -1) {
      line = line.slice(0, openIdx);
      inBlockComment = true;
    }

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || IGNORE_LINE_DIRECTIVE_RE.test(lines[idx])) {
      continue;
    }

    for (const rule of RULES) {
      rule.regex.lastIndex = 0;
      let match;
      while ((match = rule.regex.exec(line)) !== null) {
        violations.push({
          file: filePath,
          line: idx + 1,
          ruleId: rule.id,
          value: match[0].trim(),
          message: rule.message,
          suggestion: rule.suggestion,
        });
      }
    }
  }

  return violations;
}

function collectFiles(dirPath, ignoreSet, out = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!ignoreSet.has(entry.name)) {
        collectFiles(full, ignoreSet, out);
      }
    } else if (entry.isFile()) {
      if (!SCAN_EXTENSIONS.has(path.extname(entry.name))) continue;
      if (SKIP_FILE_PATTERNS.some((re) => re.test(full))) continue;
      out.push(full);
    }
  }
  return out;
}

export function validateDirectory(dirPath, ignoreSet = DEFAULT_IGNORE_DIRS) {
  const resolved = path.resolve(dirPath);
  const files = collectFiles(resolved, ignoreSet);
  const violations = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    violations.push(...scanSourceText(content, path.relative(resolved, file)));
  }
  return {
    scannedFiles: files.length,
    violations,
    passed: violations.length === 0,
  };
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
    console.log("Usage: node validate-tokens.mjs --dir <srcDir> [--ignore <dir>] [--json]");
    process.exit(0);
  }

  if (!opts.dir) {
    console.error("CONFIG_ERROR: --dir <srcDir> is required.");
    process.exit(2);
  }

  const targetDir = path.resolve(process.cwd(), opts.dir);
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    console.error(`CONFIG_ERROR: Directory not found: ${targetDir}`);
    process.exit(2);
  }

  const report = validateDirectory(targetDir, opts.ignore);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.passed) {
    console.log(`PASS: Scanned ${report.scannedFiles} files — 0 token violations.`);
  } else {
    console.error(
      `FAIL: Found ${report.violations.length} token violation(s) across ${report.scannedFiles} files:`
    );
    for (const v of report.violations) {
      console.error(`  - ${v.file}:${v.line} [${v.ruleId}] ${v.message} (${v.value})`);
    }
  }

  process.exit(report.passed ? 0 : 1);
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  main();
}
