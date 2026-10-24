#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkForUpdates, performUpdate } from './update.js';
import { generateFullProjectMap } from './brief/map.js';
import { getProjectFreshness } from './brief/stale.js';
import {
  installToApps,
  detectInstalledApps,
  ALL_APP_TARGETS,
  type InstallContext,
  type AppInstallResult
} from './install/apps.js';
import {
  loadSkillsIndex,
  listFeaturedSkills,
  searchSkills,
  getSkillInfo,
  getCategories,
  installSkill,
  formatSkillsTable,
  getDefaultSkillsDir
} from './skills/manager.js';
import { globalAwakeManager } from './awake/manager.js';
import { handleTokenCounter } from './tools/tokenCounter.js';
import { handleAccountSwitcher } from './tools/accountSwitcher.js';
import { handleModelCompressor } from './tools/modelCompressor.js';
import { globalAccountManager } from './accounts/index.js';
import { installExtensionToAllDetected, getExtensionStatus } from './extension/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

interface McpServerEntry {
  command: string;
  args: string[];
  autoApprove?: string[];
  disabled?: boolean;
}

interface McpConfig {
  mcpServers?: Record<string, McpServerEntry>;
}

function getHomeDirectory(): string {
  return process.env.AGENT_GUARD_HOME || os.homedir();
}

function getGeminiConfigPath(): string {
  const home = getHomeDirectory();
  return path.join(home, '.gemini', 'config', 'mcp_config.json');
}

function getGeminiSettingsPath(): string {
  const home = getHomeDirectory();
  return path.join(home, '.gemini', 'config', 'config.json');
}

function getGeminiPluginsDir(): string {
  const home = getHomeDirectory();
  return path.join(home, '.gemini', 'config', 'plugins', 'agent-guard');
}

