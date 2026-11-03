import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
export const PRIMARY_SOCKET_PATH = path.join(os.homedir(), 'Library', 'Application Support', 'LiquidDynamo', 'watcher.sock');
export const FALLBACK_SOCKET_PATH = '/tmp/liquid_watcher.sock';
export const STANDARD_APP_PATHS = [
    '/Applications/LiquidDynamo.app',
    path.join(os.homedir(), 'Applications', 'LiquidDynamo.app'),
    '/Users/sarvesh/Desktop/LiquidDynamo-1.9.2/build/Release/LiquidDynamo.app',
    '/Users/sarvesh/Desktop/LiquidDynamo-1.9.2/build/Build/Products/Release/LiquidDynamo.app',
];
export function detectLiquidDynamo() {
    if (process.platform !== 'darwin') {
        return {
            isInstalled: false,
            isRunning: false,
            appPath: null,
            socketPath: null,
            pid: null,
            isWatcherEnabled: false,
        };
    }
    // 1. Detect installed application bundle
    let appPath = null;
    for (const candidate of STANDARD_APP_PATHS) {
        if (fs.existsSync(candidate)) {
            appPath = candidate;
            break;
        }
    }
    // 2. Check running process via pgrep
    let isRunning = false;
    let pid = null;
    try {
        const pgrepOut = execSync('pgrep -x LiquidDynamo || pgrep -f "/LiquidDynamo.app/Contents/MacOS/LiquidDynamo"', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
        }).trim();
        if (pgrepOut) {
            const pids = pgrepOut.split('\n').map((p) => parseInt(p.trim(), 10)).filter((p) => !isNaN(p));
            if (pids.length > 0) {
                isRunning = true;
                pid = pids[0];
            }
        }
    }
    catch {
        isRunning = false;
    }
    // 3. Detect active socket path
    let socketPath = null;
    if (fs.existsSync(PRIMARY_SOCKET_PATH)) {
        socketPath = PRIMARY_SOCKET_PATH;
    }
    else if (fs.existsSync(FALLBACK_SOCKET_PATH)) {
        socketPath = FALLBACK_SOCKET_PATH;
    }
    // 4. Check user defaults setting
    let isWatcherEnabled = false;
    try {
        const defOut = execSync('defaults read com.agrigence.liquiddynamo enableWatcherIntegration 2>/dev/null', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
        }).trim();
        isWatcherEnabled = defOut === '1' || defOut.toLowerCase() === 'true';
    }
    catch {
        isWatcherEnabled = false;
    }
    return {
        isInstalled: appPath !== null || isRunning || socketPath !== null,
        isRunning,
        appPath,
        socketPath,
        pid,
        isWatcherEnabled,
    };
}
export function ensureWatcherEnabled() {
    if (process.platform !== 'darwin')
        return false;
    try {
        execSync('defaults write com.agrigence.liquiddynamo enableWatcherIntegration -bool true', {
            stdio: 'ignore',
        });
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=detector.js.map