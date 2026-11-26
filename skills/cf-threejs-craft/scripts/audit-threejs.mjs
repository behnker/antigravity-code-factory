#!/usr/bin/env node
/**
 * Static Three.js & React Three Fiber Performance/Safety Auditor (Zero Dependencies)
 *
 * Scans source files that use Three.js / R3F / Drei for high-impact anti-patterns
 * from Utsubo's 100 Three.js Tips:
 *   - setState calls inside useFrame (comment/string-aware lexer)
 *   - new THREE.* object allocations inside useFrame
 *   - deprecated THREE.Clock usage (use Timer from "three")
 *   - uncapped setPixelRatio(window.devicePixelRatio) without Math.min
 *   - unguarded top-level lil-gui / stats-gl imports or require() in production code
 *   - advisory warnings for missing .dispose(), reduced-motion, and webglcontextlost handling
 *
 * Usage:
 *   node audit-threejs.mjs --dir src/ [--json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".tmp",
]);
const SKIP_FILES = [/\.test\.[cm]?[jt]sx?$/, /\.spec\.[cm]?[jt]sx?$/, /\.d\.ts$/];

const THREE_IMPORT_RE =
  /from\s+["'](?:three(?:\/[^"']+)?|@react-three\/fiber|@react-three\/drei)["']/;

function readRequiredFlagValue(argv, index, flag) {
  const val = argv[index];
  if (val === undefined || val === "" || val.startsWith("-")) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return val;
}

export function parseArgs(argv) {
  const opts = { dir: null, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dir" || arg === "-d") {
      opts.dir = readRequiredFlagValue(argv, ++i, arg);
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

/**
 * Comment- and string-aware extraction of balanced `useFrame(...)` call bodies.
 * Prevents comments like `// 1) rotate` or `// :)` from closing depth prematurely,
 * and returns code-only body (comments stripped) so commented-out examples don't false-trigger.
 */
