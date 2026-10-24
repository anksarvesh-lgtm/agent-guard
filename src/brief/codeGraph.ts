import fs from 'node:fs';
import path from 'node:path';
import { resolveProjectPath, getAgentDir } from '../util/paths.js';
import { getProjectFreshness } from './stale.js';
import { isSensitiveOrIgnored } from './sanitize.js';

export interface CodeSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'method' | 'route' | 'variable' | 'enum';
  filePath: string;
  lineStart: number;
  lineEnd: number;
  signature: string;
  doc?: string;
  parent?: string;
}

export interface FileIndex {
  filePath: string;
  language: string;
  symbols: CodeSymbol[];
  imports: string[];
  exports: string[];
  lineCount: number;
}

export interface CodeGraph {
  commit: string;
  timestamp: string;
  fileCount: number;
  totalSymbols: number;
  files: Record<string, FileIndex>;
  symbolIndex: Record<string, CodeSymbol[]>;
}

export interface SymbolSliceResult {
  filePath: string;
  symbol: CodeSymbol;
  code: string;
  totalLines: number;
}

export interface CallerResult {
  symbolName: string;
  references: Array<{
    filePath: string;
    line: number;
    text: string;
  }>;
}

const SUPPORTED_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.cpp',
  '.h',
]);

/**
 * Extract symbols, imports, and exports from source code using high-speed lexical analysis.
 */
