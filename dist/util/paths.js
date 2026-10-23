import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const SYSTEM_PREFIXES_POSIX = [
    '/system',
    '/usr',
    '/bin',
    '/sbin',
    '/etc',
    '/library',
    '/applications',
    '/proc',
    '/dev',
    '/sys',
    '/private/etc',
    '/private/var/root',
    '/private/var/db',
];
const SYSTEM_PREFIXES_WIN = [
    'c:\\windows',
    'c:\\program files',
    'c:\\program files (x86)',
    'c:\\programdata',
];
/**
 * Validates and resolves the real project path according to the strict safety rules:
 * 1. Must exist and be a directory.
 * 2. Cannot be root or the user's home directory.
 * 3. Cannot be a system folder.
 * 4. Must contain a `.git` folder (or worktree file) OR an existing `.agent` directory.
 */
export function resolveProjectPath(projectPath) {
    const target = projectPath && projectPath.trim() !== '' ? projectPath.trim() : process.cwd();
    let resolved;
    try {
        resolved = fs.realpathSync(target);
    }
    catch (err) {
        throw new Error(`BAD_PROJECT_PATH: Path does not exist or is inaccessible: ${target}`);
    }
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
        throw new Error(`BAD_PROJECT_PATH: Path is not a directory: ${resolved}`);
    }
    // Home directory check
    const home = fs.realpathSync(os.homedir());
    if (resolved === home) {
        throw new Error(`BAD_PROJECT_PATH: Project path cannot be your home directory: ${resolved}`);
    }
    // Root directory check
    const parsed = path.parse(resolved);
    if (resolved === parsed.root) {
        throw new Error(`BAD_PROJECT_PATH: Project path cannot be the root filesystem: ${resolved}`);
    }
    // System directories check
    const lowerResolved = resolved.toLowerCase();
    const prefixes = process.platform === 'win32' ? SYSTEM_PREFIXES_WIN : SYSTEM_PREFIXES_POSIX;
    for (const prefix of prefixes) {
        if (lowerResolved === prefix || lowerResolved.startsWith(prefix + path.sep)) {
            throw new Error(`BAD_PROJECT_PATH: Project path cannot be a system folder: ${resolved}`);
        }
    }
    // Must have .git or .agent
    const hasGit = fs.existsSync(path.join(resolved, '.git'));
    const hasAgent = fs.existsSync(path.join(resolved, '.agent'));
    if (!hasGit && !hasAgent) {
        throw new Error(`BAD_PROJECT_PATH: Path must have a .git folder or an existing .agent folder: ${resolved}`);
    }
    return resolved;
}
/**
 * Returns `<project>/.agent` directory, ensuring it exists.
 */
export function getAgentDir(projectPath) {
    const project = resolveProjectPath(projectPath);
    const agentDir = path.join(project, '.agent');
    if (!fs.existsSync(agentDir)) {
        fs.mkdirSync(agentDir, { recursive: true });
    }
    return agentDir;
}
export function getLedgerPath(projectPath) {
    return path.join(getAgentDir(projectPath), 'ledger.json');
}
export function getLedgerLockPath(projectPath) {
    return path.join(getAgentDir(projectPath), 'ledger.lock');
}
export function getLedgerPrevPath(projectPath) {
    return path.join(getAgentDir(projectPath), 'ledger.prev.json');
}
export function getLedgerTmpPath(projectPath) {
    return path.join(getAgentDir(projectPath), 'ledger.tmp');
}
export function getHistoryDir(projectPath) {
    const hist = path.join(getAgentDir(projectPath), 'history');
    if (!fs.existsSync(hist)) {
        fs.mkdirSync(hist, { recursive: true });
    }
    return hist;
}
export function getBriefPath(projectPath) {
    return path.join(getAgentDir(projectPath), 'brief.md');
}
export function getHookStatePath(projectPath) {
    return path.join(getAgentDir(projectPath), 'hook-state.json');
}
export function getLogPath(projectPath) {
    return path.join(getAgentDir(projectPath), 'log.txt');
}
export function getTrapsPath(projectPath) {
    return path.join(getAgentDir(projectPath), 'traps.md');
}
//# sourceMappingURL=paths.js.map