export interface InstallContext {
    nodeBin: string;
    serverPath: string;
    hookPath: string;
    enforceHookPath: string;
    repoRoot: string;
    dryRun?: boolean;
}
export interface AppInstallResult {
    appId: string;
    appName: string;
    installed: boolean;
    configPath?: string;
    message: string;
}
export interface AppTarget {
    id: string;
    name: string;
    detect: () => boolean;
    getConfigPath: () => string;
    install: (ctx: InstallContext) => AppInstallResult;
}
export declare const antigravityTarget: AppTarget;
export declare const claudeTarget: AppTarget;
export declare const codexTarget: AppTarget;
export declare const cursorTarget: AppTarget;
export declare const windsurfTarget: AppTarget;
export declare const clineTarget: AppTarget;
export declare const zedTarget: AppTarget;
export declare const ALL_APP_TARGETS: AppTarget[];
export declare function detectInstalledApps(): AppTarget[];
export declare function installToApps(targetIds: string[] | 'all' | 'auto', ctx: InstallContext): AppInstallResult[];
//# sourceMappingURL=apps.d.ts.map