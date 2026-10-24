import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { InstalledExtensionTarget, ExtensionInstallResult, ExtensionStatusInfo } from './types.js';
import { generateExtensionManifest } from './manifest.js';
import { generateExtensionRuntimeScript } from './runtime.js';

export function getBaseHomeDir(): string {
  return process.env.AGENT_GUARD_HOME || os.homedir();
}

/**
 * Returns all potential IDE targets for extension installation.
 */
export function detectExtensionTargets(customHome?: string): InstalledExtensionTarget[] {
  const home = customHome || getBaseHomeDir();

  const targets: InstalledExtensionTarget[] = [
    {
      name: 'Google Antigravity IDE',
      appId: 'antigravity-ide',
      extensionsDir: path.join(home, '.antigravity-ide', 'extensions'),
      extensionsJsonPath: path.join(home, '.antigravity-ide', 'extensions', 'extensions.json'),
      isDetected:
        fs.existsSync(path.join(home, '.antigravity-ide')) ||
        fs.existsSync(path.join(home, '.gemini', 'antigravity')) ||
        fs.existsSync(path.join(home, 'Library', 'Application Support', 'Antigravity IDE')),
    },
    {
      name: 'Visual Studio Code',
      appId: 'vscode',
      extensionsDir: path.join(home, '.vscode', 'extensions'),
      extensionsJsonPath: path.join(home, '.vscode', 'extensions', 'extensions.json'),
      cliCommand: 'code',
      isDetected:
        fs.existsSync(path.join(home, '.vscode')) ||
        fs.existsSync(path.join(home, 'Library', 'Application Support', 'Code')),
    },
    {
      name: 'Cursor AI Editor',
      appId: 'cursor',
      extensionsDir: path.join(home, '.cursor', 'extensions'),
      extensionsJsonPath: path.join(home, '.cursor', 'extensions', 'extensions.json'),
      cliCommand: 'cursor',
      isDetected:
        fs.existsSync(path.join(home, '.cursor')) ||
        fs.existsSync(path.join(home, 'Library', 'Application Support', 'Cursor')),
    },
    {
      name: 'Windsurf AI Editor',
      appId: 'windsurf',
      extensionsDir: path.join(home, '.windsurf', 'extensions'),
      extensionsJsonPath: path.join(home, '.windsurf', 'extensions', 'extensions.json'),
      cliCommand: 'windsurf',
      isDetected:
        fs.existsSync(path.join(home, '.windsurf')) ||
        fs.existsSync(path.join(home, 'Library', 'Application Support', 'Windsurf')),
    },
  ];

  return targets;
}

/**
 * Installs Agent Guard extension into a specified extension target directory.
 */
