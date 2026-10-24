export interface LiveQuotaBucket {
    bucketId: string;
    displayName: string;
    window: string;
    remainingFraction: number;
    remainingPercent: number;
    resetTime?: string;
    resetCountdown?: string;
}
export interface LiveQuotaGroup {
    displayName: string;
    description?: string;
    buckets: LiveQuotaBucket[];
}
export interface LiveQuotaSummary {
    isReachable: boolean;
    userEmail?: string;
    userName?: string;
    planName?: string;
    lowestRemainingPercent: number;
    groups: LiveQuotaGroup[];
    geminiFiveHourPercent?: number;
    geminiWeeklyPercent?: number;
    claudeFiveHourPercent?: number;
    claudeWeeklyPercent?: number;
    availablePromptCredits?: number;
    availableFlowCredits?: number;
    checkedAt: string;
    source: 'language_server' | 'fallback_cache';
}
interface LanguageServerTarget {
    pid: number;
    port: number;
    csrfToken: string;
}
export declare function formatCountdown(dateStr?: string): string;
/**
 * Discovers running Antigravity Language Server processes, ports, and CSRF tokens.
 */
export declare function discoverLanguageServer(): LanguageServerTarget | null;
/**
 * Sends a POST request to the local Antigravity Language Server HTTPS RPC endpoint.
 */
export declare function sendLanguageServerRpc(target: LanguageServerTarget, methodName: string, payload?: Record<string, any>, timeoutMs?: number): Promise<any>;
/**
 * Sends a synchronous POST request to the local Antigravity Language Server via curl.
 */
export declare function sendLanguageServerRpcSync(target: LanguageServerTarget, methodName: string, payload?: Record<string, any>, timeoutSec?: number): any;
/**
 * Synchronous version of getLiveQuotaSummary using curl and internal caching.
 */
export declare function getLiveQuotaSummarySync(forceRefresh?: boolean): LiveQuotaSummary;
/**
 * Fetches the real-time live quota summary and user status from the Antigravity Language Server.
 */
export declare function getLiveQuotaSummary(forceRefresh?: boolean): Promise<LiveQuotaSummary>;
export {};
//# sourceMappingURL=liveQuota.d.ts.map