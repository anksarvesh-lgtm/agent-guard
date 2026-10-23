import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveProjectPath, getAgentDir, getLedgerPath } from '../src/util/paths.js';

describe('paths.ts security & isolation tests', () => {
  const testDir = path.join(os.tmpdir(), `agent-guard-paths-test-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('rejects path without .git or .agent folder', () => {
    expect(() => resolveProjectPath(testDir)).toThrowError('BAD_PROJECT_PATH');
  });

  it('accepts directory containing .git folder', () => {
    fs.mkdirSync(path.join(testDir, '.git'));
    const resolved = resolveProjectPath(testDir);
    expect(resolved).toBe(fs.realpathSync(testDir));
  });

  it('accepts directory containing existing .agent folder', () => {
    fs.mkdirSync(path.join(testDir, '.agent'));
    const resolved = resolveProjectPath(testDir);
    expect(resolved).toBe(fs.realpathSync(testDir));
  });

  it('rejects user home directory', () => {
    expect(() => resolveProjectPath(os.homedir())).toThrowError(
      'Project path cannot be your home directory'
    );
  });

  it('rejects root filesystem', () => {
    const root = path.parse(process.cwd()).root;
    expect(() => resolveProjectPath(root)).toThrowError('BAD_PROJECT_PATH');
  });

  it('rejects system directories', () => {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      expect(() => resolveProjectPath('/usr')).toThrowError('system folder');
      expect(() => resolveProjectPath('/bin')).toThrowError('system folder');
    } else if (process.platform === 'win32') {
      expect(() => resolveProjectPath('C:\\Windows')).toThrowError('system folder');
    }
  });

  it('rejects non-existent directory', () => {
    const nonExistent = path.join(testDir, 'does-not-exist');
    expect(() => resolveProjectPath(nonExistent)).toThrowError('does not exist');
  });

  it('correctly creates and resolves .agent subpaths', () => {
    fs.mkdirSync(path.join(testDir, '.git'));
    const agentDir = getAgentDir(testDir);
    expect(fs.existsSync(agentDir)).toBe(true);
    expect(getLedgerPath(testDir)).toBe(path.join(agentDir, 'ledger.json'));
  });
});
