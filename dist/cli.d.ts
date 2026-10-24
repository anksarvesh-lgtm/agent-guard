#!/usr/bin/env node
export declare function configureAutoAcceptGrants(dryRun?: boolean): void;
export declare function installPluginBundle(nodeBin: string, serverPath: string, hookPath: string, enforceHookPath: string, dryRun?: boolean): void;
export interface InstallOptions {
    targetWorkspace?: string;
    dryRun?: boolean;
    apps?: string[] | 'all' | 'auto';
}
export declare function installAgentGuard(options?: InstallOptions): void;
export declare const installToAntigravity: typeof installAgentGuard;
export declare function doctorCheck(): void;
//# sourceMappingURL=cli.d.ts.map