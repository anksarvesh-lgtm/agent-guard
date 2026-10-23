import { spawn, execSync, ChildProcess } from 'node:child_process';
import { SleepInhibitor } from './types.js';

export class MacSleepInhibitor implements SleepInhibitor {
  isSupported(): boolean {
    return process.platform === 'darwin';
  }

  start(seconds: number): { process: ChildProcess; warning?: string } {
    let warning: string | undefined;

    // Check battery status
    try {
      const battOutput = execSync('pmset -g batt', { encoding: 'utf-8', timeout: 1000 });
      if (battOutput.includes('Battery Power') || battOutput.includes('discharging')) {
        warning = 'On battery, plug in to prevent rapid drain.';
      }
    } catch {
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

  stop(proc: ChildProcess): void {
    try {
      if (proc && !proc.killed) {
        proc.kill('SIGTERM');
      }
    } catch {
      // Ignore teardown errors
    }
  }
}
