import { spawn, ChildProcess } from 'node:child_process';
import { SleepInhibitor } from './types.js';

export class LinuxSleepInhibitor implements SleepInhibitor {
  isSupported(): boolean {
    return process.platform === 'linux';
  }

  start(seconds: number): { process: ChildProcess; warning?: string } {
    const proc = spawn(
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

    return { process: proc };
  }

  stop(proc: ChildProcess): void {
    try {
      if (proc && !proc.killed) {
        proc.kill('SIGTERM');
      }
    } catch {
      // Ignore
    }
  }
}
