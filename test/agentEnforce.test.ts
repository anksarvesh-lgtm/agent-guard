import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { handleAgentEnforce } from '../src/tools/agentEnforce.js';
import { runPostInvocationHook } from '../src/hook/post-invocation-hook.js';
import { runStopHook } from '../src/hook/stop-hook.js';
import { writeLedger, recordActiveAgent } from '../src/ledger.js';
import { TaskLedger } from '../src/types.js';

describe('Inter-Agent Enforcement and Multi-Agent Hooks', () => {
  const testDir = path.join(os.tmpdir(), `agent-guard-enforce-test-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, '.git'));
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  function seedActiveTask(): TaskLedger {
    const ledger: TaskLedger = {
      version: 1,
      task_id: 't-multi-agent',
      goal: 'Multi-agent completion testing',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      checkpoint_count: 0,
      steps: [
        {
          id: 's1',
          title: 'Implement core functionality',
          status: 'in_progress',
          tries: 1,
          max_tries: 3,
          depends_on: [],
          note: null,
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        {
          id: 's2',
          title: 'Run test suite',
          status: 'pending',
          tries: 0,
          max_tries: 3,
          depends_on: ['s1'],
          note: null,
          last_error: null,
          updated_at: new Date().toISOString(),
        },
      ],
    };
    writeLedger(ledger, testDir);
    return ledger;
  }

  it('agent_enforce status reports active agents and target step', () => {
    seedActiveTask();
    recordActiveAgent(testDir, 'conv-subagent-123', 'worker', 's1');

    const res = handleAgentEnforce({ action: 'status', project_path: testDir });
    expect(res).toContain('Active Agents:');
    expect(res).toContain('conv-sub');
    expect(res).toContain('Next Target: [s1]');
  });

  it('agent_enforce broadcast writes directive and injects into hooks', () => {
    seedActiveTask();
    const res = handleAgentEnforce({
      action: 'broadcast',
      directive: 'Hurry up and complete step s1',
      project_path: testDir,
    });

    expect(res).toContain('DIRECTIVE BROADCAST');
    expect(res).toContain('Hurry up and complete step s1');

    const directiveFile = path.join(testDir, '.agent', 'agent_directives.json');
    expect(fs.existsSync(directiveFile)).toBe(true);
  });

  it('agent_enforce force_next issues authoritative order and extends lease', () => {
    seedActiveTask();
    const res = handleAgentEnforce({
      action: 'force_next',
      project_path: testDir,
    });

    expect(res).toContain('ENFORCEMENT ORDER DISPATCHED');
    expect(res).toContain('Target Step: [s1]');
    expect(res).toContain('Stop hooks and PostInvocation hooks are active');
  });

  it('PostInvocation hook outputs force_continue with directive when task is active', () => {
    seedActiveTask();
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const inputPayload = JSON.stringify({
      conversationId: 'conv-agent-abc',
      workspacePaths: [testDir],
    });

    runPostInvocationHook(testDir, inputPayload);

    expect(stdoutSpy).toHaveBeenCalled();
    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.terminationBehavior).toBe('force_continue');
    expect(output.injectSteps[0].ephemeralMessage).toContain('You MUST complete step s1');

    const agentFile = path.join(testDir, '.agent', 'active_agents.json');
    expect(fs.existsSync(agentFile)).toBe(true);

    stdoutSpy.mockRestore();
  });

  it('Stop hook injects directive and tracks conversationId', () => {
    seedActiveTask();
    handleAgentEnforce({
      action: 'broadcast',
      directive: 'Must finish before deploying',
      project_path: testDir,
    });

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const inputPayload = JSON.stringify({
      conversationId: 'conv-agent-xyz',
      workspacePaths: [testDir],
    });

    runStopHook(testDir, inputPayload);

    expect(stdoutSpy).toHaveBeenCalled();
    const output = JSON.parse(stdoutSpy.mock.calls[0][0] as string);
    expect(output.decision).toBe('continue');
    expect(output.reason).toContain('SUPERVISOR DIRECTIVE: Must finish before deploying');
    expect(output.reason).toContain('STOP REJECTED');

    stdoutSpy.mockRestore();
  });
});
