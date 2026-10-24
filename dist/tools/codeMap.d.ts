export interface CodeMapArgs {
    action?: 'overview' | 'symbols' | 'lookup' | 'slice' | 'callers';
    file_path?: string;
    symbol_name?: string;
    project_path?: string;
    force_refresh?: boolean;
}
export declare function handleCodeMap(args: CodeMapArgs): string;
//# sourceMappingURL=codeMap.d.ts.map