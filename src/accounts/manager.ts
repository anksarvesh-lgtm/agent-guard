import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  AccountProfile,
  AccountPoolConfig,
  SwitchResult,
  AutoRotateCheckResult,
  RotationStrategy,
  AccountProvider,
  AccountAuthType,
  StockAuthCache
} from './types.js';
import {
  getStateDbPath,
  readStateDbCredentials,
  writeStateDbCredentials,
  StateDbCredentials
} from './stateDb.js';
import { getLiveQuotaSummarySync } from '../tokens/liveQuota.js';

export function getAccountsHome(): string {
  return process.env.AGENT_GUARD_HOME || os.homedir();
}

export function maskSecret(secret?: string): string {
  if (!secret || secret.length <= 8) return '****';
  return secret.slice(0, 4) + '...' + secret.slice(-4);
}

export class AccountManager {
  private baseDir: string;
  private configPath: string;
  private tokensDir: string;
  private liveTokenPath: string;
  private logPath: string;

  constructor(customBaseDir?: string) {
    const home = customBaseDir || getAccountsHome();
    this.baseDir = path.join(home, '.gemini', 'accounts');
    this.configPath = path.join(this.baseDir, 'accounts.json');
    this.tokensDir = path.join(this.baseDir, 'tokens');
    this.liveTokenPath = path.join(home, '.gemini', 'jetski-standalone-oauth-token');
    this.logPath = path.join(this.baseDir, 'rotation.log');

    this.ensureStorage();
    this.initDefaultPool();
  }

