#!/usr/bin/env node
/**
 * Hardened W3C Design Token Compiler (Zero Dependencies)
 *
 * Compiles 3-layer tokens.json (primitive -> semantic -> component + dark.semantic)
 * into CSS custom properties + optional Tailwind CSS v4 @theme inline mappings,
 * with prototype-pollution guards, cycle detection, strict reference validation,
 * CSS-injection sanitization, and automated WCAG 2.1 AA contrast checks (>= 4.5:1).
 *
 * W3C token JSON structure inspired by nextlevelbuilder/ui-ux-pro-max-skill (MIT).
 *
 * Usage:
 *   node generate-tokens.mjs --config design/tokens.json --out src/styles/tokens.css --format tailwind-v4
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SAFE_KEY_RE = /^[a-zA-Z0-9_-]+$/;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const UNSAFE_CSS_VALUE_RE =
  /[;{}\r\n\0]|\/\*|\*\/|<\/style|javascript:|vbscript:|expression\s*\(|url\s*\(\s*["']?\s*(?:javascript|data|vbscript):/i;
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const FILL_CONTRAST_PAIRS = [
  ["foreground", "background"],
  ["muted-foreground", "background"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["highlight-foreground", "highlight"],
  ["destructive-foreground", "destructive"],
];

const SURFACE_CONTRAST_KEYS = ["background", "surface", "surface-elevated", "card"];

function isPlainObject(val) {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function readRequiredFlagValue(argv, index, flag) {
  const val = argv[index];
  if (val === undefined || val === "" || val.startsWith("-")) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return val;
}

export function parseArgs(argv) {
  const opts = {
    config: null,
    out: null,
    format: "tailwind-v4",
    skipContrast: false,
    minContrast: 4.5,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--config" || arg === "-c") {
      opts.config = readRequiredFlagValue(argv, ++i, arg);
    } else if (arg === "--out" || arg === "-o") {
      opts.out = readRequiredFlagValue(argv, ++i, arg);
    } else if (arg === "--format" || arg === "-f") {
      opts.format = readRequiredFlagValue(argv, ++i, arg);
    } else if (arg === "--skip-contrast") {
      opts.skipContrast = true;
    } else if (arg === "--min-contrast") {
      opts.minContrast = Number(readRequiredFlagValue(argv, ++i, arg));
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!["css", "tailwind-v4"].includes(opts.format)) {
    throw new Error(`Invalid --format "${opts.format}". Expected "css" or "tailwind-v4".`);
  }
  if (!Number.isFinite(opts.minContrast) || opts.minContrast < 1 || opts.minContrast > 21) {
    throw new Error(`Invalid --min-contrast "${opts.minContrast}". Must be between 1 and 21.`);
  }
  return opts;
}

export function hexToRgb(hex) {
  if (typeof hex !== "string" || !HEX_COLOR_RE.test(hex.trim())) {
    return null;
  }
  let raw = hex.trim().slice(1);
  if (raw.length === 3) {
    raw = raw
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  const num = Number.parseInt(raw, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function relativeLuminance({ r, g, b }) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(hexA, hexB) {
  const rgbA = hexToRgb(hexA);
  const rgbB = hexToRgb(hexB);
  if (!rgbA || !rgbB) return null;
  const lumA = relativeLuminance(rgbA);
  const lumB = relativeLuminance(rgbB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function getByPath(root, dotPath) {
  const segments = dotPath.split(".");
  let current = root;
  for (const seg of segments) {
    if (FORBIDDEN_KEYS.has(seg)) {
      throw new Error(`Forbidden prototype key "${seg}" in token reference "{${dotPath}}".`);
    }
    if (!isPlainObject(current) || !Object.hasOwn(current, seg)) {
      return undefined;
    }
    current = current[seg];
  }
  return current;
}

export function resolveTokenValue(rawValue, rootTokens, visited = new Set()) {
  if (typeof rawValue !== "string") {
    throw new Error(`Token $value must be a string, received ${typeof rawValue}.`);
  }
  if (/[\r\n\0]/.test(rawValue)) {
    throw new Error("Unsafe CSS value rejected: control characters are not allowed.");
  }
  const trimmed = rawValue.trim();
  const refMatch = /^\{([a-zA-Z0-9_.-]+)\}$/.exec(trimmed);
  if (!refMatch) {
    if (UNSAFE_CSS_VALUE_RE.test(trimmed)) {
      throw new Error(`Unsafe CSS value rejected: "${trimmed}"`);
    }
    return trimmed;
  }

  const refPath = refMatch[1];
  if (visited.has(refPath)) {
    throw new Error(`Cyclic token reference detected: ${[...visited, refPath].join(" -> ")}`);
  }

  const target = getByPath(rootTokens, refPath);
  if (target === undefined) {
    throw new Error(`Unresolved token reference: "{${refPath}}"`);
  }

  const nextValue =
    isPlainObject(target) && Object.hasOwn(target, "$value") ? target.$value : target;
  if (typeof nextValue !== "string") {
    throw new Error(`Token reference "{${refPath}}" does not resolve to a leaf $value.`);
  }

  const nextVisited = new Set(visited);
  nextVisited.add(refPath);
  return resolveTokenValue(nextValue, rootTokens, nextVisited);
}

function flattenLayer(obj, rootTokens, prefix = [], out = Object.create(null)) {
  if (!isPlainObject(obj)) return out;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$")) continue;
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Forbidden prototype key "${key}" in token config.`);
    }
    if (!SAFE_KEY_RE.test(key)) {
      throw new Error(`Invalid token key "${key}". Allowed characters: a-z, A-Z, 0-9, _, -.`);
    }
    const node = obj[key];
    const nextPath = [...prefix, key];
    if (isPlainObject(node) && Object.hasOwn(node, "$value")) {
      const cssName = `--${nextPath.join("-")}`;
      out[cssName] = resolveTokenValue(node.$value, rootTokens);
    } else if (isPlainObject(node)) {
      flattenLayer(node, rootTokens, nextPath, out);
    }
  }
  return out;
}

export function checkSemanticContrast(semanticMap, modeLabel, minContrast = 4.5) {
  const failures = [];
  const checked = [];
  const pairs = [...FILL_CONTRAST_PAIRS];
  const seen = new Set(pairs.map(([fgKey, bgKey]) => `${fgKey}|${bgKey}`));

  const textKeys = new Set(["foreground", "muted-foreground"]);
  for (const cssKey of Object.keys(semanticMap)) {
    if (cssKey.startsWith("--color-") && cssKey.endsWith("-text")) {
      textKeys.add(cssKey.slice("--color-".length));
    }
  }
  for (const fgKey of textKeys) {
    for (const bgKey of SURFACE_CONTRAST_KEYS) {
      const pairId = `${fgKey}|${bgKey}`;
      if (!seen.has(pairId)) {
        seen.add(pairId);
        pairs.push([fgKey, bgKey]);
      }
    }
  }

  for (const [fgKey, bgKey] of pairs) {
    const fg = semanticMap[`--color-${fgKey}`];
    const bg = semanticMap[`--color-${bgKey}`];
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    if (ratio === null) continue;
    const rounded = Number(ratio.toFixed(2));
    checked.push({ mode: modeLabel, fg: fgKey, bg: bgKey, ratio: rounded });
    if (ratio < minContrast) {
      failures.push({
        mode: modeLabel,
        fg: `--color-${fgKey} (${fg})`,
        bg: `--color-${bgKey} (${bg})`,
        ratio: rounded,
        required: minContrast,
      });
    }
  }
  return { checked, failures };
}

export function compileTokens(tokens, options = {}) {
  const format = options.format ?? "tailwind-v4";
  const skipContrast = options.skipContrast ?? false;
  const minContrast = options.minContrast ?? 4.5;

  if (!isPlainObject(tokens)) {
    throw new Error("Token config must be a plain JSON object.");
  }

  for (const topKey of Object.keys(tokens)) {
    if (FORBIDDEN_KEYS.has(topKey)) {
      throw new Error(`Forbidden prototype key "${topKey}" in token config.`);
    }
  }

  const primitive = flattenLayer(tokens.primitive, tokens, ["primitive"]);
  const semantic = flattenLayer(tokens.semantic, tokens, []);
  const component = flattenLayer(tokens.component, tokens, []);
  const darkSemantic = flattenLayer(tokens.dark?.semantic, tokens, []);

  const contrastResults = [];
  const contrastFailures = [];

  if (!skipContrast) {
    const lightCheck = checkSemanticContrast(semantic, "light", minContrast);
    contrastResults.push(...lightCheck.checked);
    contrastFailures.push(...lightCheck.failures);

    if (Object.keys(darkSemantic).length > 0) {
      const mergedDark = { ...semantic, ...darkSemantic };
      const darkCheck = checkSemanticContrast(mergedDark, "dark", minContrast);
      contrastResults.push(...darkCheck.checked);
      contrastFailures.push(...darkCheck.failures);
    }
  }

  if (contrastFailures.length > 0) {
    const details = contrastFailures
      .map(
        (f) =>
          `  [${f.mode}] ${f.fg} on ${f.bg} -> ${f.ratio}:1 (minimum ${f.required}:1)`
      )
      .join("\n");
    throw new Error(`WCAG contrast check failed:\n${details}`);
  }

  const lines = [
    "/* Design Tokens - Auto-generated by cf-design-tokens */",
    "/* Source of truth: design/tokens.json (do not edit directly) */",
    "",
  ];

  if (Object.keys(primitive).length > 0) {
    lines.push("/* === PRIMITIVES === */", ":root {");
    for (const [k, v] of Object.entries(primitive)) lines.push(`  ${k}: ${v};`);
    lines.push("}", "");
  }

  if (Object.keys(semantic).length > 0) {
    lines.push("/* === SEMANTIC (LIGHT / DEFAULT) === */", ":root {");
    for (const [k, v] of Object.entries(semantic)) lines.push(`  ${k}: ${v};`);
    lines.push("}", "");
  }

  if (Object.keys(component).length > 0) {
    lines.push("/* === COMPONENT TOKENS === */", ":root {");
    for (const [k, v] of Object.entries(component)) lines.push(`  ${k}: ${v};`);
    lines.push("}", "");
  }

  if (Object.keys(darkSemantic).length > 0) {
    lines.push("/* === SEMANTIC (DARK OVERRIDES) === */", ".dark {");
    for (const [k, v] of Object.entries(darkSemantic)) lines.push(`  ${k}: ${v};`);
    lines.push("}", "");
  }

  if (format === "tailwind-v4") {
    const colorKeys = Object.keys(semantic).filter((k) => k.startsWith("--color-"));
    const fontKeys = Object.keys(semantic).filter((k) => k.startsWith("--font-"));
    const spacingKeys = Object.keys(semantic).filter((k) => k.startsWith("--spacing-"));
    const radiusKeys = Object.keys(primitive).filter((k) => k.startsWith("--primitive-radius-"));
    lines.push("/* === TAILWIND CSS V4 THEME MAPPING === */", "@theme inline {");
    for (const k of colorKeys) lines.push(`  ${k}: var(${k});`);
    for (const k of fontKeys) lines.push(`  ${k}: var(${k});`);
    for (const k of spacingKeys) lines.push(`  ${k}: var(${k});`);
    for (const k of radiusKeys) {
      const shortName = k.replace("--primitive-radius-", "--radius-");
      lines.push(`  ${shortName}: var(${k});`);
    }
    lines.push("}", "");
  }

  return {
    css: lines.join("\n"),
    counts: {
      primitive: Object.keys(primitive).length,
      semantic: Object.keys(semantic).length,
      component: Object.keys(component).length,
      dark: Object.keys(darkSemantic).length,
    },
    contrastResults,
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
    console.log(
      "Usage: node generate-tokens.mjs --config <tokens.json> [--out <tokens.css>] [--format css|tailwind-v4] [--skip-contrast]"
    );
    process.exit(0);
  }

  if (!opts.config) {
    console.error("CONFIG_ERROR: --config <tokens.json> is required.");
    process.exit(2);
  }

  const configPath = path.resolve(process.cwd(), opts.config);
  if (!fs.existsSync(configPath) || !fs.statSync(configPath).isFile()) {
    console.error(`CONFIG_ERROR: Token file not found: ${configPath}`);
    process.exit(2);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    console.error(`CONFIG_ERROR: Invalid JSON in ${configPath}: ${err.message}`);
    process.exit(2);
  }

  try {
    const result = compileTokens(parsed, opts);
    if (opts.out) {
      const outPath = path.resolve(process.cwd(), opts.out);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, result.css, "utf8");
      console.log(
        `PASS: Generated ${outPath} (${result.counts.primitive} primitive, ${result.counts.semantic} semantic, ${result.counts.component} component, ${result.counts.dark} dark; ${result.contrastResults.length} WCAG contrast pairs verified).`
      );
    } else {
      process.stdout.write(result.css);
    }
    process.exit(0);
  } catch (err) {
    console.error(`FAIL: ${err.message}`);
    process.exit(1);
  }
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
