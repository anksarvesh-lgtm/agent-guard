import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  generateExtensionManifest,
  generateExtensionRuntimeScript,
  detectExtensionTargets,
  installExtensionToTarget,
  registerInExtensionsJson,
  getExtensionStatus,
  installExtensionToAllDetected,
  getPackageVersion,
} from '../src/extension/index.js';

describe('Agent Guard IDE Extension Engine & Multi-App Installer', () => {
  let tempHome: string;
  let tempAssets: string;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-guard-ext-test-'));
    tempAssets = path.join(tempHome, 'assets');
    fs.mkdirSync(tempAssets, { recursive: true });
    fs.writeFileSync(path.join(tempAssets, 'icon.png'), 'fake-png-content');
    fs.writeFileSync(path.join(tempAssets, 'logo.svg'), '<svg>fake-logo</svg>');
  });

  afterEach(() => {
    if (fs.existsSync(tempHome)) {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  describe('Manifest & Runtime Generation', () => {
    it('generates a compliant VS Code extension manifest with 21 feature control commands', () => {
      const manifest = generateExtensionManifest('1.2.3');
      expect(manifest.name).toBe('agent-guard');
      expect(manifest.publisher).toBe('sarvesh');
      expect(manifest.version).toBe('1.2.3');
      expect(manifest.engines.vscode).toBe('^1.75.0');
      expect(manifest.main).toBe('./extension.js');
      expect(manifest.activationEvents).toContain('onStartupFinished');

      // Commands
      const commands = manifest.contributes.commands.map((c: any) => c.command);
      expect(commands.length).toBeGreaterThanOrEqual(20);
      expect(commands).toContain('agentGuard.openDashboard');
      expect(commands).toContain('agentGuard.showStatus');
      expect(commands).toContain('agentGuard.toggleKeepAwake');
      expect(commands).toContain('agentGuard.acquireAwakeLease');
      expect(commands).toContain('agentGuard.releaseAwakeLease');
      expect(commands).toContain('agentGuard.toggleAutoAccept');
      expect(commands).toContain('agentGuard.manageGrants');
      expect(commands).toContain('agentGuard.switchAccount');
      expect(commands).toContain('agentGuard.addAccount');
      expect(commands).toContain('agentGuard.removeAccount');
      expect(commands).toContain('agentGuard.toggleAutoSwitch');
      expect(commands).toContain('agentGuard.setTripwireThreshold');
      expect(commands).toContain('agentGuard.testTripwire');
      expect(commands).toContain('agentGuard.countTokensCurrentFile');
      expect(commands).toContain('agentGuard.switchTokenModel');
      expect(commands).toContain('agentGuard.resetTokenSession');
      expect(commands).toContain('agentGuard.browseSkills');
      expect(commands).toContain('agentGuard.generateProjectMap');
      expect(commands).toContain('agentGuard.runDoctor');
      expect(commands).toContain('agentGuard.checkForUpdates');
      expect(commands).toContain('agentGuard.performUpdate');
      expect(commands).toContain('agentGuard.toggleStartupUpdate');
      expect(commands).toContain('agentGuard.snapshotAccount');
      expect(commands).toContain('agentGuard.refresh');

      // Webview & Views Container
      expect(manifest.contributes.viewsContainers.activitybar[0].id).toBe('agentGuard');
      expect(manifest.contributes.views.agentGuard[0].id).toBe('agentGuard.dashboardView');

      // Configurations
      const props = manifest.contributes.configuration.properties;
      expect(props['agentGuard.statusBar.showTokenPercent']).toBeDefined();
      expect(props['agentGuard.lowQuotaThresholdPercent'].default).toBe(1.0);
      expect(props['agentGuard.defaultAwakeMinutes'].default).toBe(120);
      expect(props['agentGuard.defaultModel'].default).toBe('gemini-2.5-flash');
    });

    it('generates runtime script containing all feature controllers and tabbed webview', () => {
      const script = generateExtensionRuntimeScript();
      expect(script).toContain('module.exports = {');
      expect(script).toContain('activate');
      expect(script).toContain('deactivate');
      expect(script).toContain('vscode.window.createStatusBarItem');
      expect(script).toContain('agentGuard.openDashboard');

      // Feature controllers
      expect(script).toContain('switchAccount(targetId, reason)');
      expect(script).toContain('addAccountToPool(');
      expect(script).toContain('removeAccountFromPool(');
      expect(script).toContain('setAutoRotateConfig(');
      expect(script).toContain('acquireAwakeLease(minutes)');
      expect(script).toContain('releaseAwakeLease()');
      expect(script).toContain('setAutoAcceptGrants(toolsList)');
      expect(script).toContain('estimateTokens(text, modelId)');
      expect(script).toContain('countTokensInActiveEditor()');
      expect(script).toContain('runDoctorDiagnostics()');
      expect(script).toContain('installSkillDirectly(skillId)');
      expect(script).toContain('checkAgentGuardUpdate()');
      expect(script).toContain('performAgentGuardUpdate()');
      expect(script).toContain('promptCheckForUpdates()');
      expect(script).toContain('autoCheckAndInstallOnStartup()');
      expect(script).toContain('getAutoUpdateOnStartupConfig()');
      expect(script).toContain('setAutoUpdateOnStartupConfig(');
      expect(script).toContain("post('checkUpdate')");
      expect(script).toContain("post('performUpdate')");
      expect(script).toContain("post('toggleStartupUpdate')");

      // Multi-tab Webview structure
      expect(script).toContain('tab-overview');
      expect(script).toContain('tab-accounts');
      expect(script).toContain('tab-tokens');
      expect(script).toContain('tab-awake');
      expect(script).toContain('tab-skills');

      // Dynamic extension version
      expect(script).toContain("const EXTENSION_VERSION = '");
      expect(script).toContain('Agent Guard v${EXTENSION_VERSION}');

      // 1% tripwire
      expect(script).toContain('Automatic 1% Quota Rotation Tripwire');
    });

    it('resolves dynamic package version from package.json', () => {
      const v = getPackageVersion();
      expect(typeof v).toBe('string');
      expect(v).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('Target Detection', () => {
    it('detects Antigravity IDE when directory exists', () => {
      fs.mkdirSync(path.join(tempHome, '.antigravity-ide'), { recursive: true });
      const targets = detectExtensionTargets(tempHome);
      const antigravity = targets.find((t) => t.appId === 'antigravity-ide');
      expect(antigravity).toBeDefined();
      expect(antigravity?.isDetected).toBe(true);

      const vscodeTarget = targets.find((t) => t.appId === 'vscode');
      expect(vscodeTarget?.isDetected).toBe(false);
    });

    it('detects VS Code, Cursor, and Windsurf when respective directories exist', () => {
      fs.mkdirSync(path.join(tempHome, '.vscode'), { recursive: true });
      fs.mkdirSync(path.join(tempHome, '.cursor'), { recursive: true });
      fs.mkdirSync(path.join(tempHome, '.windsurf'), { recursive: true });

      const targets = detectExtensionTargets(tempHome);
      expect(targets.find((t) => t.appId === 'vscode')?.isDetected).toBe(true);
      expect(targets.find((t) => t.appId === 'cursor')?.isDetected).toBe(true);
      expect(targets.find((t) => t.appId === 'windsurf')?.isDetected).toBe(true);
    });
  });

  describe('Installation & Registry Update', () => {
    it('installs extension bundle and writes manifest, runtime, and icons', () => {
      const antigravityTarget = {
        name: 'Google Antigravity IDE',
        appId: 'antigravity-ide' as const,
        extensionsDir: path.join(tempHome, '.antigravity-ide', 'extensions'),
        extensionsJsonPath: path.join(tempHome, '.antigravity-ide', 'extensions', 'extensions.json'),
        isDetected: true,
      };

      const result = installExtensionToTarget(antigravityTarget, tempAssets, '1.0.0');
      expect(result.success).toBe(true);
      expect(result.registeredInJson).toBe(true);
      expect(fs.existsSync(result.installedPath)).toBe(true);

      // Verify files in extension bundle
      expect(fs.existsSync(path.join(result.installedPath, 'package.json'))).toBe(true);
      expect(fs.existsSync(path.join(result.installedPath, 'extension.js'))).toBe(true);
      expect(fs.existsSync(path.join(result.installedPath, 'icon.png'))).toBe(true);
      expect(fs.existsSync(path.join(result.installedPath, 'icon.svg'))).toBe(true);

      // Verify extensions.json registry
      const reg = JSON.parse(fs.readFileSync(antigravityTarget.extensionsJsonPath, 'utf-8'));
      expect(Array.isArray(reg)).toBe(true);
      expect(reg.length).toBe(1);
      expect(reg[0].identifier.id).toBe('sarvesh.agent-guard');
      expect(reg[0].version).toBe('1.0.0');
    });

    it('cleans up older version folder when installing an updated extension', () => {
      const target = {
        name: 'Google Antigravity IDE',
        appId: 'antigravity-ide' as const,
        extensionsDir: path.join(tempHome, '.antigravity-ide', 'extensions'),
        extensionsJsonPath: path.join(tempHome, '.antigravity-ide', 'extensions', 'extensions.json'),
        isDetected: true,
      };

      // Install v1.0.0
      installExtensionToTarget(target, tempAssets, '1.0.0');
      const oldPath = path.join(target.extensionsDir, 'sarvesh.agent-guard-1.0.0-universal');
      expect(fs.existsSync(oldPath)).toBe(true);

      // Now install v1.0.1
      installExtensionToTarget(target, tempAssets, '1.0.1');
      const newPath = path.join(target.extensionsDir, 'sarvesh.agent-guard-1.0.1-universal');
      expect(fs.existsSync(newPath)).toBe(true);
      // Older version directory should be cleaned up
      expect(fs.existsSync(oldPath)).toBe(false);

      // Registry should be updated to 1.0.1 without duplication
      const reg = JSON.parse(fs.readFileSync(target.extensionsJsonPath, 'utf-8'));
      expect(reg.length).toBe(1);
      expect(reg[0].version).toBe('1.0.1');
    });

    it('reports accurate installation status via getExtensionStatus', () => {
      // Prior to install: not installed
      fs.mkdirSync(path.join(tempHome, '.antigravity-ide'), { recursive: true });
      let statuses = getExtensionStatus(tempHome);
      let agyStatus = statuses.find((s) => s.target.appId === 'antigravity-ide');
      expect(agyStatus?.isInstalled).toBe(false);

      // Install to all detected
      const installResults = installExtensionToAllDetected(tempHome, tempAssets);
      expect(installResults.length).toBeGreaterThan(0);
      expect(installResults[0].success).toBe(true);

      // After install: isInstalled is true with version and path
      statuses = getExtensionStatus(tempHome);
      agyStatus = statuses.find((s) => s.target.appId === 'antigravity-ide');
      expect(agyStatus?.isInstalled).toBe(true);
      expect(agyStatus?.version).toBe(getPackageVersion());
      expect(agyStatus?.installedPath).toBeDefined();
    });
  });
});
