export type AccountProvider = 'antigravity' | 'gemini' | 'claude' | 'openai' | 'custom';
export type AccountAuthType = 'oauth_token' | 'api_key';
export type AccountStatus = 'active' | 'standby' | 'exhausted' | 'cooldown';
export type RotationStrategy = 'round_robin' | 'least_used' | 'priority';
export interface StockAuthCache {
    id: string;
    name: string;
    email?: string;
    provider: AccountProvider;
    tokenJson?: string;
    stateDb?: any;
    savedAt: string;
    sourceApp: 'antigravity' | 'vscode' | 'cursor' | 'windsurf' | 'other';
    profileUrl?: string;
}
export interface AccountProfile {
    id: string;
    name: string;
    email?: string;
    provider: AccountProvider;
    type: AccountAuthType;
    tokenFilePath?: string;
    authCachePath?: string;
    apiKeyMasked?: string;
    isActive: boolean;
    usedTokens: number;
    remainingPercent: number;
    status: AccountStatus;
    priority?: number;
    createdAt: string;
    lastUsedAt?: string;
    lastRotatedAt?: string;
    cooldownUntil?: string;
    requestCount: number;
    errorCount: number;
}
export interface AccountPoolConfig {
    version: number;
    autoRotateEnabled: boolean;
    thresholdPercent: number;
    activeAccountId: string;
    rotationStrategy: RotationStrategy;
    accounts: AccountProfile[];
}
export interface SwitchResult {
    success: boolean;
    previousAccountId?: string;
    currentAccountId: string;
    currentAccountName: string;
    reason: string;
    message: string;
    nonDisruptive: boolean;
    timestamp: string;
}
export interface AutoRotateCheckResult {
    triggered: boolean;
    thresholdPercent: number;
    currentRemainingPercent: number;
    switchResult?: SwitchResult;
    reason?: string;
}
//# sourceMappingURL=types.d.ts.map