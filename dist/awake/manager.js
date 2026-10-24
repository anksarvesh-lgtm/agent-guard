import { MacSleepInhibitor } from './mac.js';
import { WindowsSleepInhibitor } from './windows.js';
import { LinuxSleepInhibitor } from './linux.js';
const TICK_INTERVAL_MS = 30 * 1000; // 30 seconds
const MAX_SINGLE_HOLD_MINUTES = 240; // 4 hours
const HARD_CAP_MINUTES = 480; // 8 hours hard ceiling
export class AwakeManager {
    inhibitor;
    currentProcess = null;
    leaseEndTime = null;
    taskStartTime = null;
    ticker = null;
    warning;
    constructor(customInhibitor) {
        if (customInhibitor) {
            this.inhibitor = customInhibitor;
        }
        else if (process.platform === 'darwin') {
            this.inhibitor = new MacSleepInhibitor();
        }
        else if (process.platform === 'win32') {
            this.inhibitor = new WindowsSleepInhibitor();
        }
        else {
            this.inhibitor = new LinuxSleepInhibitor();
        }
        this.registerExitHandlers();
    }
    registerExitHandlers() {
        const cleanup = () => {
            this.release();
        };
        process.once('exit', cleanup);
        process.once('SIGINT', () => {
            cleanup();
            process.exit(0);
        });
        process.once('SIGTERM', () => {
            cleanup();
            process.exit(0);
        });
    }
    startTicker() {
        if (this.ticker)
            return;
        this.ticker = setInterval(() => {
            if (this.leaseEndTime && Date.now() >= this.leaseEndTime) {
                this.release();
            }
        }, TICK_INTERVAL_MS);
        // Don't keep Node process alive solely for the ticker
        if (this.ticker.unref) {
            this.ticker.unref();
        }
    }
    stopTicker() {
        if (this.ticker) {
            clearInterval(this.ticker);
            this.ticker = null;
        }
    }
    hold(requestedMinutes, reason) {
        if (!this.inhibitor.isSupported()) {
            throw new Error(`AWAKE_UNSUPPORTED: Sleep inhibition is not supported or failed on ${process.platform}. ` +
                `Use manual keep-awake fallback (on Mac: caffeinate -di; on Windows/Linux: adjust display sleep settings).`);
        }
        const now = Date.now();
        if (!this.taskStartTime) {
            this.taskStartTime = now;
        }
        // Check 8-hour hard ceiling
        const totalElapsedMs = now - this.taskStartTime;
        const maxRemainingMs = Math.max(0, HARD_CAP_MINUTES * 60 * 1000 - totalElapsedMs);
        if (maxRemainingMs <= 0) {
            this.release();
            throw new Error(`AWAKE_HARD_CAP_EXCEEDED: 8-hour keep-awake hard cap reached for this task. ` +
                `Explicitly call keep_awake with action 'hold' and a new reason to start a new awake cycle.`);
        }
        const clampedMinutes = Math.min(requestedMinutes, MAX_SINGLE_HOLD_MINUTES, Math.ceil(maxRemainingMs / (60 * 1000)));
        const holdSeconds = clampedMinutes * 60;
        // Seamless swap: start new helper before stopping the old one
        const oldProc = this.currentProcess;
        const { process: newProc, warning } = this.inhibitor.start(holdSeconds);
        this.currentProcess = newProc;
        this.warning = warning;
        this.leaseEndTime = now + holdSeconds * 1000;
        if (newProc) {
            newProc.on('exit', () => {
                if (this.currentProcess === newProc) {
                    this.currentProcess = null;
                    this.leaseEndTime = null;
                    this.stopTicker();
                }
            });
            newProc.on('error', () => {
                if (this.currentProcess === newProc) {
                    this.currentProcess = null;
                    this.leaseEndTime = null;
                    this.stopTicker();
                }
            });
        }
        if (oldProc) {
            this.inhibitor.stop(oldProc);
        }
        this.startTicker();
        return this.status();
    }
    renew(minutes = 30) {
        const now = Date.now();
        const targetEnd = now + minutes * 60 * 1000;
        if (this.currentProcess && this.leaseEndTime && this.leaseEndTime >= targetEnd) {
            // Lease already exceeds the renewal target
            return this.status();
        }
        return this.hold(minutes, 'Automatic checkpoint renewal');
    }
    release() {
        this.stopTicker();
        if (this.currentProcess) {
            this.inhibitor.stop(this.currentProcess);
            this.currentProcess = null;
        }
        this.leaseEndTime = null;
        this.warning = undefined;
        return this.status();
    }
    resetTaskCap() {
        this.taskStartTime = null;
    }
    status() {
        const now = Date.now();
        const isHolding = this.currentProcess !== null &&
            !this.currentProcess.killed &&
            (this.currentProcess.exitCode === null || this.currentProcess.exitCode === undefined) &&
            this.leaseEndTime !== null &&
            this.leaseEndTime > now;
        const msRemaining = isHolding && this.leaseEndTime ? Math.max(0, this.leaseEndTime - now) : 0;
        const minutesRemaining = Math.ceil(msRemaining / (60 * 1000));
        const totalElapsedMs = this.taskStartTime ? now - this.taskStartTime : 0;
        const totalTaskHeldMinutes = Math.floor(totalElapsedMs / (60 * 1000));
        return {
            isHolding,
            heldUntil: isHolding && this.leaseEndTime ? new Date(this.leaseEndTime).toISOString() : null,
            minutesRemaining,
            totalTaskHeldMinutes,
            warning: this.warning,
        };
    }
}
// Global singleton instance for the MCP server process
export const globalAwakeManager = new AwakeManager();
//# sourceMappingURL=manager.js.map