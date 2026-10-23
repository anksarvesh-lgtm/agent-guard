import fs from 'node:fs';
import path from 'node:path';
import { getAgentDir, getLedgerPath, getLedgerLockPath, getLedgerPrevPath, getLedgerTmpPath, getHistoryDir, } from './util/paths.js';
const LOCK_WAIT_MS = 50;
const LOCK_TIMEOUT_MS = 5000;
const STALE_LOCK_MS = 30000;
/**
 * Acquires a file lock on .agent/ledger.lock with stale lock eviction and backoff.
 */
function acquireLock(lockPath) {
    const start = Date.now();
    while (true) {
        try {
            // Check for stale lock
            if (fs.existsSync(lockPath)) {
                try {
                    const stat = fs.statSync(lockPath);
                    const ageMs = Date.now() - stat.mtimeMs;
                    if (ageMs > STALE_LOCK_MS) {
                        // Lock is stale, unlink
                        fs.unlinkSync(lockPath);
                    }
                }
                catch {
                    // File may have been removed concurrently
                }
            }
            // 'wx' flag opens for writing and fails if file exists
            const fd = fs.openSync(lockPath, 'wx');
            fs.writeSync(fd, `${process.pid}\n${Date.now()}`);
            fs.closeSync(fd);
            // Return release function
            return () => {
                try {
                    if (fs.existsSync(lockPath)) {
                        fs.unlinkSync(lockPath);
                    }
                }
                catch {
                    // Ignore unlock errors
                }
            };
        }
        catch (err) {
            if (err.code !== 'EEXIST') {
                throw err;
            }
            if (Date.now() - start >= LOCK_TIMEOUT_MS) {
                throw new Error('LOCK_TIMEOUT: Could not acquire ledger lock after 5 seconds');
            }
            // Sleep synchronous wait
            const waitUntil = Date.now() + LOCK_WAIT_MS;
            while (Date.now() < waitUntil) {
                // spin
            }
        }
    }
}
/**
 * Validates the basic structural shape of a TaskLedger.
 */
export function isValidLedger(obj) {
    return (obj &&
        typeof obj === 'object' &&
        typeof obj.version === 'number' &&
        typeof obj.task_id === 'string' &&
        typeof obj.goal === 'string' &&
        ['active', 'done', 'blocked'].includes(obj.status) &&
        typeof obj.checkpoint_count === 'number' &&
        Array.isArray(obj.steps));
}
/**
 * Reads the ledger from disk safely, restoring from ledger.prev.json if corrupt.
 */
export function readLedger(projectPath) {
    const ledgerPath = getLedgerPath(projectPath);
    const prevPath = getLedgerPrevPath(projectPath);
    if (!fs.existsSync(ledgerPath)) {
        return null;
    }
    try {
        const raw = fs.readFileSync(ledgerPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (isValidLedger(parsed)) {
            return parsed;
        }
        throw new Error('Invalid ledger structure');
    }
    catch (err) {
        // Attempt recovery from prev file
        if (fs.existsSync(prevPath)) {
            try {
                const rawPrev = fs.readFileSync(prevPath, 'utf-8');
                const parsedPrev = JSON.parse(rawPrev);
                if (isValidLedger(parsedPrev)) {
                    // Restore prev to current
                    fs.copyFileSync(prevPath, ledgerPath);
                    return parsedPrev;
                }
            }
            catch {
                // Prev was also corrupted
            }
        }
        return null;
    }
}
/**
 * Writes the ledger to disk atomically with file locking and backup.
 */
export function writeLedger(ledger, projectPath) {
    // Ensure agent dir exists
    getAgentDir(projectPath);
    const lockPath = getLedgerLockPath(projectPath);
    const ledgerPath = getLedgerPath(projectPath);
    const prevPath = getLedgerPrevPath(projectPath);
    const tmpPath = getLedgerTmpPath(projectPath);
    const release = acquireLock(lockPath);
    try {
        // Step 2: Backup existing ledger if present
        if (fs.existsSync(ledgerPath)) {
            fs.copyFileSync(ledgerPath, prevPath);
        }
        // Step 3: Write new content to tmp and atomic rename
        const jsonStr = JSON.stringify(ledger, null, 2);
        fs.writeFileSync(tmpPath, jsonStr, 'utf-8');
        fs.renameSync(tmpPath, ledgerPath);
    }
    finally {
        release();
    }
}
/**
 * Archives current active task into .agent/history/<task_id>.json
 */
export function archiveCurrentTask(projectPath) {
    const current = readLedger(projectPath);
    if (!current) {
        return;
    }
    const histDir = getHistoryDir(projectPath);
    const archivePath = path.join(histDir, `${current.task_id}.json`);
    fs.writeFileSync(archivePath, JSON.stringify(current, null, 2), 'utf-8');
    // Remove ledger and prev
    const ledgerPath = getLedgerPath(projectPath);
    if (fs.existsSync(ledgerPath)) {
        fs.unlinkSync(ledgerPath);
    }
}
/**
 * Cascades blocked status to any pending or in_progress steps that depend on blocked steps.
 */
export function cascadeBlockedDependencies(steps) {
    let changed = false;
    const blockedIds = new Set(steps.filter((s) => s.status === 'blocked').map((s) => s.id));
    let more = true;
    while (more) {
        more = false;
        for (const step of steps) {
            if (['pending', 'in_progress', 'failed'].includes(step.status)) {
                const hasBlockedDep = step.depends_on.some((depId) => blockedIds.has(depId));
                if (hasBlockedDep) {
                    step.status = 'blocked';
                    step.last_error = `Blocked because dependency is blocked`;
                    step.updated_at = new Date().toISOString();
                    blockedIds.add(step.id);
                    changed = true;
                    more = true;
                }
            }
        }
    }
    return changed;
}
/**
 * Selects the next step to work on according to strict priority:
 * 1. Any in_progress step.
 * 2. Any failed step with tries < max_tries.
 * 3. First pending step whose dependencies are all 'done'.
 */
export function getNextStep(steps) {
    // 1. in_progress
    const inProgress = steps.find((s) => s.status === 'in_progress');
    if (inProgress) {
        return inProgress;
    }
    // 2. failed with tries left
    const failedWithTries = steps.find((s) => s.status === 'failed' && s.tries < s.max_tries);
    if (failedWithTries) {
        return failedWithTries;
    }
    // 3. first ready pending
    const doneIds = new Set(steps.filter((s) => s.status === 'done').map((s) => s.id));
    const pendingReady = steps.find((s) => {
        if (s.status !== 'pending')
            return false;
        return s.depends_on.every((depId) => doneIds.has(depId));
    });
    return pendingReady ?? null;
}
/**
 * Re-evaluates top-level task status based on all steps.
 */
export function evaluateTaskStatus(steps) {
    cascadeBlockedDependencies(steps);
    const allDone = steps.length > 0 && steps.every((s) => s.status === 'done');
    if (allDone) {
        return 'done';
    }
    const next = getNextStep(steps);
    if (!next) {
        // If no next step can run and not all steps are done, task is blocked
        return 'blocked';
    }
    return 'active';
}
//# sourceMappingURL=ledger.js.map