export function parseSourceFile(filePath: string, content: string): FileIndex {
  filePath = filePath.replace(/\\/g, '/');
  const ext = path.extname(filePath).toLowerCase();
  const lines = content.split('\n');
  const lineCount = lines.length;

  let language = 'unknown';
  if (['.ts', '.tsx'].includes(ext)) language = 'typescript';
  else if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) language = 'javascript';
  else if (ext === '.py') language = 'python';
  else if (ext === '.go') language = 'go';
  else if (ext === '.rs') language = 'rust';
  else if (ext === '.java') language = 'java';
  else if (['.c', '.cpp', '.h'].includes(ext)) language = 'c_cpp';

  const symbols: CodeSymbol[] = [];
  const imports: string[] = [];
  const exportsList: string[] = [];

  let currentClass: string | null = null;
  let classIndentLevel = -1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const lineNum = i + 1;

    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      continue;
    }

    // --- Imports & Exports ---
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      imports.push(trimmed.slice(0, 120));
      continue;
    }
    if (trimmed.startsWith('export ') && !trimmed.includes('function') && !trimmed.includes('class') && !trimmed.includes('const') && !trimmed.includes('interface') && !trimmed.includes('type')) {
      exportsList.push(trimmed.slice(0, 120));
    }

    // Capture preceding doc comment
    let doc: string | undefined = undefined;
    if (i > 0 && lines[i - 1].trim().endsWith('*/')) {
      const docLines: string[] = [];
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const dLine = lines[j].trim();
        docLines.unshift(dLine.replace(/^(\/\*\*|\*|\*\/)\s*/, ''));
        if (dLine.startsWith('/**')) break;
      }
      doc = docLines.filter(Boolean).slice(0, 3).join(' ');
    }

    // --- Python Parsing ---
    if (language === 'python') {
      const pyClassMatch = rawLine.match(/^(\s*)class\s+([A-Za-z0-9_]+)/);
      if (pyClassMatch) {
        const name = pyClassMatch[2];
        const endLine = findBlockEndIndent(lines, i);
        symbols.push({
          name,
          kind: 'class',
          filePath,
          lineStart: lineNum,
          lineEnd: endLine,
          signature: trimmed.replace(/:$/, ''),
          doc,
        });
        currentClass = name;
        classIndentLevel = pyClassMatch[1].length;
        continue;
      }

      const pyDefMatch = rawLine.match(/^(\s*)(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/);
      if (pyDefMatch) {
        const indent = pyDefMatch[1].length;
        const name = pyDefMatch[2];
        const endLine = findBlockEndIndent(lines, i);
        const isMethod = currentClass !== null && indent > classIndentLevel;
        symbols.push({
          name,
          kind: isMethod ? 'method' : 'function',
          filePath,
          lineStart: lineNum,
          lineEnd: endLine,
          signature: trimmed.replace(/:$/, ''),
          doc,
          parent: isMethod ? currentClass! : undefined,
        });
        continue;
      }

      // Python Routes (@app.route, @router.get)
      if (trimmed.startsWith('@') && (trimmed.includes('route') || trimmed.includes('.get(') || trimmed.includes('.post('))) {
        symbols.push({
          name: trimmed.slice(0, 60),
          kind: 'route',
          filePath,
          lineStart: lineNum,
          lineEnd: Math.min(lineNum + 5, lineCount),
          signature: trimmed,
        });
        continue;
      }
      continue;
    }

    // --- TypeScript & JavaScript Parsing ---
    if (language === 'typescript' || language === 'javascript') {
      // Classes
      const classMatch = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_]+)/);
      if (classMatch) {
        const name = classMatch[1];
        const endLine = findClosingBrace(lines, i);
        symbols.push({
          name,
          kind: 'class',
          filePath,
          lineStart: lineNum,
          lineEnd: endLine,
          signature: trimmed.slice(0, 100),
          doc,
        });
        currentClass = name;
        continue;
      }

      // Interfaces
      const ifaceMatch = trimmed.match(/^(?:export\s+)?interface\s+([A-Za-z0-9_]+)/);
      if (ifaceMatch) {
        const name = ifaceMatch[1];
        const endLine = findClosingBrace(lines, i);
        symbols.push({
          name,
          kind: 'interface',
          filePath,
          lineStart: lineNum,
          lineEnd: endLine,
          signature: trimmed.slice(0, 100),
          doc,
        });
        continue;
      }

      // Types & Enums
      const typeMatch = trimmed.match(/^(?:export\s+)?type\s+([A-Za-z0-9_]+)/);
      if (typeMatch) {
        symbols.push({
          name: typeMatch[1],
          kind: 'type',
          filePath,
          lineStart: lineNum,
          lineEnd: trimmed.endsWith(';') ? lineNum : findTypeEnd(lines, i),
          signature: trimmed.slice(0, 100),
          doc,
        });
        continue;
      }
      const enumMatch = trimmed.match(/^(?:export\s+)?enum\s+([A-Za-z0-9_]+)/);
      if (enumMatch) {
        symbols.push({
          name: enumMatch[1],
          kind: 'enum',
          filePath,
          lineStart: lineNum,
          lineEnd: findClosingBrace(lines, i),
          signature: trimmed.slice(0, 100),
          doc,
        });
        continue;
      }

      // Functions
      const fnMatch = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function(?:\s*\*|\s+)\s*([A-Za-z0-9_]+)\s*\(/);
      if (fnMatch) {
        const name = fnMatch[1];
        const endLine = findClosingBrace(lines, i);
        symbols.push({
          name,
          kind: 'function',
          filePath,
          lineStart: lineNum,
          lineEnd: endLine,
          signature: extractFnSignature(lines, i),
          doc,
        });
        continue;
      }

      // Arrow functions / const functions
      const arrowMatch = trimmed.match(/^(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_]+)\s*(?::\s*[^=]+)?\s*=>/);
      if (arrowMatch) {
        const name = arrowMatch[1];
        const endLine = trimmed.includes('{') ? findClosingBrace(lines, i) : lineNum;
        symbols.push({
          name,
          kind: 'function',
          filePath,
          lineStart: lineNum,
          lineEnd: endLine,
          signature: extractFnSignature(lines, i),
          doc,
        });
        continue;
      }

      // Class Methods
      if (currentClass) {
        const methodMatch = trimmed.match(/^(?:public|private|protected|static|async|\s)*\s*([A-Za-z0-9_]+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/);
        if (methodMatch && !['if', 'for', 'while', 'switch', 'catch'].includes(methodMatch[1])) {
          const name = methodMatch[1];
          const endLine = findClosingBrace(lines, i);
          symbols.push({
            name,
            kind: 'method',
            filePath,
            lineStart: lineNum,
            lineEnd: endLine,
            signature: trimmed.slice(0, 100),
            parent: currentClass,
            doc,
          });
          continue;
        }
      }

      // Express / Koa / Fastify Routes
      const routeMatch = trimmed.match(/(?:app|router|server)\.(get|post|put|delete|patch)\s*\(\s*(['"][^'"]+['"])/);
      if (routeMatch) {
        symbols.push({
          name: `${routeMatch[1].toUpperCase()} ${routeMatch[2]}`,
          kind: 'route',
          filePath,
          lineStart: lineNum,
          lineEnd: findClosingBrace(lines, i),
          signature: trimmed.slice(0, 100),
        });
        continue;
      }
    }

    // --- Go Parsing ---
    if (language === 'go') {
      const goFnMatch = trimmed.match(/^func\s+(?:\((?:[^)]+)\)\s+)?([A-Za-z0-9_]+)\s*\(/);
      if (goFnMatch) {
        const name = goFnMatch[1];
        symbols.push({
          name,
          kind: trimmed.includes('(') && trimmed.indexOf('(') < trimmed.indexOf(name) ? 'method' : 'function',
          filePath,
          lineStart: lineNum,
          lineEnd: findClosingBrace(lines, i),
          signature: extractFnSignature(lines, i),
          doc,
        });
        continue;
      }
      const goTypeMatch = trimmed.match(/^type\s+([A-Za-z0-9_]+)\s+(struct|interface)/);
      if (goTypeMatch) {
        symbols.push({
          name: goTypeMatch[1],
          kind: goTypeMatch[2] === 'interface' ? 'interface' : 'class',
          filePath,
          lineStart: lineNum,
          lineEnd: findClosingBrace(lines, i),
          signature: trimmed,
          doc,
        });
        continue;
      }
    }

    // --- Rust Parsing ---
    if (language === 'rust') {
      const rustFnMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/);
      if (rustFnMatch) {
        symbols.push({
          name: rustFnMatch[1],
          kind: 'function',
          filePath,
          lineStart: lineNum,
          lineEnd: findClosingBrace(lines, i),
          signature: extractFnSignature(lines, i),
          doc,
        });
        continue;
      }
      const rustStructMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?(struct|enum|trait)\s+([A-Za-z0-9_]+)/);
      if (rustStructMatch) {
        symbols.push({
          name: rustStructMatch[2],
          kind: rustStructMatch[1] === 'trait' ? 'interface' : 'class',
          filePath,
          lineStart: lineNum,
          lineEnd: findClosingBrace(lines, i),
          signature: trimmed,
          doc,
        });
        continue;
      }
    }
  }

  return {
    filePath,
    language,
    symbols,
    imports,
    exports: exportsList,
    lineCount,
  };
}

