import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  EXIT_CODES,
  buildSafeScreenshotPath,
  extractFeatureMapJson,
  isIgnoredUrl,
  isLocalhostUrl,
  parseCliArgs,
  runCli,
  validateConfig,
} from './run-verify-map.mjs';

const VALID_CONFIG = {
  baseUrl: 'http://localhost:3000',
  healthCheck: '/api/health',
  viewports: [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'desktop', width: 1440, height: 900 },
  ],
  ignoreUrls: ['/favicon.ico'],
  targets: [
    {
      feature: 'home-shell',
      route: '/',
      expectedStatus: 200,
      waitUntil: 'domcontentloaded',
      waitForSelector: '#main-content',
      selectors: ['#main-content'],
      checkOverflow: true,
      timeoutMs: 15000,
    },
  ],
};

describe('extractFeatureMapJson', () => {
  it('extracts valid fenced json feature-map block from Markdown', () => {
    const md = `# Feature Map\n\n\`\`\`json feature-map\n${JSON.stringify(VALID_CONFIG, null, 2)}\n\`\`\`\n`;
    const parsed = extractFeatureMapJson(md);
    assert.equal(parsed.baseUrl, 'http://localhost:3000');
    assert.equal(parsed.targets.length, 1);
  });

  it('throws when fenced block is missing', () => {
    assert.throws(
      () => extractFeatureMapJson('# Feature Map\nNo machine block here.'),
      /Missing fenced/
    );
  });

  it('throws on malformed JSON inside fenced block', () => {
    const md = '```json feature-map\n{ "baseUrl": "http://localhost:3000", }\n```';
    assert.throws(() => extractFeatureMapJson(md), /Invalid JSON/);
  });
});

describe('isLocalhostUrl & validateConfig', () => {
  it('allows localhost and loopback addresses', () => {
    assert.equal(isLocalhostUrl('http://localhost:3000'), true);
    assert.equal(isLocalhostUrl('http://127.0.0.1:8000'), true);
    assert.equal(isLocalhostUrl('https://[::1]:3000'), true);
    assert.equal(isLocalhostUrl('https://example.com'), false);
    assert.equal(isLocalhostUrl('file:///etc/passwd'), false);
  });

  it('rejects remote baseUrl unless allowRemote is true', () => {
    const remote = { ...VALID_CONFIG, baseUrl: 'https://staging.example.com' };
    assert.throws(() => validateConfig(remote), /Refusing non-localhost/);

    const validated = validateConfig(remote, { allowRemote: true });
    assert.equal(validated.baseUrl, 'https://staging.example.com');
  });

  it('rejects invalid feature slugs, non-leading-slash routes, and empty targets', () => {
    assert.throws(
      () => validateConfig({ ...VALID_CONFIG, targets: [] }),
      /non-empty "targets"/
    );
    assert.throws(
      () =>
        validateConfig({
          ...VALID_CONFIG,
          targets: [{ feature: 'Bad Feature!', route: '/' }],
        }),
      /lowercase slug/
    );
    assert.throws(
      () =>
        validateConfig({
          ...VALID_CONFIG,
          targets: [{ feature: 'valid-slug', route: 'no-slash' }],
        }),
      /starting with "\/"/
    );
  });

  it('blocks protocol-relative and backslash SSRF bypasses in route and healthCheck', () => {
    assert.throws(
      () =>
        validateConfig({
          ...VALID_CONFIG,
          targets: [{ feature: 'ssrf-route', route: '//evil.com/steal' }],
        }),
      /protocol-relative or backslash/
    );
    assert.throws(
      () =>
        validateConfig({
          ...VALID_CONFIG,
          targets: [{ feature: 'ssrf-backslash', route: '/\\evil.com/pwn' }],
        }),
      /protocol-relative or backslash/
    );
    assert.throws(
      () =>
        validateConfig({
          ...VALID_CONFIG,
          healthCheck: '//evil.com/health',
        }),
      /protocol-relative or backslash/
    );
  });

  it('rejects invalid waitUntil, expectedStatus, and timeoutMs values', () => {
    assert.throws(
      () =>
        validateConfig({
          ...VALID_CONFIG,
          targets: [{ feature: 'bad-wait', route: '/', waitUntil: 'forever' }],
        }),
      /waitUntil/
    );
    assert.throws(
      () =>
        validateConfig({
          ...VALID_CONFIG,
          targets: [{ feature: 'bad-status', route: '/', expectedStatus: 999 }],
        }),
      /expectedStatus/
    );
    assert.throws(
      () =>
        validateConfig({
          ...VALID_CONFIG,
          targets: [{ feature: 'bad-timeout', route: '/', timeoutMs: 50 }],
        }),
      /timeoutMs/
    );
  });

  it('defaults to desktop viewport unless allViewports is requested', () => {
    const single = validateConfig(VALID_CONFIG, { allViewports: false });
    assert.equal(single.viewports.length, 1);
    assert.equal(single.viewports[0].name, 'desktop');

    const all = validateConfig(VALID_CONFIG, { allViewports: true });
    assert.equal(all.viewports.length, 2);
  });
});

