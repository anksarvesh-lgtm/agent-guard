import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');

export const OFFICIAL_REPO_URL = 'https://github.com/anksarvesh-lgtm/agent-guard.git';
export const GITHUB_RAW_PACKAGE_URL = 'https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/package.json';

export interface UpdateCheckResult {
  isGit: boolean;
  hasUpdate: boolean;
  currentSha?: string;
  remoteSha?: string;
  behindCount?: number;
  error?: string;
  message?: string;
  remoteVersion?: string;
  localVersion?: string;
}

export interface PerformUpdateResult {
  success: boolean;
  updated: boolean;
  message: string;
  previousSha?: string;
  newSha?: string;
}

export function isVersionNewer(remote: string, local: string): boolean {
  const r = String(remote).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const l = String(local).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

/**
 * Check if the repository has incoming updates from GitHub origin main.
 */
export function checkForUpdates(repoDir: string = DEFAULT_REPO_ROOT): UpdateCheckResult {
  const gitDir = path.join(repoDir, '.git');
  const pkgPath = path.join(repoDir, 'package.json');
  let localVersion = '';
  if (fs.existsSync(pkgPath)) {
    try {
      localVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version || '';
    } catch {}
  }

  const checkHttpsFallback = (curSha?: string): UpdateCheckResult | null => {
    try {
      const raw = execSync(`curl -s -m 5 "${GITHUB_RAW_PACKAGE_URL}"`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 6000
      }).trim();
      if (raw && raw.startsWith('{')) {
        const data = JSON.parse(raw);
        const remoteVersion = data.version;
        if (remoteVersion && localVersion && isVersionNewer(remoteVersion, localVersion)) {
          return {
            isGit: fs.existsSync(gitDir),
            hasUpdate: true,
            currentSha: curSha || ('v' + localVersion),
            remoteSha: 'v' + remoteVersion,
            behindCount: 1,
            remoteVersion,
            localVersion,
            message: `Update available: v${remoteVersion} on GitHub (Current: v${localVersion}).`
          };
        }
      }
    } catch {}
    return null;
  };

  if (!fs.existsSync(gitDir)) {
    return { isGit: false, hasUpdate: false, error: 'Not a git repository' };
  }

  // Self-heal remote origin if missing or pointing to outdated repo (e.g. anksarvash-prog)
  try {
    const remoteUrl = execSync('git remote get-url origin', {
      cwd: repoDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000
    }).trim();
    if (remoteUrl.includes('anksarvash-prog') || remoteUrl.includes('YOUR_NEW_TOKEN') || !remoteUrl.includes('anksarvesh-lgtm')) {
      execSync(`git remote set-url origin ${OFFICIAL_REPO_URL}`, {
        cwd: repoDir,
        stdio: ['ignore', 'ignore', 'ignore'],
        timeout: 2000
      });
    }
  } catch {
    try {
      execSync(`git remote add origin ${OFFICIAL_REPO_URL}`, {
        cwd: repoDir,
        stdio: ['ignore', 'ignore', 'ignore'],
        timeout: 2000
      });
    } catch {}
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

    // Fetch upstream refs quietly with 12s timeout and depth fallback
    try {
      execSync('git fetch --depth=20 origin main --quiet', {
        cwd: repoDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        env: gitEnv,
        timeout: 12000
      });
    } catch {
      try {
        execSync('git fetch origin main --quiet', {
          cwd: repoDir,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
          env: gitEnv,
          timeout: 12000
        });
      } catch (fetchErr: any) {
        const httpsRes = checkHttpsFallback(currentSha);
        if (httpsRes) return httpsRes;

        return {
          isGit: true,
          hasUpdate: false,
          currentSha,
          error: `Could not reach remote: ${fetchErr.message || 'offline'}`
        };
      }
    }

    let remoteSha = '';
    try {
      remoteSha = execSync('git rev-parse FETCH_HEAD', {
        cwd: repoDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        env: gitEnv,
        timeout: 2000
      }).trim();
    } catch {
      try {
        remoteSha = execSync('git rev-parse origin/main', {
          cwd: repoDir,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore'],
          env: gitEnv,
          timeout: 2000
        }).trim();
      } catch {}
    }

    if (!remoteSha || currentSha === remoteSha) {
      const httpsRes = checkHttpsFallback(currentSha);
      if (httpsRes) return httpsRes;

      return { isGit: true, hasUpdate: false, currentSha, remoteSha: remoteSha || currentSha, behindCount: 0 };
    }

    // Count commits behind
    let behindCount = 0;
    try {
      const revList = execSync(`git rev-list --count HEAD..${remoteSha}`, {
        cwd: repoDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        env: gitEnv,
        timeout: 4000
      }).trim();
      behindCount = parseInt(revList, 10) || 0;
    } catch {
      behindCount = 1;
    }

    return {
      isGit: true,
      hasUpdate: true,
      currentSha,
      remoteSha,
      behindCount: Math.max(1, behindCount)
    };
  } catch (err: any) {
    const httpsRes = checkHttpsFallback();
    if (httpsRes) return httpsRes;
    return { isGit: true, hasUpdate: false, error: err.message };
  }
}

