import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  writeLedger,
  readLedger,
  archiveCurrentTask,
  isValidLedger,
} from '../src/ledger.js';
import { getLedgerPath, getLedgerLockPath, getLedgerPrevPath, getHistoryDir } from '../src/util/paths.js';
import { TaskLedger } from '../src/types.js';
import { truncateText } from '../src/util/schema.js';

describe('ledger.ts safe read/write and resilience', () => {
  const testDir = path.join(os.tmpdir(), `agent-guard-ledger-test-${Date.now()}`);

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(path.join(testDir, '.git'));
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  const mockLedger: TaskLedger = {
    version: 1,
    task_id: 't-20261023-1234',
    goal: 'Test atomic writes',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    checkpoint_count: 1,
    steps: [
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
    ],
  };

  it('writes and reads back identical ledger data', () => {
    writeLedger(mockLedger, testDir);
    const readBack = readLedger(testDir);
    expect(readBack).not.toBeNull();
    expect(readBack?.task_id).toBe(mockLedger.task_id);
    expect(readBack?.steps.length).toBe(1);
    expect(readBack?.steps[0].title).toBe('Step 1');
  });

  it('creates ledger.prev.json on subsequent writes', () => {
    writeLedger(mockLedger, testDir);
    const prevPath = getLedgerPrevPath(testDir);
    expect(fs.existsSync(prevPath)).toBe(false);

    const updatedLedger: TaskLedger = {
      ...mockLedger,
      checkpoint_count: 2,
    };
    writeLedger(updatedLedger, testDir);

    expect(fs.existsSync(prevPath)).toBe(true);
    const prevData = JSON.parse(fs.readFileSync(prevPath, 'utf-8'));
    expect(prevData.checkpoint_count).toBe(1);
  });

  it('recovers corrupted ledger.json from ledger.prev.json', () => {
    writeLedger(mockLedger, testDir);

    const updatedLedger: TaskLedger = {
      ...mockLedger,
      checkpoint_count: 2,
    };
    writeLedger(updatedLedger, testDir);

    // Corrupt current ledger.json
    const ledgerPath = getLedgerPath(testDir);
    fs.writeFileSync(ledgerPath, '{{corrupt-json', 'utf-8');

    // Reading should self-heal and return previous valid ledger
    const recovered = readLedger(testDir);
    expect(recovered).not.toBeNull();
    expect(recovered?.checkpoint_count).toBe(1);

    // The ledger.json on disk should now be restored
    const fixedContent = fs.readFileSync(ledgerPath, 'utf-8');
    expect(JSON.parse(fixedContent).checkpoint_count).toBe(1);
  });

  it('evicts stale lock older than 30 seconds', () => {
    writeLedger(mockLedger, testDir);
    const lockPath = getLedgerLockPath(testDir);

    // Create a stale lock file 40 seconds in the past
    fs.writeFileSync(lockPath, 'stale_pid\n12345', 'utf-8');
    const pastTime = (Date.now() - 40000) / 1000;
    fs.utimesSync(lockPath, pastTime, pastTime);

    // Writing should succeed by evicting stale lock
    const nextLedger: TaskLedger = { ...mockLedger, checkpoint_count: 5 };
    expect(() => writeLedger(nextLedger, testDir)).not.toThrow();

    const read = readLedger(testDir);
    expect(read?.checkpoint_count).toBe(5);
  });

  it('truncates over-long text and appends [cut]', () => {
    const longString = 'A'.repeat(600);
    const truncated = truncateText(longString, 500);
    expect(truncated.length).toBe(500);
    expect(truncated.endsWith('[cut]')).toBe(true);
  });

  it('archives current active task to history folder', () => {
    writeLedger(mockLedger, testDir);
    archiveCurrentTask(testDir);

    expect(readLedger(testDir)).toBeNull();
    const historyDir = getHistoryDir(testDir);
    const archivedPath = path.join(historyDir, `${mockLedger.task_id}.json`);
    expect(fs.existsSync(archivedPath)).toBe(true);

    const archivedData = JSON.parse(fs.readFileSync(archivedPath, 'utf-8'));
    expect(archivedData.task_id).toBe(mockLedger.task_id);
  });
});
