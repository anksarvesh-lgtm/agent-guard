import { SkillRouteResult } from './router.js';
export interface TechDetection {
    name: string;
    category: 'frontend' | 'backend' | 'database' | 'devops' | 'testing' | 'ai' | 'language';
    sourceFile: string;
}
export interface WorkspaceScanResult {
    workspace: string;
    detectedTech: TechDetection[];
    recommendedSkills: SkillRouteResult[];
    savedConfigPath?: string;
}
export declare class WorkspaceScanner {
    private static instance;
    static getInstance(): WorkspaceScanner;
    /**
     * Scans a workspace directory for technologies, frameworks, and tools.
     */
    scan(workspacePath: string, options?: {
        maxSkills?: number;
        saveConfig?: boolean;
    }): WorkspaceScanResult;
}
export declare const globalWorkspaceScanner: WorkspaceScanner;
//# sourceMappingURL=scanner.d.ts.map