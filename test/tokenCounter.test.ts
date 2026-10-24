import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  estimateTextTokens,
  estimateFileTokens,
  calculateContextBudget,
  compareAcrossModels,
  formatTokenNumber,
  resolveModelProfile,
  parseTranscriptTokens
} from '../src/tokens/index.js';
import { handleTokenCounter } from '../src/tools/tokenCounter.js';

describe('Token Counter & Multi-Model Context Budget Engine', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-guard-tokens-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('estimateTextTokens', () => {
    it('returns 0 for empty or null text', () => {
      expect(estimateTextTokens('')).toBe(0);
    });

    it('estimates tokens for ASCII code using calibrated ~3.3 chars per token', () => {
      const code = 'const express = require("express"); const app = express(); app.listen(3000);';
      const tokens = estimateTextTokens(code);
      expect(tokens).toBe(Math.ceil(code.length / 3.3));
      expect(tokens).toBeGreaterThan(15);
      expect(tokens).toBeLessThan(35);
    });

    it('correctly weighs CJK characters at ~1 token per character', () => {
      const cjk = '日本語のテスト文章です。한국어도 가능합니다.';
      const tokens = estimateTextTokens(cjk);
      // CJK characters count ~1 token/char, spaces/ascii count at 3.3
      expect(tokens).toBeGreaterThanOrEqual(18);
    });
  });

  describe('estimateFileTokens', () => {
    it('returns 0 for missing files', () => {
      expect(estimateFileTokens('/path/to/nonexistent/file.txt')).toBe(0);
    });

    it('calculates token count from file on disk', () => {
      const testFile = path.join(tempDir, 'sample.ts');
      fs.writeFileSync(testFile, 'export function add(a: number, b: number): number { return a + b; }', 'utf-8');
      const tokens = estimateFileTokens(testFile);
      expect(tokens).toBeGreaterThan(10);
    });
  });

  describe('calculateContextBudget', () => {
    it('calculates Gemini 1.5 Pro budget accurately', () => {
      const budget = calculateContextBudget(50000, 'gemini-1.5-pro');
      expect(budget.model.id).toBe('gemini-1.5-pro');
      expect(budget.contextLimit).toBe(2000000);
      expect(budget.usedTokens).toBe(50000);
      expect(budget.remainingTokens).toBe(1950000);
      expect(budget.percentUsed).toBe(2.5);
      expect(budget.percentRemaining).toBe(97.5);
      expect(budget.status).toBe('OPTIMAL');
    });

    it('calculates Claude 3.5 Sonnet budget and detects WARNING status', () => {
      // 160k out of 200k = 80% (WARNING)
      const budget = calculateContextBudget(160000, 'claude-3-5-sonnet');
      expect(budget.model.id).toBe('claude-3-5-sonnet');
      expect(budget.contextLimit).toBe(200000);
      expect(budget.percentUsed).toBe(80.0);
      expect(budget.remainingTokens).toBe(40000);
      expect(budget.status).toBe('WARNING');
      expect(budget.statusEmoji).toBe('🟠');
    });

    it('detects CRITICAL status when context usage exceeds 90%', () => {
      // 120k out of 128k for GPT-4o = 93.8% (CRITICAL)
      const budget = calculateContextBudget(120000, 'gpt-4o');
      expect(budget.status).toBe('CRITICAL');
      expect(budget.statusEmoji).toBe('🔴');
      expect(budget.recommendation).toContain('/compact');
    });
  });

  describe('compareAcrossModels', () => {
    it('generates comparison across Gemini, Claude, GPT-4o, DeepSeek, and Llama', () => {
      const comparison = compareAcrossModels(45000);
      expect(comparison.length).toBeGreaterThanOrEqual(5);

      const gemini = comparison.find((c) => c.modelId === 'gemini-1.5-pro');
      expect(gemini).toBeDefined();
      expect(gemini?.contextLimit).toBe(2000000);
      expect(gemini?.status).toBe('OPTIMAL');

      const claude = comparison.find((c) => c.modelId === 'claude-3-5-sonnet');
      expect(claude).toBeDefined();
      expect(claude?.contextLimit).toBe(200000);
      expect(claude?.remainingTokens).toBe(155000);

      const deepseek = comparison.find((c) => c.modelId === 'deepseek-chat');
      expect(deepseek).toBeDefined();
      expect(deepseek?.contextLimit).toBe(64000);
      expect(deepseek?.percentUsed).toBe(70.3);
    });
  });

  describe('formatTokenNumber', () => {
    it('formats numbers into human readable units', () => {
      expect(formatTokenNumber(2000000)).toBe('2M');
      expect(formatTokenNumber(1500000)).toBe('1.5M');
      expect(formatTokenNumber(45200)).toBe('45.2k');
      expect(formatTokenNumber(450)).toBe('450');
    });
  });

  describe('resolveModelProfile', () => {
    it('resolves exact model names and fuzzy aliases', () => {
      expect(resolveModelProfile('gemini-1.5-pro').id).toBe('gemini-1.5-pro');
      expect(resolveModelProfile('gemini').id).toBe('gemini-1.5-pro');
      expect(resolveModelProfile('claude').id).toBe('claude-3-5-sonnet');
      expect(resolveModelProfile('gpt-4o').id).toBe('gpt-4o');
      expect(resolveModelProfile('deepseek').id).toBe('deepseek-chat');
      expect(resolveModelProfile('deepseek-r1').id).toBe('deepseek-r1');
    });
  });

  describe('parseTranscriptTokens', () => {
    it('parses valid JSONL transcript lines into category token totals', () => {
      const transcriptFile = path.join(tempDir, 'transcript.jsonl');
      const lines = [
        JSON.stringify({ type: 'USER_INPUT', source: 'USER', content: 'Please refactor this code.' }),
        JSON.stringify({ type: 'PLANNER_RESPONSE', source: 'MODEL', content: 'Here is the refactored code.', thinking: 'I need to check imports and exports first.' }),
        JSON.stringify({ tool_calls: [{ name: 'read_file', args: { Path: '/test.ts' } }] }),
      ];
      fs.writeFileSync(transcriptFile, lines.join('\n') + '\n', 'utf-8');

      const result = parseTranscriptTokens(transcriptFile);
      expect(result.stepsCount).toBe(3);
      expect(result.totalEstimatedTokens).toBeGreaterThan(20);
      expect(result.userTokens).toBeGreaterThan(0);
      expect(result.assistantTokens).toBeGreaterThan(0);
      expect(result.thinkingTokens).toBeGreaterThan(0);
      expect(result.toolCallTokens).toBeGreaterThan(0);
    });
  });

  describe('handleTokenCounter MCP Tool', () => {
    it('handles raw text analysis and outputs markdown summary with table', () => {
      const output = handleTokenCounter({
        model: 'gemini-1.5-pro',
        text: 'Hello world from Agent Guard token counter!',
        compare_all: true,
      });

      expect(output).toContain('Token Counter & Context Budget: Gemini 1.5 Pro');
      expect(output).toContain('Tokens Used');
      expect(output).toContain('Tokens Remaining');
      expect(output).toContain('Cross-Model Context Consumption Comparison');
      expect(output).toContain('Claude 3.5 Sonnet');
      expect(output).toContain('DeepSeek V3');
    });

    it('handles file analysis and returns error on missing file', () => {
      const err = handleTokenCounter({
        file_path: '/nonexistent/file/path.ts',
      });
      expect(err).toContain('FILE_NOT_FOUND');
    });
  });
});
