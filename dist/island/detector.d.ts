export interface LiquidDynamoDetection {
    isInstalled: boolean;
    isRunning: boolean;
    appPath: string | null;
    socketPath: string | null;
    pid: number | null;
    isWatcherEnabled: boolean;
}
export declare const PRIMARY_SOCKET_PATH: string;
export declare const FALLBACK_SOCKET_PATH = "/tmp/liquid_watcher.sock";
export declare const STANDARD_APP_PATHS: string[];
export declare function detectLiquidDynamo(): LiquidDynamoDetection;
export declare function ensureWatcherEnabled(): boolean;
//# sourceMappingURL=detector.d.ts.map