/**
 * Finds the closing brace for bracketed languages.
 */
function findClosingBrace(lines: string[], startIdx: number): number {
  let depth = 0;
  let started = false;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') {
        depth++;
        started = true;
      } else if (ch === '}') {
        depth--;
        if (started && depth <= 0) {
          return i + 1;
        }
      }
    }
  }
  return Math.min(startIdx + 30, lines.length);
}

/**
 * Finds Python block end using indentation.
 */
function findBlockEndIndent(lines: string[], startIdx: number): number {
  const baseMatch = lines[startIdx].match(/^(\s*)/);
  const baseIndent = baseMatch ? baseMatch[1].length : 0;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1].length : 0;
    if (indent <= baseIndent) {
      return i;
    }
  }
  return lines.length;
}

/**
 * Finds type alias ending semicolon or closing brace.
 */
function findTypeEnd(lines: string[], startIdx: number): number {
  for (let i = startIdx; i < Math.min(startIdx + 25, lines.length); i++) {
    if (lines[i].includes(';')) return i + 1;
  }
  return Math.min(startIdx + 10, lines.length);
}

function extractFnSignature(lines: string[], startIdx: number): string {
  let sig = lines[startIdx].trim();
  if (sig.includes('{')) {
    sig = sig.slice(0, sig.indexOf('{')).trim();
  }
  if (!sig.includes(')') && startIdx + 1 < lines.length) {
    sig += ' ' + lines[startIdx + 1].trim();
    if (sig.includes('{')) {
      sig = sig.slice(0, sig.indexOf('{')).trim();
    }
  }
  return sig.slice(0, 150);
}

export function getCodeGraphCachePath(projectPath: string): string {
  return path.join(getAgentDir(projectPath), 'codemap-cache.json');
}

/**
 * Builds or refreshes the AST Code Knowledge Graph for a project.
 */
