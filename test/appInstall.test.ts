import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  ALL_APP_TARGETS,
  detectInstalledApps,
  installToApps,
  antigravityTarget,
  claudeTarget,
  codexTarget,
  cursorTarget,
  windsurfTarget,
  clineTarget,
  zedTarget,
  type InstallContext
} from '../src/install/apps.js';

describe('Universal Multi-App MCP Installer', () => {
  let tempDir: string;
  let dummyContext: InstallContext;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-guard-apps-test-'));
    dummyContext = {
      nodeBin: '/usr/local/bin/node',
      serverPath: '/repo/dist/index.js',
      hookPath: '/repo/dist/hook/stop-hook.js',
      enforceHookPath: '/repo/dist/hook/post-invocation-hook.js',
      repoRoot: tempDir,
      dryRun: false,
    };
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('registers all 7 major coding applications in ALL_APP_TARGETS', () => {
    const ids = ALL_APP_TARGETS.map((t) => t.id);
    expect(ids).toContain('antigravity');
    expect(ids).toContain('claude');
    expect(ids).toContain('codex');
    expect(ids).toContain('cursor');
    expect(ids).toContain('windsurf');
    expect(ids).toContain('cline');
    expect(ids).toContain('zed');
  });

  it('detects installed applications on the current system', () => {
    const detected = detectInstalledApps();
    expect(Array.isArray(detected)).toBe(true);
    // On this machine with ~/.gemini, antigravity must be detected
    const hasAntigravity = detected.some((a) => a.id === 'antigravity');
    expect(hasAntigravity).toBe(true);
  });

  it('installs to specific target applications', () => {
    const results = installToApps(['antigravity'], dummyContext);
    expect(results.length).toBe(1);
    expect(results[0].appId).toBe('antigravity');
    expect(results[0].installed).toBe(true);
  });

  it('installs to all targets when targetIds is "all"', () => {
    const dryContext = { ...dummyContext, dryRun: true };
    const results = installToApps('all', dryContext);
    expect(results.length).toBe(ALL_APP_TARGETS.length);
    for (const r of results) {
      expect(r.installed).toBe(true);
    }
  });

  it('installs with "auto" detection fallback', () => {
    const dryContext = { ...dummyContext, dryRun: true };
    const results = installToApps('auto', dryContext);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('respects dryRun without throwing or failing', () => {
    const dryContext = { ...dummyContext, dryRun: true };
    const res = claudeTarget.install(dryContext);
    expect(res.installed).toBe(true);
    expect(res.appId).toBe('claude');

    const resZed = zedTarget.install(dryContext);
    expect(resZed.installed).toBe(true);
    expect(resZed.appId).toBe('zed');

    const resCursor = cursorTarget.install(dryContext);
    expect(resCursor.installed).toBe(true);
    expect(resCursor.appId).toBe('cursor');

    const resCline = clineTarget.install(dryContext);
    expect(resCline.installed).toBe(true);
    expect(resCline.appId).toBe('cline');

    const resCodex = codexTarget.install(dryContext);
    expect(resCodex.installed).toBe(true);
    expect(resCodex.appId).toBe('codex');

    const resWindsurf = windsurfTarget.install(dryContext);
    expect(resWindsurf.installed).toBe(true);
    expect(resWindsurf.appId).toBe('windsurf');
  });
});
