#!/usr/bin/env node
/**
 * Enterprise Code Factory — Deterministic Feature Map Verifier
 *
 * Parses a fenced ```json feature-map``` block from .memory/feature-map.md
 * (or a standalone JSON config via --config) and verifies routes, HTTP status,
 * DOM selectors, console/page errors, unexpected 4xx/5xx responses, and
 * multi-viewport horizontal overflow using project-local Playwright.
 *
 * Exit Codes:
 *   0 = PASS
 *   1 = VERIFICATION_FAIL
 *   2 = CONFIG_ERROR
 *   3 = PLAYWRIGHT_UNAVAILABLE (signal to fall back to Antigravity browser subagent)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const EXIT_CODES = Object.freeze({
  PASS: 0,
  VERIFICATION_FAIL: 1,
  CONFIG_ERROR: 2,
  PLAYWRIGHT_UNAVAILABLE: 3,
});

export const DEFAULT_VIEWPORTS = Object.freeze([
  { name: 'desktop', width: 1440, height: 900 },
]);

export const ALL_STANDARD_VIEWPORTS = Object.freeze([
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]);

const FEATURE_SLUG_RE = /^[a-z0-9][a-z0-9-_]*$/;
const ALLOWED_WAIT_UNTIL = new Set(['domcontentloaded', 'load', 'networkidle']);
const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Extracts and parses the ```json feature-map``` fenced code block from Markdown.
 */
export function extractFeatureMapJson(markdownText) {
  if (typeof markdownText !== 'string' || !markdownText.trim()) {
    throw new Error('Feature map file is empty.');
  }

  const fenceRegex = /```json[ \t]+feature-map[ \t]*\r?\n([\s\S]*?)\r?\n```/i;
  const match = markdownText.match(fenceRegex);
  if (!match || !match[1]) {
    throw new Error(
      'Missing fenced ```json feature-map``` contract block in feature-map.md.'
    );
  }

  try {
    return JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`Invalid JSON inside \`\`\`json feature-map\`\`\` block: ${err.message}`);
  }
}

/**
 * Validates that a URL is http(s) and points to localhost unless remote is explicitly permitted.
 */
export function isLocalhostUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }
  return LOCALHOST_HOSTS.has(parsed.hostname.toLowerCase());
}

/**
 * Ensures a relative route/healthCheck path starts with a single "/" and
 * resolves strictly to the same origin as parsedBase (blocks "//evil.com" and "/\\evil.com" SSRF).
 */
export function assertSameOriginPath(rawPath, parsedBase, fieldName) {
  if (typeof rawPath !== 'string' || !rawPath.startsWith('/')) {
    throw new Error(`${fieldName} must be a path starting with "/".`);
  }
  if (rawPath.startsWith('//') || rawPath.startsWith('/\\') || rawPath.includes('\\')) {
    throw new Error(
      `${fieldName} "${rawPath}" must be a single-slash relative path (protocol-relative or backslash paths are forbidden).`
    );
  }
  let resolved;
  try {
    resolved = new URL(rawPath, parsedBase);
  } catch {
    throw new Error(`${fieldName} "${rawPath}" is not a valid relative URL path.`);
  }
  if (resolved.origin !== parsedBase.origin) {
    throw new Error(
      `${fieldName} "${rawPath}" resolves to cross-origin URL "${resolved.origin}" (expected "${parsedBase.origin}").`
    );
  }
  return rawPath;
}

/**
 * Runtime schema validation for Feature Map config (zero external dependencies).
 */