describe('isIgnoredUrl & buildSafeScreenshotPath', () => {
  it('matches ignoreUrls substrings accurately', () => {
    assert.equal(isIgnoredUrl('http://localhost:3000/favicon.ico', ['/favicon.ico']), true);
    assert.equal(isIgnoredUrl('http://localhost:3000/api/courses', ['/favicon.ico']), false);
  });

  it('sanitizes routes and stays strictly inside screenshotDir', () => {
    const dir = path.join(os.tmpdir(), 'cf-verify-shots');
    const out = buildSafeScreenshotPath(dir, '/../../etc/passwd?a=1', 'mobile (375)');
    assert.ok(out.startsWith(`${path.resolve(dir)}${path.sep}`));
    assert.equal(path.basename(out), 'fail-etc_passwd_a_1-mobile_375.png');
  });
});

describe('parseCliArgs & runCli exit codes', () => {
  it('parses flags and positional arguments and rejects missing flag values', () => {
    const parsed = parseCliArgs([
      '--map',
      '.memory/feature-map.md',
      '--feature',
      'home-shell',
      '--all-viewports',
    ]);
    assert.equal(parsed.mapPath, '.memory/feature-map.md');
    assert.equal(parsed.feature, 'home-shell');
    assert.equal(parsed.allViewports, true);

    assert.throws(() => parseCliArgs(['--base-url']), /requires a value/);
    assert.throws(() => parseCliArgs(['--map', '--all-viewports']), /requires a value/);
  });

  it('supports --config mode and rejects remote baseUrl via CLI exit code 2', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-verify-cfg-'));
    try {
      const cfgFile = path.join(tmpDir, 'targets.json');
      fs.writeFileSync(
        cfgFile,
        JSON.stringify({ ...VALID_CONFIG, baseUrl: 'https://remote.example.com' })
      );
      const remoteCode = await runCli(['--config', cfgFile], tmpDir);
      assert.equal(remoteCode, EXIT_CODES.CONFIG_ERROR);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns EXIT_CODES.CONFIG_ERROR (2) for missing map or unknown feature', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-verify-test-'));
    try {
      const missingCode = await runCli(['--map', 'does-not-exist.md'], tmpDir);
      assert.equal(missingCode, EXIT_CODES.CONFIG_ERROR);

      const mapFile = path.join(tmpDir, 'feature-map.md');
      fs.writeFileSync(
        mapFile,
        `# Map\n\`\`\`json feature-map\n${JSON.stringify(VALID_CONFIG)}\n\`\`\`\n`
      );
      const unknownFeatureCode = await runCli(
        ['--map', mapFile, '--feature', 'nonexistent'],
        tmpDir
      );
      assert.equal(unknownFeatureCode, EXIT_CODES.CONFIG_ERROR);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns EXIT_CODES.PLAYWRIGHT_UNAVAILABLE (3) when playwright is not installed in cwd', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-verify-nopw-'));
    try {
      const mapFile = path.join(tmpDir, 'feature-map.md');
      fs.writeFileSync(
        mapFile,
        `# Map\n\`\`\`json feature-map\n${JSON.stringify(VALID_CONFIG)}\n\`\`\`\n`
      );
      const code = await runCli(['--map', mapFile], tmpDir);
      assert.equal(code, EXIT_CODES.PLAYWRIGHT_UNAVAILABLE);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
