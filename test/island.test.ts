import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import net from 'net';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  detectLiquidDynamo,
  createTaskStartEvent,
  createStepCheckpointEvent,
  createToolEvent,
  createAccountSwitchEvent,
  createKeepAwakeEvent,
  IslandSocketClient,
  IslandBridge,
} from '../src/island/index.js';
import { handleIslandStatus, handleIslandNotify } from '../src/tools/island.js';

describe('IslandBridge & LiquidDynamo Integration', () => {
  const tmpDir = path.join(os.tmpdir(), `test-island-${Date.now()}`);
  const mockSockPath = path.join(tmpDir, 'mock_watcher.sock');
  let mockServer: net.Server | null = null;
  let receivedLines: string[] = [];

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    receivedLines = [];
  });

  afterEach(() => {
    if (mockServer) {
      mockServer.close();
      mockServer = null;
    }
    try {
      if (fs.existsSync(mockSockPath)) fs.unlinkSync(mockSockPath);
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('detects LiquidDynamo installation and runtime gracefully', () => {
    const d = detectLiquidDynamo();
    expect(d).toBeDefined();
    expect(typeof d.isInstalled).toBe('boolean');
    expect(typeof d.isRunning).toBe('boolean');
    expect(typeof d.isWatcherEnabled).toBe('boolean');
  });

  it('creates well-formed TaskStart event with alert payload', () => {
    const evt = createTaskStartEvent({
      sessionId: 't-test-1234',
      goal: 'Test Dynamic Island streaming',
      totalSteps: 5,
      firstStepTitle: 'Step 1: Setup',
      account: 'Test User (100%)',
    });

    expect(evt.agent).toBe('antigravity');
    expect(evt.session_id).toBe('t-test-1234');
    expect(evt.hook_event_name).toBe('TaskStart');
    expect(evt.step_total).toBe(5);
    expect(evt.step_index).toBe(1);
    expect(evt.notification).toBeDefined();
    expect(evt.notification?.title).toBe('Antigravity Task Started');
    expect(evt.notification?.subtitle).toBe('Test Dynamic Island streaming');
    expect(evt.notification?.kind).toBe('alert');
  });

  it('creates well-formed StepCheckpoint event with progress & status', () => {
    const evt = createStepCheckpointEvent({
      sessionId: 't-test-1234',
      goal: 'Test Dynamic Island streaming',
      stepId: 's3',
      stepTitle: 'Step 3: Verification',
      stepIndex: 3,
      totalSteps: 5,
      status: 'done',
      note: 'All tests green',
    });

    expect(evt.step_id).toBe('s3');
    expect(evt.step_index).toBe(3);
    expect(evt.progress).toBe(0.6); // 3 / 5 = 0.6
    expect(evt.notification?.title).toBe('Step 3/5 Completed');
    expect(evt.notification?.subtitle).toBe('All tests green');
  });

  it('creates finished task celebration alert on final step completion', () => {
    const evt = createStepCheckpointEvent({
      sessionId: 't-test-1234',
      goal: 'Complete task',
      stepId: 's5',
      stepTitle: 'Final step',
      stepIndex: 5,
      totalSteps: 5,
      status: 'done',
    });

    expect(evt.progress).toBe(1.0);
    expect(evt.hook_event_name).toBe('Stop');
    expect(evt.status).toBe('finished');
    expect(evt.notification?.title).toContain('Finished');
  });

  it('creates failure warning alert on step error', () => {
    const evt = createStepCheckpointEvent({
      sessionId: 't-test-1234',
      goal: 'Failed task test',
      stepId: 's2',
      stepTitle: 'Failing step',
      stepIndex: 2,
      totalSteps: 4,
      status: 'failed',
      error: 'Assertion failed at line 42',
    });

    expect(evt.hook_event_name).toBe('PostToolUseFailure');
    expect(evt.status).toBe('error');
    expect(evt.notification?.title).toContain('Failed (Retrying)');
    expect(evt.notification?.subtitle).toContain('Assertion failed');
  });

  it('creates account switch and keep-awake events correctly', () => {
    const switchEvt = createAccountSwitchEvent({
      oldAccount: 'primary',
      newAccount: 'Ankit Yadav',
      quotaPercent: 95,
    });
    expect(switchEvt.hook_event_name).toBe('AccountSwitch');
    expect(switchEvt.notification?.subtitle).toContain('Switched to Ankit Yadav (95% quota)');

    const awakeEvt = createKeepAwakeEvent({
      enabled: true,
      remainingMinutes: 45,
    });
    expect(awakeEvt.hook_event_name).toBe('KeepAwakeChanged');
    expect(awakeEvt.notification?.subtitle).toContain('45 min remaining');
  });

  it('connects to unix socket and streams newline-delimited JSON events', async () => {
    await new Promise<void>((resolve) => {
      mockServer = net.createServer((c) => {
        c.on('data', (d) => {
          const lines = d.toString('utf8').split('\n').filter(Boolean);
          receivedLines.push(...lines);
        });
      });
      mockServer.listen(mockSockPath, () => resolve());
    });

    const client = new IslandSocketClient();
    (client as any).resolveActiveSocketPath = () => mockSockPath;
    (client as any).connect();

    await new Promise((r) => setTimeout(r, 200));

    expect(client.connected).toBe(true);

    client.send({
      event: 'TestEvent',
      message: 'Hello Island!',
    });

    await new Promise((r) => setTimeout(r, 150));

    expect(receivedLines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(receivedLines[0]);
    expect(parsed.event).toBe('TestEvent');
    expect(parsed.message).toBe('Hello Island!');

    client.disconnect();
  });

  it('handles island_status and island_notify tool handlers', () => {
    const statusText = handleIslandStatus();
    expect(statusText).toContain('LiquidDynamo Dynamic Island Status:');
    expect(statusText).toContain('Installed:');
    expect(statusText).toContain('Running:');

    const notifyText = handleIslandNotify({
      title: 'Unit Test Alert',
      message: 'Dynamic island payload verification',
      duration: 3,
    });
    expect(notifyText).toContain('Unit Test Alert');
  });
});
