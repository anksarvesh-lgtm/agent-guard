export interface UpdateCheckResult {
    isGit: boolean;
    hasUpdate: boolean;
    currentSha?: string;
    remoteSha?: string;
    behindCount?: number;
    error?: string;
}
export interface PerformUpdateResult {
    success: boolean;
    updated: boolean;
    message: string;
    previousSha?: string;
    newSha?: string;
}
/**
 * Check if the repository has incoming updates from GitHub origin main.
 */
export declare function checkForUpdates(repoDir?: string): UpdateCheckResult;
/**
 * Pull latest changes from origin main and recompile TypeScript.
 */
export declare function performUpdate(repoDir?: string): PerformUpdateResult;
/**
 * Non-blocking background update check (cached for 1 hour to avoid network overhead).
 */
export declare function maybeBackgroundUpdate(repoDir?: string, logFn?: (msg: string) => void): void;
/**
 * Check and auto-install updates on startup if enabled and available.
 */
export declare function autoUpdateOnStartup(repoDir?: string, logFn?: (msg: string) => void): PerformUpdateResult | null;
//# sourceMappingURL=update.d.ts.map