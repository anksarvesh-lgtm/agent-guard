import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { syncMcpSchemaFiles, refreshAntigravityLsMcp } from '../tools/definitions.js';
export const AGENT_GUARD_AUTO_APPROVE_TOOLS = [
    'task_start',
    'task_checkpoint',
    'task_status',
    'keep_awake',
    'repo_brief',
    'agent_enforce',
    'project_map',
    'token_counter',
    'account_switcher',
    'model_compressor',
    'skill_activate',
    'memory_store',
    'memory_recall',
    'code_map',
];
export function getHomeDir() {
    return process.env.AGENT_GUARD_HOME || os.homedir();
}
export function deploySkillsToDirectory(skillsSourceDir, targetSkillsDir, dryRun) {
    if (!fs.existsSync(skillsSourceDir))
        return 0;
    if (!dryRun) {
        fs.mkdirSync(targetSkillsDir, { recursive: true });
    }
    const entries = fs.readdirSync(skillsSourceDir, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const srcSkillDir = path.join(skillsSourceDir, entry.name);
            const destSkillDir = path.join(targetSkillsDir, entry.name);
            if (!dryRun) {
                fs.mkdirSync(destSkillDir, { recursive: true });
                fs.cpSync(srcSkillDir, destSkillDir, { recursive: true });
            }
            count++;
        }
    }
    return count;
}
function resolveSkillsSourceDir(repoRoot) {
    const curated = path.join(repoRoot, 'templates', 'skills', 'curated');
    if (fs.existsSync(curated))
        return curated;
    const pluginSkills = path.join(repoRoot, 'templates', 'plugin', 'agent-guard', 'skills');
    if (fs.existsSync(pluginSkills))
        return pluginSkills;
    return '';
}
function safeJsonWrite(filePath, updater, dryRun) {
    let data = {};
    if (fs.existsSync(filePath)) {
        try {
            data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        catch {
            data = {};
        }
    }
    else if (!dryRun) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    const updated = updater(data);
    if (!dryRun) {
        fs.writeFileSync(filePath, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
    }
}
// 1. Antigravity & Gemini CLI
export const antigravityTarget = {
    id: 'antigravity',
    name: 'Google Antigravity & Gemini CLI',
    detect: () => fs.existsSync(path.join(getHomeDir(), '.gemini')),
    getConfigPath: () => path.join(getHomeDir(), '.gemini', 'config', 'mcp_config.json'),
    install: (ctx) => {
        const configPath = path.join(getHomeDir(), '.gemini', 'config', 'mcp_config.json');
        safeJsonWrite(configPath, (cfg) => {
            cfg.mcpServers = cfg.mcpServers || {};
            cfg.mcpServers['agent-guard'] = {
                command: ctx.nodeBin,
                args: [ctx.serverPath],
                autoApprove: [...AGENT_GUARD_AUTO_APPROVE_TOOLS],
            };
            return cfg;
        }, ctx.dryRun);
        const skillsSource = resolveSkillsSourceDir(ctx.repoRoot);
        const globalSkillsDir = path.join(getHomeDir(), '.gemini', 'config', 'skills');
        const skillCount = deploySkillsToDirectory(skillsSource, globalSkillsDir, ctx.dryRun);
        const skillsJsonPath = path.join(getHomeDir(), '.gemini', 'config', 'skills.json');
        safeJsonWrite(skillsJsonPath, () => ({
            entries: [
                { path: '~/.gemini/config/skills' },
                { path: path.join(ctx.repoRoot, 'templates', 'skills', 'curated') },
                { path: path.join(path.dirname(ctx.repoRoot), 'agent-skills', 'skills') },
            ],
        }), ctx.dryRun);
        if (!ctx.dryRun) {
            syncMcpSchemaFiles();
            refreshAntigravityLsMcp().catch(() => { });
        }
        return {
            appId: 'antigravity',
            appName: 'Google Antigravity & Gemini CLI',
            installed: true,
            configPath,
            message: `Configured agent-guard MCP server in ${configPath}, deployed ${skillCount} skills, and synced schemas`,
        };
    },
};
// 2. Claude Code
export const claudeTarget = {
    id: 'claude',
    name: 'Claude Code',
    detect: () => {
        const home = getHomeDir();
        if (fs.existsSync(path.join(home, '.claude')) || fs.existsSync(path.join(home, '.claude.json'))) {
            return true;
        }
        try {
            execSync('which claude', { stdio: 'ignore' });
            return true;
        }
        catch {
            return false;
        }
    },
    getConfigPath: () => {
        const home = getHomeDir();
        const claudeDir = path.join(home, '.claude');
        if (fs.existsSync(claudeDir)) {
            return path.join(claudeDir, 'mcp.json');
        }
        return path.join(home, '.claude.json');
    },
    install: (ctx) => {
        const home = getHomeDir();
        const claudeDir = path.join(home, '.claude');
        const configPath = fs.existsSync(claudeDir)
            ? path.join(claudeDir, 'mcp.json')
            : path.join(home, '.claude.json');
        safeJsonWrite(configPath, (cfg) => {
            cfg.mcpServers = cfg.mcpServers || {};
            cfg.mcpServers['agent-guard'] = {
                command: ctx.nodeBin,
                args: [ctx.serverPath],
                autoApprove: [...AGENT_GUARD_AUTO_APPROVE_TOOLS],
            };
            // Configure approved tools for Claude Code CLI
            cfg.approvedTools = cfg.approvedTools || [];
            for (const tool of AGENT_GUARD_AUTO_APPROVE_TOOLS) {
                if (!cfg.approvedTools.includes(tool)) {
                    cfg.approvedTools.push(tool);
                }
            }
            return cfg;
        }, ctx.dryRun);
        const skillsSource = resolveSkillsSourceDir(ctx.repoRoot);
        const claudeSkillsDir = path.join(home, '.claude', 'skills');
        const skillCount = deploySkillsToDirectory(skillsSource, claudeSkillsDir, ctx.dryRun);
        return {
            appId: 'claude',
            appName: 'Claude Code',
            installed: true,
            configPath,
            message: `Configured agent-guard MCP server in ${configPath} and deployed ${skillCount} skills to ${claudeSkillsDir}`,
        };
    },
};
// 3. Codex CLI
export const codexTarget = {
    id: 'codex',
    name: 'Codex CLI',
    detect: () => {
        const home = getHomeDir();
        if (process.env.CODEX_HOME && fs.existsSync(process.env.CODEX_HOME))
            return true;
        if (fs.existsSync(path.join(home, '.codex')))
            return true;
        try {
            execSync('which codex', { stdio: 'ignore' });
            return true;
        }
        catch {
            return false;
        }
    },
    getConfigPath: () => {
        const home = getHomeDir();
        const codexHome = process.env.CODEX_HOME || path.join(home, '.codex');
        return path.join(codexHome, 'mcp.json');
    },
    install: (ctx) => {
        const home = getHomeDir();
        const codexHome = process.env.CODEX_HOME || path.join(home, '.codex');
        const configPath = path.join(codexHome, 'mcp.json');
        safeJsonWrite(configPath, (cfg) => {
            cfg.mcpServers = cfg.mcpServers || {};
            cfg.mcpServers['agent-guard'] = {
                command: ctx.nodeBin,
                args: [ctx.serverPath],
                autoApprove: [...AGENT_GUARD_AUTO_APPROVE_TOOLS],
            };
            return cfg;
        }, ctx.dryRun);
        const skillsSource = resolveSkillsSourceDir(ctx.repoRoot);
        const codexSkillsDir = path.join(codexHome, 'skills');
        const skillCount = deploySkillsToDirectory(skillsSource, codexSkillsDir, ctx.dryRun);
        return {
            appId: 'codex',
            appName: 'Codex CLI',
            installed: true,
            configPath,
            message: `Configured agent-guard MCP server in ${configPath} and deployed ${skillCount} skills to ${codexSkillsDir}`,
        };
    },
};
// 4. Cursor IDE
export const cursorTarget = {
    id: 'cursor',
    name: 'Cursor IDE',
    detect: () => {
        const home = getHomeDir();
        const paths = [
            path.join(home, '.cursor'),
            path.join(home, 'Library', 'Application Support', 'Cursor'),
            path.join(home, '.config', 'Cursor'),
        ];
        return paths.some((p) => fs.existsSync(p));
    },
    getConfigPath: () => path.join(getHomeDir(), '.cursor', 'mcp.json'),
    install: (ctx) => {
        const configPath = path.join(getHomeDir(), '.cursor', 'mcp.json');
        safeJsonWrite(configPath, (cfg) => {
            cfg.mcpServers = cfg.mcpServers || {};
            cfg.mcpServers['agent-guard'] = {
                command: ctx.nodeBin,
                args: [ctx.serverPath],
                autoApprove: [...AGENT_GUARD_AUTO_APPROVE_TOOLS],
            };
            return cfg;
        }, ctx.dryRun);
        const skillsSource = resolveSkillsSourceDir(ctx.repoRoot);
        const cursorSkillsDir = path.join(getHomeDir(), '.cursor', 'skills');
        const skillCount = deploySkillsToDirectory(skillsSource, cursorSkillsDir, ctx.dryRun);
        return {
            appId: 'cursor',
            appName: 'Cursor IDE',
            installed: true,
            configPath,
            message: `Configured agent-guard MCP server in ${configPath} and deployed ${skillCount} skills to ${cursorSkillsDir}`,
        };
    },
};
// 5. Windsurf
export const windsurfTarget = {
    id: 'windsurf',
    name: 'Windsurf (Codeium)',
    detect: () => {
        const home = getHomeDir();
        return fs.existsSync(path.join(home, '.codeium', 'windsurf')) || fs.existsSync(path.join(home, '.codeium'));
    },
    getConfigPath: () => path.join(getHomeDir(), '.codeium', 'windsurf', 'mcp_config.json'),
    install: (ctx) => {
        const configPath = path.join(getHomeDir(), '.codeium', 'windsurf', 'mcp_config.json');
        safeJsonWrite(configPath, (cfg) => {
            cfg.mcpServers = cfg.mcpServers || {};
            cfg.mcpServers['agent-guard'] = {
                command: ctx.nodeBin,
                args: [ctx.serverPath],
                autoApprove: [...AGENT_GUARD_AUTO_APPROVE_TOOLS],
            };
            return cfg;
        }, ctx.dryRun);
        return {
            appId: 'windsurf',
            appName: 'Windsurf (Codeium)',
            installed: true,
            configPath,
            message: `Configured agent-guard MCP server in ${configPath}`,
        };
    },
};
// 6. VS Code (Cline / Roo Code)
export const clineTarget = {
    id: 'cline',
    name: 'VS Code (Cline / Roo Code)',
    detect: () => {
        const home = getHomeDir();
        const candidateDirs = [
            path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev'),
            path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
            path.join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev'),
            path.join(home, '.config', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
        ];
        return candidateDirs.some((p) => fs.existsSync(p));
    },
    getConfigPath: () => {
        const home = getHomeDir();
        const base = process.platform === 'darwin'
            ? path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage')
            : path.join(home, '.config', 'Code', 'User', 'globalStorage');
        return path.join(base, 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json');
    },
    install: (ctx) => {
        const home = getHomeDir();
        const base = process.platform === 'darwin'
            ? path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage')
            : path.join(home, '.config', 'Code', 'User', 'globalStorage');
        const targets = [
            path.join(base, 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
            path.join(base, 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
        ];
        let installedPath = '';
        for (const configPath of targets) {
            safeJsonWrite(configPath, (cfg) => {
                cfg.mcpServers = cfg.mcpServers || {};
                cfg.mcpServers['agent-guard'] = {
                    command: ctx.nodeBin,
                    args: [ctx.serverPath],
                    disabled: false,
                    autoApprove: [...AGENT_GUARD_AUTO_APPROVE_TOOLS],
                };
                return cfg;
            }, ctx.dryRun);
            if (!installedPath)
                installedPath = configPath;
        }
        return {
            appId: 'cline',
            appName: 'VS Code (Cline / Roo Code)',
            installed: true,
            configPath: installedPath,
            message: `Configured agent-guard MCP server in ${installedPath}`,
        };
    },
};
// 7. Zed Editor
export const zedTarget = {
    id: 'zed',
    name: 'Zed Editor',
    detect: () => fs.existsSync(path.join(getHomeDir(), '.config', 'zed')),
    getConfigPath: () => path.join(getHomeDir(), '.config', 'zed', 'settings.json'),
    install: (ctx) => {
        const configPath = path.join(getHomeDir(), '.config', 'zed', 'settings.json');
        safeJsonWrite(configPath, (cfg) => {
            cfg.experimental = cfg.experimental || {};
            cfg.experimental.model_context_protocol = cfg.experimental.model_context_protocol || {};
            cfg.experimental.model_context_protocol.servers = cfg.experimental.model_context_protocol.servers || {};
            cfg.experimental.model_context_protocol.servers['agent-guard'] = {
                command: ctx.nodeBin,
                args: [ctx.serverPath],
            };
            return cfg;
        }, ctx.dryRun);
        return {
            appId: 'zed',
            appName: 'Zed Editor',
            installed: true,
            configPath,
            message: `Configured agent-guard MCP server in ${configPath}`,
        };
    },
};
export const ALL_APP_TARGETS = [
    antigravityTarget,
    claudeTarget,
    codexTarget,
    cursorTarget,
    windsurfTarget,
    clineTarget,
    zedTarget,
];
export function detectInstalledApps() {
    return ALL_APP_TARGETS.filter((t) => t.detect());
}
export function installToApps(targetIds, ctx) {
    let targetsToInstall = [];
    if (targetIds === 'all') {
        targetsToInstall = ALL_APP_TARGETS;
    }
    else if (targetIds === 'auto') {
        targetsToInstall = detectInstalledApps();
        // Fallback: If no specific app detected, always configure Antigravity/Gemini
        if (targetsToInstall.length === 0) {
            targetsToInstall = [antigravityTarget];
        }
    }
    else {
        targetsToInstall = ALL_APP_TARGETS.filter((t) => targetIds.includes(t.id));
        if (targetsToInstall.length === 0) {
            targetsToInstall = [antigravityTarget];
        }
    }
    const results = [];
    for (const t of targetsToInstall) {
        try {
            const res = t.install(ctx);
            results.push(res);
        }
        catch (err) {
            results.push({
                appId: t.id,
                appName: t.name,
                installed: false,
                message: `Failed to configure ${t.name}: ${err.message}`,
            });
        }
    }
    return results;
}
//# sourceMappingURL=apps.js.map