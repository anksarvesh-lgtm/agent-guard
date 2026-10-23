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
                warning = 'On battery, plug in to prevent rapid drain.';
            }
        }
        catch {
            // Ignore battery query failures
        }
        // Start caffeinate with -d (display), -i (idle), -t (timeout), -w (wait for PID)
        const proc = spawn('caffeinate', ['-d', '-i', '-t', String(seconds), '-w', String(process.pid)], {
            stdio: 'ignore',
            detached: false,
        });
        proc.on('error', (err) => {
            // Helper failed
        });
        return { process: proc, warning };
    }
    stop(proc) {
        try {
            if (proc && !proc.killed) {
                proc.kill('SIGTERM');
            }
        }
        catch {
            // Ignore teardown errors
        }
    }
}
//# sourceMappingURL=mac.js.map