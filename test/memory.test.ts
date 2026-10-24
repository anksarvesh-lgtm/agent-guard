import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LocalMemoryManager } from '../src/memory/index.js';
import { handleMemoryStore, handleMemoryRecall } from '../src/tools/memory.js';

describe('Agent Memory & Cross-Session Recall Engine', () => {
  let tempDir: string;
  let manager: LocalMemoryManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-guard-mem-test-'));
    fs.mkdirSync(path.join(tempDir, '.git'), { recursive: true });
    manager = new LocalMemoryManager();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('LocalMemoryManager', () => {
    it('stores and retrieves memories with tags and categories', () => {
      const entry = manager.store('Rotate JWT refresh tokens on every use; revoke old token server-side', {
        tags: ['auth', 'jwt', 'security'],
        category: 'architecture',
        projectPath: tempDir,
      });

      expect(entry.id).toMatch(/^mem-\d+-[a-f0-9]+/);
      expect(entry.content).toContain('Rotate JWT');
      expect(entry.tags).toEqual(['auth', 'jwt', 'security']);
      expect(entry.category).toBe('architecture');

      const file = path.join(tempDir, '.agent', 'memories.json');
      expect(fs.existsSync(file)).toBe(true);
    });

    it('recalls memories using keyword scoring and tag filters', () => {
      manager.store('PostgreSQL connection pool max size is 20 for API servers', {
        tags: ['database', 'postgres'],
        category: 'convention',
        projectPath: tempDir,
      });

      manager.store('Use TailwindCSS v4 with Vite and zero config CSS variables', {
        tags: ['frontend', 'tailwind'],
        category: 'convention',
        projectPath: tempDir,
      });

      const res1 = manager.recall('postgres connection pool', { projectPath: tempDir });
      expect(res1.memories.length).toBe(1);
      expect(res1.memories[0].content).toContain('PostgreSQL');

      const res2 = manager.recall('tailwind', { tag: 'tailwind', projectPath: tempDir });
      expect(res2.memories.length).toBe(1);
      expect(res2.memories[0].content).toContain('TailwindCSS');
    });

    it('lists and deletes memories by ID', () => {
      const m1 = manager.store('First memory item', { projectPath: tempDir });
      const m2 = manager.store('Second memory item', { projectPath: tempDir });

      const list1 = manager.list({ projectPath: tempDir });
      expect(list1.length).toBe(2);

      const deleted = manager.delete(m1.id, { projectPath: tempDir });
      expect(deleted).toBe(true);

      const list2 = manager.list({ projectPath: tempDir });
      expect(list2.length).toBe(1);
      expect(list2[0].id).toBe(m2.id);
    });
  });

  describe('MCP Memory Tools (memory_store & memory_recall)', () => {
    it('handleMemoryStore rejects missing content', () => {
      const res = handleMemoryStore({ project_path: tempDir });
      expect(res).toContain('BAD_INPUT');
    });

    it('handleMemoryStore successfully stores memory and returns formatted confirmation', () => {
      const res = handleMemoryStore({
        content: 'Never commit secrets or API keys to git repositories',
        tags: ['security', 'git'],
        category: 'decision',
        project_path: tempDir,
      });

      expect(res).toContain('Persistent Memory Stored');
      expect(res).toContain('DECISION');
      expect(res).toContain('#security');
      expect(res).toContain('Never commit secrets');
    });

    it('handleMemoryRecall searches and returns formatted results', () => {
      handleMemoryStore({
        content: 'Use Vitest as the standard test framework across all packages',
        tags: ['testing', 'vitest'],
        category: 'convention',
        project_path: tempDir,
      });

      const res = handleMemoryRecall({
        query: 'vitest framework',
        project_path: tempDir,
      });

      expect(res).toContain('Memory Recall');
      expect(res).toContain('CONVENTION');
      expect(res).toContain('Use Vitest');
    });

    it('handleMemoryRecall returns helpful guidance when no memory matches', () => {
      const res = handleMemoryRecall({
        query: 'xyznonexistentconcept999',
        project_path: tempDir,
      });

      expect(res).toContain('No memories found matching');
      expect(res).toContain('Tip: Use `memory_store`');
    });
  });
});
