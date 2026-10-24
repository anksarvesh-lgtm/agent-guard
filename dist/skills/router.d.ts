export type SkillTier = 'active' | 'composio' | 'community';
export interface IndexedSkill {
    id: string;
    name: string;
    category: string;
    tier: SkillTier;
    description: string;
    tags: string[];
    diskPath?: string;
}
export interface SkillRouteResult {
    id: string;
    name: string;
    category: string;
    tier: SkillTier;
    description: string;
    score: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    matchReasons: string[];
    diskPath?: string;
    content?: string;
}
export declare class JitSkillRouter {
    private static instance;
    private skills;
    private invertedIndex;
    private repoRoot;
    private initialized;
    constructor(customRoot?: string);
    static getInstance(customRoot?: string): JitSkillRouter;
    private resolveRepoRoot;
    ensureInitialized(): void;
    private tokenize;
    getTotalSkillsCount(): number;
    getStats(): {
        totalSkills: number;
        activeCount: number;
        composioCount: number;
        communityCount: number;
        uniqueTokens: number;
    };
    getSkillsByTier(tier: SkillTier): IndexedSkill[];
    route(query: string, options?: {
        limit?: number;
        minScore?: number;
        tier?: SkillTier;
        loadContent?: boolean;
    }): SkillRouteResult[];
    readSkillContent(skill: IndexedSkill | {
        id: string;
        diskPath?: string;
    }): string | undefined;
}
export declare const globalJitSkillRouter: JitSkillRouter;
//# sourceMappingURL=router.d.ts.map