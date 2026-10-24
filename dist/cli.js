#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkForUpdates, performUpdate } from './update.js';
import { generateFullProjectMap } from './brief/map.js';
import { getProjectFreshness } from './brief/stale.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
function getGeminiConfigPath() {
    const home = os.homedir();
    return path.join(home, '.gemini', 'config', 'mcp_config.json');
}
function getGeminiSettingsPath() {
    const home = os.homedir();
    return path.join(home, '.gemini', 'config', 'config.json');
}
function getGeminiPluginsDir() {
    const home = os.homedir();
    return path.join(home, '.gemini', 'config', 'plugins', 'agent-guard');
}
export function configureAutoAcceptGrants(dryRun) {
    const settingsFile = getGeminiSettingsPath();
    if (!fs.existsSync(settingsFile))
        return;
    console.log(`\n4. Enabling automatic tool acceptance in Antigravity IDE...`);
    if (dryRun) {
        console.log('   [Dry Run] Would configure globalPermissionGrants in config.json');
        return;
    }
    try {
        const raw = fs.readFileSync(settingsFile, 'utf-8');
        const cfg = JSON.parse(raw);
        cfg.userSettings = cfg.userSettings || {};
        cfg.userSettings.globalPermissionGrants = cfg.userSettings.globalPermissionGrants || {};
        cfg.userSettings.globalPermissionGrants.allow = cfg.userSettings.globalPermissionGrants.allow || [];
        const grantsToAdd = [
            'mcp(agent-guard/task_start)',
            'mcp(agent-guard/task_checkpoint)',
            'mcp(agent-guard/task_status)',
            'mcp(agent-guard/keep_awake)',
            'mcp(agent-guard/repo_brief)',
            'mcp(agent-guard/project_map)',
            'mcp(agent-guard_agent-guard/task_start)',
            'mcp(agent-guard_agent-guard/task_checkpoint)',
            'mcp(agent-guard_agent-guard/task_status)',
            'mcp(agent-guard_agent-guard/keep_awake)',
            'mcp(agent-guard_agent-guard/repo_brief)',
            'mcp(agent-guard_agent-guard/project_map)',
            'command(npm run build)',
            'command(npm test)',
            'command(npm run doctor)',
            'command(npm run update)',
            'command(npm run map)',
            'command(./install.sh)',
            'command(node dist/cli.js)',
            'command(node dist/cli.js doctor)',
            'command(node dist/cli.js install)',
            'command(node dist/cli.js update)',
            'command(node dist/cli.js map)'
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
    }
    catch (err) {
        console.warn(`   ⚠️ Warning: Could not update auto-accept grants: ${err.message}`);
    }
}
export function installPluginBundle(nodeBin, serverPath, hookPath, dryRun) {
    const pluginDir = getGeminiPluginsDir();
    const templateDir = path.join(REPO_ROOT, 'templates', 'plugin', 'agent-guard');
    if (!fs.existsSync(templateDir))
        return;
    console.log(`\n3. Installing @agent-guard Antigravity plugin into ${pluginDir}...`);
    if (dryRun) {
        console.log('   [Dry Run] Would deploy @agent-guard plugin bundle');
        return;
    }
    try {
        fs.mkdirSync(path.join(pluginDir, 'agents'), { recursive: true });
        fs.mkdirSync(path.join(pluginDir, 'skills', 'agent-guard'), { recursive: true });
        fs.mkdirSync(path.join(pluginDir, 'rules'), { recursive: true });
        fs.mkdirSync(path.join(pluginDir, 'assets'), { recursive: true });
        // Copy static files
        fs.copyFileSync(path.join(templateDir, 'plugin.json'), path.join(pluginDir, 'plugin.json'));
        fs.copyFileSync(path.join(templateDir, 'agents', 'agent-guard.md'), path.join(pluginDir, 'agents', 'agent-guard.md'));
        fs.copyFileSync(path.join(templateDir, 'skills', 'agent-guard', 'SKILL.md'), path.join(pluginDir, 'skills', 'agent-guard', 'SKILL.md'));
        fs.copyFileSync(path.join(templateDir, 'rules', 'AGENTS.md'), path.join(pluginDir, 'rules', 'AGENTS.md'));
        if (fs.existsSync(path.join(templateDir, 'assets', 'logo.svg'))) {
            fs.copyFileSync(path.join(templateDir, 'assets', 'logo.svg'), path.join(pluginDir, 'assets', 'logo.svg'));
        }
        // Write rendered mcp_config.json
        const mcpContent = JSON.stringify({
            mcpServers: {
                'agent-guard': {
                    command: nodeBin,
                    args: [serverPath]
                }
            }
        }, null, 2);
        fs.writeFileSync(path.join(pluginDir, 'mcp_config.json'), mcpContent + '\n', 'utf-8');
        // Write rendered hooks.json
        const hooksContent = JSON.stringify({
            'agent-guard-stop': {
                Stop: [
                    {
                        type: 'command',
                        command: `${nodeBin} ${hookPath}`
                    }
                ]
            }
        }, null, 2);
        fs.writeFileSync(path.join(pluginDir, 'hooks.json'), hooksContent + '\n', 'utf-8');
        console.log('   ✅ Installed Antigravity plugin: `@agent-guard` is now callable via chat mentions.');
    }
    catch (err) {
        console.warn(`   ⚠️ Warning: Could not install plugin bundle: ${err.message}`);
    }
}
function detectNodeBinary() {
    // Prefer current running node binary
    if (process.execPath && fs.existsSync(process.execPath)) {
        return process.execPath;
    }
    try {
        return execSync('which node', { encoding: 'utf-8' }).trim();
    }
    catch {
        return 'node';
    }
}
export function installToAntigravity(options = {}) {
    const nodeBin = detectNodeBinary();
    const serverPath = path.join(REPO_ROOT, 'dist', 'index.js');
    const hookPath = path.join(REPO_ROOT, 'dist', 'hook', 'stop-hook.js');
    const mcpConfigFile = getGeminiConfigPath();
    console.log('🛡️  Agent Guard — Antigravity Automated Installer\n');
    console.log(`• Repository:  ${REPO_ROOT}`);
    console.log(`• Node binary: ${nodeBin}`);
    console.log(`• MCP Server:  ${serverPath}`);
    console.log(`• Stop Hook:   ${hookPath}\n`);
    if (!fs.existsSync(serverPath)) {
        console.error('❌ Error: dist/index.js not found. Run `npm run build` before installing.');
        process.exit(1);
    }
    // 1. Update ~/.gemini/config/mcp_config.json
    console.log(`1. Configuring MCP server in ${mcpConfigFile}...`);
    let config = { mcpServers: {} };
    if (fs.existsSync(mcpConfigFile)) {
        try {
            const raw = fs.readFileSync(mcpConfigFile, 'utf-8');
            config = JSON.parse(raw);
            if (!config.mcpServers)
                config.mcpServers = {};
        }
        catch (err) {
            console.warn(`⚠️ Warning: Could not parse existing config: ${err.message}. Creating backup.`);
            fs.copyFileSync(mcpConfigFile, `${mcpConfigFile}.bak-${Date.now()}`);
            config = { mcpServers: {} };
        }
    }
    else {
        fs.mkdirSync(path.dirname(mcpConfigFile), { recursive: true });
    }
    config.mcpServers = config.mcpServers || {};
    config.mcpServers['agent-guard'] = {
        command: nodeBin,
        args: [serverPath],
        autoApprove: [
            'task_start',
            'task_checkpoint',
            'task_status',
            'keep_awake',
            'repo_brief',
            'project_map'
        ],
        disabled: false
    };
    if (!options.dryRun) {
        fs.writeFileSync(mcpConfigFile, JSON.stringify(config, null, 2) + '\n', 'utf-8');
        console.log('   ✅ Successfully registered `agent-guard` MCP server.');
    }
    else {
        console.log('   [Dry Run] Would write updated mcp_config.json');
    }
    // 2. Configure target workspace (if provided or current dir)
    const workspace = path.resolve(options.targetWorkspace || process.cwd());
    const hasGit = fs.existsSync(path.join(workspace, '.git'));
    if (hasGit || options.targetWorkspace) {
        console.log(`\n2. Configuring workspace at ${workspace}...`);
        // Setup .agents/hooks.json
        const agentsDir = path.join(workspace, '.agents');
        const hooksFile = path.join(agentsDir, 'hooks.json');
        let hooksData = {};
        if (fs.existsSync(hooksFile)) {
            try {
                hooksData = JSON.parse(fs.readFileSync(hooksFile, 'utf-8'));
            }
            catch {
                hooksData = {};
            }
        }
        else if (!options.dryRun) {
            fs.mkdirSync(agentsDir, { recursive: true });
        }
        hooksData['agent-guard-stop'] = {
            Stop: [
                {
                    type: 'command',
                    command: `${nodeBin} ${hookPath}`,
                },
            ],
        };
        if (!options.dryRun) {
            fs.writeFileSync(hooksFile, JSON.stringify(hooksData, null, 2) + '\n', 'utf-8');
            console.log('   ✅ Configured Stop hook in .agents/hooks.json');
            // Setup AGENTS.md rules
            const rulesSource = path.join(REPO_ROOT, 'templates', 'AGENT_RULES.md');
            const rulesDest = path.join(workspace, 'AGENTS.md');
            if (fs.existsSync(rulesSource) && !fs.existsSync(rulesDest)) {
                fs.copyFileSync(rulesSource, rulesDest);
                console.log('   ✅ Installed default workspace rules into AGENTS.md');
            }
            else if (fs.existsSync(rulesDest)) {
                console.log('   ℹ️  Workspace already contains AGENTS.md (preserved)');
            }
        }
        else {
            console.log('   [Dry Run] Would configure .agents/hooks.json and AGENTS.md');
        }
    }
    // 3. Deploy Antigravity @agent-guard plugin
    installPluginBundle(nodeBin, serverPath, hookPath, options.dryRun);
    // 4. Configure auto-accept in IDE
    configureAutoAcceptGrants(options.dryRun);
    console.log('\n🎉 Installation Complete!');
    console.log('----------------------------------------------------');
    console.log('Restart or reload Antigravity to activate Agent Guard.');
    console.log('You can now mention `@agent-guard` directly in chat.');
    console.log('Verify with: `npm run doctor` or `node dist/cli.js doctor`\n');
}
export function doctorCheck() {
    console.log('🩺 Agent Guard Readiness Doctor\n');
    const nodeBin = detectNodeBinary();
    console.log(`• Node version:    ${process.version} (${nodeBin})`);
    // Check MCP registration
    const mcpConfigFile = getGeminiConfigPath();
    if (fs.existsSync(mcpConfigFile)) {
        try {
            const cfg = JSON.parse(fs.readFileSync(mcpConfigFile, 'utf-8'));
            if (cfg.mcpServers?.['agent-guard']) {
                console.log('• MCP Config:      [OK] agent-guard is registered in mcp_config.json');
            }
            else {
                console.log('• MCP Config:      [WARN] agent-guard not found in mcp_config.json');
            }
        }
        catch {
            console.log('• MCP Config:      [FAIL] Corrupted mcp_config.json');
        }
    }
    else {
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
            const allows = cfg.userSettings?.globalPermissionGrants?.allow || [];
            const hasGrants = allows.some((g) => g.includes('agent-guard'));
            console.log(`• Auto-Accept IDE: ${hasGrants ? '[OK] Tool and command permissions granted' : '[WARN] Missing auto-accept grants (run npm run install:antigravity)'}`);
        }
        catch {
            console.log('• Auto-Accept IDE: [WARN] Could not parse config.json');
        }
    }
    else {
        console.log('• Auto-Accept IDE: [INFO] config.json not yet created');
    }
    // Check Git upstream status for auto-update
    const updateStatus = checkForUpdates(REPO_ROOT);
    if (updateStatus.isGit) {
        if (updateStatus.hasUpdate) {
            console.log(`• Auto-Update:     [UPDATE AVAILABLE] ${updateStatus.behindCount} commits behind origin/main (run 'npm run update')`);
        }
        else if (updateStatus.error) {
            console.log(`• Auto-Update:     [OFFLINE] ${updateStatus.error}`);
        }
        else {
            console.log(`• Auto-Update:     [OK] Up to date with origin/main (${updateStatus.currentSha?.slice(0, 7)})`);
        }
    }
    else {
        console.log('• Auto-Update:     [INFO] Standalone installation (not a git clone)');
    }
    // Check build files
    const serverPath = path.join(REPO_ROOT, 'dist', 'index.js');
    const hookPath = path.join(REPO_ROOT, 'dist', 'hook', 'stop-hook.js');
    console.log(`• Server Binary:   ${fs.existsSync(serverPath) ? '[OK]' : '[FAIL] Missing'} dist/index.js`);
    console.log(`• Hook Binary:     ${fs.existsSync(hookPath) ? '[OK]' : '[FAIL] Missing'} dist/hook/stop-hook.js`);
    // Check sleep inhibitor support
    if (process.platform === 'darwin') {
        try {
            execSync('which caffeinate');
            console.log('• Sleep Inhibitor: [OK] macOS caffeinate available');
        }
        catch {
            console.log('• Sleep Inhibitor: [FAIL] caffeinate not found');
        }
    }
    else if (process.platform === 'win32') {
        console.log('• Sleep Inhibitor: [OK] Windows SetThreadExecutionState support ready');
    }
    else {
        try {
            execSync('which systemd-inhibit');
            console.log('• Sleep Inhibitor: [OK] Linux systemd-inhibit available');
        }
        catch {
            console.log('• Sleep Inhibitor: [WARN] systemd-inhibit not found');
        }
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
    installToAntigravity({ targetWorkspace, dryRun });
}
else if (command === 'update') {
    console.log('🔄 Checking for Agent Guard updates...\n');
    const res = performUpdate(REPO_ROOT);
    if (res.updated) {
        console.log(`✅ ${res.message}`);
        console.log(`• Previous Commit: ${res.previousSha?.slice(0, 7)}`);
        console.log(`• Updated Commit:  ${res.newSha?.slice(0, 7)}`);
        console.log('\nRunning readiness doctor...');
        doctorCheck();
    }
    else if (res.success) {
        console.log(`✅ ${res.message}`);
    }
    else {
        console.error(`⚠️ ${res.message}`);
        process.exit(1);
    }
}
else if (command === 'map') {
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
}
else if (command === 'doctor') {
    doctorCheck();
}
else {
    console.log('Usage:');
    console.log('  node dist/cli.js install [--workspace <path>] [--dry-run]');
    console.log('  node dist/cli.js map [--workspace <path>]');
    console.log('  node dist/cli.js update');
    console.log('  node dist/cli.js doctor');
}
//# sourceMappingURL=cli.js.map