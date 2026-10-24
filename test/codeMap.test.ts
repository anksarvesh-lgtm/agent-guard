import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  parseSourceFile,
  buildCodeGraph,
  getGraphOverview,
  listFileSymbols,
  lookupSymbol,
  sliceSymbol,
  findCallers,
} from '../src/brief/codeGraph.js';
import { handleCodeMap } from '../src/tools/codeMap.js';
import { generateAgentsMd } from '../src/brief/agentsMdGenerator.js';

describe('AST Code Knowledge Graph & Symbol Slicer (code_map)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-guard-codemap-test-'));
    fs.mkdirSync(path.join(tempDir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('parseSourceFile', () => {
    it('accurately parses TypeScript functions, classes, interfaces, and routes', () => {
      const tsCode = `
import { Router } from 'express';

/**
 * Calculate financial interest rate.
 */
export function calculateInterest(principal: number, rate: number): number {
  return principal * rate;
}

export interface AccountRecord {
  id: string;
  balance: number;
}

export class BankService {
  private vaultId: string;

  public deposit(amount: number): boolean {
    return true;
  }
}

export const fetchSummary = async (userId: string) => {
  return { userId };
};

const router = Router();
router.get('/api/accounts', (req, res) => res.json([]));
`;

      const result = parseSourceFile('src/bank.ts', tsCode);
      expect(result.language).toBe('typescript');
      expect(result.symbols.length).toBeGreaterThanOrEqual(5);

      const fn = result.symbols.find(s => s.name === 'calculateInterest');
      expect(fn).toBeDefined();
      expect(fn?.kind).toBe('function');
      expect(fn?.lineStart).toBe(7);
      expect(fn?.doc).toContain('Calculate financial interest');

      const iface = result.symbols.find(s => s.name === 'AccountRecord');
      expect(iface).toBeDefined();
      expect(iface?.kind).toBe('interface');

      const cls = result.symbols.find(s => s.name === 'BankService');
      expect(cls).toBeDefined();
      expect(cls?.kind).toBe('class');

      const method = result.symbols.find(s => s.name === 'deposit');
      expect(method).toBeDefined();
      expect(method?.kind).toBe('method');
      expect(method?.parent).toBe('BankService');

      const route = result.symbols.find(s => s.kind === 'route');
      expect(route).toBeDefined();
      expect(route?.name).toContain('GET');
    });

    it('accurately parses Python classes, methods, and functions', () => {
      const pyCode = `
class DataPipeline:
    """ETL Pipeline processor."""
    def __init__(self, name):
        self.name = name

    def execute(self, df):
        return df.head()

def process_stream(data):
    return data * 2
`;
      const result = parseSourceFile('src/pipeline.py', pyCode);
      expect(result.language).toBe('python');
      const cls = result.symbols.find(s => s.name === 'DataPipeline');
      expect(cls).toBeDefined();
      expect(cls?.kind).toBe('class');

      const initMethod = result.symbols.find(s => s.name === '__init__');
      expect(initMethod?.kind).toBe('method');
      expect(initMethod?.parent).toBe('DataPipeline');

      const fn = result.symbols.find(s => s.name === 'process_stream');
      expect(fn?.kind).toBe('function');
    });
  });

  describe('buildCodeGraph & Slicing', () => {
    beforeEach(() => {
      const fileA = `
export function authUser(token: string): boolean {
  if (!token) return false;
  return token.startsWith('sec_');
}

export class AuthService {
  validate(token: string) {
    return authUser(token);
  }
}
`;
      const fileB = `
import { authUser } from './auth.js';

export function handleRequest(headers: any) {
  const token = headers['authorization'];
  return authUser(token);
}
`;
      fs.writeFileSync(path.join(tempDir, 'src', 'auth.ts'), fileA, 'utf-8');
      fs.writeFileSync(path.join(tempDir, 'src', 'request.ts'), fileB, 'utf-8');
    });

    it('indexes files and builds cached knowledge graph', () => {
      const graph = buildCodeGraph(tempDir, { forceRefresh: true });
      expect(graph.fileCount).toBe(2);
      expect(graph.totalSymbols).toBeGreaterThanOrEqual(3);

      const cacheFile = path.join(tempDir, '.agent', 'codemap-cache.json');
      expect(fs.existsSync(cacheFile)).toBe(true);

      const cached = buildCodeGraph(tempDir);
      expect(cached.fileCount).toBe(2);
    });

    it('slices exact symbol code with zero file overhead', () => {
      const graph = buildCodeGraph(tempDir, { forceRefresh: true });
      const slice = sliceSymbol(tempDir, graph, 'authUser');

      expect(typeof slice).not.toBe('string');
      if (typeof slice !== 'string') {
        expect(slice.symbol.name).toBe('authUser');
        expect(slice.code).toContain('export function authUser');
        expect(slice.code).toContain('return token.startsWith');
        expect(slice.totalLines).toBeLessThanOrEqual(5);
      }
    });

    it('finds callers across multiple files', () => {
      const graph = buildCodeGraph(tempDir, { forceRefresh: true });
      const callers = findCallers(tempDir, graph, 'authUser');

      expect(callers.references.length).toBe(3); // In AuthService and request.ts (import + call)
      const reqRef = callers.references.find(r => r.filePath.includes('request.ts'));
      expect(reqRef).toBeDefined();
    });
  });

  describe('handleCodeMap Tool Dispatcher', () => {
    beforeEach(() => {
      const code = `
export function calculateTax(amount: number): number {
  return amount * 0.2;
}
`;
      fs.writeFileSync(path.join(tempDir, 'src', 'tax.ts'), code, 'utf-8');
    });

    it('handles action: overview', () => {
      const out = handleCodeMap({ project_path: tempDir, action: 'overview' });
      expect(out).toContain('# Code Knowledge Graph Overview');
      expect(out).toContain('src/tax.ts');
      expect(out).toContain('**function**: 1');
    });

    it('handles action: lookup', () => {
      const out = handleCodeMap({ project_path: tempDir, action: 'lookup', symbol_name: 'calculateTax' });
      expect(out).toContain('# Symbol Lookup: "calculateTax"');
      expect(out).toContain('src/tax.ts');
    });

    it('handles action: slice', () => {
      const out = handleCodeMap({ project_path: tempDir, action: 'slice', symbol_name: 'calculateTax' });
      expect(out).toContain('# Symbol Slice: `calculateTax`');
      expect(out).toContain('return amount * 0.2');
    });

    it('returns BAD_INPUT when symbol_name is missing for slice or lookup', () => {
      const outLookup = handleCodeMap({ project_path: tempDir, action: 'lookup' });
      expect(outLookup).toContain('BAD_INPUT');

      const outSlice = handleCodeMap({ project_path: tempDir, action: 'slice' });
      expect(outSlice).toContain('BAD_INPUT');
    });

    it('returns BAD_PROJECT_PATH for invalid project', () => {
      const out = handleCodeMap({ project_path: '/non/existent/path', action: 'overview' });
      expect(out).toContain('BAD_PROJECT_PATH');
    });
  });

  describe('generateAgentsMd', () => {
    it('generates a tailored AGENTS.md rulebook with detected stack and symbols', () => {
      const pkg = {
        name: 'tax-calculator',
        scripts: {
          test: 'vitest run',
          build: 'tsc',
          bump: 'node scripts/bump.js',
        },
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkg, null, 2), 'utf-8');

      const res = generateAgentsMd({ projectPath: tempDir });
      const expectedPath = path.join(fs.realpathSync(tempDir), 'AGENTS.md');
      expect(res.outputPath).toBe(expectedPath);
      expect(res.content).toContain('# Agent rules');
      expect(res.content).toContain('1. Call task_status');
      expect(res.content).toContain('3. Use the code-map tools');
      expect(res.content).toContain('npm test');
      expect(res.content).toContain('tax-calculator');
      expect(res.content).toContain('bump');
      expect(fs.existsSync(res.outputPath)).toBe(true);
    });
  });
});
