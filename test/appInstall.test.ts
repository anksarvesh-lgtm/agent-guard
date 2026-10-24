import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  ALL_APP_TARGETS,
  detectInstalledApps,
  installToApps,
  antigravityTarget,
  claudeTarget,
  codexTarget,
  cursorTarget,
  windsurfTarget,
  clineTarget,
  zedTarget,
  AGENT_GUARD_AUTO_APPROVE_TOOLS,
  type InstallContext
} from '../src/install/apps.js';
import { configureAutoAcceptGrants } from '../src/cli.js';

describe('Universal Multi-App MCP Installer', () => {
  let tempDir: string;
  let dummyContext: InstallContext;
  const originalEnvHome = process.env.AGENT_GUARD_HOME;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-guard-apps-test-'));
    process.env.AGENT_GUARD_HOME = tempDir;
    dummyContext = {
      nodeBin: '/usr/local/bin/node',
      serverPath: '/repo/dist/index.js',
      hookPath: '/repo/dist/hook/stop-hook.js',
      enforceHookPath: '/repo/dist/hook/post-invocation-hook.js',
      repoRoot: tempDir,
      dryRun: false,
    };
  });

  afterEach(() => {
    if (originalEnvHome !== undefined) {
      process.env.AGENT_GUARD_HOME = originalEnvHome;
    } else {
      delete process.env.AGENT_GUARD_HOME;
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('registers all 7 major coding applications in ALL_APP_TARGETS', () => {
    const ids = ALL_APP_TARGETS.map((t) => t.id);
    expect(ids).toContain('antigravity');
    expect(ids).toContain('claude');
    expect(ids).toContain('codex');
    expect(ids).toContain('cursor');
    expect(ids).toContain('windsurf');
    expect(ids).toContain('cline');
    expect(ids).toContain('zed');
  });

  it('detects installed applications hermetically based on home directory structure', () => {
    // When no app directories exist in isolated home
    expect(detectInstalledApps()).toEqual([]);

    // Create .gemini directory -> antigravity detected
    fs.mkdirSync(path.join(tempDir, '.gemini'), { recursive: true });
    const detected1 = detectInstalledApps();
    expect(detected1.some((a) => a.id === 'antigravity')).toBe(true);

    // Create .cursor directory -> cursor detected
    fs.mkdirSync(path.join(tempDir, '.cursor'), { recursive: true });
    const detected2 = detectInstalledApps();
    expect(detected2.some((a) => a.id === 'cursor')).toBe(true);

    // Create .config/zed directory -> zed detected
    fs.mkdirSync(path.join(tempDir, '.config', 'zed'), { recursive: true });
    const detected3 = detectInstalledApps();
    expect(detected3.some((a) => a.id === 'zed')).toBe(true);
  });

  it('installs to specific target applications and writes valid JSON configs', () => {
    const results = installToApps(['antigravity'], dummyContext);
    expect(results.length).toBe(1);
    expect(results[0].appId).toBe('antigravity');
    expect(results[0].installed).toBe(true);

    const mcpConfigPath = path.join(tempDir, '.gemini', 'config', 'mcp_config.json');
    expect(fs.existsSync(mcpConfigPath)).toBe(true);
    const cfg = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
    expect(cfg.mcpServers['agent-guard']).toBeDefined();
    expect(cfg.mcpServers['agent-guard'].command).toBe('/usr/local/bin/node');
  });

  it('installs to all targets when targetIds is "all"', () => {
    const results = installToApps('all', dummyContext);
    expect(results.length).toBe(ALL_APP_TARGETS.length);
    for (const r of results) {
      expect(r.installed).toBe(true);
    }

    // Verify Cursor config was written
    const cursorConfigPath = path.join(tempDir, '.cursor', 'mcp.json');
    expect(fs.existsSync(cursorConfigPath)).toBe(true);
    const cursorCfg = JSON.parse(fs.readFileSync(cursorConfigPath, 'utf-8'));
    expect(cursorCfg.mcpServers['agent-guard']).toBeDefined();

    // Verify Zed config was written
    const zedConfigPath = path.join(tempDir, '.config', 'zed', 'settings.json');
    expect(fs.existsSync(zedConfigPath)).toBe(true);
    const zedCfg = JSON.parse(fs.readFileSync(zedConfigPath, 'utf-8'));
    expect(zedCfg.experimental.model_context_protocol.servers['agent-guard']).toBeDefined();
  });

  it('installs with "auto" detection fallback when no apps exist', () => {
    // When no apps detected, fallback to Antigravity
    const results = installToApps('auto', dummyContext);
    expect(results.length).toBe(1);
    expect(results[0].appId).toBe('antigravity');
  });

  it('respects dryRun without writing files to disk', () => {
    const dryContext = { ...dummyContext, dryRun: true };
    const res = claudeTarget.install(dryContext);
    expect(res.installed).toBe(true);
    expect(res.appId).toBe('claude');

    const resZed = zedTarget.install(dryContext);
    expect(resZed.installed).toBe(true);
    expect(resZed.appId).toBe('zed');

    const resCursor = cursorTarget.install(dryContext);
    expect(resCursor.installed).toBe(true);
    expect(resCursor.appId).toBe('cursor');

    const resCline = clineTarget.install(dryContext);
    expect(resCline.installed).toBe(true);
    expect(resCline.appId).toBe('cline');

    const resCodex = codexTarget.install(dryContext);
    expect(resCodex.installed).toBe(true);
    expect(resCodex.appId).toBe('codex');

    const resWindsurf = windsurfTarget.install(dryContext);
    expect(resWindsurf.installed).toBe(true);
    expect(resWindsurf.appId).toBe('windsurf');

    // Confirm no files written in dry run
    expect(fs.existsSync(path.join(tempDir, '.claude.json'))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, '.cursor', 'mcp.json'))).toBe(false);
  });

  it('configures autoApprove tools across Antigravity, Claude, Codex, Cursor, Windsurf, Cline', () => {
    installToApps('all', dummyContext);

    // 1. Antigravity
    const antiCfg = JSON.parse(fs.readFileSync(path.join(tempDir, '.gemini', 'config', 'mcp_config.json'), 'utf-8'));
    expect(antiCfg.mcpServers['agent-guard'].autoApprove).toEqual(
      expect.arrayContaining(AGENT_GUARD_AUTO_APPROVE_TOOLS)
    );

    // 2. Cursor
    const cursorCfg = JSON.parse(fs.readFileSync(path.join(tempDir, '.cursor', 'mcp.json'), 'utf-8'));
    expect(cursorCfg.mcpServers['agent-guard'].autoApprove).toEqual(
      expect.arrayContaining(AGENT_GUARD_AUTO_APPROVE_TOOLS)
    );

    // 3. Codex
    const codexCfg = JSON.parse(fs.readFileSync(path.join(tempDir, '.codex', 'mcp.json'), 'utf-8'));
    expect(codexCfg.mcpServers['agent-guard'].autoApprove).toEqual(
      expect.arrayContaining(AGENT_GUARD_AUTO_APPROVE_TOOLS)
    );

    // 4. Windsurf
    const windsurfCfg = JSON.parse(fs.readFileSync(path.join(tempDir, '.codeium', 'windsurf', 'mcp_config.json'), 'utf-8'));
    expect(windsurfCfg.mcpServers['agent-guard'].autoApprove).toEqual(
      expect.arrayContaining(AGENT_GUARD_AUTO_APPROVE_TOOLS)
    );
  });

  it('configures Antigravity IDE auto-accept grants with eager execution and turbo presets', () => {
    const configPath = path.join(tempDir, '.gemini', 'config', 'config.json');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify({ userSettings: {} }), 'utf-8');

    const result = configureAutoAcceptGrants(false);
    expect(result.addedCount).toBeGreaterThan(0);

    const updated = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(updated.userSettings.autoExecutionPolicy).toBe('CASCADE_COMMANDS_AUTO_EXECUTION_EAGER');
    expect(updated.userSettings.permissionPreset).toBe('AGENT_PERMISSION_PRESET_TURBO');
    expect(updated.userSettings.globalPermissionGrants.allow).toEqual(
      expect.arrayContaining([
        'mcp(agent-guard/*)',
        'mcp(agent-guard_agent-guard/*)',
        'mcp(agent-guard/task_start)',
        'mcp(agent-guard/keep_awake)',
        'command(agent-guard)',
        'command(npm run build)',
        'command(git commit)',
      ])
    );
  });
});
