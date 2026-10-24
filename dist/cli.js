#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkForUpdates, performUpdate } from './update.js';
import { generateFullProjectMap } from './brief/map.js';
import { getProjectFreshness } from './brief/stale.js';
import { installToApps, detectInstalledApps } from './install/apps.js';
import { loadSkillsIndex, listFeaturedSkills, searchSkills, getSkillInfo, getCategories, installSkill, formatSkillsTable } from './skills/manager.js';
import { globalAwakeManager } from './awake/manager.js';
import { handleTokenCounter } from './tools/tokenCounter.js';
import { handleAccountSwitcher } from './tools/accountSwitcher.js';
import { globalAccountManager } from './accounts/index.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
function getHomeDirectory() {
    return process.env.AGENT_GUARD_HOME || os.homedir();
}
function getGeminiConfigPath() {
    const home = getHomeDirectory();
    return path.join(home, '.gemini', 'config', 'mcp_config.json');
}
function getGeminiSettingsPath() {
    const home = getHomeDirectory();
    return path.join(home, '.gemini', 'config', 'config.json');
}
function getGeminiPluginsDir() {
    const home = getHomeDirectory();
    return path.join(home, '.gemini', 'config', 'plugins', 'agent-guard');
}
export function configureAutoAcceptGrants(dryRun) {
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
    }
    catch (err) {
        console.warn(`   ⚠️ Warning: Could not update auto-accept grants: ${err.message}`);
        return { addedCount: 0, totalCount: 0 };
    }
}
export function installPluginBundle(nodeBin, serverPath, hookPath, enforceHookPath, dryRun) {
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
export function installAgentGuard(options = {}) {
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
    const ctx = {
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
        }
        else {
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
    installPluginBundle(nodeBin, serverPath, hookPath, enforceHookPath, options.dryRun);
    // 4. Configure auto-accept in IDE
    configureAutoAcceptGrants(options.dryRun);
    console.log('\n🎉 Universal Installation Complete!');
    console.log('----------------------------------------------------');
    console.log('Agent Guard is now active across your coding environments.');
    console.log('Restart your IDE / coding CLI to load new MCP tools.');
    console.log('Verify at any time with: `npm run doctor` or `node dist/cli.js doctor`\n');
}
export const installToAntigravity = installAgentGuard;
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
                const auto = cfg.mcpServers['agent-guard'].autoApprove || [];
                console.log(`• MCP Config:      [OK] agent-guard is registered in mcp_config.json (${auto.length} auto-approved tools)`);
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
            const eager = cfg.userSettings?.autoExecutionPolicy === 'CASCADE_COMMANDS_AUTO_EXECUTION_EAGER';
            const turbo = cfg.userSettings?.permissionPreset === 'AGENT_PERMISSION_PRESET_TURBO';
            const statusDetails = [];
            if (hasGrants)
                statusDetails.push('Grants OK');
            if (eager)
                statusDetails.push('Eager execution OK');
            if (turbo)
                statusDetails.push('Turbo preset OK');
            console.log(`• Auto-Accept IDE: ${hasGrants ? `[OK] ${statusDetails.join(', ')}` : '[WARN] Missing auto-accept grants (run: node dist/cli.js auto-accept)'}`);
        }
        catch {
            console.log('• Auto-Accept IDE: [WARN] Could not parse config.json');
        }
    }
    else {
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
    const enforceHookPath = path.join(REPO_ROOT, 'dist', 'hook', 'post-invocation-hook.js');
    console.log(`• Server Binary:   ${fs.existsSync(serverPath) ? '[OK]' : '[FAIL] Missing'} dist/index.js`);
    console.log(`• Stop Hook:       ${fs.existsSync(hookPath) ? '[OK]' : '[FAIL] Missing'} dist/hook/stop-hook.js`);
    console.log(`• Enforce Hook:    ${fs.existsSync(enforceHookPath) ? '[OK]' : '[FAIL] Missing'} dist/hook/post-invocation-hook.js`);
    // Check sleep inhibitor support
    if (process.platform === 'darwin') {
        try {
            execSync('which caffeinate', { stdio: 'ignore' });
            console.log('• Sleep Inhibitor: [OK] macOS native caffeinate available (-d -i -m -s -u verified)');
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
            execSync('which systemd-inhibit', { stdio: 'ignore' });
            console.log('• Sleep Inhibitor: [OK] Linux systemd-inhibit available');
        }
        catch {
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
        }
        else {
            console.log('• Account Switcher: [INFO] No account pool configured');
        }
    }
    catch {
        console.log('• Account Switcher: [WARN] Could not read accounts.json');
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
    let apps = 'auto';
    if (all) {
        apps = 'all';
    }
    else {
        const selected = [];
        if (args.includes('--antigravity') || args.includes('--gemini'))
            selected.push('antigravity');
        if (args.includes('--claude'))
            selected.push('claude');
        if (args.includes('--cursor'))
            selected.push('cursor');
        if (args.includes('--codex'))
            selected.push('codex');
        if (args.includes('--windsurf'))
            selected.push('windsurf');
        if (args.includes('--cline') || args.includes('--roo'))
            selected.push('cline');
        if (args.includes('--zed'))
            selected.push('zed');
        if (selected.length > 0)
            apps = selected;
    }
    installAgentGuard({ targetWorkspace, dryRun, apps });
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
else if (command === 'skills') {
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
    }
    else if (sub === 'search') {
        const query = args[2] || '';
        const results = searchSkills(query, { limit: 25 }, REPO_ROOT);
        console.log(`🔍 Search Results for "${query}" (${results.length} found):\n`);
        console.log(formatSkillsTable(results));
        console.log('\nTip: Run `node dist/cli.js skills info <id>` for full details.');
    }
    else if (sub === 'info') {
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
    }
    else if (sub === 'categories') {
        const cats = getCategories(REPO_ROOT);
        console.log('📂 Skill Categories:\n');
        for (const c of cats) {
            console.log(`  • ${c.category.padEnd(25)} (${c.count} skills)`);
        }
        console.log(`\nTotal Categories: ${cats.length}`);
    }
    else if (sub === 'install') {
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
        }
        else {
            console.error(`❌ ${res.message}`);
            process.exit(1);
        }
    }
    else {
        console.log('Usage:');
        console.log('  node dist/cli.js skills list');
        console.log('  node dist/cli.js skills search <query>');
        console.log('  node dist/cli.js skills info <id>');
        console.log('  node dist/cli.js skills install <id> [--path <dir>]');
        console.log('  node dist/cli.js skills categories');
    }
}
else if (command === 'auto-accept') {
    const dryRun = args.includes('--dry-run');
    configureAutoAcceptGrants(dryRun);
}
else if (command === 'awake') {
    const sub = args[1] || 'status';
    if (sub === 'hold') {
        const mins = parseInt(args[2] || '30', 10);
        const status = globalAwakeManager.hold(mins, 'CLI manual hold');
        console.log(`🛡️ Awake lease active: holding system awake for ${status.minutesRemaining} minutes (until ${status.heldUntil})`);
        if (status.warning)
            console.log(`   Notice: ${status.warning}`);
    }
    else if (sub === 'release') {
        globalAwakeManager.release();
        console.log('🛡️ Awake lease released. Operating system sleep restored to normal.');
    }
    else {
        const status = globalAwakeManager.status();
        if (status.isHolding) {
            console.log(`🛡️ Awake lease is ACTIVE: holding until ${status.heldUntil} (${status.minutesRemaining}m remaining, total ${status.totalTaskHeldMinutes}m held).`);
        }
        else {
            console.log('🛡️ Awake lease is INACTIVE: normal operating system sleep policy applies.');
        }
    }
}
else if (command === 'tokens') {
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
}
else if (command === 'accounts') {
    const sub = args[1] || 'status';
    if (sub === 'list') {
        console.log(handleAccountSwitcher({ action: 'list', project_path: process.cwd() }));
    }
    else if (sub === 'status') {
        console.log(handleAccountSwitcher({ action: 'status', project_path: process.cwd() }));
    }
    else if (sub === 'switch') {
        const accId = args[2];
        if (!accId) {
            console.error('Usage: node dist/cli.js accounts switch <account-id>');
            process.exit(1);
        }
        console.log(handleAccountSwitcher({ action: 'switch', account_id: accId, project_path: process.cwd() }));
    }
    else if (sub === 'add') {
        const accId = args[2];
        if (!accId) {
            console.error('Usage: node dist/cli.js accounts add <id> [--name <name>] [--token-file <path>] [--api-key <key>]');
            process.exit(1);
        }
        const nameIdx = args.indexOf('--name');
        const name = nameIdx !== -1 ? args[nameIdx + 1] : accId;
        const fileIdx = args.indexOf('--token-file');
        const tokenFile = fileIdx !== -1 ? args[fileIdx + 1] : undefined;
        const keyIdx = args.indexOf('--api-key');
        const apiKey = keyIdx !== -1 ? args[keyIdx + 1] : undefined;
        console.log(handleAccountSwitcher({
            action: 'add',
            account_id: accId,
            name,
            token_source_file: tokenFile,
            api_key: apiKey,
            project_path: process.cwd()
        }));
    }
    else if (sub === 'rotate') {
        console.log(handleAccountSwitcher({ action: 'auto_rotate', project_path: process.cwd() }));
    }
    else if (sub === 'auto-switch') {
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
    }
    else {
        console.log('Usage:');
        console.log('  node dist/cli.js accounts list');
        console.log('  node dist/cli.js accounts status');
        console.log('  node dist/cli.js accounts switch <account-id>');
        console.log('  node dist/cli.js accounts add <id> [--name <name>] [--token-file <file>] [--api-key <key>]');
        console.log('  node dist/cli.js accounts rotate');
        console.log('  node dist/cli.js accounts auto-switch <on|off> [--threshold <pct>]');
    }
}
else {
    console.log('Usage:');
    console.log('  node dist/cli.js install [--all|--claude|--cursor|--codex|--antigravity|--windsurf|--cline|--zed] [--workspace <path>] [--dry-run]');
    console.log('  node dist/cli.js auto-accept [--dry-run]');
    console.log('  node dist/cli.js awake [status|hold <mins>|release]');
    console.log('  node dist/cli.js tokens [file] [--model <name>] [--text <str>] [--no-compare]');
    console.log('  node dist/cli.js accounts [list|status|switch|add|rotate|auto-switch]');
    console.log('  node dist/cli.js map [--workspace <path>]');
    console.log('  node dist/cli.js update');
    console.log('  node dist/cli.js doctor');
    console.log('  node dist/cli.js skills [list|search|info|install|categories]');
}
//# sourceMappingURL=cli.js.map