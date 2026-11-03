import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  registerRunningTask,
  updateRunningTask,
  completeRunningTask,
  readRunningTasks,
  getRunningTasksPath,
} from '../src/util/taskRegistry.js';

describe('taskRegistry background task tracker', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-task-reg-'));
    fs.mkdirSync(path.join(tempDir, '.git'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('registers and retrieves running background tasks', () => {
    const task = registerRunningTask(
      {
        name: 'App Packaging',
        type: 'packaging',
        current_phase: 'Building DMG archive',
        details: 'Running hdiutil create',
        progress_percent: 25,
      },
      tempDir
    );

    expect(task.id).toMatch(/^packaging-/);
    expect(task.name).toBe('App Packaging');
    expect(task.type).toBe('packaging');
    expect(task.status).toBe('in_progress');

    const tasks = readRunningTasks(tempDir);
    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe(task.id);
  });

  it('updates task progress and phase', () => {
    const task = registerRunningTask(
      {
        name: 'App Packaging',
        type: 'packaging',
      },
      tempDir
    );

    const updated = updateRunningTask(
      task.id,
      {
        current_phase: 'UDZO compression',
        progress_percent: 75,
      },
      tempDir
    );

    expect(updated).not.toBeNull();
    expect(updated?.current_phase).toBe('UDZO compression');
    expect(updated?.progress_percent).toBe(75);
  });

  it('completes a running task successfully', () => {
    const task = registerRunningTask(
      {
        name: 'App Packaging',
        type: 'packaging',
      },
      tempDir
    );

    const ok = completeRunningTask(task.id, { success: true, note: 'DMG built successfully' }, tempDir);
    expect(ok).toBe(true);

    const tasks = readRunningTasks(tempDir);
    expect(tasks[0].status).toBe('completed');
    expect(tasks[0].progress_percent).toBe(100);
    expect(tasks[0].details).toBe('DMG built successfully');
  });
});