export function configureAutoAcceptGrants(dryRun?: boolean): { addedCount: number; totalCount: number } {
  const settingsFile = getGeminiSettingsPath();
  if (!fs.existsSync(settingsFile)) {
    console.log(`\n4. Antigravity config.json not yet created at ${settingsFile}. Skipping IDE grants update.`);
    return { addedCount: 0, totalCount: 0 };
  }

  console.log(`\n4. Enabling automatic tool acceptance in Antigravity IDE...`);
  if (dryRun) {
    console.log('   [Dry Run] Would configure globalPermissionGrants in config.json');
    return { addedCount: 0, totalCount: 0 };
  }

  try {
    const raw = fs.readFileSync(settingsFile, 'utf-8');
    const cfg = JSON.parse(raw);
    cfg.userSettings = cfg.userSettings || {};
    cfg.userSettings.globalPermissionGrants = cfg.userSettings.globalPermissionGrants || {};
    cfg.userSettings.globalPermissionGrants.allow = cfg.userSettings.globalPermissionGrants.allow || [];

    // Ensure frictionless agent execution policy
    if (!cfg.userSettings.autoExecutionPolicy) {
      cfg.userSettings.autoExecutionPolicy = 'CASCADE_COMMANDS_AUTO_EXECUTION_EAGER';
    }
    if (!cfg.userSettings.permissionPreset) {
      cfg.userSettings.permissionPreset = 'AGENT_PERMISSION_PRESET_TURBO';
    }
    if (cfg.userSettings.enableTerminalSandbox === undefined) {
      cfg.userSettings.enableTerminalSandbox = false;
    }
    if (!cfg.userSettings.nonWorkspaceFileAccessPolicy) {
      cfg.userSettings.nonWorkspaceFileAccessPolicy = 'AGENT_SETTING_POLICY_ALLOW';
    }

    const grantsToAdd = [
      // Wildcard grants
      'mcp(agent-guard/*)',
      'mcp(agent-guard_agent-guard/*)',
      // Standard MCP tool grants
      'mcp(agent-guard/task_start)',
      'mcp(agent-guard/task_checkpoint)',
      'mcp(agent-guard/task_status)',
      'mcp(agent-guard/keep_awake)',
      'mcp(agent-guard/repo_brief)',
      'mcp(agent-guard/agent_enforce)',
      'mcp(agent-guard/project_map)',
      'mcp(agent-guard/token_counter)',
      'mcp(agent-guard/account_switcher)',
      // Antigravity plugin-scoped tool grants
      'mcp(agent-guard_agent-guard/task_start)',
      'mcp(agent-guard_agent-guard/task_checkpoint)',
      'mcp(agent-guard_agent-guard/task_status)',
      'mcp(agent-guard_agent-guard/keep_awake)',
      'mcp(agent-guard_agent-guard/repo_brief)',
      'mcp(agent-guard_agent-guard/agent_enforce)',
      'mcp(agent-guard_agent-guard/project_map)',
      'mcp(agent-guard_agent-guard/token_counter)',
      'mcp(agent-guard_agent-guard/account_switcher)',
      // Command execution grants for autonomous agent workflow
      'command(agent-guard)',
      'command(npx agent-guard)',
      'command(npm run build)',
      'command(npm test)',
      'command(npm run doctor)',
      'command(npm run update)',
      'command(npm run map)',
      'command(npm run skills)',
      'command(npm run tokens)',
      'command(npm run accounts)',
      'command(./install.sh)',
      'command(node dist/cli.js)',
      'command(node dist/cli.js doctor)',
      'command(node dist/cli.js install)',
      'command(node dist/cli.js update)',
      'command(node dist/cli.js map)',
      'command(node dist/cli.js skills)',
      'command(node dist/cli.js auto-accept)',
      'command(node dist/cli.js awake)',
      'command(git status)',
      'command(git add)',
      'command(git commit)',
      'command(git push)',
      'command(git pull)',
      'command(git diff)',
      'command(git log)',
      'command(git remote)'
    ];

    let count = 0;
    for (const grant of grantsToAdd) {
      if (!cfg.userSettings.globalPermissionGrants.allow.includes(grant)) {
        cfg.userSettings.globalPermissionGrants.allow.push(grant);
        count++;
      }
    }

    fs.writeFileSync(settingsFile, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
    console.log(`   ✅ Enabled auto-accept for ${grantsToAdd.length} Agent Guard tools and actions (${count} new grants saved).`);
    return { addedCount: count, totalCount: cfg.userSettings.globalPermissionGrants.allow.length };
  } catch (err: any) {
    console.warn(`   ⚠️ Warning: Could not update auto-accept grants: ${err.message}`);
    return { addedCount: 0, totalCount: 0 };
  }
}

export function installPluginBundle(nodeBin: string, serverPath: string, hookPath: string, enforceHookPath: string, dryRun?: boolean): void {
  const pluginDir = getGeminiPluginsDir();
  const templateDir = path.join(REPO_ROOT, 'templates', 'plugin', 'agent-guard');
  if (!fs.existsSync(templateDir)) return;

  console.log(`\n3. Installing @agent-guard Antigravity plugin into ${pluginDir}...`);
  if (dryRun) {
    console.log('   [Dry Run] Would deploy @agent-guard plugin bundle');
    return;
  }

  try {
    fs.mkdirSync(path.join(pluginDir, 'agents'), { recursive: true });
    fs.mkdirSync(path.join(pluginDir, 'skills'), { recursive: true });
    fs.mkdirSync(path.join(pluginDir, 'rules'), { recursive: true });
    fs.mkdirSync(path.join(pluginDir, 'assets'), { recursive: true });

    // Copy static files
    fs.copyFileSync(path.join(templateDir, 'plugin.json'), path.join(pluginDir, 'plugin.json'));
    fs.copyFileSync(path.join(templateDir, 'agents', 'agent-guard.md'), path.join(pluginDir, 'agents', 'agent-guard.md'));
    fs.copyFileSync(path.join(templateDir, 'rules', 'AGENTS.md'), path.join(pluginDir, 'rules', 'AGENTS.md'));
    if (fs.existsSync(path.join(templateDir, 'assets', 'logo.svg'))) {
      fs.copyFileSync(path.join(templateDir, 'assets', 'logo.svg'), path.join(pluginDir, 'assets', 'logo.svg'));
    }

    // Deploy all bundled skills
    const skillsTemplateDir = path.join(templateDir, 'skills');
    if (fs.existsSync(skillsTemplateDir)) {
      const skillEntries = fs.readdirSync(skillsTemplateDir, { withFileTypes: true });
      for (const entry of skillEntries) {
        if (entry.isDirectory()) {
          const srcSkillDir = path.join(skillsTemplateDir, entry.name);
          const destSkillDir = path.join(pluginDir, 'skills', entry.name);
          fs.mkdirSync(destSkillDir, { recursive: true });
          const skillFiles = fs.readdirSync(srcSkillDir);
          for (const file of skillFiles) {
            fs.copyFileSync(path.join(srcSkillDir, file), path.join(destSkillDir, file));
          }
        }
      }
    }

    // Write rendered mcp_config.json
    const mcpContent = JSON.stringify({
      mcpServers: {
        'agent-guard': {
          command: nodeBin,
          args: [serverPath],
          autoApprove: [
            'task_start',
            'task_checkpoint',
            'task_status',
            'keep_awake',
            'repo_brief',
            'agent_enforce',
            'project_map'
          ]
        }
      }
    }, null, 2);
    fs.writeFileSync(path.join(pluginDir, 'mcp_config.json'), mcpContent + '\n', 'utf-8');

    // Write rendered hooks.json with Stop and PostInvocation
    const hooksContent = JSON.stringify({
      'agent-guard-supervisor': {
        Stop: [
          {
            type: 'command',
            command: `${nodeBin} ${hookPath}`
          }
        ],
        PostInvocation: [
          {
            type: 'command',
            command: `${nodeBin} ${enforceHookPath}`
          }
        ]
      }
    }, null, 2);
    fs.writeFileSync(path.join(pluginDir, 'hooks.json'), hooksContent + '\n', 'utf-8');

    console.log('   ✅ Installed Antigravity plugin: `@agent-guard` with Stop & PostInvocation supervisor hooks.');
  } catch (err: any) {
    console.warn(`   ⚠️ Warning: Could not install plugin bundle: ${err.message}`);
  }
}

function detectNodeBinary(): string {
  // Prefer current running node binary
  if (process.execPath && fs.existsSync(process.execPath)) {
    return process.execPath;
  }
  try {
    return execSync('which node', { encoding: 'utf-8' }).trim();
  } catch {
    return 'node';
  }
}

export interface InstallOptions {
  targetWorkspace?: string;
  dryRun?: boolean;
  apps?: string[] | 'all' | 'auto';
}

export function installAgentGuard(options: InstallOptions = {}): void {
  const nodeBin = detectNodeBinary();
  const serverPath = path.join(REPO_ROOT, 'dist', 'index.js');
  const hookPath = path.join(REPO_ROOT, 'dist', 'hook', 'stop-hook.js');
  const enforceHookPath = path.join(REPO_ROOT, 'dist', 'hook', 'post-invocation-hook.js');

  console.log('🛡️  Agent Guard — Universal MCP & Multi-App Installer\n');
  console.log(`• Repository:    ${REPO_ROOT}`);
  console.log(`• Node binary:   ${nodeBin}`);
  console.log(`• MCP Server:    ${serverPath}`);
  console.log(`• Stop Hook:     ${hookPath}`);
  console.log(`• Enforce Hook:  ${enforceHookPath}\n`);

  if (!fs.existsSync(serverPath)) {
    console.error('❌ Error: dist/index.js not found. Run `npm run build` before installing.');
    process.exit(1);
  }

  const ctx: InstallContext = {
    nodeBin,
    serverPath,
    hookPath,
    enforceHookPath,
    repoRoot: REPO_ROOT,
    dryRun: options.dryRun,
  };

  const appSelection = options.apps || 'auto';
  console.log(`1. Configuring MCP server for target applications (${appSelection === 'auto' ? 'auto-detecting installed apps' : appSelection})...`);
  const installResults = installToApps(appSelection, ctx);

  for (const res of installResults) {
    if (res.installed) {
      console.log(`   ✅ [${res.appName}] ${res.message}`);
    } else {
      console.log(`   ⚠️ [${res.appName}] ${res.message}`);
    }
  }

  // 2. Configure target workspace (if provided or current dir)
  const workspace = path.resolve(options.targetWorkspace || process.cwd());
  const hasGit = fs.existsSync(path.join(workspace, '.git'));

  if (hasGit || options.targetWorkspace) {
    console.log(`\n2. Configuring workspace supervisor at ${workspace}...`);

    // Setup .agents/hooks.json
    const agentsDir = path.join(workspace, '.agents');
    const hooksFile = path.join(agentsDir, 'hooks.json');
    let hooksData: any = {};

    if (fs.existsSync(hooksFile)) {
      try {
        hooksData = JSON.parse(fs.readFileSync(hooksFile, 'utf-8'));
      } catch {
        hooksData = {};
      }
    } else if (!options.dryRun) {
      fs.mkdirSync(agentsDir, { recursive: true });
    }

    hooksData['agent-guard-supervisor'] = {
      Stop: [
        {
          type: 'command',
          command: `${nodeBin} ${hookPath}`,
        },
      ],
      PostInvocation: [
        {
          type: 'command',
          command: `${nodeBin} ${enforceHookPath}`,
        },
      ],
    };

    if (!options.dryRun) {
      fs.writeFileSync(hooksFile, JSON.stringify(hooksData, null, 2) + '\n', 'utf-8');
      console.log('   ✅ Configured Stop & PostInvocation supervisor hooks in .agents/hooks.json');

      // Setup AGENTS.md rules
      const rulesSource = path.join(REPO_ROOT, 'templates', 'AGENT_RULES.md');
      const rulesDest = path.join(workspace, 'AGENTS.md');
      if (fs.existsSync(rulesSource) && !fs.existsSync(rulesDest)) {
        fs.copyFileSync(rulesSource, rulesDest);
        console.log('   ✅ Installed default workspace rules into AGENTS.md');
      } else if (fs.existsSync(rulesDest)) {
        console.log('   ℹ️  Workspace already contains AGENTS.md (preserved)');
      }
    } else {
      console.log('   [Dry Run] Would configure .agents/hooks.json and AGENTS.md');
    }
  }

  // 3. Deploy Antigravity @agent-guard plugin
  installPluginBundle(nodeBin, serverPath, hookPath, enforceHookPath, options.dryRun);

  // 4. Configure auto-accept in IDE
  configureAutoAcceptGrants(options.dryRun);

  // 5. Install Agent Guard extension into coding applications
  console.log('\n5. Installing Agent Guard Extension into coding applications...');
  if (!options.dryRun) {
    const extResults = installExtensionToAllDetected(undefined, path.join(REPO_ROOT, 'assets'));
    for (const res of extResults) {
      if (res.success) {
        console.log(`   ✅ Installed Agent Guard extension into ${res.target.name}`);
      } else {
        console.log(`   ⚠️ Failed to install extension into ${res.target.name}: ${res.error}`);
      }
    }
  } else {
    console.log('   [Dry Run] Would install Agent Guard extension into detected IDEs');
  }

  console.log('\n🎉 Universal Installation Complete!');
  console.log('----------------------------------------------------');
  console.log('Agent Guard is now active across your coding environments.');
  console.log('Restart your IDE / coding CLI to load new MCP tools.');
  console.log('Verify at any time with: `npm run doctor` or `node dist/cli.js doctor`\n');
}

export const installToAntigravity = installAgentGuard;

export function doctorCheck(): void {
  console.log('🩺 Agent Guard Readiness Doctor\n');

  const nodeBin = detectNodeBinary();
  console.log(`• Node version:    ${process.version} (${nodeBin})`);

  // Check MCP registration
  const mcpConfigFile = getGeminiConfigPath();
  if (fs.existsSync(mcpConfigFile)) {
    try {
      const cfg: McpConfig = JSON.parse(fs.readFileSync(mcpConfigFile, 'utf-8'));
      if (cfg.mcpServers?.['agent-guard']) {
        const auto = cfg.mcpServers['agent-guard'].autoApprove || [];
        console.log(`• MCP Config:      [OK] agent-guard is registered in mcp_config.json (${auto.length} auto-approved tools)`);
      } else {
        console.log('• MCP Config:      [WARN] agent-guard not found in mcp_config.json');
      }
    } catch {
      console.log('• MCP Config:      [FAIL] Corrupted mcp_config.json');
    }
  } else {
    console.log('• MCP Config:      [FAIL] ~/.gemini/config/mcp_config.json missing');
  }

  // Check @agent-guard plugin registration
  const pluginDir = getGeminiPluginsDir();
  const pluginManifest = path.join(pluginDir, 'plugin.json');
  console.log(`• Mention @agent-guard: ${fs.existsSync(pluginManifest) ? '[OK] Plugin active in Antigravity' : '[WARN] Run npm run install:antigravity to enable @agent-guard mention'}`);

  // Check auto-accept status in IDE
  const settingsFile = getGeminiSettingsPath();
  if (fs.existsSync(settingsFile)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
      const allows: string[] = cfg.userSettings?.globalPermissionGrants?.allow || [];
      const hasGrants = allows.some((g: string) => g.includes('agent-guard'));
      const eager = cfg.userSettings?.autoExecutionPolicy === 'CASCADE_COMMANDS_AUTO_EXECUTION_EAGER';
      const turbo = cfg.userSettings?.permissionPreset === 'AGENT_PERMISSION_PRESET_TURBO';
      const statusDetails: string[] = [];
      if (hasGrants) statusDetails.push('Grants OK');
      if (eager) statusDetails.push('Eager execution OK');
      if (turbo) statusDetails.push('Turbo preset OK');

      console.log(`• Auto-Accept IDE: ${hasGrants ? `[OK] ${statusDetails.join(', ')}` : '[WARN] Missing auto-accept grants (run: node dist/cli.js auto-accept)'}`);
    } catch {
      console.log('• Auto-Accept IDE: [WARN] Could not parse config.json');
    }
  } else {
    console.log('• Auto-Accept IDE: [INFO] config.json not yet created');
  }

  // Check detected coding apps
  const apps = detectInstalledApps();
  console.log(`• Detected Apps:   ${apps.map((a) => a.name).join(', ')} (${apps.length} environments ready)`);

  // Check Git upstream status for auto-update
  const updateStatus = checkForUpdates(REPO_ROOT);
  if (updateStatus.isGit) {
    if (updateStatus.hasUpdate) {
      console.log(`• Auto-Update:     [UPDATE AVAILABLE] ${updateStatus.behindCount} commits behind origin/main (run 'npm run update')`);
    } else if (updateStatus.error) {
      console.log(`• Auto-Update:     [OFFLINE] ${updateStatus.error}`);
    } else {
      console.log(`• Auto-Update:     [OK] Up to date with origin/main (${updateStatus.currentSha?.slice(0, 7)})`);
    }
  } else {
    console.log('• Auto-Update:     [INFO] Standalone installation (not a git clone)');
  }

  // Check build files
  const serverPath = path.join(REPO_ROOT, 'dist', 'index.js');
  const hookPath = path.join(REPO_ROOT, 'dist', 'hook', 'stop-hook.js');
  const enforceHookPath = path.join(REPO_ROOT, 'dist', 'hook', 'post-invocation-hook.js');
  console.log(`• Server Binary:   ${fs.existsSync(serverPath) ? '[OK]' : '[FAIL] Missing'} dist/index.js`);
  console.log(`• Stop Hook:       ${fs.existsSync(hookPath) ? '[OK]' : '[FAIL] Missing'} dist/hook/stop-hook.js`);
  console.log(`• Enforce Hook:    ${fs.existsSync(enforceHookPath) ? '[OK]' : '[FAIL] Missing'} dist/hook/post-invocation-hook.js`);

  // Check sleep inhibitor support
  if (process.platform === 'darwin') {
    try {
      execSync('which caffeinate', { stdio: 'ignore' });
      console.log('• Sleep Inhibitor: [OK] macOS native caffeinate available (-d -i -m -s -u verified)');
    } catch {
      console.log('• Sleep Inhibitor: [FAIL] caffeinate not found');
    }
  } else if (process.platform === 'win32') {
    console.log('• Sleep Inhibitor: [OK] Windows SetThreadExecutionState support ready');
  } else {
    try {
      execSync('which systemd-inhibit', { stdio: 'ignore' });
      console.log('• Sleep Inhibitor: [OK] Linux systemd-inhibit available');
    } catch {
      console.log('• Sleep Inhibitor: [WARN] systemd-inhibit not found (graceful sleep fallback active)');
    }
  }

  // Check active awake lease
  const leaseStatus = globalAwakeManager.status();
  console.log(`• Awake Lease:     ${leaseStatus.isHolding ? `[ACTIVE] Holding until ${leaseStatus.heldUntil} (${leaseStatus.minutesRemaining}m remaining)` : '[INACTIVE] Normal OS sleep policy'}`);

  // Check Account Switcher pool
  try {
    const activeAcc = globalAccountManager.getActiveAccount();
    const accCfg = globalAccountManager.getConfig();
    if (activeAcc) {
      const autoText = accCfg.autoRotateEnabled ? `Auto-switch at <=${accCfg.thresholdPercent}%: ENABLED` : 'Auto-switch: DISABLED';
      console.log(`• Account Switcher: [OK] Active: "${activeAcc.name}" (${activeAcc.id}) (${autoText}, ${accCfg.accounts.length} in pool)`);
    } else {
      console.log('• Account Switcher: [INFO] No account pool configured');
    }
  } catch {
    console.log('• Account Switcher: [WARN] Could not read accounts.json');
  }

  // Check IDE Extensions
  try {
    const extStatuses = getExtensionStatus();
    const installedExts = extStatuses.filter((s) => s.isInstalled);
    if (installedExts.length > 0) {
      console.log(`• IDE Extension:   [OK] Installed in ${installedExts.map((e) => `${e.target.name} (v${e.version || '1.0.0'})`).join(', ')}`);
    } else {
      console.log('• IDE Extension:   [INFO] Not yet installed in IDEs (run: npm run extension:install)');
    }
  } catch {
    console.log('• IDE Extension:   [WARN] Could not inspect IDE extensions');
  }

  console.log('');
}

