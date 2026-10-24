export interface GenerateAgentsMdOptions {
    outputPath?: string;
    projectPath?: string;
    extraRules?: string[];
    forceOverwrite?: boolean;
}
export interface GeneratedAgentsMdResult {
    projectPath: string;
    outputPath: string;
    content: string;
    isNew: boolean;
}
/**
 * Dynamically inspects project architecture, commands, and tech stack to generate
 * a tailored, context-dense AGENTS.md rulebook.
 */
export declare function generateAgentsMd(options?: GenerateAgentsMdOptions): GeneratedAgentsMdResult;
//# sourceMappingURL=agentsMdGenerator.d.ts.map