export function installExtensionToTarget(
  target: InstalledExtensionTarget,
  assetsDir?: string,
  version: string = '1.0.0'
): ExtensionInstallResult {
  try {
    const extensionFolder = `sarvesh.agent-guard-${version}-universal`;
    const targetInstallPath = path.join(target.extensionsDir, extensionFolder);

    // 1. Ensure target directory exists
    fs.mkdirSync(targetInstallPath, { recursive: true });

    // Clean up any older version directories in extensionsDir
    try {
      if (fs.existsSync(target.extensionsDir)) {
        const entries = fs.readdirSync(target.extensionsDir);
        for (const entry of entries) {
          if (entry.startsWith('sarvesh.agent-guard-') && entry !== extensionFolder) {
            try {
              fs.rmSync(path.join(target.extensionsDir, entry), { recursive: true, force: true });
            } catch {}
          }
        }
      }
    } catch {}

    // 2. Write package.json manifest
    const manifest = generateExtensionManifest(version);
    fs.writeFileSync(
      path.join(targetInstallPath, 'package.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    // 3. Write extension.js runtime
    const runtimeScript = generateExtensionRuntimeScript();
    fs.writeFileSync(
      path.join(targetInstallPath, 'extension.js'),
      runtimeScript,
      'utf-8'
    );

    // 4. Copy icons if available
    const resolvedAssetsDir =
      assetsDir ||
      path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'assets');

    if (fs.existsSync(resolvedAssetsDir)) {
      const iconPng = path.join(resolvedAssetsDir, 'icon.png');
      if (fs.existsSync(iconPng)) {
        fs.copyFileSync(iconPng, path.join(targetInstallPath, 'icon.png'));
      }
      const logoSvg = path.join(resolvedAssetsDir, 'logo.svg');
      if (fs.existsSync(logoSvg)) {
        fs.copyFileSync(logoSvg, path.join(targetInstallPath, 'icon.svg'));
      }
    }

    // 5. Register in extensions.json if target uses an extension registry
    let registeredInJson = false;
    if (target.extensionsJsonPath) {
      registeredInJson = registerInExtensionsJson(
        target.extensionsJsonPath,
        extensionFolder,
        targetInstallPath,
        version
      );
    }

    return {
      target,
      success: true,
      installedPath: targetInstallPath,
      registeredInJson,
      message: `Installed Agent Guard extension into ${target.name} at ${targetInstallPath}`,
    };
  } catch (error: any) {
    return {
      target,
      success: false,
      installedPath: '',
      registeredInJson: false,
      message: `Failed to install extension into ${target.name}: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Registers the extension into the IDE's extensions.json registry
 */
export function registerInExtensionsJson(
  registryPath: string,
  relativeLocation: string,
  absoluteLocation: string,
  version: string = '1.0.0'
): boolean {
  try {
    let registry: any[] = [];
    if (fs.existsSync(registryPath)) {
      const content = fs.readFileSync(registryPath, 'utf-8');
      try {
        registry = JSON.parse(content);
        if (!Array.isArray(registry)) {
          registry = [];
        }
      } catch {
        registry = [];
      }
    }

    const extensionId = 'sarvesh.agent-guard';
    const uuid = '7a3e9c12-88f1-4b2e-a39c-agentguard001';

    const existingIdx = registry.findIndex(
      (entry) =>
        entry.identifier?.id?.toLowerCase() === extensionId.toLowerCase() ||
        entry.relativeLocation?.startsWith('sarvesh.agent-guard')
    );

    const entry = {
      identifier: {
        id: extensionId,
        uuid,
      },
      version,
      location: {
        $mid: 1,
        path: absoluteLocation,
        scheme: 'file',
      },
      relativeLocation,
      metadata: {
        installedTimestamp: Date.now(),
        pinned: false,
        source: 'local',
        id: uuid,
        publisherId: 'sarvesh',
        publisherDisplayName: 'Sarvesh',
        targetPlatform: 'universal',
        updated: false,
        private: false,
        isPreReleaseVersion: false,
        hasPreReleaseVersion: false,
        isApplicationScoped: false,
        isMachineScoped: false,
        isBuiltin: false,
      },
    };

    if (existingIdx >= 0) {
      registry[existingIdx] = entry;
    } else {
      registry.push(entry);
    }

    // Write back atomically
    const tmp = `${registryPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(registry, null, 2), 'utf-8');
    fs.renameSync(tmp, registryPath);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Installs Agent Guard extension into all detected coding applications.
 */
export function installExtensionToAllDetected(
  customHome?: string,
  assetsDir?: string
): ExtensionInstallResult[] {
  const targets = detectExtensionTargets(customHome);
  const detectedTargets = targets.filter((t) => t.isDetected);

  // If no targets explicitly detected, at least install to Antigravity IDE
  const targetsToInstall =
    detectedTargets.length > 0
      ? detectedTargets
      : targets.filter((t) => t.appId === 'antigravity-ide');

  return targetsToInstall.map((target) =>
    installExtensionToTarget(target, assetsDir)
  );
}

/**
 * Checks extension installation status across all targets.
 */
export function getExtensionStatus(customHome?: string): ExtensionStatusInfo[] {
  const targets = detectExtensionTargets(customHome);
  const results: ExtensionStatusInfo[] = [];

  for (const target of targets) {
    let isInstalled = false;
    let version: string | undefined;
    let installedPath: string | undefined;

    if (fs.existsSync(target.extensionsDir)) {
      try {
        const entries = fs.readdirSync(target.extensionsDir);
        const match = entries.find((e) => e.startsWith('sarvesh.agent-guard-'));
        if (match) {
          installedPath = path.join(target.extensionsDir, match);
          const pkgJson = path.join(installedPath, 'package.json');
          if (fs.existsSync(pkgJson)) {
            try {
              const parsed = JSON.parse(fs.readFileSync(pkgJson, 'utf-8'));
              version = parsed.version;
              isInstalled = true;
            } catch {}
          }
        }
      } catch {}
    }

    results.push({
      target,
      isInstalled,
      version,
      installedPath,
    });
  }

  return results;
}

