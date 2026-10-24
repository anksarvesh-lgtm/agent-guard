import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export function getAccountsHome() {
    return process.env.AGENT_GUARD_HOME || os.homedir();
}
export function maskSecret(secret) {
    if (!secret || secret.length <= 8)
        return '****';
    return secret.slice(0, 4) + '...' + secret.slice(-4);
}
export class AccountManager {
    baseDir;
    configPath;
    tokensDir;
    liveTokenPath;
    logPath;
    constructor(customBaseDir) {
        const home = customBaseDir || getAccountsHome();
        this.baseDir = path.join(home, '.gemini', 'accounts');
        this.configPath = path.join(this.baseDir, 'accounts.json');
        this.tokensDir = path.join(this.baseDir, 'tokens');
        this.liveTokenPath = path.join(home, '.gemini', 'jetski-standalone-oauth-token');
        this.logPath = path.join(this.baseDir, 'rotation.log');
        this.ensureStorage();
        this.initDefaultPool();
    }
    ensureStorage() {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
            if (process.platform !== 'win32') {
                try {
                    fs.chmodSync(this.baseDir, 0o700);
                }
                catch { }
            }
        }
        if (!fs.existsSync(this.tokensDir)) {
            fs.mkdirSync(this.tokensDir, { recursive: true });
            if (process.platform !== 'win32') {
                try {
                    fs.chmodSync(this.tokensDir, 0o700);
                }
                catch { }
            }
        }
    }
    initDefaultPool() {
        if (fs.existsSync(this.configPath))
            return;
        const now = new Date().toISOString();
        const primaryTokenPath = path.join(this.tokensDir, 'primary.token');
        // If live Antigravity OAuth token exists, preserve as primary profile
        if (fs.existsSync(this.liveTokenPath) && !fs.existsSync(primaryTokenPath)) {
            try {
                fs.copyFileSync(this.liveTokenPath, primaryTokenPath);
                if (process.platform !== 'win32') {
                    try {
                        fs.chmodSync(primaryTokenPath, 0o600);
                    }
                    catch { }
                }
            }
            catch { }
        }
        const defaultAccount = {
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
        const initialConfig = {
            version: 1,
            autoRotateEnabled: true,
            thresholdPercent: 1.0, // Rotate when remaining <= 1%
            activeAccountId: 'primary',
            rotationStrategy: 'round_robin',
            accounts: [defaultAccount],
        };
        this.saveConfig(initialConfig);
    }
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const raw = fs.readFileSync(this.configPath, 'utf-8');
                return JSON.parse(raw);
            }
        }
        catch { }
        return {
            version: 1,
            autoRotateEnabled: true,
            thresholdPercent: 1.0,
            activeAccountId: 'primary',
            rotationStrategy: 'round_robin',
            accounts: [],
        };
    }
    saveConfig(config) {
        const raw = JSON.stringify(config, null, 2) + '\n';
        fs.writeFileSync(this.configPath, raw, 'utf-8');
        if (process.platform !== 'win32') {
            try {
                fs.chmodSync(this.configPath, 0o600);
            }
            catch { }
        }
    }
    logRotation(msg) {
        try {
            const line = `[${new Date().toISOString()}] ${msg}\n`;
            fs.appendFileSync(this.logPath, line, 'utf-8');
        }
        catch { }
    }
    getConfig() {
        return this.loadConfig();
    }
    listAccounts() {
        const cfg = this.loadConfig();
        return cfg.accounts.map((acc) => ({
            ...acc,
            apiKeyMasked: acc.apiKeyMasked ? maskSecret(acc.apiKeyMasked) : undefined,
        }));
    }
    getActiveAccount() {
        const cfg = this.loadConfig();
        return cfg.accounts.find((a) => a.id === cfg.activeAccountId) || cfg.accounts[0] || null;
    }
    addAccount(options) {
        const cfg = this.loadConfig();
        const cleanId = options.id.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        if (cfg.accounts.some((a) => a.id === cleanId)) {
            return { success: false, message: `Account ID "${cleanId}" already exists.` };
        }
        const now = new Date().toISOString();
        const provider = options.provider || 'antigravity';
        const type = options.type || (options.apiKey ? 'api_key' : 'oauth_token');
        let savedTokenPath;
        if (type === 'oauth_token') {
            savedTokenPath = path.join(this.tokensDir, `${cleanId}.token`);
            if (options.tokenContent) {
                fs.writeFileSync(savedTokenPath, options.tokenContent, 'utf-8');
            }
            else if (options.tokenSourceFile && fs.existsSync(options.tokenSourceFile)) {
                fs.copyFileSync(options.tokenSourceFile, savedTokenPath);
            }
            else if (fs.existsSync(this.liveTokenPath)) {
                fs.copyFileSync(this.liveTokenPath, savedTokenPath);
            }
            else {
                fs.writeFileSync(savedTokenPath, JSON.stringify({ placeholder: true }), 'utf-8');
            }
            if (process.platform !== 'win32') {
                try {
                    fs.chmodSync(savedTokenPath, 0o600);
                }
                catch { }
            }
        }
        const newAccount = {
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
    removeAccount(id) {
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
            try {
                fs.unlinkSync(removed.tokenFilePath);
            }
            catch { }
        }
        this.saveConfig(cfg);
        this.logRotation(`Account removed: ${id}`);
        return { success: true, message: `Account "${id}" removed from pool.` };
    }
    applyLiveCredential(account) {
        if (account.type === 'oauth_token' && account.tokenFilePath && fs.existsSync(account.tokenFilePath)) {
            try {
                // Atomic credential swap via temp file
                const tmpFile = `${this.liveTokenPath}.tmp.${Date.now()}`;
                fs.copyFileSync(account.tokenFilePath, tmpFile);
                if (process.platform !== 'win32') {
                    try {
                        fs.chmodSync(tmpFile, 0o600);
                    }
                    catch { }
                }
                fs.renameSync(tmpFile, this.liveTokenPath);
            }
            catch (err) {
                this.logRotation(`Warning: Failed to update live token: ${err.message}`);
            }
        }
    }
    switchAccount(targetId, reason = 'Manual rotation') {
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
        // Backup current live credentials into current account's store
        if (currentAccount && currentAccount.type === 'oauth_token' && currentAccount.tokenFilePath && fs.existsSync(this.liveTokenPath)) {
            try {
                fs.copyFileSync(this.liveTokenPath, currentAccount.tokenFilePath);
            }
            catch { }
        }
        // Determine target account
        let target;
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
        }
        else {
            // Find next healthy account in pool
            const candidates = cfg.accounts.filter((a) => a.id !== previousId && a.status !== 'exhausted');
            if (candidates.length > 0) {
                target = candidates[0];
            }
            else {
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
    checkAndAutoRotate(remainingPercent, reason) {
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
    setAutoRotateConfig(enabled, thresholdPercent = 1.0, strategy = 'round_robin') {
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
export function setGlobalAccountManager(mgr) {
    globalAccountManager = mgr;
}
//# sourceMappingURL=manager.js.map