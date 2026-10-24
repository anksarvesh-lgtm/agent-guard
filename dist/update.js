import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');
/**
 * Check if the repository has incoming updates from GitHub origin main.
 */
export function checkForUpdates(repoDir = DEFAULT_REPO_ROOT) {
    const gitDir = path.join(repoDir, '.git');
    if (!fs.existsSync(gitDir)) {
        return { isGit: false, hasUpdate: false, error: 'Not a git repository' };
    }
    const gitEnv = {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: '',
    };
    try {
        const currentSha = execSync('git rev-parse HEAD', {
            cwd: repoDir,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
            env: gitEnv,
            timeout: 4000
        }).trim();
        // Fetch upstream refs quietly
        try {
            execSync('git fetch origin main --quiet', {
                cwd: repoDir,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'ignore'],
                env: gitEnv,
                timeout: 4000
            });
        }
        catch (fetchErr) {
            return {
                isGit: true,
                hasUpdate: false,
                currentSha,
                error: `Could not reach remote: ${fetchErr.message || 'offline'}`
            };
        }
        const remoteSha = execSync('git rev-parse origin/main', {
            cwd: repoDir,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
            env: gitEnv,
            timeout: 4000
        }).trim();
        if (currentSha === remoteSha) {
            return { isGit: true, hasUpdate: false, currentSha, remoteSha, behindCount: 0 };
        }
        // Count commits behind
        let behindCount = 0;
        try {
            const revList = execSync('git rev-list --count HEAD..origin/main', {
                cwd: repoDir,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'ignore'],
                env: gitEnv,
                timeout: 4000
            }).trim();
            behindCount = parseInt(revList, 10) || 0;
        }
        catch {
            behindCount = 1;
        }
        return {
            isGit: true,
            hasUpdate: behindCount > 0,
            currentSha,
            remoteSha,
            behindCount
        };
    }
    catch (err) {
        return { isGit: true, hasUpdate: false, error: err.message };
    }
}
/**
 * Pull latest changes from origin main and recompile TypeScript.
 */
export function performUpdate(repoDir = DEFAULT_REPO_ROOT) {
    const check = checkForUpdates(repoDir);
    if (!check.isGit) {
        return { success: false, updated: false, message: 'Cannot auto-update: not a git clone.' };
    }
    if (check.error && !check.hasUpdate) {
        return { success: false, updated: false, message: `Update check failed: ${check.error}` };
    }
    if (!check.hasUpdate) {
        return {
            success: true,
            updated: false,
            message: 'Agent Guard is already up to date.',
            previousSha: check.currentSha,
            newSha: check.currentSha
        };
    }
    const previousSha = check.currentSha;
    try {
        const gitEnv = {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
            GIT_ASKPASS: '',
        };
        // 1. Pull changes
        execSync('git pull --rebase origin main --quiet', {
            cwd: repoDir,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
            env: gitEnv,
            timeout: 20000
        });
        const newSha = execSync('git rev-parse HEAD', {
            cwd: repoDir,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 5000
        }).trim();
        // 2. Recompile TypeScript build
        try {
            execSync('npm run build', {
                cwd: repoDir,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 30000
            });
        }
        catch {
            // Fallback: try npx tsc
            execSync('npx tsc', {
                cwd: repoDir,
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 30000
            });
        }
        return {
            success: true,
            updated: true,
            message: `Successfully updated Agent Guard (${check.behindCount || 1} new commits applied).`,
            previousSha,
            newSha
        };
    }
    catch (err) {
        return {
            success: false,
            updated: false,
            message: `Update failed: ${err.message}`,
            previousSha
        };
    }
}
/**
 * Non-blocking background update check (cached for 1 hour to avoid network overhead).
 */
export function maybeBackgroundUpdate(repoDir = DEFAULT_REPO_ROOT, logFn) {
    const markerDir = path.join(repoDir, '.agent');
    const markerFile = path.join(markerDir, 'update_state.json');
    try {
        if (fs.existsSync(markerFile)) {
            const state = JSON.parse(fs.readFileSync(markerFile, 'utf-8'));
            const now = Date.now();
            const ONE_HOUR_MS = 60 * 60 * 1000;
            if (now - (state.last_check || 0) < ONE_HOUR_MS) {
                return; // Too soon to check again
            }
        }
    }
    catch {
        // ignore parse errors and proceed
    }
    // Record check attempt timestamp
    try {
        if (!fs.existsSync(markerDir)) {
            fs.mkdirSync(markerDir, { recursive: true });
        }
        fs.writeFileSync(markerFile, JSON.stringify({ last_check: Date.now() }, null, 2), 'utf-8');
    }
    catch {
        // Non-fatal
    }
    // Asynchronous update attempt in background
    setTimeout(() => {
        try {
            const res = performUpdate(repoDir);
            if (res.updated && logFn) {
                logFn(`[Agent Guard] Auto-updated to ${res.newSha?.slice(0, 7)}: ${res.message}`);
            }
        }
        catch {
            // Silent fail on background auto-update
        }
    }, 100).unref?.();
}
//# sourceMappingURL=update.js.map