export function validateConfig(raw, options = {}) {
  const { allowRemote = false, baseUrlOverride = null, allViewports = false } = options;

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Config root must be a JSON object.');
  }

  const baseUrl = baseUrlOverride ?? raw.baseUrl;
  if (typeof baseUrl !== 'string' || !baseUrl.trim()) {
    throw new Error('Config requires a non-empty string "baseUrl".');
  }

  let parsedBase;
  try {
    parsedBase = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid "baseUrl": ${baseUrl}`);
  }
  if (parsedBase.protocol !== 'http:' && parsedBase.protocol !== 'https:') {
    throw new Error(`"baseUrl" must use http: or https: protocol (received ${parsedBase.protocol}).`);
  }
  if (!allowRemote && !isLocalhostUrl(baseUrl)) {
    throw new Error(
      `Refusing non-localhost baseUrl "${baseUrl}" without explicit --allow-remote flag.`
    );
  }

  let healthCheck = null;
  if (raw.healthCheck !== undefined && raw.healthCheck !== null) {
    healthCheck = assertSameOriginPath(raw.healthCheck, parsedBase, '"healthCheck"');
  }

  let viewports;
  if (raw.viewports !== undefined) {
    if (!Array.isArray(raw.viewports) || raw.viewports.length === 0) {
      throw new Error('"viewports" must be a non-empty array when provided.');
    }
    viewports = raw.viewports.map((vp, idx) => {
      if (!vp || typeof vp !== 'object') {
        throw new Error(`viewports[${idx}] must be an object.`);
      }
      const name = typeof vp.name === 'string' && vp.name.trim() ? vp.name.trim() : `vp-${idx}`;
      const width = Number(vp.width);
      const height = Number(vp.height);
      if (!Number.isInteger(width) || width < 320 || width > 3840) {
        throw new Error(`viewports[${idx}].width must be an integer between 320 and 3840.`);
      }
      if (!Number.isInteger(height) || height < 320 || height > 2160) {
        throw new Error(`viewports[${idx}].height must be an integer between 320 and 2160.`);
      }
      return { name, width, height };
    });
  } else {
    viewports = allViewports ? [...ALL_STANDARD_VIEWPORTS] : [...DEFAULT_VIEWPORTS];
  }

  if (!allViewports && raw.viewports !== undefined && viewports.length > 1) {
    // Respect explicit viewports in config, or filter to desktop only if user didn't pass --all-viewports?
    // Keeping explicit config viewports when --all-viewports is passed; when not passed, prefer desktop if present.
    const desktopVp = viewports.find((v) => v.name.toLowerCase() === 'desktop');
    if (desktopVp) {
      viewports = [desktopVp];
    }
  }

  let ignoreUrls = ['/favicon.ico'];
  if (raw.ignoreUrls !== undefined) {
    if (!Array.isArray(raw.ignoreUrls) || !raw.ignoreUrls.every((u) => typeof u === 'string')) {
      throw new Error('"ignoreUrls" must be an array of strings.');
    }
    ignoreUrls = raw.ignoreUrls;
  }

  if (!Array.isArray(raw.targets) || raw.targets.length === 0) {
    throw new Error('Config requires a non-empty "targets" array.');
  }

  const targets = raw.targets.map((target, idx) => {
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      throw new Error(`targets[${idx}] must be an object.`);
    }
    if (typeof target.feature !== 'string' || !FEATURE_SLUG_RE.test(target.feature)) {
      throw new Error(
        `targets[${idx}].feature must be a lowercase slug matching ${FEATURE_SLUG_RE}.`
      );
    }
    assertSameOriginPath(target.route, parsedBase, `targets[${idx}].route`);

    const expectedStatus =
      target.expectedStatus === undefined ? 200 : Number(target.expectedStatus);
    if (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599) {
      throw new Error(`targets[${idx}].expectedStatus must be an HTTP status integer (100-599).`);
    }

    const waitUntil = target.waitUntil ?? 'domcontentloaded';
    if (!ALLOWED_WAIT_UNTIL.has(waitUntil)) {
      throw new Error(
        `targets[${idx}].waitUntil must be one of: ${[...ALLOWED_WAIT_UNTIL].join(', ')}.`
      );
    }

    let waitForSelector = null;
    if (target.waitForSelector !== undefined && target.waitForSelector !== null) {
      if (typeof target.waitForSelector !== 'string' || !target.waitForSelector.trim()) {
        throw new Error(`targets[${idx}].waitForSelector must be a non-empty string.`);
      }
      waitForSelector = target.waitForSelector.trim();
    }

    let selectors = [];
    if (target.selectors !== undefined) {
      if (
        !Array.isArray(target.selectors) ||
        !target.selectors.every((s) => typeof s === 'string' && s.trim().length > 0)
      ) {
        throw new Error(`targets[${idx}].selectors must be an array of non-empty strings.`);
      }
      selectors = target.selectors.map((s) => s.trim());
    }

    const checkOverflow = target.checkOverflow === undefined ? true : Boolean(target.checkOverflow);
    const timeoutMs = target.timeoutMs === undefined ? 15000 : Number(target.timeoutMs);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
      throw new Error(`targets[${idx}].timeoutMs must be an integer between 1000 and 60000.`);
    }

    return {
      feature: target.feature,
      route: target.route,
      expectedStatus,
      waitUntil,
      waitForSelector,
      selectors,
      checkOverflow,
      timeoutMs,
    };
  });

  return {
    baseUrl,
    healthCheck,
    viewports,
    ignoreUrls,
    targets,
  };
}

/**
 * Checks whether a response URL matches any configured ignoreUrls entry.
 */
export function isIgnoredUrl(urlStr, ignoreUrls = []) {
  if (typeof urlStr !== 'string') return false;
  return ignoreUrls.some((pattern) => pattern && urlStr.includes(pattern));
}

/**
 * Builds a sanitized, path-traversal-safe screenshot path strictly inside screenshotDir.
 */
export function buildSafeScreenshotPath(screenshotDir, route, viewportName) {
  const resolvedDir = path.resolve(screenshotDir);
  const safeRoute = String(route || 'root')
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'root';
  const safeVp = String(viewportName || 'default')
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'default';

  const fileName = `fail-${safeRoute}-${safeVp}.png`;
  const resolvedPath = path.resolve(resolvedDir, fileName);
  const rel = path.relative(resolvedDir, resolvedPath);

  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Refused unsafe screenshot path outside ${resolvedDir}`);
  }
  return resolvedPath;
}