function extractUseFrameBlocks(source) {
  const blocks = [];
  const callRe = /\buseFrame\s*\(/g;
  let match;

  while ((match = callRe.exec(source)) !== null) {
    const startIdx = match.index;
    const startLine = source.slice(0, startIdx).split(/\r?\n/).length;
    const openParen = source.indexOf("(", startIdx);
    let depth = 0;
    let i = openParen;
    let codeChars = [];

    while (i < source.length) {
      const ch = source[i];
      const next = source[i + 1];

      // Line comment: // ...
      if (ch === "/" && next === "/") {
        i += 2;
        while (i < source.length && source[i] !== "\n") i += 1;
        continue;
      }
      // Block comment: /* ... */
      if (ch === "/" && next === "*") {
        i += 2;
        while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
        i += 2;
        continue;
      }
      // Single / double / template string literals
      if (ch === "'" || ch === '"' || ch === "`") {
        const quote = ch;
        codeChars.push(ch);
        i += 1;
        while (i < source.length) {
          if (source[i] === "\\") {
            codeChars.push(source[i], source[i + 1] ?? "");
            i += 2;
            continue;
          }
          codeChars.push(source[i]);
          if (source[i] === quote) {
            i += 1;
            break;
          }
          i += 1;
        }
        continue;
      }

      codeChars.push(ch);
      if (ch === "(") {
        depth += 1;
      } else if (ch === ")") {
        depth -= 1;
        if (depth === 0) {
          break;
        }
      }
      i += 1;
    }

    blocks.push({
      startLine,
      body: codeChars.join(""),
    });
  }

  return blocks;
}

export function auditThreeSource(content, filePath) {
  const findings = [];
  if (!THREE_IMPORT_RE.test(content) && !/\blil-gui\b|\bstats-gl\b/.test(content)) {
    return findings;
  }

  const lines = content.split(/\r?\n/);

  // 1. Check useFrame anti-patterns (setState & new THREE.* allocations)
  for (const block of extractUseFrameBlocks(content)) {
    if (/\bset[A-Z][A-Za-z0-9_]*\s*\(/.test(block.body)) {
      findings.push({
        severity: "error",
        ruleId: "r3f-no-setstate-in-useframe",
        file: filePath,
        line: block.startLine,
        message: "React state setter called inside useFrame() causes 60-120fps re-render storms",
        remediation: "Mutate ref.current properties directly inside useFrame instead of setState",
      });
    }
    if (
      /\bnew\s+THREE\.(?:Vector[234]|Matrix[34]|Quaternion|Euler|Color|Box3|Raycaster)\s*\(/.test(
        block.body
      )
    ) {
      findings.push({
        severity: "error",
        ruleId: "r3f-no-alloc-in-useframe",
        file: filePath,
        line: block.startLine,
        message: "Per-frame THREE math object allocation inside useFrame() causes GC frame hitches",
        remediation: "Hoist scratch Vector3/Matrix4/Color objects outside useFrame or via useMemo",
      });
    }
  }

  // 2. Line-level checks
  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      continue;
    }

    if (/\bnew\s+(?:THREE\.)?Clock\s*\(/.test(line)) {
      findings.push({
        severity: "error",
        ruleId: "three-no-deprecated-clock",
        file: filePath,
        line: idx + 1,
        message: "THREE.Clock is deprecated since r183 and jumps after background tab sleep",
        remediation: 'Use `import { Timer } from "three"` and call `timer.connect(document)`',
      });
    }

    if (
      /\.setPixelRatio\s*\(\s*window\.devicePixelRatio\s*\)/.test(line) &&
      !/Math\.min/.test(line)
    ) {
      findings.push({
        severity: "error",
        ruleId: "three-cap-dpr",
        file: filePath,
        line: idx + 1,
        message: "Uncapped devicePixelRatio can render 9x pixels on 3x mobile displays",
        remediation: "Clamp DPR via `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`",
      });
    }

    if (
      /^\s*import\s+(?:.+\s+from\s+)?["'](?:lil-gui|stats-gl)["']/.test(line) ||
      /\brequire\s*\(\s*["'](?:lil-gui|stats-gl)["']\s*\)/.test(line)
    ) {
      findings.push({
        severity: "error",
        ruleId: "three-dev-only-debug-ui",
        file: filePath,
        line: idx + 1,
        message:
          "Static import or require() of lil-gui/stats-gl ships debug tooling to production bundles",
        remediation:
          'Guard behind `if (process.env.NODE_ENV === "development")` and dynamic `import("lil-gui")`',
      });
    }
  }

  // 3. File-level advisory warnings
  const createsRawRenderer = /\bnew\s+(?:THREE\.)?(?:WebGLRenderer|WebGPURenderer)\s*\(/.test(
    content
  );
  if (createsRawRenderer && !/\.dispose\s*\(/.test(content)) {
    findings.push({
      severity: "warn",
      ruleId: "three-dispose-resources",
      file: filePath,
      line: 1,
      message: "Renderer created without visible .dispose() cleanup in this module",
      remediation: "Dispose geometries, materials, textures, and renderer on unmount",
    });
  }

  const mountsCanvas = /<Canvas\b/.test(content) || createsRawRenderer;
  if (mountsCanvas && !/prefers-reduced-motion|useReducedMotion|reducedMotion/i.test(content)) {
    findings.push({
      severity: "warn",
      ruleId: "three-reduced-motion-fallback",
      file: filePath,
      line: 1,
      message: "3D canvas mount has no visible prefers-reduced-motion handling in this file",
      remediation:
        "Respect prefers-reduced-motion (pause camera animation or render static fallback)",
    });
  }

  if (mountsCanvas && !/webglcontextlost|onDeviceLost/i.test(content)) {
    findings.push({
      severity: "warn",
      ruleId: "three-context-loss-fallback",
      file: filePath,
      line: 1,
      message: "3D canvas mount has no visible webglcontextlost / onDeviceLost fallback handler",
      remediation: "Attach a webglcontextlost listener (or WebGPU onDeviceLost) and show static fallback",
    });
  }

  return findings;
}

function collectFiles(dirPath, out = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) collectFiles(full, out);
    } else if (entry.isFile()) {
      if (!SCAN_EXTENSIONS.has(path.extname(entry.name))) continue;
      if (SKIP_FILES.some((re) => re.test(full))) continue;
      out.push(full);
    }
  }
  return out;
}

export function auditDirectory(dirPath) {
  const resolved = path.resolve(dirPath);
  const files = collectFiles(resolved);
  const findings = [];
  let threeFiles = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    if (THREE_IMPORT_RE.test(content) || /\blil-gui\b|\bstats-gl\b/.test(content)) {
      threeFiles += 1;
      findings.push(...auditThreeSource(content, path.relative(resolved, file)));
    }
  }

  const errors = findings.filter((f) => f.severity === "error");
  const warnings = findings.filter((f) => f.severity === "warn");

  return {
    scannedFiles: files.length,
    threeFiles,
    errors,
    warnings,
    passed: errors.length === 0,
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
    console.log("Usage: node audit-threejs.mjs --dir <srcDir> [--json]");
    process.exit(0);
  }

  if (!opts.dir) {
    console.error("CONFIG_ERROR: --dir <srcDir> is required.");
    process.exit(2);
  }

  const target = path.resolve(process.cwd(), opts.dir);
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    console.error(`CONFIG_ERROR: Directory not found: ${target}`);
    process.exit(2);
  }

  const report = auditDirectory(target);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const status = report.passed ? "PASS" : "FAIL";
    console.log(
      `${status}: Audited ${report.threeFiles} Three.js/R3F file(s) (of ${report.scannedFiles} scanned) — ${report.errors.length} error(s), ${report.warnings.length} warning(s).`
    );
    for (const f of [...report.errors, ...report.warnings]) {
      console.log(`  [${f.severity.toUpperCase()}] ${f.file}:${f.line} (${f.ruleId}) ${f.message}`);
    }
  }

  process.exit(report.passed ? 0 : 1);
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  main();
}
