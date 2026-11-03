import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { checkForUpdates, performUpdate, maybeBackgroundUpdate, autoUpdateOnStartup, isVersionNewer, OFFICIAL_REPO_URL } from '../src/update.js';
import { execSync } from 'node:child_process';

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
  }, 15000);

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

  it('handles autoUpdateOnStartup safely on non-git directory', () => {
    let logMsg = '';
    const res = autoUpdateOnStartup(tempDir, (msg) => { logMsg = msg; });
    expect(res).toBeNull();
  });

  it('correctly compares semantic versions for incoming updates', () => {
    expect(isVersionNewer('0.2.22', '0.2.21')).toBe(true);
    expect(isVersionNewer('v0.2.22', 'v0.2.21')).toBe(true);
    expect(isVersionNewer('0.3.0', '0.2.22')).toBe(true);
    expect(isVersionNewer('1.0.0', '0.2.22')).toBe(true);
    expect(isVersionNewer('0.2.21', '0.2.22')).toBe(false);
    expect(isVersionNewer('0.2.22', '0.2.22')).toBe(false);
  });

  it('self-heals outdated or legacy anksarvash-prog git remotes to official anksarvesh-lgtm URL', () => {
    // Initialize temporary git repo
    execSync('git init --quiet', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git remote add origin https://github.com/anksarvash-prog/agent-guard.git', { cwd: tempDir, stdio: 'ignore' });
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test\n');
    execSync('git add . && git commit -m "initial" --quiet', { cwd: tempDir, stdio: 'ignore' });

    // Run checkForUpdates which should self-heal the remote
    checkForUpdates(tempDir);

    const healedUrl = execSync('git remote get-url origin', { cwd: tempDir, encoding: 'utf-8' }).trim();
    expect(healedUrl).toBe(OFFICIAL_REPO_URL);
  });
});