function readRequiredFlagValue(argv, index, flagName) {
  const val = argv[index];
  if (val === undefined || val === '' || val.startsWith('-')) {
    throw new Error(`Flag "${flagName}" requires a value.`);
  }
  return val;
}

/**
 * Parses CLI flags cleanly without external dependencies.
 */
export function parseCliArgs(argv) {
  const args = {
    mapPath: null,
    configPath: null,
    feature: null,
    allViewports: false,
    baseUrl: null,
    screenshotDir: '.tmp/verify-screenshots',
    allowRemote: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--map':
        args.mapPath = readRequiredFlagValue(argv, ++i, '--map');
        break;
      case '--config':
        args.configPath = readRequiredFlagValue(argv, ++i, '--config');
        break;
      case '--feature':
        args.feature = readRequiredFlagValue(argv, ++i, '--feature');
        break;
      case '--all-viewports':
        args.allViewports = true;
        break;
      case '--base-url':
        args.baseUrl = readRequiredFlagValue(argv, ++i, '--base-url');
        break;
      case '--screenshot-dir':
        args.screenshotDir = readRequiredFlagValue(argv, ++i, '--screenshot-dir');
        break;
      case '--allow-remote':
        args.allowRemote = true;
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      default:
        if (!token.startsWith('-') && !args.mapPath && !args.configPath) {
          if (token.endsWith('.md')) {
            args.mapPath = token;
          } else {
            args.configPath = token;
          }
        } else {
          throw new Error(`Unknown CLI argument: ${token}`);
        }
        break;
    }
  }

  return args;
}

/**
 * Resolves Playwright from the target workspace cwd first (essential when this script
 * executes from the global symlinked plugin directory), then falls back to ESM import.
 */
export async function loadPlaywright(cwd = process.cwd()) {
  try {
    const localRequire = createRequire(path.join(path.resolve(cwd), '__cf_verify_resolver__.cjs'));
    const mod = localRequire('playwright');
    if (mod?.chromium) return mod;
    if (mod?.default?.chromium) return mod.default;
  } catch {
    // Fall through to standard ESM resolution
  }

  try {
    const mod = await import('playwright');
    if (mod?.chromium) return mod;
    if (mod?.default?.chromium) return mod.default;
    return null;
  } catch {
    return null;
  }
}

function isMissingBrowserBinaryError(err) {
  const msg = String(err?.message ?? err ?? '');
  return (
    msg.includes("Executable doesn't exist") ||
    msg.includes('Please run the following command to download new browsers')
  );
}

function printReport(report) {
  console.log(JSON.stringify(report, null, 2));
}

