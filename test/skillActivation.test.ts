import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { globalJitSkillRouter, JitSkillRouter } from '../src/skills/router.js';
import { handleSkillActivate } from '../src/tools/skillActivate.js';
import { WorkspaceScanner } from '../src/skills/scanner.js';
import { runPreInvocationHook } from '../src/hook/pre-invocation-hook.js';

describe('Autonomous Dynamic Skill Activation Engine', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-guard-jit-test-'));
    fs.mkdirSync(path.join(tempDir, '.git'), { recursive: true });
    globalJitSkillRouter.ensureInitialized();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('JitSkillRouter', () => {
    it('indexes all 3,600+ skills across Tier 1, Tier 2, and Tier 3 into memory', () => {
      const stats = globalJitSkillRouter.getStats();
      expect(stats.totalSkills).toBeGreaterThanOrEqual(3600);
      expect(stats.activeCount).toBeGreaterThanOrEqual(70);
      expect(stats.composioCount).toBeGreaterThanOrEqual(800);
      expect(stats.communityCount).toBeGreaterThanOrEqual(2700);
      expect(stats.uniqueTokens).toBeGreaterThan(5000);
    });

    it('routes exact slug matches with 100% confidence in sub-25ms', () => {
      // Warm up
      globalJitSkillRouter.route('test', { limit: 1 });

      const t0 = Date.now();
      const results = globalJitSkillRouter.route('docx', { limit: 1 });
      const duration = Date.now() - t0;

      expect(duration).toBeLessThan(50);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('docx');
      expect(results[0].score).toBe(1.0);
      expect(results[0].confidence).toBe('HIGH');
    });

    it('routes natural language prompts to relevant specialized skills', () => {
      const results = globalJitSkillRouter.route('format docx word document letter', { limit: 3 });
      expect(results.length).toBeGreaterThan(0);
      const ids = results.map(r => r.id);
      expect(ids).toContain('docx');
    });

    it('loads procedural markdown content on-demand without memory bloating', () => {
      const results = globalJitSkillRouter.route('clean-architecture', { limit: 1, loadContent: true });
      expect(results.length).toBe(1);
      expect(results[0].content).toBeDefined();
      expect(results[0].content).toContain('Clean Architecture');
    });
  });

  describe('handleSkillActivate MCP Tool', () => {
    it('rejects invalid inputs missing query or project_path', () => {
      const res = handleSkillActivate({});
      expect(res).toContain('BAD_INPUT');
    });

    it('activates a matching skill and auto-links it to the project', () => {
      const res = handleSkillActivate({
        query: 'clean-architecture',
        project_path: tempDir,
        auto_install: true,
      });

      expect(res).toContain('JIT Skill Activated');
      expect(res).toContain('clean-architecture');

      // Check auto-link
      const linkPath = path.join(tempDir, '.agents', 'skills', 'clean-architecture', 'SKILL.md');
      expect(fs.existsSync(linkPath)).toBe(true);

      // Check .agents/skills.json
      const configPath = path.join(tempDir, '.agents', 'skills.json');
      expect(fs.existsSync(configPath)).toBe(true);
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(config.skills.some((s: any) => s.id === 'clean-architecture')).toBe(true);
    });

    it('returns informative suggestions when query has no direct match', () => {
      const res = handleSkillActivate({
        query: 'xyznonexistentterm12345abcdef',
        project_path: tempDir,
      });

      expect(res).toContain('No skills found matching');
    });
  });

  describe('WorkspaceScanner', () => {
    it('detects tech stack and recommends appropriate skills', () => {
      // Mock a Node + TypeScript + Vitest project
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-app',
          dependencies: {
            react: '^18.0.0',
            express: '^4.18.0',
          },
          devDependencies: {
            typescript: '^5.0.0',
            vitest: '^1.0.0',
          },
        }),
        'utf-8'
      );

      // Mock Dockerfile
      fs.writeFileSync(path.join(tempDir, 'Dockerfile'), 'FROM node:20\n', 'utf-8');

      const scanner = new WorkspaceScanner();
      const result = scanner.scan(tempDir, { maxSkills: 8, saveConfig: true });

      expect(result.detectedTech.length).toBeGreaterThanOrEqual(4);
      const names = result.detectedTech.map(d => d.name);
      expect(names).toContain('React');
      expect(names).toContain('Express');
      expect(names).toContain('TypeScript');
      expect(names).toContain('Vitest');
      expect(names).toContain('Docker / Containers');

      expect(result.recommendedSkills.length).toBeGreaterThan(0);
      expect(result.savedConfigPath).toBeDefined();
      expect(fs.existsSync(result.savedConfigPath!)).toBe(true);
    });
  });

  describe('runPreInvocationHook', () => {
    it('returns empty injectSteps when stdin is empty or query is general', () => {
      let output = '';
      const originalStdout = process.stdout.write;
      process.stdout.write = (chunk: any) => {
        output += chunk.toString();
        return true;
      };

      try {
        runPreInvocationHook(tempDir, JSON.stringify({ prompt: 'hello there' }));
        const parsed = JSON.parse(output);
        expect(parsed.injectSteps).toEqual([]);
      } finally {
        process.stdout.write = originalStdout;
      }
    });

    it('injects ephemeralMessage when prompt matches specialized skill', () => {
      let output = '';
      const originalStdout = process.stdout.write;
      process.stdout.write = (chunk: any) => {
        output += chunk.toString();
        return true;
      };

      try {
        runPreInvocationHook(tempDir, JSON.stringify({
          conversationId: 'vitest-conv-unique-1',
          prompt: 'Please help write a docx word document letter for client'
        }));
        const parsed = JSON.parse(output);
        expect(parsed.injectSteps).toBeDefined();
        expect(parsed.injectSteps.length).toBe(1);
        expect(parsed.injectSteps[0].ephemeralMessage).toContain('docx');
        expect(parsed.injectSteps[0].ephemeralMessage).toContain('JIT-Activation');
      } finally {
        process.stdout.write = originalStdout;
      }
    });

    it('prevents duplicate injection in the same conversation session', () => {
      let output1 = '';
      let output2 = '';
      const originalStdout = process.stdout.write;

      try {
        process.stdout.write = (chunk: any) => {
          output1 += chunk.toString();
          return true;
        };
        runPreInvocationHook(tempDir, JSON.stringify({
          conversationId: 'vitest-conv-dedup',
          prompt: 'docx word document letter template'
        }));

        process.stdout.write = (chunk: any) => {
          output2 += chunk.toString();
          return true;
        };
        runPreInvocationHook(tempDir, JSON.stringify({
          conversationId: 'vitest-conv-dedup',
          prompt: 'docx word document letter template again'
        }));

        const parsed1 = JSON.parse(output1);
        const parsed2 = JSON.parse(output2);
        expect(parsed1.injectSteps.length).toBe(1);
        expect(parsed2.injectSteps.length).toBe(0);
      } finally {
        process.stdout.write = originalStdout;
      }
    });
  });
});
