export interface SkillEntry {
    id: string;
    name: string;
    category: string;
    description: string;
    tags?: string[];
    risk?: string;
    source?: string;
    author?: string;
    featured?: boolean;
}
export declare function getRepoRoot(customRoot?: string): string;
export declare function loadSkillsIndex(repoRoot?: string): SkillEntry[];
export declare function listFeaturedSkills(repoRoot?: string): SkillEntry[];
export declare function searchSkills(query: string, options?: {
    category?: string;
    limit?: number;
}, repoRoot?: string): SkillEntry[];
export declare function getSkillInfo(id: string, repoRoot?: string): SkillEntry | null;
export declare function getCategories(repoRoot?: string): {
    category: string;
    count: number;
}[];
export declare function getDefaultSkillsDir(): string;
export declare function installSkill(id: string, options?: {
    targetDir?: string;
    repoRoot?: string;
}): {
    success: boolean;
    destPath: string;
    message: string;
};
export declare function formatSkillsTable(skills: SkillEntry[]): string;
//# sourceMappingURL=manager.d.ts.map