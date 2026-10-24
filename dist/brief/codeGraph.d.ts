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
/**
 * Extract symbols, imports, and exports from source code using high-speed lexical analysis.
 */
export declare function parseSourceFile(filePath: string, content: string): FileIndex;
export declare function getCodeGraphCachePath(projectPath: string): string;
/**
 * Builds or refreshes the AST Code Knowledge Graph for a project.
 */
export declare function buildCodeGraph(projectPath: string, options?: {
    forceRefresh?: boolean;
    maxFiles?: number;
}): CodeGraph;
/**
 * Query high-level project architectural overview.
 */
export declare function getGraphOverview(graph: CodeGraph): string;
/**
 * List symbols inside a specific file or directory.
 */
export declare function listFileSymbols(graph: CodeGraph, fileOrPattern: string): string;
/**
 * Look up a symbol across the entire codebase.
 */
export declare function lookupSymbol(graph: CodeGraph, symbolName: string): string;
/**
 * Slice and return ONLY the exact lines of code defining a symbol.
 * Cuts code-reading tokens by 90-95% by avoiding reading entire files!
 */
export declare function sliceSymbol(projectPath: string, graph: CodeGraph, symbolName: string, targetFile?: string): SymbolSliceResult | string;
/**
 * Find callers and references of a symbol across project files.
 */
export declare function findCallers(projectPath: string, graph: CodeGraph, symbolName: string): CallerResult;
//# sourceMappingURL=codeGraph.d.ts.map