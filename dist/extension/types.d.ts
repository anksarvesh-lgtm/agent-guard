export interface InstalledExtensionTarget {
    name: string;
    appId: 'antigravity-ide' | 'vscode' | 'cursor' | 'windsurf' | 'other';
    extensionsDir: string;
    extensionsJsonPath?: string;
    cliCommand?: string;
    isDetected: boolean;
}
export interface ExtensionInstallResult {
    target: InstalledExtensionTarget;
    success: boolean;
    installedPath: string;
    registeredInJson: boolean;
    message: string;
    error?: string;
}
export interface ExtensionStatusInfo {
    target: InstalledExtensionTarget;
    isInstalled: boolean;
    version?: string;
    installedPath?: string;
}
export interface ExtensionBuildOptions {
    version?: string;
    publisher?: string;
    extensionId?: string;
}
//# sourceMappingURL=types.d.ts.map