/**
 * Validates and resolves the real project path according to the strict safety rules:
 * 1. Must exist and be a directory.
 * 2. Cannot be root or the user's home directory.
 * 3. Cannot be a system folder.
 * 4. Must contain a `.git` folder (or worktree file) OR an existing `.agent` directory.
 */
export declare function resolveProjectPath(projectPath?: string): string;
/**
 * Returns `<project>/.agent` directory, ensuring it exists.
 */
export declare function getAgentDir(projectPath?: string): string;
export declare function getLedgerPath(projectPath?: string): string;
export declare function getLedgerLockPath(projectPath?: string): string;
export declare function getLedgerPrevPath(projectPath?: string): string;
export declare function getLedgerTmpPath(projectPath?: string): string;
export declare function getHistoryDir(projectPath?: string): string;
export declare function getBriefPath(projectPath?: string): string;
export declare function getHookStatePath(projectPath?: string): string;
export declare function getLogPath(projectPath?: string): string;
export declare function getTrapsPath(projectPath?: string): string;
//# sourceMappingURL=paths.d.ts.map