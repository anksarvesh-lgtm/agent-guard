import { InstalledExtensionTarget, ExtensionInstallResult, ExtensionStatusInfo } from './types.js';
export declare function getPackageVersion(): string;
export declare function getBaseHomeDir(): string;
/**
 * Returns all potential IDE targets for extension installation.
 */
export declare function detectExtensionTargets(customHome?: string): InstalledExtensionTarget[];
/**
 * Installs Agent Guard extension into a specified extension target directory.
 */
export declare function installExtensionToTarget(target: InstalledExtensionTarget, assetsDir?: string, version?: string): ExtensionInstallResult;
/**
 * Registers the extension into the IDE's extensions.json registry
 */
export declare function registerInExtensionsJson(registryPath: string, relativeLocation: string, absoluteLocation: string, version?: string): boolean;
/**
 * Installs Agent Guard extension into all detected coding applications.
 */
export declare function installExtensionToAllDetected(customHome?: string, assetsDir?: string, version?: string): ExtensionInstallResult[];
/**
 * Checks extension installation status across all targets.
 */
export declare function getExtensionStatus(customHome?: string): ExtensionStatusInfo[];
//# sourceMappingURL=installer.d.ts.map