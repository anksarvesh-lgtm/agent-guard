#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
function getGeminiConfigPath() {
    const home = os.homedir();
    return path.join(home, '.gemini', 'config', 'mcp_config.json');
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
    console.log('\n🎉 Installation Complete!');
    console.log('----------------------------------------------------');
    console.log('Restart or reload Antigravity to activate Agent Guard.');
    console.log('Verify with: `npx agent-guard doctor` or `node dist/cli.js doctor`\n');
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
else if (command === 'doctor') {
    doctorCheck();
}
else {
    console.log('Usage:');
    console.log('  node dist/cli.js install [--workspace <path>] [--dry-run]');
    console.log('  node dist/cli.js doctor');
}
//# sourceMappingURL=cli.js.map