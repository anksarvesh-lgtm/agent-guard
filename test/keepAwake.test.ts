import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AwakeManager } from '../src/awake/manager.js';
import { SleepInhibitor } from '../src/awake/types.js';
import { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

class MockChildProcess extends EventEmitter {
  public killed = false;
  kill(signal?: string) {
    this.killed = true;
    return true;
  }
}

describe('keep_awake lease manager & supervisor', () => {
  let mockInhibitor: SleepInhibitor;
  let activeProcesses: MockChildProcess[] = [];
  let isSupported = true;

  beforeEach(() => {
    activeProcesses = [];
    isSupported = true;

    mockInhibitor = {
      isSupported: () => isSupported,
      start: vi.fn((seconds: number) => {
        const proc = new MockChildProcess() as unknown as ChildProcess;
        activeProcesses.push(proc as any);
        return { process: proc };
      }),
      stop: vi.fn((proc: ChildProcess) => {
        (proc as any).killed = true;
      }),
    };
  });

  it('activates a hold lease and updates status', () => {
    const manager = new AwakeManager(mockInhibitor);
    const status = manager.hold(45, 'Testing hold');

    expect(status.isHolding).toBe(true);
    expect(status.minutesRemaining).toBe(45);
    expect(mockInhibitor.start).toHaveBeenCalledWith(45 * 60);

    manager.release();
  });

  it('performs seamless swap by starting new process before stopping old one', () => {
    const manager = new AwakeManager(mockInhibitor);
    manager.hold(30, 'First hold');

    const firstProc = activeProcesses[0];
    expect(firstProc.killed).toBe(false);

    manager.hold(60, 'Second hold');

    const secondProc = activeProcesses[1];
    expect(firstProc.killed).toBe(true);
    expect(secondProc.killed).toBe(false);

    manager.release();
    expect(secondProc.killed).toBe(true);
  });

  it('renews lease properly', () => {
    const manager = new AwakeManager(mockInhibitor);
    manager.hold(15, 'Short hold');

    const renewStatus = manager.renew(45);
    expect(renewStatus.minutesRemaining).toBeGreaterThanOrEqual(44);

    manager.release();
  });

  it('releases hold cleanly', () => {
    const manager = new AwakeManager(mockInhibitor);
    manager.hold(30);
    const releaseStatus = manager.release();

    expect(releaseStatus.isHolding).toBe(false);
    expect(releaseStatus.minutesRemaining).toBe(0);
    expect(activeProcesses[0].killed).toBe(true);
  });

  it('throws AWAKE_UNSUPPORTED when inhibitor is unsupported', () => {
    isSupported = false;
    const manager = new AwakeManager(mockInhibitor);

    expect(() => manager.hold(30)).toThrowError('AWAKE_UNSUPPORTED');
  });

  it('handles child process exit event by automatically transitioning isHolding to false', () => {
    const manager = new AwakeManager(mockInhibitor);
    manager.hold(30);

    expect(manager.status().isHolding).toBe(true);
    const proc = activeProcesses[0];

    // Emit exit event from child process
    proc.emit('exit', 0, null);

    expect(manager.status().isHolding).toBe(false);
    expect(manager.status().minutesRemaining).toBe(0);
  });

  it('handles child process error event cleanly without crashing', () => {
    const manager = new AwakeManager(mockInhibitor);
    manager.hold(30);

    expect(manager.status().isHolding).toBe(true);
    const proc = activeProcesses[0];

    proc.emit('error', new Error('Process spawn failed'));

    expect(manager.status().isHolding).toBe(false);
  });
});