// CLI argument parsing
const args = process.argv.slice(2);
const command = args[0] || 'install';

if (command === 'install') {
  const targetIdx = args.indexOf('--workspace');
  const targetWorkspace = targetIdx !== -1 ? args[targetIdx + 1] : undefined;
  const dryRun = args.includes('--dry-run');
  const all = args.includes('--all');

  let apps: string[] | 'all' | 'auto' = 'auto';
  if (all) {
    apps = 'all';
  } else {
    const selected: string[] = [];
    if (args.includes('--antigravity') || args.includes('--gemini')) selected.push('antigravity');
    if (args.includes('--claude')) selected.push('claude');
    if (args.includes('--cursor')) selected.push('cursor');
    if (args.includes('--codex')) selected.push('codex');
    if (args.includes('--windsurf')) selected.push('windsurf');
    if (args.includes('--cline') || args.includes('--roo')) selected.push('cline');
    if (args.includes('--zed')) selected.push('zed');
    if (selected.length > 0) apps = selected;
  }
  installAgentGuard({ targetWorkspace, dryRun, apps });
} else if (command === 'update') {
  console.log('🔄 Checking for Agent Guard updates...\n');
  const res = performUpdate(REPO_ROOT);
  if (res.updated) {
    console.log(`✅ ${res.message}`);
    console.log(`• Previous Commit: ${res.previousSha?.slice(0, 7)}`);
    console.log(`• Updated Commit:  ${res.newSha?.slice(0, 7)}`);
    console.log('\nRunning readiness doctor...');
    doctorCheck();
  } else if (res.success) {
    console.log(`✅ ${res.message}`);
  } else {
    console.error(`⚠️ ${res.message}`);
    process.exit(1);
  }
} else if (command === 'map') {
  const targetIdx = args.indexOf('--workspace');
  const targetWorkspace = path.resolve(targetIdx !== -1 ? args[targetIdx + 1] : process.cwd());
  console.log(`🗺️ Generating project map and architecture chart for ${targetWorkspace}...\n`);
  const fresh = getProjectFreshness(targetWorkspace);
  const mapMd = generateFullProjectMap(targetWorkspace, fresh.files);
  const agentDir = path.join(targetWorkspace, '.agent');
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir, { recursive: true });
  }
  const mapFile = path.join(agentDir, 'project_map.md');
  fs.writeFileSync(mapFile, mapMd, 'utf-8');
  console.log(`✅ Saved project map to: ${mapFile}\n`);
  console.log('--- Project Map Preview ---');
  console.log(mapMd);
} else if (command === 'doctor') {
  doctorCheck();
} else if (command === 'skills') {
  const sub = args[1] || 'list';
  if (sub === 'list') {
    const featured = listFeaturedSkills(REPO_ROOT);
    const total = loadSkillsIndex(REPO_ROOT).length;
    console.log('🛡️ Agent Guard Awesome Skills Catalog\n');
    console.log(`Curated by Sarvesh (@anksarvesh-lgtm) | Total Skills: ${total}`);
    console.log('Supervised by @agent-guard • Apache-2.0 License\n');
    console.log('Featured Core Skills:');
    console.log(formatSkillsTable(featured));
    console.log('\nCommands:');
    console.log('  node dist/cli.js skills search <term>');
    console.log('  node dist/cli.js skills info <id>');
    console.log('  node dist/cli.js skills install <id> [--path <dir>]');
    console.log('  node dist/cli.js skills categories\n');
  } else if (sub === 'search') {
    const query = args[2] || '';
    const results = searchSkills(query, { limit: 25 }, REPO_ROOT);
    console.log(`🔍 Search Results for "${query}" (${results.length} found):\n`);
    console.log(formatSkillsTable(results));
    console.log('\nTip: Run `node dist/cli.js skills info <id>` for full details.');
  } else if (sub === 'info') {
    const id = args[2];
    if (!id) {
      console.error('Usage: node dist/cli.js skills info <skill-id>');
      process.exit(1);
    }
    const skill = getSkillInfo(id, REPO_ROOT);
    if (!skill) {
      console.error(`Skill "${id}" not found.`);
      process.exit(1);
    }
    console.log(`\n🛡️ Skill: ${skill.name} (${skill.id})`);
    console.log('----------------------------------------------------');
    console.log(`• Category:    ${skill.category}`);
    console.log(`• Risk Level:  ${skill.risk || 'safe'}`);
    console.log(`• Source:      ${skill.source || 'community'}`);
    console.log(`• Author:      ${skill.author || 'Curated by Agent Guard'}`);
    console.log(`• Tags:        ${(skill.tags || []).join(', ') || 'none'}`);
    console.log(`• Supervisor:  @agent-guard`);
    console.log(`\nDescription:\n  ${skill.description}`);
    console.log(`\nInstall Command:`);
    console.log(`  node dist/cli.js skills install ${skill.id}\n`);
  } else if (sub === 'categories') {
    const cats = getCategories(REPO_ROOT);
    console.log('📂 Skill Categories:\n');
    for (const c of cats) {
      console.log(`  • ${c.category.padEnd(25)} (${c.count} skills)`);
    }
    console.log(`\nTotal Categories: ${cats.length}`);
  } else if (sub === 'install') {
    const id = args[2];
    if (!id) {
      console.error('Usage: node dist/cli.js skills install <skill-id> [--path <dir>]');
      process.exit(1);
    }
    const pathIdx = args.indexOf('--path');
    const targetDir = pathIdx !== -1 ? args[pathIdx + 1] : undefined;
    const res = installSkill(id, { targetDir, repoRoot: REPO_ROOT });
    if (res.success) {
      console.log(`✅ ${res.message}`);
    } else {
      console.error(`❌ ${res.message}`);
      process.exit(1);
    }
  } else {
    console.log('Usage:');
    console.log('  node dist/cli.js skills list');
    console.log('  node dist/cli.js skills search <query>');
    console.log('  node dist/cli.js skills info <id>');
    console.log('  node dist/cli.js skills install <id> [--path <dir>]');
    console.log('  node dist/cli.js skills categories');
  }
} else if (command === 'auto-accept') {
  const dryRun = args.includes('--dry-run');
  configureAutoAcceptGrants(dryRun);
} else if (command === 'awake') {
  const sub = args[1] || 'status';
  if (sub === 'hold') {
    const mins = parseInt(args[2] || '30', 10);
    const status = globalAwakeManager.hold(mins, 'CLI manual hold');
    console.log(`🛡️ Awake lease active: holding system awake for ${status.minutesRemaining} minutes (until ${status.heldUntil})`);
    if (status.warning) console.log(`   Notice: ${status.warning}`);
  } else if (sub === 'release') {
    globalAwakeManager.release();
    console.log('🛡️ Awake lease released. Operating system sleep restored to normal.');
  } else {
    const status = globalAwakeManager.status();
    if (status.isHolding) {
      console.log(`🛡️ Awake lease is ACTIVE: holding until ${status.heldUntil} (${status.minutesRemaining}m remaining, total ${status.totalTaskHeldMinutes}m held).`);
    } else {
      console.log('🛡️ Awake lease is INACTIVE: normal operating system sleep policy applies.');
    }
  }
} else if (command === 'tokens') {
  const modelIdx = args.indexOf('--model');
  const targetModel = modelIdx !== -1 ? args[modelIdx + 1] : undefined;
  const fileIdx = args.indexOf('--file');
  const targetFile = fileIdx !== -1 ? args[fileIdx + 1] : (args[1] && !args[1].startsWith('--') ? args[1] : undefined);
  const textIdx = args.indexOf('--text');
  const targetText = textIdx !== -1 ? args[textIdx + 1] : undefined;
  const noCompare = args.includes('--no-compare');

  const report = handleTokenCounter({
    model: targetModel,
    file_path: targetFile,
    text: targetText,
    compare_all: !noCompare,
    project_path: process.cwd(),
  });
  console.log(report);
} else if (command === 'accounts') {
  const sub = args[1] || 'status';
  if (sub === 'list') {
    console.log(handleAccountSwitcher({ action: 'list', project_path: process.cwd() }));
  } else if (sub === 'status') {
    console.log(handleAccountSwitcher({ action: 'status', project_path: process.cwd() }));
  } else if (sub === 'switch') {
    const accId = args[2];
    if (!accId) {
      console.error('Usage: node dist/cli.js accounts switch <account-id>');
      process.exit(1);
    }
    console.log(handleAccountSwitcher({ action: 'switch', account_id: accId, project_path: process.cwd() }));
  } else if (sub === 'snapshot') {
    const rawName = args[2] && !args[2].startsWith('--') ? args[2] : undefined;
    const idIdx = args.indexOf('--id');
    const customId = idIdx !== -1 ? args[idIdx + 1] : undefined;
    const nameIdx = args.indexOf('--name');
    const customName = nameIdx !== -1 ? args[nameIdx + 1] : rawName;

    const res = globalAccountManager.snapshotActiveSession(customId, customName);
    if (res.success) {
      console.log(`✅ ${res.message}`);
      console.log(`• ID: "${res.account?.id}"`);
      console.log(`• Display Name: "${res.account?.name}"`);
      console.log(`• Token Saved: ${res.account?.tokenFilePath}`);
      console.log(`• Headroom: ${res.account?.remainingPercent}%`);
    } else {
      console.error(`❌ Snapshot failed: ${res.message}`);
      process.exit(1);
    }
  } else if (sub === 'add') {
    const isSnapshot = args.includes('--snapshot');
    const accId = args[2] && !args[2].startsWith('--') ? args[2] : undefined;

    if (isSnapshot) {
      const nameIdx = args.indexOf('--name');
      const name = nameIdx !== -1 ? args[nameIdx + 1] : accId;
      const res = globalAccountManager.snapshotActiveSession(accId, name);
      if (res.success) {
        console.log(`✅ ${res.message}`);
        process.exit(0);
      } else {
        console.error(`❌ Snapshot failed: ${res.message}`);
        process.exit(1);
      }
    }

    if (!accId) {
      console.log('🛡️  Agent Guard — Add Account Options:\n');
      console.log('1. Snapshot Currently Logged-in Antigravity Session:');
      console.log('   node dist/cli.js accounts snapshot [name] [--id <id>]\n');
      console.log('2. Add Token File:');
      console.log('   node dist/cli.js accounts add <id> --name <name> --token-file <path>\n');
      console.log('3. Add Raw Token JSON / JWT:');
      console.log('   node dist/cli.js accounts add <id> --name <name> --token \'<json_or_jwt>\'\n');
      console.log('4. Add API Key:');
      console.log('   node dist/cli.js accounts add <id> --name <name> --api-key <key>\n');
      console.log('5. Import Token File:');
      console.log('   node dist/cli.js accounts import <path> [--id <id>] [--name <name>]\n');
      process.exit(1);
    }

    const nameIdx = args.indexOf('--name');
    const name = nameIdx !== -1 ? args[nameIdx + 1] : accId;
    const fileIdx = args.indexOf('--token-file');
    const tokenFile = fileIdx !== -1 ? args[fileIdx + 1] : undefined;
    const tokenIdx = args.indexOf('--token');
    const tokenContent = tokenIdx !== -1 ? args[tokenIdx + 1] : undefined;
    const keyIdx = args.indexOf('--api-key');
    const apiKey = keyIdx !== -1 ? args[keyIdx + 1] : undefined;

    console.log(handleAccountSwitcher({
      action: 'add',
      account_id: accId,
      name,
      token_content: tokenContent,
      token_source_file: tokenFile,
      api_key: apiKey,
      project_path: process.cwd()
    }));
  } else if (sub === 'import') {
    const filePath = args[2];
    if (!filePath || filePath.startsWith('--')) {
      console.error('Usage: node dist/cli.js accounts import <file-path> [--id <id>] [--name <name>]');
      process.exit(1);
    }
    const idIdx = args.indexOf('--id');
    const customId = idIdx !== -1 ? args[idIdx + 1] : undefined;
    const nameIdx = args.indexOf('--name');
    const customName = nameIdx !== -1 ? args[nameIdx + 1] : undefined;

    const res = globalAccountManager.importAccountFile(filePath, customId, customName);
    if (res.success) {
      console.log(`✅ ${res.message}`);
    } else {
      console.error(`❌ Import failed: ${res.message}`);
      process.exit(1);
    }
  } else if (sub === 'remove') {
    const accId = args[2];
    if (!accId) {
      console.error('Usage: node dist/cli.js accounts remove <account-id>');
      process.exit(1);
    }
    const res = globalAccountManager.removeAccount(accId);
    if (res.success) {
      console.log(`✅ ${res.message}`);
    } else {
      console.error(`❌ Remove failed: ${res.message}`);
      process.exit(1);
    }
  } else if (sub === 'rotate') {
    console.log(handleAccountSwitcher({ action: 'auto_rotate', project_path: process.cwd() }));
  } else if (sub === 'auto-switch') {
    const setting = args[2]?.toLowerCase();
    const enabled = setting === 'on' || setting === 'true' || setting === '1';
    const threshIdx = args.indexOf('--threshold');
    const threshold = threshIdx !== -1 ? parseFloat(args[threshIdx + 1]) : 1.0;
    console.log(handleAccountSwitcher({
      action: 'configure',
      enabled,
      threshold_percent: threshold,
      project_path: process.cwd()
    }));
  } else if (sub === 'proxy' || sub === 'failover') {
    console.log(handleAccountSwitcher({ action: 'failover_proxy', project_path: process.cwd() }));
  } else {
    console.log('Usage:');
    console.log('  node dist/cli.js accounts list');
    console.log('  node dist/cli.js accounts status');
    console.log('  node dist/cli.js accounts snapshot [name] [--id <id>]');
    console.log('  node dist/cli.js accounts switch <account-id>');
    console.log('  node dist/cli.js accounts add <id> [--name <name>] [--token <json>] [--token-file <file>] [--api-key <key>] [--snapshot]');
    console.log('  node dist/cli.js accounts import <file-path> [--id <id>] [--name <name>]');
    console.log('  node dist/cli.js accounts remove <account-id>');
    console.log('  node dist/cli.js accounts rotate');
    console.log('  node dist/cli.js accounts auto-switch <on|off> [--threshold <pct>]');
    console.log('  node dist/cli.js accounts proxy');
  }
} else if (command === 'compress') {
  const sub = args[1] || 'list-algos';
  if (sub === 'list-algos' || sub === 'algos') {
    console.log(handleModelCompressor({ action: 'list_algos' }));
  } else if (sub === 'list-models' || sub === 'models') {
    console.log(handleModelCompressor({ action: 'list_models' }));
  } else if (sub === 'estimate') {
    const params = parseFloat(args[2] || '7');
    const bitsIdx = args.indexOf('--bits');
    const bits = bitsIdx !== -1 ? parseInt(args[bitsIdx + 1], 10) : 4;
    console.log(handleModelCompressor({ action: 'estimate', param_billions: params, weight_bits: bits }));
  } else if (sub === 'recommend') {
    const modelType = args[2] || 'llama3';
    const vramIdx = args.indexOf('--vram');
    const vram = vramIdx !== -1 ? parseFloat(args[vramIdx + 1]) : 24;
    console.log(handleModelCompressor({ action: 'recommend', model_type: modelType, available_vram_gb: vram }));
  } else if (sub === 'generate') {
    const modelType = args[2] || 'Llama';
    const pathIdx = args.indexOf('--path');
    const modelPath = pathIdx !== -1 ? args[pathIdx + 1] : 'meta-llama/Meta-Llama-3-8B';
    const methodIdx = args.indexOf('--method');
    const method = methodIdx !== -1 ? args[methodIdx + 1] : 'Awq';
    console.log(handleModelCompressor({ action: 'generate_config', model_type: modelType, model_path: modelPath, method }));
  } else {
    console.log('Usage:');
    console.log('  node dist/cli.js compress list-algos');
    console.log('  node dist/cli.js compress list-models');
    console.log('  node dist/cli.js compress estimate <param-billions> [--bits <2|3|4|8>]');
    console.log('  node dist/cli.js compress recommend <model-type> [--vram <gb>]');
    console.log('  node dist/cli.js compress generate <model-type> [--path <path>] [--method <method>]');
  }
} else if (command === 'extension') {
  const sub = args[1] || 'status';
  if (sub === 'install') {
    console.log('📦 Installing Agent Guard Extension into coding applications...\n');
    const results = installExtensionToAllDetected(undefined, path.join(REPO_ROOT, 'assets'));
    for (const r of results) {
      if (r.success) {
        console.log(`✅ ${r.message}`);
      } else {
        console.error(`❌ ${r.message}`);
      }
    }
    console.log('\nExtension installation complete. Restart your editor to activate the Agent Guard status bar!');
  } else if (sub === 'status') {
    console.log('🛡️ Agent Guard IDE Extension Status\n');
    const statuses = getExtensionStatus();
    for (const s of statuses) {
      const mark = s.isInstalled ? '✅ INSTALLED' : (s.target.isDetected ? '⚪ DETECTED (Not installed)' : '❌ Not detected');
      console.log(`• ${s.target.name}: ${mark}`);
      if (s.isInstalled) {
        console.log(`  Version: v${s.version || '1.0.0'}`);
        console.log(`  Path:    ${s.installedPath}`);
      }
    }
    console.log('\nTip: Run `node dist/cli.js extension install` to install into detected editors.');
  } else {
    console.log('Usage:');
    console.log('  node dist/cli.js extension install');
    console.log('  node dist/cli.js extension status');
  }
} else {
  console.log('Usage:');
  console.log('  node dist/cli.js install [--all|--claude|--cursor|--codex|--antigravity|--windsurf|--cline|--zed] [--workspace <path>] [--dry-run]');
  console.log('  node dist/cli.js extension [install|status]');
  console.log('  node dist/cli.js auto-accept [--dry-run]');
  console.log('  node dist/cli.js awake [status|hold <mins>|release]');
  console.log('  node dist/cli.js tokens [file] [--model <name>] [--text <str>] [--no-compare]');
  console.log('  node dist/cli.js accounts [list|status|switch|add|rotate|auto-switch]');
  console.log('  node dist/cli.js compress [list-algos|list-models|estimate|recommend|generate]');
  console.log('  node dist/cli.js map [--workspace <path>]');
  console.log('  node dist/cli.js update');
  console.log('  node dist/cli.js doctor');
  console.log('  node dist/cli.js skills [list|search|info|install|categories]');
}
