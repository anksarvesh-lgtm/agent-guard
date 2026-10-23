import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildRepoBrief } from '../src/brief/build.js';
import { isSensitiveOrIgnored } from '../src/brief/sanitize.js';
import { parseBriefHeader } from '../src/brief/stale.js';

describe('repo_brief generator and safety guards', () => {
  const testDir = path.join(os.tmpdir(), `agent-guard-brief-test-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, '.git'));
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('filters sensitive files and build artifacts', () => {
    expect(isSensitiveOrIgnored('.env')).toBe(true);
    expect(isSensitiveOrIgnored('.env.local')).toBe(true);
    expect(isSensitiveOrIgnored('.env.production')).toBe(true);
    expect(isSensitiveOrIgnored('server.key')).toBe(true);
    expect(isSensitiveOrIgnored('cert.pem')).toBe(true);
    expect(isSensitiveOrIgnored('credentials')).toBe(true);
    expect(isSensitiveOrIgnored('secrets')).toBe(true);
    expect(isSensitiveOrIgnored('node_modules/express/index.js')).toBe(true);
    expect(isSensitiveOrIgnored('dist/bundle.js')).toBe(true);

    expect(isSensitiveOrIgnored('src/index.ts')).toBe(false);
    expect(isSensitiveOrIgnored('package.json')).toBe(false);
    expect(isSensitiveOrIgnored('README.md')).toBe(false);
  });

  it('generates brief containing README and package info', () => {
    fs.writeFileSync(
      path.join(testDir, 'README.md'),
      '# Sample App\n\nThis is a sample application for testing brief generation.\n\nMore details.'
    );

    fs.writeFileSync(
      path.join(testDir, 'package.json'),
      JSON.stringify({
        name: 'sample-project',
        dependencies: { express: '^4.18.2' },
        scripts: { test: 'vitest', build: 'tsc' },
      })
    );

    const brief = buildRepoBrief(testDir);
    expect(brief).toContain('# Project Brief');
    expect(brief).toContain('This is a sample application');
    expect(brief).toContain('Node.js / JavaScript/TypeScript');
    expect(brief).toContain('npm run test');

    const header = parseBriefHeader(brief);
    expect(header).not.toBeNull();
    expect(header?.commit).toBeDefined();
    expect(header?.hash).toBeDefined();
  });

  it('strictly caps brief output to 8,000 characters', () => {
    // Write a huge README
    const largeText = 'A'.repeat(10000);
    fs.writeFileSync(path.join(testDir, 'README.md'), largeText);

    const brief = buildRepoBrief(testDir);
    expect(brief.length).toBeLessThanOrEqual(8000);
  });
});
