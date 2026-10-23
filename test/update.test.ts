import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { checkForUpdates, performUpdate, maybeBackgroundUpdate } from '../src/update.js';

describe('Auto-Update Engine', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-guard-update-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('reports non-git directory appropriately', () => {
    const res = checkForUpdates(tempDir);
    expect(res.isGit).toBe(false);
    expect(res.hasUpdate).toBe(false);
    expect(res.error).toBe('Not a git repository');
  });

  it('fails performUpdate gracefully on non-git directory', () => {
    const res = performUpdate(tempDir);
    expect(res.success).toBe(false);
    expect(res.updated).toBe(false);
    expect(res.message).toContain('not a git clone');
  });

  it('inspects current git repo without crashing', () => {
    const res = checkForUpdates();
    expect(res.isGit).toBe(true);
    expect(typeof res.hasUpdate).toBe('boolean');
    if (res.currentSha) {
      expect(res.currentSha).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it('debounces background update check within 1 hour', () => {
    const markerDir = path.join(tempDir, '.agent');
    const markerFile = path.join(markerDir, 'update_state.json');

    maybeBackgroundUpdate(tempDir);

    expect(fs.existsSync(markerFile)).toBe(true);
    const state1 = JSON.parse(fs.readFileSync(markerFile, 'utf-8'));
    expect(typeof state1.last_check).toBe('number');

    // Calling immediately again should not throw and keep debounce
    maybeBackgroundUpdate(tempDir);
    const state2 = JSON.parse(fs.readFileSync(markerFile, 'utf-8'));
    expect(state2.last_check).toBe(state1.last_check);
  });
});
