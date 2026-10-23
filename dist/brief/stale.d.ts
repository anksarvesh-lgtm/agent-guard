export interface FreshnessInfo {
    isGit: boolean;
    commit: string;
    filesHash: string;
    fileCount: number;
    files: string[];
}
export declare function getProjectFreshness(projectPath: string): FreshnessInfo;
export declare function parseBriefHeader(briefContent: string): {
    commit: string;
    hash: string;
} | null;
//# sourceMappingURL=stale.d.ts.map