  private ensureStorage(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
      if (process.platform !== 'win32') {
        try { fs.chmodSync(this.baseDir, 0o700); } catch {}
      }
    }
    if (!fs.existsSync(this.tokensDir)) {
      fs.mkdirSync(this.tokensDir, { recursive: true });
      if (process.platform !== 'win32') {
        try { fs.chmodSync(this.tokensDir, 0o700); } catch {}
      }
    }
  }

  private initDefaultPool(): void {
    if (fs.existsSync(this.configPath)) return;

    const now = new Date().toISOString();
    const primaryTokenPath = path.join(this.tokensDir, 'primary.token');

    // If live Antigravity OAuth token exists, preserve as primary profile
    if (fs.existsSync(this.liveTokenPath) && !fs.existsSync(primaryTokenPath)) {
      try {
        fs.copyFileSync(this.liveTokenPath, primaryTokenPath);
        if (process.platform !== 'win32') {
          try { fs.chmodSync(primaryTokenPath, 0o600); } catch {}
        }
      } catch {}
    }

    const stateDb = getStateDbPath(path.dirname(path.dirname(this.baseDir)));
    const primaryStatePath = path.join(this.tokensDir, 'primary.state.json');
    if (stateDb && fs.existsSync(stateDb) && !fs.existsSync(primaryStatePath)) {
      try {
        const creds = readStateDbCredentials(stateDb);
        if (creds.oauthToken || creds.userStatus) {
          fs.writeFileSync(primaryStatePath, JSON.stringify(creds, null, 2), 'utf-8');
        }
      } catch {}
    }

    const defaultAccount: AccountProfile = {
      id: 'primary',
      name: 'Primary Antigravity Account',
      provider: 'antigravity',
      type: 'oauth_token',
      tokenFilePath: primaryTokenPath,
      isActive: true,
      usedTokens: 0,
      remainingPercent: 100,
      status: 'active',
      priority: 1,
      createdAt: now,
      lastUsedAt: now,
      requestCount: 0,
      errorCount: 0,
    };

    const initialConfig: AccountPoolConfig = {
      version: 1,
      autoRotateEnabled: true,
      thresholdPercent: 1.0, // Rotate when remaining <= 1%
      activeAccountId: 'primary',
      rotationStrategy: 'round_robin',
      accounts: [defaultAccount],
    };

    this.saveConfig(initialConfig);
  }

  private loadConfig(): AccountPoolConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch {}

    return {
      version: 1,
      autoRotateEnabled: true,
      thresholdPercent: 1.0,
      activeAccountId: 'primary',
      rotationStrategy: 'round_robin',
      accounts: [],
    };
  }

  private saveConfig(config: AccountPoolConfig): void {
    const raw = JSON.stringify(config, null, 2) + '\n';
    fs.writeFileSync(this.configPath, raw, 'utf-8');
    if (process.platform !== 'win32') {
      try { fs.chmodSync(this.configPath, 0o600); } catch {}
    }
  }

  private logRotation(msg: string): void {
    try {
      const line = `[${new Date().toISOString()}] ${msg}\n`;
      fs.appendFileSync(this.logPath, line, 'utf-8');
    } catch {}
  }

  public getConfig(): AccountPoolConfig {
    return this.loadConfig();
  }

  public listAccounts(): AccountProfile[] {
    const cfg = this.loadConfig();
    return cfg.accounts.map((acc) => ({
      ...acc,
      apiKeyMasked: acc.apiKeyMasked ? maskSecret(acc.apiKeyMasked) : undefined,
    }));
  }

  public getActiveAccount(): AccountProfile | null {
    const cfg = this.loadConfig();
    const active = cfg.accounts.find((a) => a.id === cfg.activeAccountId) || cfg.accounts[0] || null;
    if (active && active.provider === 'antigravity') {
      try {
        const live = getLiveQuotaSummarySync();
        if (live.isReachable) {
          active.remainingPercent = live.lowestRemainingPercent;
        }
      } catch {}
    }
    return active;
  }

  public addAccount(options: {
    id: string;
    name: string;
    provider?: AccountProvider;
    type?: AccountAuthType;
    tokenContent?: string;
    tokenSourceFile?: string;
    apiKey?: string;
    priority?: number;
  }): { success: boolean; message: string; account?: AccountProfile } {
    const cfg = this.loadConfig();
    const cleanId = options.id.toLowerCase().replace(/[^a-z0-9-_]/g, '-');

    if (cfg.accounts.some((a) => a.id === cleanId)) {
      return { success: false, message: `Account ID "${cleanId}" already exists.` };
    }

    const now = new Date().toISOString();
    const provider = options.provider || 'antigravity';
    const type = options.type || (options.apiKey ? 'api_key' : 'oauth_token');
    let savedTokenPath: string | undefined;

    if (type === 'oauth_token') {
      savedTokenPath = path.join(this.tokensDir, `${cleanId}.token`);
      if (options.tokenContent) {
        fs.writeFileSync(savedTokenPath, options.tokenContent, 'utf-8');
      } else if (options.tokenSourceFile && fs.existsSync(options.tokenSourceFile)) {
        fs.copyFileSync(options.tokenSourceFile, savedTokenPath);
      } else if (fs.existsSync(this.liveTokenPath)) {
        fs.copyFileSync(this.liveTokenPath, savedTokenPath);
      } else {
        fs.writeFileSync(savedTokenPath, JSON.stringify({ placeholder: true }), 'utf-8');
      }
      if (process.platform !== 'win32') {
        try { fs.chmodSync(savedTokenPath, 0o600); } catch {}
      }
    }

    const newAccount: AccountProfile = {
      id: cleanId,
      name: options.name || cleanId,
      provider,
      type,
      tokenFilePath: savedTokenPath,
      apiKeyMasked: options.apiKey ? maskSecret(options.apiKey) : undefined,
      isActive: cfg.accounts.length === 0,
      usedTokens: 0,
      remainingPercent: 100,
      status: cfg.accounts.length === 0 ? 'active' : 'standby',
      priority: options.priority || cfg.accounts.length + 1,
      createdAt: now,
      requestCount: 0,
      errorCount: 0,
    };

    cfg.accounts.push(newAccount);
    if (cfg.accounts.length === 1) {
      cfg.activeAccountId = newAccount.id;
    }

    this.saveConfig(cfg);
    this.logRotation(`Account added: ${newAccount.id} (${newAccount.name})`);

    return {
      success: true,
      message: `Account "${newAccount.name}" (${newAccount.id}) added to pool. Total accounts: ${cfg.accounts.length}.`,
      account: newAccount,
    };
  }

  /**
   * Captures the currently active Antigravity IDE / CLI session credentials into the account pool.
   * Backups both ~/.gemini/jetski-standalone-oauth-token and SQLite state.vscdb credentials.
   */
  public snapshotActiveSession(
    id?: string,
    name?: string
  ): { success: boolean; message: string; account?: AccountProfile } {
    const cfg = this.loadConfig();
    const live = getLiveQuotaSummarySync(true);

    const generatedId = id
      ? id.toLowerCase().replace(/[^a-z0-9-_]/g, '-')
      : live.userEmail
        ? live.userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9-_]/g, '-')
        : `session-${Date.now().toString().slice(-4)}`;

    const displayName = name || (live.userName ? `${live.userName} (${live.userEmail || generatedId})` : `Active Session (${generatedId})`);

    const tokenFile = path.join(this.tokensDir, `${generatedId}.token`);
    const stateFile = path.join(this.tokensDir, `${generatedId}.state.json`);

    // 1. Copy live jetski token
    if (fs.existsSync(this.liveTokenPath)) {
      try {
        fs.copyFileSync(this.liveTokenPath, tokenFile);
        if (process.platform !== 'win32') {
          try { fs.chmodSync(tokenFile, 0o600); } catch {}
        }
      } catch (err: any) {
        return { success: false, message: `Failed to copy live token: ${err.message}` };
      }
    } else {
      return { success: false, message: `Live token file not found at ${this.liveTokenPath}` };
    }

    // 2. Capture state.vscdb credentials
    const stateDb = getStateDbPath(path.dirname(path.dirname(this.baseDir)));
    if (stateDb && fs.existsSync(stateDb)) {
      try {
        const creds = readStateDbCredentials(stateDb);
        if (creds.oauthToken || creds.userStatus) {
          fs.writeFileSync(stateFile, JSON.stringify(creds, null, 2), 'utf-8');
        }
      } catch {}
    }

    const now = new Date().toISOString();
    const existingIdx = cfg.accounts.findIndex((a) => a.id === generatedId);
    let targetAccount: AccountProfile;

    if (existingIdx !== -1) {
      targetAccount = {
        ...cfg.accounts[existingIdx],
        name: displayName,
        tokenFilePath: tokenFile,
        remainingPercent: live.isReachable ? live.lowestRemainingPercent : cfg.accounts[existingIdx].remainingPercent,
        lastUsedAt: now,
      };
      cfg.accounts[existingIdx] = targetAccount;
    } else {
      targetAccount = {
        id: generatedId,
        name: displayName,
        provider: 'antigravity',
        type: 'oauth_token',
        tokenFilePath: tokenFile,
        isActive: cfg.accounts.length === 0,
        usedTokens: 0,
        remainingPercent: live.isReachable ? live.lowestRemainingPercent : 100,
        status: cfg.accounts.length === 0 ? 'active' : 'standby',
        priority: cfg.accounts.length + 1,
        createdAt: now,
        lastUsedAt: now,
        requestCount: 0,
        errorCount: 0,
      };
      cfg.accounts.push(targetAccount);
    }

    if (cfg.accounts.length === 1) {
      cfg.activeAccountId = targetAccount.id;
    }

    this.saveConfig(cfg);
    this.logRotation(`Snapshot active session captured: "${targetAccount.name}" (${targetAccount.id})`);

    return {
      success: true,
      message: `Active session snapshot saved as "${targetAccount.name}" (${targetAccount.id}). Total accounts in pool: ${cfg.accounts.length}.`,
      account: targetAccount,
    };
  }

  /**
   * Imports stock auth credentials and session caches from Antigravity IDE / CLI or other coding apps.
   * Automatically captures both jetski-standalone-oauth-token and SQLite state.vscdb entries,
   * generates an auth cache bundle, and registers the account profile.
   */
  public importStockAuth(options?: {
    id?: string;
    name?: string;
    sourceApp?: 'antigravity' | 'vscode' | 'cursor' | 'windsurf' | 'other';
  }): { success: boolean; message: string; account?: AccountProfile } {
    const live = getLiveQuotaSummarySync(true);
    const sourceApp = options?.sourceApp || 'antigravity';

    // 1. Read live token content if available
    let liveTokenContent: string | undefined;
    if (fs.existsSync(this.liveTokenPath)) {
      try {
        liveTokenContent = fs.readFileSync(this.liveTokenPath, 'utf-8');
      } catch {}
    }

    // 2. Read state.vscdb credentials
    const stateDb = getStateDbPath(path.dirname(path.dirname(this.baseDir)));
    let creds: StateDbCredentials | undefined;
    if (stateDb && fs.existsSync(stateDb)) {
      try {
        creds = readStateDbCredentials(stateDb);
      } catch {}
    }

    if (!liveTokenContent && (!creds || !creds.oauthToken)) {
      return {
        success: false,
        message: 'No active stock auth session or tokens found to import.',
      };
    }

    const email = live.userEmail || (creds?.userStatus?.includes('@') ? 'user@antigravity' : undefined);
    const cleanId = options?.id
      ? options.id.toLowerCase().replace(/[^a-z0-9-_]/g, '-')
      : email
        ? email.split('@')[0].toLowerCase().replace(/[^a-z0-9-_]/g, '-')
        : `auth-${Date.now().toString().slice(-4)}`;

    const displayName = options?.name || (live.userName ? `${live.userName} (${email || cleanId})` : `Stock Auth (${cleanId})`);

    const tokenFile = path.join(this.tokensDir, `${cleanId}.token`);
    const cacheFile = path.join(this.tokensDir, `${cleanId}.auth-cache.json`);
    const stateFile = path.join(this.tokensDir, `${cleanId}.state.json`);

    if (liveTokenContent) {
      try {
        fs.writeFileSync(tokenFile, liveTokenContent, 'utf-8');
        if (process.platform !== 'win32') {
          try { fs.chmodSync(tokenFile, 0o600); } catch {}
        }
      } catch {}
    }

    if (creds && (creds.oauthToken || creds.userStatus)) {
      try {
        fs.writeFileSync(stateFile, JSON.stringify(creds, null, 2), 'utf-8');
      } catch {}
    }

    const authCache: StockAuthCache = {
      id: cleanId,
      name: displayName,
      email,
      provider: 'antigravity',
      tokenJson: liveTokenContent,
      stateDb: creds,
      savedAt: new Date().toISOString(),
      sourceApp,
      profileUrl: creds?.profileUrl,
    };

    try {
      fs.writeFileSync(cacheFile, JSON.stringify(authCache, null, 2), 'utf-8');
      if (process.platform !== 'win32') {
        try { fs.chmodSync(cacheFile, 0o600); } catch {}
      }
    } catch {}

    const cfg = this.loadConfig();
    const existingIdx = cfg.accounts.findIndex((a) => a.id === cleanId);
    let targetAccount: AccountProfile;

    const now = new Date().toISOString();
    if (existingIdx !== -1) {
      targetAccount = {
        ...cfg.accounts[existingIdx],
        name: displayName,
        email,
        tokenFilePath: tokenFile,
        authCachePath: cacheFile,
        remainingPercent: live.isReachable ? live.lowestRemainingPercent : cfg.accounts[existingIdx].remainingPercent,
        lastUsedAt: now,
      };
      cfg.accounts[existingIdx] = targetAccount;
    } else {
      targetAccount = {
        id: cleanId,
        name: displayName,
        email,
        provider: 'antigravity',
        type: 'oauth_token',
        tokenFilePath: tokenFile,
        authCachePath: cacheFile,
        isActive: cfg.accounts.length === 0,
        usedTokens: 0,
        remainingPercent: live.isReachable ? live.lowestRemainingPercent : 100,
        status: cfg.accounts.length === 0 ? 'active' : 'standby',
        priority: cfg.accounts.length + 1,
        createdAt: now,
        lastUsedAt: now,
        requestCount: 0,
        errorCount: 0,
      };
      cfg.accounts.push(targetAccount);
    }

    if (cfg.accounts.length === 1) {
      cfg.activeAccountId = targetAccount.id;
    }

    this.saveConfig(cfg);
    this.logRotation(`Stock auth session imported and cached: "${targetAccount.name}" (${targetAccount.id})`);

    return {
      success: true,
      message: `Stock auth session cached as "${targetAccount.name}" (${targetAccount.id}) with both token and state.vscdb entries preserved.`,
      account: targetAccount,
    };
  }

  /**
   * Imports an account credentials token file from disk.
   */
  public importAccountFile(
    filePath: string,
    id?: string,
    name?: string
  ): { success: boolean; message: string; account?: AccountProfile } {
    if (!fs.existsSync(filePath)) {
      return { success: false, message: `File not found at: ${filePath}` };
    }
    const filename = path.basename(filePath, path.extname(filePath));
    const cleanId = (id || filename).toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.addAccount({
      id: cleanId,
      name: name || cleanId,
      tokenContent: content,
      tokenSourceFile: filePath,
    });
  }

  public removeAccount(id: string): { success: boolean; message: string } {
    const cfg = this.loadConfig();
    const idx = cfg.accounts.findIndex((a) => a.id === id);
    if (idx === -1) {
      return { success: false, message: `Account "${id}" not found.` };
    }

    if (cfg.accounts.length === 1) {
      return { success: false, message: 'Cannot remove the only remaining account in pool.' };
    }

    const removed = cfg.accounts[idx];
    cfg.accounts.splice(idx, 1);

    // If active account was removed, switch to first available
    if (cfg.activeAccountId === id) {
      cfg.activeAccountId = cfg.accounts[0].id;
      cfg.accounts[0].isActive = true;
      cfg.accounts[0].status = 'active';
      this.applyLiveCredential(cfg.accounts[0]);
    }

    if (removed.tokenFilePath && fs.existsSync(removed.tokenFilePath)) {
      try { fs.unlinkSync(removed.tokenFilePath); } catch {}
    }

    this.saveConfig(cfg);
    this.logRotation(`Account removed: ${id}`);
    return { success: true, message: `Account "${id}" removed from pool.` };
  }

  private applyLiveCredential(account: AccountProfile): void {
    // 1. Restore from full AuthCache bundle if available
    if (account.authCachePath && fs.existsSync(account.authCachePath)) {
      try {
        const bundle: StockAuthCache = JSON.parse(fs.readFileSync(account.authCachePath, 'utf-8'));
        if (bundle.tokenJson) {
          const tmpFile = `${this.liveTokenPath}.tmp.${Date.now()}`;
          fs.writeFileSync(tmpFile, bundle.tokenJson, 'utf-8');
          if (process.platform !== 'win32') {
            try { fs.chmodSync(tmpFile, 0o600); } catch {}
          }
          fs.renameSync(tmpFile, this.liveTokenPath);
        }
        if (bundle.stateDb) {
          const stateDb = getStateDbPath(path.dirname(path.dirname(this.baseDir)));
          if (stateDb && fs.existsSync(stateDb)) {
            writeStateDbCredentials(stateDb, bundle.stateDb as any);
          }
        }
        this.logRotation(`Restored auth cache bundle for "${account.name}" (${account.id})`);
      } catch (err: any) {
        this.logRotation(`Warning: Failed to restore authCache: ${err.message}`);
      }
    }

    // 2. Fallback / direct token file restore
    if (account.type === 'oauth_token' && account.tokenFilePath && fs.existsSync(account.tokenFilePath)) {
      try {
        // Atomic credential swap via temp file
        const tmpFile = `${this.liveTokenPath}.tmp.${Date.now()}`;
        fs.copyFileSync(account.tokenFilePath, tmpFile);
        if (process.platform !== 'win32') {
          try { fs.chmodSync(tmpFile, 0o600); } catch {}
        }
        fs.renameSync(tmpFile, this.liveTokenPath);

        // Touch token file to trigger file watchers
        const now = new Date();
        try { fs.utimesSync(this.liveTokenPath, now, now); } catch {}
      } catch (err: any) {
        this.logRotation(`Warning: Failed to update live token: ${err.message}`);
      }
    }

    // 3. Layer 2: Antigravity IDE state.vscdb synchronization
    const stateFile = path.join(this.tokensDir, `${account.id}.state.json`);
    const stateDb = getStateDbPath(path.dirname(path.dirname(this.baseDir)));
    if (fs.existsSync(stateFile) && stateDb && fs.existsSync(stateDb)) {
      try {
        const creds: StateDbCredentials = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        writeStateDbCredentials(stateDb, creds);
        this.logRotation(`Synchronized state.vscdb for account "${account.id}"`);
      } catch (err: any) {
        this.logRotation(`Warning: Failed to synchronize state.vscdb: ${err.message}`);
      }
    }
  }

  public switchAccount(targetId?: string, reason: string = 'Manual rotation'): SwitchResult {
    const cfg = this.loadConfig();
    if (cfg.accounts.length === 0) {
      return {
        success: false,
        currentAccountId: 'none',
        currentAccountName: 'None',
        reason,
        message: 'No accounts configured in pool.',
        nonDisruptive: true,
        timestamp: new Date().toISOString(),
      };
    }

    const previousId = cfg.activeAccountId;
    const currentAccount = cfg.accounts.find((a) => a.id === previousId);

    // Backup current live credentials & state.vscdb into previous account's store
    if (currentAccount && currentAccount.type === 'oauth_token') {
      let liveContent: string | undefined;
      if (currentAccount.tokenFilePath && fs.existsSync(this.liveTokenPath)) {
        try {
          fs.copyFileSync(this.liveTokenPath, currentAccount.tokenFilePath);
          liveContent = fs.readFileSync(this.liveTokenPath, 'utf-8');
        } catch {}
      }
      const stateDb = getStateDbPath(path.dirname(path.dirname(this.baseDir)));
      let creds: StateDbCredentials | undefined;
      if (stateDb && fs.existsSync(stateDb)) {
        try {
          creds = readStateDbCredentials(stateDb);
          if (creds.oauthToken || creds.userStatus) {
            fs.writeFileSync(
              path.join(this.tokensDir, `${currentAccount.id}.state.json`),
              JSON.stringify(creds, null, 2),
              'utf-8'
            );
          }
        } catch {}
      }

      // Preserve full auth cache bundle for future sign-ins
      if (liveContent || creds) {
        const cacheFile = path.join(this.tokensDir, `${currentAccount.id}.auth-cache.json`);
        const bundle: StockAuthCache = {
          id: currentAccount.id,
          name: currentAccount.name,
          email: currentAccount.email,
          provider: currentAccount.provider,
          tokenJson: liveContent,
          stateDb: creds,
          savedAt: new Date().toISOString(),
          sourceApp: 'antigravity',
        };
        try {
          fs.writeFileSync(cacheFile, JSON.stringify(bundle, null, 2), 'utf-8');
          currentAccount.authCachePath = cacheFile;
        } catch {}
      }
    }

    // Determine target account
    let target: AccountProfile | undefined;

    if (targetId) {
      target = cfg.accounts.find((a) => a.id === targetId);
      if (!target) {
        return {
          success: false,
          previousAccountId: previousId,
          currentAccountId: previousId,
          currentAccountName: currentAccount?.name || previousId,
          reason,
          message: `Target account "${targetId}" not found in pool.`,
          nonDisruptive: true,
          timestamp: new Date().toISOString(),
        };
      }
    } else {
      // Find next healthy account in pool
      const candidates = cfg.accounts.filter(
        (a) => a.id !== previousId && a.status !== 'exhausted'
      );
      if (candidates.length > 0) {
        target = candidates[0];
      } else {
        // Fallback: reset standby on non-active accounts
        const standbys = cfg.accounts.filter((a) => a.id !== previousId);
        target = standbys.length > 0 ? standbys[0] : cfg.accounts[0];
      }
    }

    const now = new Date().toISOString();

    // Mark previous account as standby
    if (currentAccount && currentAccount.id !== target.id) {
      currentAccount.isActive = false;
      currentAccount.status = currentAccount.remainingPercent <= cfg.thresholdPercent ? 'exhausted' : 'standby';
    }

    // Activate target account
    target.isActive = true;
    target.status = 'active';
    target.lastRotatedAt = now;
    target.lastUsedAt = now;
    cfg.activeAccountId = target.id;

    // Apply live credential without restarting Antigravity
    this.applyLiveCredential(target);

    // Refresh live quota from language server
    try {
      const live = getLiveQuotaSummarySync(true);
      if (live.isReachable) {
        target.remainingPercent = live.lowestRemainingPercent;
        if (live.userName && (!target.name || target.name === target.id || target.name.startsWith('Primary Antigravity'))) {
          target.name = `${live.userName} (${live.userEmail || target.id})`;
        }
      }
    } catch {}

    this.saveConfig(cfg);

    const logMsg = `Switched account from "${previousId}" to "${target.id}" (${target.name}) [Reason: ${reason}]`;
    this.logRotation(logMsg);

    return {
      success: true,
      previousAccountId: previousId,
      currentAccountId: target.id,
      currentAccountName: target.name,
      reason,
      message: `Seamlessly switched to account "${target.name}" (${target.id}) without task disruption.`,
      nonDisruptive: true,
      timestamp: now,
    };
  }

  public checkAndAutoRotate(remainingPercent: number, reason?: string): AutoRotateCheckResult {
    const cfg = this.loadConfig();

    // If auto-rotate is disabled, skip
    if (!cfg.autoRotateEnabled) {
      return {
        triggered: false,
        thresholdPercent: cfg.thresholdPercent,
        currentRemainingPercent: remainingPercent,
        reason: 'Auto-rotate is disabled in config.',
      };
    }

    // Update current active account's remaining percentage
    const active = this.getActiveAccount();
    if (active) {
      active.remainingPercent = Math.max(0, Math.min(100, remainingPercent));
      if (active.remainingPercent <= cfg.thresholdPercent) {
        active.status = 'exhausted';
      }
      this.saveConfig(cfg);
    }

    // Trigger condition: remaining tokens/quota <= threshold (default 1.0%)
    if (remainingPercent <= cfg.thresholdPercent) {
      const switchReason = reason || `Remaining tokens at ${remainingPercent}% (threshold: ${cfg.thresholdPercent}%)`;
      const switchResult = this.switchAccount(undefined, switchReason);
      return {
        triggered: true,
        thresholdPercent: cfg.thresholdPercent,
        currentRemainingPercent: remainingPercent,
        switchResult,
        reason: switchReason,
      };
    }

    return {
      triggered: false,
      thresholdPercent: cfg.thresholdPercent,
      currentRemainingPercent: remainingPercent,
      reason: `Remaining tokens (${remainingPercent}%) above threshold (${cfg.thresholdPercent}%).`,
    };
  }

  public setAutoRotateConfig(enabled: boolean, thresholdPercent: number = 1.0, strategy: RotationStrategy = 'round_robin'): void {
    const cfg = this.loadConfig();
    cfg.autoRotateEnabled = enabled;
    cfg.thresholdPercent = Math.max(0.1, Math.min(50, thresholdPercent));
    cfg.rotationStrategy = strategy;
    this.saveConfig(cfg);
    this.logRotation(`Auto-rotate config updated: enabled=${enabled}, threshold=${cfg.thresholdPercent}%`);
  }
}

// Global singleton instance
export let globalAccountManager = new AccountManager();

export function setGlobalAccountManager(mgr: AccountManager): void {
  globalAccountManager = mgr;
}