/**
 * Pull latest changes from origin main and recompile TypeScript.
 */
export function performUpdate(repoDir: string = DEFAULT_REPO_ROOT): PerformUpdateResult {
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

    // 1. Ensure remote is correct
    try {
      execSync(`git remote set-url origin ${OFFICIAL_REPO_URL}`, { cwd: repoDir, stdio: ['ignore', 'ignore', 'ignore'] });
    } catch {}

    // 2. Pull changes
    try {
      execSync('git pull --rebase origin main --quiet', {
        cwd: repoDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: gitEnv,
        timeout: 20000
      });
    } catch {
      // Check if local has unpushed commits ahead of origin/main before any destructive reset
      let aheadCount = 0;
      try {
        aheadCount = parseInt(execSync('git rev-list --count origin/main..HEAD', { cwd: repoDir, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(), 10) || 0;
      } catch {}
      if (aheadCount > 0) {
        return { success: false, updated: false, message: `Local repository has ${aheadCount} unpushed commit(s) ahead of origin/main. Skipping auto-reset.` };
      }

      // Fallback: stash local untracked/dirty changes and reset to origin/main
      try {
        execSync('git stash', { cwd: repoDir, stdio: ['ignore', 'ignore', 'ignore'] });
        execSync('git checkout -B main origin/main --quiet', {
          cwd: repoDir,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe'],
          env: gitEnv,
          timeout: 10000
        });
      } catch (pullErr: any) {
        throw new Error(`Git pull failed: ${pullErr.message}`);
      }
    }

    const newSha = execSync('git rev-parse HEAD', {
      cwd: repoDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000
    }).trim();

    // 3. Recompile TypeScript build
    try {
      execSync('npm run build', {
        cwd: repoDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000
      });
    } catch {
      execSync('npx tsc', {
        cwd: repoDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30000
      });
    }

    // 4. Automatically re-install extension if possible
    try {
      execSync('node dist/cli.js extension install', {
        cwd: repoDir,
        encoding: 'utf-8',
        stdio: ['ignore', 'ignore', 'ignore'],
        timeout: 15000
      });
    } catch {}

    return {
      success: true,
      updated: true,
      message: `Successfully updated Agent Guard (${check.behindCount || 1} new commits applied).`,
      previousSha,
      newSha
    };
  } catch (err: any) {
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
export function maybeBackgroundUpdate(repoDir: string = DEFAULT_REPO_ROOT, logFn?: (msg: string) => void): void {
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
  } catch {
    // ignore parse errors and proceed
  }

  // Record check attempt timestamp
  try {
    if (!fs.existsSync(markerDir)) {
      fs.mkdirSync(markerDir, { recursive: true });
    }
    fs.writeFileSync(
      markerFile,
      JSON.stringify({ last_check: Date.now() }, null, 2),
      'utf-8'
    );
  } catch {
    // Non-fatal
  }

  // Asynchronous update attempt in background
  setTimeout(() => {
    try {
      const res = performUpdate(repoDir);
      if (res.updated && logFn) {
        logFn(`[Agent Guard] Auto-updated to ${res.newSha?.slice(0, 7)}: ${res.message}`);
      }
    } catch {
      // Silent fail on background auto-update
    }
  }, 100).unref?.();
}

/**
 * Check and auto-install updates on startup if enabled and available.
 */
export function autoUpdateOnStartup(repoDir: string = DEFAULT_REPO_ROOT, logFn?: (msg: string) => void): PerformUpdateResult | null {
  try {
    const check = checkForUpdates(repoDir);
    if (check.isGit && check.hasUpdate) {
      if (logFn) {
        logFn(`[Agent Guard Startup] Auto-installing update: ${check.behindCount || 1} new commit(s) detected.`);
      }
      return performUpdate(repoDir);
    }
  } catch (err: any) {
    if (logFn) {
      logFn(`[Agent Guard Startup] Auto-update check error: ${err.message}`);
    }
  }
  return null;
}

