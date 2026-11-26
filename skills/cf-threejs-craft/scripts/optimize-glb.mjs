#!/usr/bin/env node
/**
 * Safe Zero-Native-Binary GLB Asset Optimizer Wrapper
 *
 * Wraps project-local `@gltf-transform/cli` using execFileSync with strict
 * argument arrays (zero shell string concatenation). Default pipeline uses
 * Meshopt + KHR_mesh_quantization + WebP textures (works on every OS without
 * requiring native KTX-Software binaries); optional `--texture-format ktx2`
 * supported when `ktx` is installed.
 *
 * Usage:
 *   node optimize-glb.mjs --in raw/hero.glb --out public/models/hero.glb [--texture-format webp|ktx2] [--max-texture-size 1024] [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const VALID_TEXTURE_FORMATS = new Set(["webp", "ktx2", "none"]);

function readRequiredFlagValue(argv, index, flag) {
  const val = argv[index];
  if (val === undefined || val === "" || val.startsWith("-")) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return val;
}

export function parseArgs(argv) {
  const opts = {
    input: null,
    output: null,
    textureFormat: "webp",
    maxTextureSize: 1024,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--in" || arg === "-i") {
      opts.input = readRequiredFlagValue(argv, ++i, arg);
    } else if (arg === "--out" || arg === "-o") {
      opts.output = readRequiredFlagValue(argv, ++i, arg);
    } else if (arg === "--texture-format") {
      opts.textureFormat = readRequiredFlagValue(argv, ++i, arg);
    } else if (arg === "--max-texture-size") {
      opts.maxTextureSize = Number(readRequiredFlagValue(argv, ++i, arg));
    } else if (arg === "--dry-run") {
      opts.dryRun = true;
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

export function validateGlbPaths(input, output) {
  if (!input || !output) {
    throw new Error("Both --in <input.glb> and --out <output.glb> are required.");
  }
  for (const [label, value] of [
    ["input", input],
    ["output", output],
  ]) {
    if (/[\0\r\n]/.test(value)) {
      throw new Error(`Invalid control characters in --${label} path.`);
    }
    if (path.extname(value).toLowerCase() !== ".glb") {
      throw new Error(`--${label} must have a .glb extension (received "${value}").`);
    }
  }
  const resolvedIn = path.resolve(process.cwd(), input);
  const resolvedOut = path.resolve(process.cwd(), output);
  if (resolvedIn === resolvedOut) {
    throw new Error("--out must differ from --in to avoid clobbering raw source assets.");
  }
  return { resolvedIn, resolvedOut };
}

export function buildOptimizeArgs(resolvedIn, resolvedOut, opts) {
  if (!VALID_TEXTURE_FORMATS.has(opts.textureFormat)) {
    throw new Error(
      `Invalid --texture-format "${opts.textureFormat}". Expected webp, ktx2, or none.`
    );
  }
  if (
    !Number.isInteger(opts.maxTextureSize) ||
    opts.maxTextureSize < 128 ||
    opts.maxTextureSize > 4096
  ) {
    throw new Error("--max-texture-size must be an integer between 128 and 4096.");
  }

  const args = [
    "optimize",
    resolvedIn,
    resolvedOut,
    "--compress",
    "meshopt",
    "--texture-size",
    String(opts.maxTextureSize),
  ];

  if (opts.textureFormat === "webp") {
    args.push("--texture-compress", "webp");
  } else if (opts.textureFormat === "ktx2") {
    args.push("--texture-compress", "ktx2");
  } else {
    args.push("--texture-compress", "false");
  }

  return args;
}

function findLocalGltfTransform(cwd) {
  // Prefer resolving the JS entrypoint directly via createRequire so execution works
  // identically on macOS, Linux, Windows, and hoisted monorepos.
  try {
    const req = createRequire(path.join(cwd, "package.json"));
    const pkgPath = req.resolve("@gltf-transform/cli/package.json");
    const pkgDir = path.dirname(pkgPath);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const binRel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.["gltf-transform"];
    if (binRel) {
      const binJs = path.resolve(pkgDir, binRel);
      if (fs.existsSync(binJs)) {
        return { cmd: process.execPath, prefixArgs: [binJs] };
      }
    }
  } catch {
    // Fall back to walking up node_modules/.bin
  }

  let dir = path.resolve(cwd);
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = path.join(dir, "node_modules", ".bin", "gltf-transform");
    if (fs.existsSync(candidate)) {
      return { cmd: candidate, prefixArgs: [] };
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
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
      "Usage: node optimize-glb.mjs --in <input.glb> --out <output.glb> [--texture-format webp|ktx2|none] [--max-texture-size 1024] [--dry-run]"
    );
    process.exit(0);
  }

  let resolvedIn;
  let resolvedOut;
  let cliArgs;
  try {
    ({ resolvedIn, resolvedOut } = validateGlbPaths(opts.input, opts.output));
    cliArgs = buildOptimizeArgs(resolvedIn, resolvedOut, opts);
  } catch (err) {
    console.error(`CONFIG_ERROR: ${err.message}`);
    process.exit(2);
  }

  if (!fs.existsSync(resolvedIn) || !fs.statSync(resolvedIn).isFile()) {
    console.error(`CONFIG_ERROR: Input GLB file not found: ${resolvedIn}`);
    process.exit(2);
  }

  const inputBytes = fs.statSync(resolvedIn).size;
  if (inputBytes === 0) {
    console.error(`CONFIG_ERROR: Input GLB file is empty (0 bytes): ${resolvedIn}`);
    process.exit(2);
  }

  if (opts.dryRun) {
    console.log(
      JSON.stringify(
        {
          status: "DRY_RUN",
          input: resolvedIn,
          output: resolvedOut,
          inputBytes,
          args: cliArgs,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const runner = findLocalGltfTransform(process.cwd());
  if (!runner) {
    console.error(
      "TOOL_UNAVAILABLE: Local @gltf-transform/cli binary not found. Install @gltf-transform/cli as a devDependency first."
    );
    process.exit(3);
  }

  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  try {
    execFileSync(runner.cmd, [...runner.prefixArgs, ...cliArgs], {
      stdio: "pipe",
      timeout: 120000,
    });
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString("utf8").trim() : err.message;
    console.error(`FAIL: gltf-transform optimize failed: ${stderr}`);
    process.exit(1);
  }

  const outputBytes = fs.statSync(resolvedOut).size;
  const reductionPercent = Number((((inputBytes - outputBytes) / inputBytes) * 100).toFixed(2));
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        input: resolvedIn,
        output: resolvedOut,
        inputBytes,
        outputBytes,
        reductionPercent,
        textureFormat: opts.textureFormat,
      },
      null,
      2
    )
  );
  process.exit(0);
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
