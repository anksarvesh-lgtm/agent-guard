import { spawn, execSync } from 'node:child_process';
export class MacSleepInhibitor {
    isSupported() {
        return process.platform === 'darwin';
    }
    start(seconds) {
        let warning;
        // Check battery status
        try {
            const battOutput = execSync('pmset -g batt', { encoding: 'utf-8', timeout: 1000 });
            if (battOutput.includes('Battery Power') || battOutput.includes('discharging')) {
                warning = 'On battery power. Plug into AC power to guarantee long-running background tasks do not suspend.';
            }
        }
        catch {
            // Ignore battery query failures
        }
        // Start caffeinate with -d (display), -i (idle), -m (disk), -s (system on AC), -u (user active), -t (timeout), -w (wait for PID)
        const proc = spawn('caffeinate', ['-d', '-i', '-m', '-s', '-u', '-t', String(seconds), '-w', String(process.pid)], {
            stdio: 'ignore',
            detached: false,
        });
        proc.on('error', () => {
            // Helper failed to spawn
        });
        return { process: proc, warning };
    }
    stop(proc) {
        try {
            if (proc && !proc.killed && proc.pid) {
                proc.kill('SIGTERM');
                // Force kill if helper remains alive
                setTimeout(() => {
                    try {
                        if (!proc.killed && proc.exitCode === null && proc.pid) {
                            proc.kill('SIGKILL');
                        }
                    }
                    catch { }
                }, 500).unref();
            }
        }
        catch {
            // Ignore teardown errors
        }
    }
}
//# sourceMappingURL=mac.js.map