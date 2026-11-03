export interface ParsedPromptResult {
    goal: string;
    steps: Array<{
        title: string;
        depends_on?: string[];
    }>;
}
/**
 * Automatically parses freeform user prompts containing numbered lists, bullet points,
 * or step keywords into a structured, ordered array of steps.
 */
export declare function parsePromptSteps(rawPrompt: string): ParsedPromptResult;
/**
 * Initializes a prompt-guided task from user instructions, locking the agent onto each step.
 */
export declare function initializePromptTask(prompt: string, projectPath?: string, options?: {
    maxTries?: number;
    replace?: boolean;
}): {
    success: boolean;
    taskId: string;
    goal: string;
    stepCount: number;
    message: string;
};
//# sourceMappingURL=promptTask.d.ts.map