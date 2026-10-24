import { resolveProjectPath } from '../util/paths.js';
import {
  buildCodeGraph,
  getGraphOverview,
  listFileSymbols,
  lookupSymbol,
  sliceSymbol,
  findCallers,
} from '../brief/codeGraph.js';

export interface CodeMapArgs {
  action?: 'overview' | 'symbols' | 'lookup' | 'slice' | 'callers';
  file_path?: string;
  symbol_name?: string;
  project_path?: string;
  force_refresh?: boolean;
}

export function handleCodeMap(args: CodeMapArgs): string {
  let projectPath: string;
  try {
    projectPath = resolveProjectPath(args.project_path);
  } catch (err: any) {
    return err.message;
  }

  const action = args.action || 'overview';
  const graph = buildCodeGraph(projectPath, { forceRefresh: args.force_refresh });

  switch (action) {
    case 'overview': {
      return getGraphOverview(graph);
    }

    case 'symbols': {
      const target = args.file_path || '.';
      return listFileSymbols(graph, target);
    }

    case 'lookup': {
      if (!args.symbol_name || args.symbol_name.trim() === '') {
        return 'BAD_INPUT: symbol_name is required for action "lookup".';
      }
      return lookupSymbol(graph, args.symbol_name);
    }

    case 'slice': {
      if (!args.symbol_name || args.symbol_name.trim() === '') {
        return 'BAD_INPUT: symbol_name is required for action "slice".';
      }
      const res = sliceSymbol(projectPath, graph, args.symbol_name, args.file_path);
      if (typeof res === 'string') {
        return res;
      }
      return [
        `# Symbol Slice: \`${res.symbol.name}\` (${res.symbol.kind})`,
        `- **File**: [${res.filePath}:${res.symbol.lineStart}-${res.symbol.lineEnd}](file:///${res.filePath}#L${res.symbol.lineStart}-L${res.symbol.lineEnd})`,
        `- **Lines**: ${res.totalLines} lines (token savings: ~${Math.max(50, 100 - Math.round(res.totalLines / 5))}% vs reading full file)`,
        '',
        '```' + (res.filePath.endsWith('.py') ? 'python' : res.filePath.endsWith('.go') ? 'go' : res.filePath.endsWith('.rs') ? 'rust' : 'typescript'),
        res.code,
        '```',
      ].join('\n');
    }

    case 'callers': {
      if (!args.symbol_name || args.symbol_name.trim() === '') {
        return 'BAD_INPUT: symbol_name is required for action "callers".';
      }
      const callers = findCallers(projectPath, graph, args.symbol_name);
      if (callers.references.length === 0) {
        return `No callers or references found for symbol "${args.symbol_name}".`;
      }
      const lines: string[] = [];
      lines.push(`# Callers & References: \`${callers.symbolName}\` (${callers.references.length} found)\n`);
      for (const ref of callers.references) {
        lines.push(`- [${ref.filePath}:${ref.line}](file:///${ref.filePath}#L${ref.line}): \`${ref.text}\``);
      }
      return lines.join('\n');
    }

    default:
      return `BAD_INPUT: Unknown action "${action}". Allowed actions: overview, symbols, lookup, slice, callers.`;
  }
}
