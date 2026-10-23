import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { handleTaskStart } from '../src/tools/taskStart.js';
import { handleTaskCheckpoint } from '../src/tools/taskCheckpoint.js';
import { handleTaskStatus } from '../src/tools/taskStatus.js';
import { handleKeepAwake } from '../src/tools/keepAwake.js';
import { handleRepoBrief } from '../src/tools/repoBrief.js';
import { readLedger } from '../src/ledger.js';

describe('end-to-end tool handlers', () => {
  const testDir = path.join(os.tmpdir(), `agent-guard-tools-test-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, '.git'));
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('task_start starts task, creates ledger, and sets first step in_progress', () => {
    const res = handleTaskStart({
      goal: 'Build authentication module',
      steps: [
        { title: 'Create DB schema' },
        { title: 'Write token generator', depends_on: ['s1'] },
      ],
      project_path: testDir,
    });

    expect(res).toContain('Task started:');
    expect(res).toContain('First step to do: s1 (Create DB schema)');

    const ledger = readLedger(testDir);
    expect(ledger).not.toBeNull();
    expect(ledger?.status).toBe('active');
    expect(ledger?.steps.length).toBe(2);
    expect(ledger?.steps[0].status).toBe('in_progress');
    expect(ledger?.steps[1].status).toBe('pending');
  });

  it('task_start refuses TASK_ACTIVE if task exists without replace: true', () => {
    handleTaskStart({
      goal: 'First task',
      steps: [{ title: 'Step 1' }],
      project_path: testDir,
    });

    const secondRes = handleTaskStart({
      goal: 'Second task',
      steps: [{ title: 'Step 2' }],
      project_path: testDir,
    });

    expect(secondRes).toContain('TASK_ACTIVE');
  });

  it('task_start archives existing task when replace: true is passed', () => {
    handleTaskStart({
      goal: 'First task',
      steps: [{ title: 'Step 1' }],
      project_path: testDir,
    });

    const replaceRes = handleTaskStart({
      goal: 'Replaced task',
      steps: [{ title: 'New step 1' }],
      replace: true,
      project_path: testDir,
    });

    expect(replaceRes).toContain('Task started:');
    const ledger = readLedger(testDir);
    expect(ledger?.goal).toBe('Replaced task');
  });

  it('task_checkpoint supports dynamically adding new steps', () => {
    handleTaskStart({
      goal: 'Initial task',
      steps: [{ title: 'Initial step' }],
      project_path: testDir,
    });

    handleTaskCheckpoint({
      step_id: 's1',
      status: 'in_progress',
      note: 'Found extra work',
      add_steps: [{ title: 'Discovered follow-up step', depends_on: ['s1'] }],
      project_path: testDir,
    });

    const ledger = readLedger(testDir);
    expect(ledger?.steps.length).toBe(2);
    expect(ledger?.steps[1].id).toBe('s2');
    expect(ledger?.steps[1].title).toBe('Discovered follow-up step');
  });

  it('task_status formats concise overview of current task', () => {
    handleTaskStart({
      goal: 'Status display check',
      steps: [{ title: 'Step 1' }],
      project_path: testDir,
    });

    const status = handleTaskStatus({ project_path: testDir });
    expect(status).toContain('Task:');
    expect(status).toContain('Status display check');
    expect(status).toContain('Progress: 0 done, 1 remaining, 0 blocked');
    expect(status).toContain('Next Action: Continue step s1');
  });

  it('keep_awake handles hold, status, and release', () => {
    const holdRes = handleKeepAwake({
      action: 'hold',
      minutes: 10,
      reason: 'Batch compiling',
      project_path: testDir,
    });
    expect(holdRes).toContain('Awake lease active');

    const statusRes = handleKeepAwake({ action: 'status', project_path: testDir });
    expect(statusRes).toContain('Awake lease is ACTIVE');

    const releaseRes = handleKeepAwake({ action: 'release', project_path: testDir });
    expect(releaseRes).toContain('released');
  });

  it('repo_brief creates fresh brief on demand', () => {
    fs.writeFileSync(path.join(testDir, 'README.md'), '# Repo Brief Test Project');
    const briefRes = handleRepoBrief({ refresh: true, project_path: testDir });
    expect(briefRes).toContain('BRIEF: FRESH');
    expect(briefRes).toContain('Repo Brief Test Project');
  });
});
