import { spawn, execSync, ChildProcess } from 'node:child_process';
import { SleepInhibitor } from './types.js';

export class LinuxSleepInhibitor implements SleepInhibitor {
  isSupported(): boolean {
    return process.platform === 'linux';
  }

  start(seconds: number): { process: ChildProcess; warning?: string } {
    let warning: string | undefined;
    let proc: ChildProcess;

    try {
      execSync('which systemd-inhibit', { stdio: 'ignore' });
      proc = spawn(
        'systemd-inhibit',
        [
          '--what=idle:sleep',
          '--who=agent-guard',
          '--why=agent-task',
          '--mode=block',
          'sleep',
          String(seconds),
        ],
        {
          stdio: 'ignore',
          detached: false,
        }
      );
    } catch {
      warning = 'systemd-inhibit utility not found; native sleep inhibition unavailable on this Linux system.';
      proc = spawn('sleep', [String(seconds)], {
        stdio: 'ignore',
        detached: false,
      });
    }

    proc.on('error', () => {
      // Helper failed
    });

    return { process: proc, warning };
  }

  stop(proc: ChildProcess): void {
    try {
      if (proc && !proc.killed && proc.pid) {
        proc.kill('SIGTERM');
        setTimeout(() => {
          try {
            if (!proc.killed && proc.exitCode === null && proc.pid) {
              proc.kill('SIGKILL');
            }
          } catch {}
        }, 500).unref();
      }
    } catch {
      // Ignore
    }
  }
}