export function buildCodeGraph(projectPath: string, options: { forceRefresh?: boolean; maxFiles?: number } = {}): CodeGraph {
  const resolved = resolveProjectPath(projectPath);
  const cachePath = getCodeGraphCachePath(resolved);
  const fresh = getProjectFreshness(resolved);

  if (!options.forceRefresh && fs.existsSync(cachePath)) {
    try {
      const cached: CodeGraph = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (cached.commit === fresh.commit && cached.fileCount > 0) {
        return cached;
      }
    } catch {}
  }

  const filesMap: Record<string, FileIndex> = {};
  const symbolIndex: Record<string, CodeSymbol[]> = {};
  let totalSymbols = 0;

  const maxFiles = options.maxFiles || 2000;
  let parsedCount = 0;

  for (const rawRelFile of fresh.files) {
    if (parsedCount >= maxFiles) break;

    const relFile = rawRelFile.replace(/\\/g, '/');
    const ext = path.extname(relFile).toLowerCase();
    if (!SUPPORTED_EXTS.has(ext)) continue;
    if (isSensitiveOrIgnored(relFile)) continue;

    const fullPath = path.join(resolved, rawRelFile);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.size > 500 * 1024) continue; // Skip files > 500KB

      const content = fs.readFileSync(fullPath, 'utf-8');
      const fileIndex = parseSourceFile(relFile, content);

      filesMap[relFile] = fileIndex;
      parsedCount++;

      for (const sym of fileIndex.symbols) {
        totalSymbols++;
        const key = sym.name.toLowerCase();
        if (!symbolIndex[key]) {
          symbolIndex[key] = [];
        }
        symbolIndex[key].push(sym);
      }
    } catch {}
  }

  const graph: CodeGraph = {
    commit: fresh.commit,
    timestamp: new Date().toISOString(),
    fileCount: parsedCount,
    totalSymbols,
    files: filesMap,
    symbolIndex,
  };

  try {
    fs.writeFileSync(cachePath, JSON.stringify(graph), 'utf-8');
  } catch {}

  return graph;
}

/**
 * Query high-level project architectural overview.
 */
export function getGraphOverview(graph: CodeGraph): string {
  const lines: string[] = [];
  lines.push(`# Code Knowledge Graph Overview`);
  lines.push(`- **Commit**: \`${graph.commit}\` | **Indexed Files**: ${graph.fileCount} | **Total Symbols**: ${graph.totalSymbols}\n`);

  // Count by kind
  const kindCounts: Record<string, number> = {};
  const routes: CodeSymbol[] = [];
  for (const symbols of Object.values(graph.symbolIndex)) {
    for (const sym of symbols) {
      kindCounts[sym.kind] = (kindCounts[sym.kind] || 0) + 1;
      if (sym.kind === 'route') {
        routes.push(sym);
      }
    }
  }

  lines.push(`## Symbol Breakdown`);
  for (const [kind, count] of Object.entries(kindCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`- **${kind}**: ${count}`);
  }
  lines.push('');

  if (routes.length > 0) {
    lines.push(`## API Endpoints (${routes.length})`);
    for (const r of routes.slice(0, 15)) {
      lines.push(`- \`${r.name}\` -> [${r.filePath}:${r.lineStart}](file:///${r.filePath}#L${r.lineStart})`);
    }
    if (routes.length > 15) {
      lines.push(`  ... (+${routes.length - 15} more routes)`);
    }
    lines.push('');
  }

  // Top files by symbol count
  const fileStats = Object.values(graph.files)
    .sort((a, b) => b.symbols.length - a.symbols.length)
    .slice(0, 10);

  lines.push(`## Key Modules by Symbol Density`);
  for (const f of fileStats) {
    lines.push(`- \`${f.filePath}\` (${f.symbols.length} symbols, ${f.lineCount} lines, ${f.language})`);
  }

  return lines.join('\n');
}

/**
 * List symbols inside a specific file or directory.
 */
export function listFileSymbols(graph: CodeGraph, fileOrPattern: string): string {
  const norm = fileOrPattern.replace(/\\/g, '/').replace(/^[./]+/, '').toLowerCase();
  const matchedFiles = Object.keys(graph.files).filter(f => f.toLowerCase().includes(norm));

  if (matchedFiles.length === 0) {
    return `No indexed files matched pattern: "${fileOrPattern}".`;
  }

  const lines: string[] = [];
  lines.push(`# Symbols in: ${fileOrPattern} (${matchedFiles.length} file${matchedFiles.length === 1 ? '' : 's'})\n`);

  for (const file of matchedFiles.slice(0, 5)) {
    const fileIdx = graph.files[file];
    lines.push(`### \`${file}\` (${fileIdx.symbols.length} symbols, ${fileIdx.lineCount} lines)`);
    if (fileIdx.symbols.length === 0) {
      lines.push(`_No top-level declarations found._\n`);
      continue;
    }

    for (const sym of fileIdx.symbols) {
      const parentInfo = sym.parent ? ` [in ${sym.parent}]` : '';
      const docPreview = sym.doc ? ` - _${sym.doc}_` : '';
      lines.push(`- **${sym.kind}** \`${sym.name}\`${parentInfo}: lines ${sym.lineStart}-${sym.lineEnd}${docPreview}`);
      if (sym.signature && sym.signature !== sym.name) {
        lines.push(`  \`${sym.signature}\``);
      }
    }
    lines.push('');
  }

  if (matchedFiles.length > 5) {
    lines.push(`... (+${matchedFiles.length - 5} more matching files)`);
  }

  return lines.join('\n');
}

