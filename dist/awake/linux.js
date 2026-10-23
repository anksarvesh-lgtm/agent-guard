import { spawn } from 'node:child_process';
export class LinuxSleepInhibitor {
    isSupported() {
        return process.platform === 'linux';
    }
    start(seconds) {
        const proc = spawn('systemd-inhibit', [
            '--what=idle:sleep',
            '--who=agent-guard',
            '--why=agent-task',
            '--mode=block',
            'sleep',
            String(seconds),
        ], {
            stdio: 'ignore',
            detached: false,
        });
        return { process: proc };
    }
    stop(proc) {
        try {
            if (proc && !proc.killed) {
                proc.kill('SIGTERM');
            }
        }
        catch {
            // Ignore
        }
    }
}
//# sourceMappingURL=linux.js.map