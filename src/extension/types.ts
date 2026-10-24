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

export interface ExtensionBuildOptions {
  version?: string;
  publisher?: string;
  extensionId?: string;
}
