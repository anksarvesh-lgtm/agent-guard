import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { AccountManager, globalAccountManager, setGlobalAccountManager } from '../src/accounts/manager.js';
import { handleAccountSwitcher } from '../src/tools/accountSwitcher.js';

describe('Antigravity Account Switcher & 1% Auto-Rotator', () => {
  let tempDir: string;
  let manager: AccountManager;
  let originalGlobalManager: AccountManager;
  const originalEnvHome = process.env.AGENT_GUARD_HOME;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-guard-acc-test-'));
    process.env.AGENT_GUARD_HOME = tempDir;

    // Create fake live Antigravity token
    const geminiDir = path.join(tempDir, '.gemini');
    fs.mkdirSync(geminiDir, { recursive: true });
    fs.writeFileSync(path.join(geminiDir, 'jetski-standalone-oauth-token'), JSON.stringify({ token: 'live-primary-token-123' }), 'utf-8');

    manager = new AccountManager(tempDir);
    originalGlobalManager = globalAccountManager;
    setGlobalAccountManager(manager);
  });

  afterEach(() => {
    setGlobalAccountManager(originalGlobalManager);
    if (originalEnvHome !== undefined) {
      process.env.AGENT_GUARD_HOME = originalEnvHome;
    } else {
      delete process.env.AGENT_GUARD_HOME;
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('initializes default pool preserving existing Antigravity live token as primary', () => {
    const accounts = manager.listAccounts();
    expect(accounts.length).toBe(1);
    expect(accounts[0].id).toBe('primary');
    expect(accounts[0].isActive).toBe(true);
    expect(accounts[0].remainingPercent).toBe(100);

    const cfg = manager.getConfig();
    expect(cfg.autoRotateEnabled).toBe(true);
    expect(cfg.thresholdPercent).toBe(1.0);
  });

  it('adds backup account to the pool', () => {
    const res = manager.addAccount({
      id: 'backup-1',
      name: 'Backup Account 1',
      provider: 'antigravity',
      tokenContent: JSON.stringify({ token: 'backup-token-456' }),
    });

    expect(res.success).toBe(true);
    const accounts = manager.listAccounts();
    expect(accounts.length).toBe(2);
    expect(accounts.some((a) => a.id === 'backup-1')).toBe(true);
  });

  it('switches accounts seamlessly and updates live jetski token file', () => {
    manager.addAccount({
      id: 'backup-1',
      name: 'Backup Account 1',
      tokenContent: JSON.stringify({ token: 'backup-token-456' }),
    });

    const switchRes = manager.switchAccount('backup-1', 'Testing manual switch');
    expect(switchRes.success).toBe(true);
    expect(switchRes.currentAccountId).toBe('backup-1');
    expect(switchRes.previousAccountId).toBe('primary');
    expect(switchRes.nonDisruptive).toBe(true);

    // Verify live token was replaced with backup token content
    const liveTokenPath = path.join(tempDir, '.gemini', 'jetski-standalone-oauth-token');
    const liveContent = JSON.parse(fs.readFileSync(liveTokenPath, 'utf-8'));
    expect(liveContent.token).toBe('backup-token-456');

    const active = manager.getActiveAccount();
    expect(active?.id).toBe('backup-1');
    expect(active?.isActive).toBe(true);
  }, 25000);

  it('triggers auto-rotation automatically when remaining quota reaches 1%', () => {
    manager.addAccount({
      id: 'backup-1',
      name: 'Backup Account 1',
      tokenContent: JSON.stringify({ token: 'backup-token-456' }),
    });

    // Case 1: Quota above 1% threshold -> does NOT rotate
    const checkHigh = manager.checkAndAutoRotate(5.0);
    expect(checkHigh.triggered).toBe(false);
    expect(manager.getActiveAccount()?.id).toBe('primary');

    // Case 2: Quota drops to <= 1.0% -> AUTOMATICALLY rotates to backup account!
    const checkLow = manager.checkAndAutoRotate(0.9, 'Quota critically low');
    expect(checkLow.triggered).toBe(true);
    expect(checkLow.switchResult?.success).toBe(true);
    expect(checkLow.switchResult?.currentAccountId).toBe('backup-1');
    expect(manager.getActiveAccount()?.id).toBe('backup-1');

    // Live token file must now hold backup-1 token
    const liveTokenPath = path.join(tempDir, '.gemini', 'jetski-standalone-oauth-token');
    const liveContent = JSON.parse(fs.readFileSync(liveTokenPath, 'utf-8'));
    expect(liveContent.token).toBe('backup-token-456');
  });

  it('respects auto-rotate configuration changes', () => {
    manager.setAutoRotateConfig(false, 0.5);
    const cfg = manager.getConfig();
    expect(cfg.autoRotateEnabled).toBe(false);
    expect(cfg.thresholdPercent).toBe(0.5);

    // When disabled, dropping to 0.1% does NOT trigger
    const res = manager.checkAndAutoRotate(0.1);
    expect(res.triggered).toBe(false);
  });

  describe('handleAccountSwitcher MCP Tool', () => {
    it('executes status and list actions returning structured markdown', () => {
      const statusOutput = handleAccountSwitcher({ action: 'status' });
      expect(statusOutput).toContain('Antigravity Account Switcher Status');
      expect(statusOutput).toContain('Primary Antigravity Account');
      expect(statusOutput).toContain('Auto-Switch at 1%');

      const listOutput = handleAccountSwitcher({ action: 'list' });
      expect(listOutput).toContain('Registered Account Pool');
      expect(listOutput).toContain('primary');
    });

    it('executes add and switch actions through MCP tool interface', () => {
      const addOutput = handleAccountSwitcher({
        action: 'add',
        account_id: 'tool-backup',
        name: 'Tool Backup Account',
        token_content: JSON.stringify({ token: 'tool-token-789' }),
      });
      expect(addOutput).toContain('added to pool');

      const switchOutput = handleAccountSwitcher({
        action: 'switch',
        account_id: 'tool-backup',
      });
      expect(switchOutput).toContain('Account Switched Successfully');
      expect(switchOutput).toContain('Tool Backup Account');
    });

    it('configures auto-rotate threshold via MCP tool', () => {
      const configOutput = handleAccountSwitcher({
        action: 'configure',
        enabled: true,
        threshold_percent: 2.5,
      });
      expect(configOutput).toContain('Auto-rotate is ENABLED with threshold <= 2.5%');
    });

    it('snapshots active session and removes account via MCP tool', () => {
      const snapOutput = handleAccountSwitcher({
        action: 'snapshot',
        account_id: 'tool-snapshot',
        name: 'MCP Snapshot Account',
      });
      expect(snapOutput).toContain('Active Session Snapshot Saved');
      expect(snapOutput).toContain('tool-snapshot');

      // Remove an account
      const removeOutput = handleAccountSwitcher({
        action: 'remove',
        account_id: 'tool-snapshot',
      });
      expect(removeOutput).toContain('removed from pool');
    });

    it('validates required fields on add and remove actions', () => {
      const missingAddId = handleAccountSwitcher({
        action: 'add',
      });
      expect(missingAddId).toContain('account_id');

      const missingRemoveId = handleAccountSwitcher({
        action: 'remove',
      });
      expect(missingRemoveId).toContain('account_id');

      const nonExistentFile = handleAccountSwitcher({
        action: 'add',
        account_id: 'bad-file-acc',
        token_source_file: '/non/existent/path/token.json',
      });
      expect(nonExistentFile).toContain('not found');
    });

    it('returns failover proxy instructions on proxy action', () => {
      const output = handleAccountSwitcher({
        action: 'failover_proxy',
      });
      expect(output).toContain('Antigravity Seamless HTTP 429 Failover Proxy');
      expect(output).toContain('Transparent In-Memory Replay');
      expect(output).toContain('Intra-Account Model Fallback');
    });
  });
});