function printUsage() {
  console.log(`Usage:
  node run-verify-map.mjs --map .memory/feature-map.md [options]
  node run-verify-map.mjs --config .tmp/verify-targets.json [options]

Options:
  --map <path>             Path to .memory/feature-map.md containing \`\`\`json feature-map\`\`\` block
  --config <path>          Path to standalone JSON target config
  --feature <slug>         Filter verification to a single feature slug
  --all-viewports          Run across all viewports (375px, 768px, 1440px)
  --base-url <url>         Override baseUrl from config
  --screenshot-dir <dir>   Directory for failure screenshots (default: .tmp/verify-screenshots)
  --allow-remote           Allow non-localhost baseUrl (disabled by default for safety)
  -h, --help               Show this help message`);
}

export async function runCli(argv = process.argv.slice(2), cwd = process.cwd()) {
  let cli;
  try {
    cli = parseCliArgs(argv);
  } catch (err) {
    printReport({
      schemaVersion: '1.0',
      status: 'CONFIG_ERROR',
      error: err.message,
    });
    return EXIT_CODES.CONFIG_ERROR;
  }

  if (cli.help) {
    printUsage();
    return EXIT_CODES.PASS;
  }

  if (!cli.mapPath && !cli.configPath) {
    const defaultMap = path.resolve(cwd, '.memory/feature-map.md');
    if (fs.existsSync(defaultMap)) {
      cli.mapPath = defaultMap;
    } else {
      printReport({
        schemaVersion: '1.0',
        status: 'CONFIG_ERROR',
        error: 'Provide --map <.memory/feature-map.md> or --config <targets.json>.',
      });
      return EXIT_CODES.CONFIG_ERROR;
    }
  }

  let config;
  try {
    let rawConfig;
    if (cli.mapPath) {
      const resolvedMap = path.resolve(cwd, cli.mapPath);
      if (!fs.existsSync(resolvedMap)) {
        throw new Error(`Feature map not found: ${resolvedMap}`);
      }
      rawConfig = extractFeatureMapJson(fs.readFileSync(resolvedMap, 'utf8'));
    } else {
      const resolvedConfig = path.resolve(cwd, cli.configPath);
      if (!fs.existsSync(resolvedConfig)) {
        throw new Error(`Config file not found: ${resolvedConfig}`);
      }
      rawConfig = JSON.parse(fs.readFileSync(resolvedConfig, 'utf8'));
    }

    config = validateConfig(rawConfig, {
      allowRemote: cli.allowRemote,
      baseUrlOverride: cli.baseUrl,
      allViewports: cli.allViewports,
    });

    if (cli.feature) {
      config.targets = config.targets.filter((t) => t.feature === cli.feature);
      if (config.targets.length === 0) {
        throw new Error(`No targets matched --feature "${cli.feature}".`);
      }
    }
  } catch (err) {
    printReport({
      schemaVersion: '1.0',
      status: 'CONFIG_ERROR',
      error: err.message,
    });
    return EXIT_CODES.CONFIG_ERROR;
  }

  const playwright = await loadPlaywright(cwd);
  if (!playwright || !playwright.chromium) {
    printReport({
      schemaVersion: '1.0',
      status: 'PLAYWRIGHT_UNAVAILABLE',
      baseUrl: config.baseUrl,
      scope: cli.feature ?? 'all',
      error:
        'Playwright is not installed in the current project. Install playwright (with approval) or fall back to the Antigravity browser subagent.',
    });
    return EXIT_CODES.PLAYWRIGHT_UNAVAILABLE;
  }

  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
  } catch (err) {
    if (isMissingBrowserBinaryError(err)) {
      printReport({
        schemaVersion: '1.0',
        status: 'PLAYWRIGHT_UNAVAILABLE',
        baseUrl: config.baseUrl,
        scope: cli.feature ?? 'all',
        error:
          'Playwright Chromium binary is not installed (run `npx playwright install chromium` or fall back to the Antigravity browser subagent).',
      });
      return EXIT_CODES.PLAYWRIGHT_UNAVAILABLE;
    }
    printReport({
      schemaVersion: '1.0',
      status: 'FAIL',
      baseUrl: config.baseUrl,
      scope: cli.feature ?? 'all',
      error: `Failed to launch Chromium: ${err.message}`,
    });
    return EXIT_CODES.VERIFICATION_FAIL;
  }

  const results = [];
  let passedCount = 0;
  let failedCount = 0;

  try {
    const screenshotRoot = path.resolve(cwd, cli.screenshotDir);

    for (const vp of config.viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });

      try {
        const page = await context.newPage();

        for (const target of config.targets) {
          const consoleErrors = [];
          const pageErrors = [];
          const networkErrors = [];
          const missingSelectors = [];
          let httpStatus = null;
          let horizontalOverflowPx = 0;
          let screenshotPath = null;

          const url = new URL(target.route, config.baseUrl).toString();

          const onConsole = (msg) => {
            if (msg.type() === 'error') {
              consoleErrors.push(msg.text());
            }
          };
          const onPageError = (err) => {
            pageErrors.push(err.message);
          };
          const onResponse = (res) => {
            const status = res.status();
            const resUrl = res.url();
            if (isIgnoredUrl(resUrl, config.ignoreUrls)) return;
            // Allow intentional expectedStatus on the target document itself
            if (resUrl === url && status === target.expectedStatus) return;
            if (status >= 400) {
              networkErrors.push(`${res.request().method()} ${resUrl} -> ${status}`);
            }
          };

          page.on('console', onConsole);
          page.on('pageerror', onPageError);
          page.on('response', onResponse);

          try {
            const response = await page.goto(url, {
              waitUntil: target.waitUntil,
              timeout: target.timeoutMs,
            });

            httpStatus = response ? response.status() : null;
            if (httpStatus !== target.expectedStatus) {
              networkErrors.push(
                `GET ${url} -> ${httpStatus ?? 'NO_RESPONSE'} (expected ${target.expectedStatus})`
              );
            }

            if (target.waitForSelector) {
              await page.waitForSelector(target.waitForSelector, {
                state: 'attached',
                timeout: target.timeoutMs,
              });
            }

            for (const selector of target.selectors) {
              const count = await page.locator(selector).count();
              if (count === 0) {
                missingSelectors.push(selector);
              }
            }

            if (target.checkOverflow && httpStatus === target.expectedStatus) {
              horizontalOverflowPx = await page.evaluate(() => {
                const docEl = document.documentElement;
                if (!docEl) return 0;
                const diff = Math.ceil(docEl.scrollWidth - window.innerWidth);
                return diff > 1 ? diff : 0;
              });
            }
          } catch (err) {
            pageErrors.push(`Navigation/Assertion error: ${err.message}`);
          } finally {
            page.off('console', onConsole);
            page.off('pageerror', onPageError);
            page.off('response', onResponse);
          }

          const failed =
            consoleErrors.length > 0 ||
            pageErrors.length > 0 ||
            networkErrors.length > 0 ||
            missingSelectors.length > 0 ||
            horizontalOverflowPx > 0;

          if (failed) {
            failedCount += 1;
            try {
              fs.mkdirSync(screenshotRoot, { recursive: true });
              const outPath = buildSafeScreenshotPath(screenshotRoot, target.route, vp.name);
              await page.screenshot({ path: outPath, fullPage: true });
              screenshotPath = path.relative(cwd, outPath);
            } catch (shotErr) {
              pageErrors.push(`Screenshot capture failed: ${shotErr.message}`);
            }
          } else {
            passedCount += 1;
          }

          results.push({
            feature: target.feature,
            route: target.route,
            viewport: `${vp.name} (${vp.width}x${vp.height})`,
            status: failed ? 'FAIL' : 'PASS',
            httpStatus,
            consoleErrors,
            pageErrors,
            networkErrors,
            missingSelectors,
            horizontalOverflowPx,
            screenshotPath,
          });
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const overallPass = failedCount === 0;
  printReport({
    schemaVersion: '1.0',
    status: overallPass ? 'PASS' : 'FAIL',
    baseUrl: config.baseUrl,
    scope: cli.feature ?? 'all',
    summary: {
      totalChecks: passedCount + failedCount,
      passed: passedCount,
      failed: failedCount,
    },
    results,
  });

  return overallPass ? EXIT_CODES.PASS : EXIT_CODES.VERIFICATION_FAIL;
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
  runCli().then((code) => {
    process.exit(code);
  });
}