/**
 * Look up a symbol across the entire codebase.
 */
export function lookupSymbol(graph: CodeGraph, symbolName: string): string {
  const key = symbolName.trim().toLowerCase();
  const directMatches = graph.symbolIndex[key] || [];

  // Also fuzzy search if no direct match
  let fuzzyMatches: CodeSymbol[] = [];
  if (directMatches.length === 0) {
    for (const [symKey, list] of Object.entries(graph.symbolIndex)) {
      if (symKey.includes(key)) {
        fuzzyMatches.push(...list);
        if (fuzzyMatches.length >= 10) break;
      }
    }
  }

  const results = directMatches.length > 0 ? directMatches : fuzzyMatches;
  if (results.length === 0) {
    return `Symbol "${symbolName}" not found in project code graph.`;
  }

  const lines: string[] = [];
  lines.push(`# Symbol Lookup: "${symbolName}" (${results.length} match${results.length === 1 ? '' : 'es'})\n`);

  for (const sym of results.slice(0, 15)) {
    lines.push(`- **${sym.kind}** \`${sym.name}\` in \`${sym.filePath}\` (lines ${sym.lineStart}-${sym.lineEnd})`);
    if (sym.signature) {
      lines.push(`  Declaration: \`${sym.signature}\``);
    }
    if (sym.doc) {
      lines.push(`  Doc: ${sym.doc}`);
    }
  }

  if (results.length > 15) {
    lines.push(`... (+${results.length - 15} more matches)`);
  }

  return lines.join('\n');
}

/**
 * Slice and return ONLY the exact lines of code defining a symbol.
 * Cuts code-reading tokens by 90-95% by avoiding reading entire files!
 */
export function sliceSymbol(projectPath: string, graph: CodeGraph, symbolName: string, targetFile?: string): SymbolSliceResult | string {
  const resolved = resolveProjectPath(projectPath);
  const key = symbolName.trim().toLowerCase();
  let matches = graph.symbolIndex[key] || [];

  if (targetFile) {
    const norm = targetFile.replace(/\\/g, '/').replace(/^[./]+/, '').toLowerCase();
    matches = matches.filter(m => m.filePath.toLowerCase().includes(norm));
  }

  if (matches.length === 0) {
    // If not found in index, check if file exists and try on-the-fly parse
    if (targetFile) {
      const fullPath = path.join(resolved, targetFile);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const parsed = parseSourceFile(targetFile, content);
        const onTheFly = parsed.symbols.find(s => s.name.toLowerCase() === key);
        if (onTheFly) {
          matches = [onTheFly];
        }
      }
    }
  }

  if (matches.length === 0) {
    return `Cannot slice symbol "${symbolName}": not found in project code graph.`;
  }

  const target = matches[0];
  const fullPath = path.join(resolved, target.filePath);
  if (!fs.existsSync(fullPath)) {
    return `File not found for sliced symbol: ${target.filePath}`;
  }

  const allLines = fs.readFileSync(fullPath, 'utf-8').split('\n');
  const sliceLines = allLines.slice(target.lineStart - 1, target.lineEnd);
  const code = sliceLines.join('\n');

  return {
    filePath: target.filePath,
    symbol: target,
    code,
    totalLines: sliceLines.length,
  };
}

/**
 * Find callers and references of a symbol across project files.
 */
export function findCallers(projectPath: string, graph: CodeGraph, symbolName: string): CallerResult {
  const resolved = resolveProjectPath(projectPath);
  const name = symbolName.trim();
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escapedName}\\b`);

  const references: CallerResult['references'] = [];

  for (const [relFile, fileIdx] of Object.entries(graph.files)) {
    const fullPath = path.join(resolved, relFile);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (regex.test(line)) {
          // Exclude the declaration line itself if in the same file
          const isDecl = fileIdx.symbols.some(s => s.name === name && s.lineStart === i + 1);
          if (!isDecl) {
            references.push({
              filePath: relFile,
              line: i + 1,
              text: line.trim().slice(0, 120),
            });
            if (references.length >= 25) break;
          }
        }
      }
      if (references.length >= 25) break;
    } catch {}
  }

  return {
    symbolName: name,
    references,
  };
}
