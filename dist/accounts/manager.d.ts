import { AccountProfile, AccountPoolConfig, SwitchResult, AutoRotateCheckResult, RotationStrategy, AccountProvider, AccountAuthType } from './types.js';
export declare function getAccountsHome(): string;
export declare function maskSecret(secret?: string): string;
export declare class AccountManager {
    private baseDir;
    private configPath;
    private tokensDir;
    private liveTokenPath;
    private logPath;
    constructor(customBaseDir?: string);
    private ensureStorage;
    private initDefaultPool;
    private loadConfig;
    private saveConfig;
    private logRotation;
    getConfig(): AccountPoolConfig;
    listAccounts(): AccountProfile[];
    getActiveAccount(): AccountProfile | null;
    addAccount(options: {
        id: string;
        name: string;
        provider?: AccountProvider;
        type?: AccountAuthType;
        tokenContent?: string;
        tokenSourceFile?: string;
        apiKey?: string;
        priority?: number;
    }): {
        success: boolean;
        message: string;
        account?: AccountProfile;
    };
    /**
     * Captures the currently active Antigravity IDE / CLI session credentials into the account pool.
     * Backups both ~/.gemini/jetski-standalone-oauth-token and SQLite state.vscdb credentials.
     */
    snapshotActiveSession(id?: string, name?: string): {
        success: boolean;
        message: string;
        account?: AccountProfile;
    };
    /**
     * Imports an account credentials token file from disk.
     */
    importAccountFile(filePath: string, id?: string, name?: string): {
        success: boolean;
        message: string;
        account?: AccountProfile;
    };
    removeAccount(id: string): {
        success: boolean;
        message: string;
    };
    private applyLiveCredential;
    switchAccount(targetId?: string, reason?: string): SwitchResult;
    checkAndAutoRotate(remainingPercent: number, reason?: string): AutoRotateCheckResult;
    setAutoRotateConfig(enabled: boolean, thresholdPercent?: number, strategy?: RotationStrategy): void;
}
export declare let globalAccountManager: AccountManager;
export declare function setGlobalAccountManager(mgr: AccountManager): void;
//# sourceMappingURL=manager.d.ts.map