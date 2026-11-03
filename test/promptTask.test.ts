import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parsePromptSteps, initializePromptTask } from '../src/tools/promptTask.js';
import { readLedger } from '../src/ledger.js';

describe('promptTask parser and execution engine', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-prompt-test-'));
    fs.mkdirSync(path.join(tempDir, '.git'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('parses numbered steps from freeform prompt text', () => {
    const prompt = `Please do this refactor:
1. Research existing codebase and inspect models
2. Add manual timer to sleep inhibitor
3. Place icons across all surfaces
4. Run packaging tests and verify zero errors`;

    const parsed = parsePromptSteps(prompt);
    expect(parsed.steps.length).toBe(4);
    expect(parsed.steps[0].title).toBe('Research existing codebase and inspect models');
    expect(parsed.steps[1].title).toBe('Add manual timer to sleep inhibitor');
    expect(parsed.steps[2].title).toBe('Place icons across all surfaces');
    expect(parsed.steps[3].title).toBe('Run packaging tests and verify zero errors');
  });

  it('parses bullet point steps from user instructions', () => {
    const prompt = `Goal: Upgrade desktop packaging
- Step 1: Update tauri.conf.json configuration
- Step 2: Test package_dmg.sh script
- Step 3: Verify binary signature`;

    const parsed = parsePromptSteps(prompt);
    expect(parsed.steps.length).toBe(3);
    expect(parsed.steps[0].title).toContain('Update tauri.conf.json');
    expect(parsed.steps[1].title).toContain('Test package_dmg.sh');
    expect(parsed.steps[2].title).toContain('Verify binary signature');
  });

  it('initializes guided task and writes to ledger with user prompt preserved', () => {
    const prompt = `1. Check system status
2. Perform core code update
3. Verify with test suite`;

    const result = initializePromptTask(prompt, tempDir);
    expect(result.success).toBe(true);
    expect(result.stepCount).toBe(3);

    const ledger = readLedger(tempDir);
    expect(ledger).not.toBeNull();
    expect(ledger?.status).toBe('active');
    expect(ledger?.steps.length).toBe(3);
    expect(ledger?.steps[0].status).toBe('in_progress');
    expect(ledger?.steps[1].status).toBe('pending');
    expect((ledger as any)?.user_prompt).toBe(prompt);
  });
});
