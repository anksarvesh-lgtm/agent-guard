import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  writeLedger,
  readLedger,
  getNextStep,
  evaluateTaskStatus,
  cascadeBlockedDependencies,
} from '../src/ledger.js';
import { handleTaskCheckpoint } from '../src/tools/taskCheckpoint.js';
import { Step, TaskLedger } from '../src/types.js';

describe('step rules, transitions, and priority ordering', () => {
  const testDir = path.join(os.tmpdir(), `agent-guard-step-test-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, '.git'));
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  function createTestLedger(steps: Step[]): TaskLedger {
    return {
      version: 1,
      task_id: 't-step-test',
      goal: 'Step transition test',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      checkpoint_count: 0,
      steps,
    };
  }

  it('refuses done status if note is under 10 characters (NEED_PROOF)', () => {
    const steps: Step[] = [
      {
        id: 's1',
        title: 'Step 1',
        status: 'in_progress',
        tries: 0,
        max_tries: 3,
        depends_on: [],
        note: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
    ];
    writeLedger(createTestLedger(steps), testDir);

    const result = handleTaskCheckpoint({
      step_id: 's1',
      status: 'done',
      note: 'short',
      project_path: testDir,
    });

    expect(result).toContain('NEED_PROOF');
    const ledger = readLedger(testDir);
    expect(ledger?.steps[0].status).toBe('in_progress'); // remains unchanged
  });

  it('marks step done when note provides >=10 chars of proof', () => {
    const steps: Step[] = [
      {
        id: 's1',
        title: 'Step 1',
        status: 'in_progress',
        tries: 0,
        max_tries: 3,
        depends_on: [],
        note: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      {
        id: 's2',
        title: 'Step 2',
        status: 'pending',
        tries: 0,
        max_tries: 3,
        depends_on: ['s1'],
        note: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
    ];
    writeLedger(createTestLedger(steps), testDir);

    const result = handleTaskCheckpoint({
      step_id: 's1',
      status: 'done',
      note: 'Unit tests passed (24/24)',
      project_path: testDir,
    });

    expect(result).toContain('s1 done');
    expect(result).toContain('Next: s2');

    const ledger = readLedger(testDir);
    expect(ledger?.steps[0].status).toBe('done');
    expect(ledger?.checkpoint_count).toBe(1);
  });

  it('increments tries on failed step and prompts retry when tries < max_tries', () => {
    const steps: Step[] = [
      {
        id: 's1',
        title: 'Step 1',
        status: 'in_progress',
        tries: 0,
        max_tries: 3,
        depends_on: [],
        note: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
    ];
    writeLedger(createTestLedger(steps), testDir);

    const result = handleTaskCheckpoint({
      step_id: 's1',
      status: 'failed',
      note: 'Syntax error in parser',
      error: 'Unexpected token at line 4',
      project_path: testDir,
    });

    expect(result).toContain('Step s1 failed (try 1 of 3)');
    expect(result).toContain('Fix the cause and retry s1');

    const ledger = readLedger(testDir);
    expect(ledger?.steps[0].status).toBe('failed');
    expect(ledger?.steps[0].tries).toBe(1);
  });

  it('transitions to blocked when tries reach max_tries', () => {
    const steps: Step[] = [
      {
        id: 's1',
        title: 'Step 1',
        status: 'failed',
        tries: 2,
        max_tries: 3,
        depends_on: [],
        note: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
    ];
    writeLedger(createTestLedger(steps), testDir);

    const result = handleTaskCheckpoint({
      step_id: 's1',
      status: 'failed',
      note: 'Failed third attempt',
      project_path: testDir,
    });

    expect(result).toContain('blocked after 3 tries');

    const ledger = readLedger(testDir);
    expect(ledger?.steps[0].status).toBe('blocked');
    expect(ledger?.steps[0].tries).toBe(3);
    expect(ledger?.status).toBe('blocked'); // task blocked since no other step
  });

  it('cascades blocked status to dependent steps', () => {
    const steps: Step[] = [
      {
        id: 's1',
        title: 'Step 1',
        status: 'blocked',
        tries: 3,
        max_tries: 3,
        depends_on: [],
        note: null,
        last_error: 'Connection timeout',
        updated_at: new Date().toISOString(),
      },
      {
        id: 's2',
        title: 'Step 2',
        status: 'pending',
        tries: 0,
        max_tries: 3,
        depends_on: ['s1'],
        note: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      {
        id: 's3',
        title: 'Step 3',
        status: 'pending',
        tries: 0,
        max_tries: 3,
        depends_on: ['s2'],
        note: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
    ];

    cascadeBlockedDependencies(steps);

    expect(steps[1].status).toBe('blocked');
    expect(steps[2].status).toBe('blocked');
  });

  it('strictly respects next-step selection priority order', () => {
    // Priority: in_progress > failed with tries > first ready pending
    const steps: Step[] = [
      {
        id: 's1',
        title: 'Step 1',
        status: 'done',
        tries: 1,
        max_tries: 3,
        depends_on: [],
        note: 'Completed OK',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      {
        id: 's2',
        title: 'Step 2 (pending ready)',
        status: 'pending',
        tries: 0,
        max_tries: 3,
        depends_on: ['s1'],
        note: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      {
        id: 's3',
        title: 'Step 3 (failed with tries left)',
        status: 'failed',
        tries: 1,
        max_tries: 3,
        depends_on: ['s1'],
        note: null,
        last_error: 'flaky test',
        updated_at: new Date().toISOString(),
      },
      {
        id: 's4',
        title: 'Step 4 (in_progress)',
        status: 'in_progress',
        tries: 0,
        max_tries: 3,
        depends_on: ['s1'],
        note: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
    ];

    // With in_progress present, it must be chosen first
    expect(getNextStep(steps)?.id).toBe('s4');

    // Remove in_progress, failed with tries left must be chosen next
    steps[3].status = 'done';
    expect(getNextStep(steps)?.id).toBe('s3');

    // Remove failed, ready pending must be chosen next
    steps[2].status = 'done';
    expect(getNextStep(steps)?.id).toBe('s2');
  });

  it('marks task done when all steps are done', () => {
    const steps: Step[] = [
      {
        id: 's1',
        title: 'Step 1',
        status: 'done',
        tries: 1,
        max_tries: 3,
        depends_on: [],
        note: 'Finished 1',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      {
        id: 's2',
        title: 'Step 2',
        status: 'done',
        tries: 1,
        max_tries: 3,
        depends_on: ['s1'],
        note: 'Finished 2',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
    ];

    expect(evaluateTaskStatus(steps)).toBe('done');
  });
});
