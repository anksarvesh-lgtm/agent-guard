import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runStopHook } from '../src/hook/stop-hook.js';
import { writeLedger } from '../src/ledger.js';
import { getHookStatePath } from '../src/util/paths.js';
import { TaskLedger } from '../src/types.js';

describe('stop-hook.ts logic and loop breaker', () => {
  const testDir = path.join(os.tmpdir(), `agent-guard-stophook-test-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, '.git'));
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('allows stop when no ledger exists', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    runStopHook(testDir);
    expect(stdoutSpy).not.toHaveBeenCalled();

    stdoutSpy.mockRestore();
  });

  it('allows stop and resets counters when task is done', () => {
    const ledger: TaskLedger = {
      version: 1,
      task_id: 't-hook-done',
      goal: 'Done task',
      status: 'done',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      checkpoint_count: 5,
      steps: [
        {
          id: 's1',
          title: 'Done step',
          status: 'done',
          tries: 1,
          max_tries: 3,
          depends_on: [],
          note: 'Done proof ok',
          last_error: null,
          updated_at: new Date().toISOString(),
        },
      ],
    };
    writeLedger(ledger, testDir);

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    runStopHook(testDir);

    expect(stdoutSpy).not.toHaveBeenCalled();
    stdoutSpy.mockRestore();
  });

  it('pushes back when unfinished unblocked steps remain', () => {
    const ledger: TaskLedger = {
      version: 1,
      task_id: 't-hook-active',
      goal: 'Unfinished task',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      checkpoint_count: 1,
      steps: [
        {
          id: 's1',
          title: 'Unfinished step',
          status: 'in_progress',
          tries: 0,
          max_tries: 3,
          depends_on: [],
          note: null,
          last_error: null,
          updated_at: new Date().toISOString(),
        },
      ],
    };
    writeLedger(ledger, testDir);

    let output = '';
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((data: any) => {
      output += data;
      return true;
    });

    runStopHook(testDir);

    expect(stdoutSpy).toHaveBeenCalled();
    const parsed = JSON.parse(output);
    expect(parsed.decision).toBe('continue');
    expect(parsed.reason).toContain('s1');

    stdoutSpy.mockRestore();
  });

  it('triggers loop breaker after 3 consecutive idle pushes', () => {
    const ledger: TaskLedger = {
      version: 1,
      task_id: 't-hook-loop',
      goal: 'Loop task',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      checkpoint_count: 1, // Progress not advancing
      steps: [
        {
          id: 's1',
          title: 'Stuck step',
          status: 'in_progress',
          tries: 0,
          max_tries: 3,
          depends_on: [],
          note: null,
          last_error: null,
          updated_at: new Date().toISOString(),
        },
      ],
    };
    writeLedger(ledger, testDir);

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Push 1
    runStopHook(testDir);
    expect(stdoutSpy).toHaveBeenCalledTimes(1);

    // Push 2
    runStopHook(testDir);
    expect(stdoutSpy).toHaveBeenCalledTimes(2);

    // Push 3
    runStopHook(testDir);
    expect(stdoutSpy).toHaveBeenCalledTimes(3);

    // Push 4 (should break loop and allow stop!)
    runStopHook(testDir);
    expect(stdoutSpy).toHaveBeenCalledTimes(3); // Not called again!

    stdoutSpy.mockRestore();
  });
});
