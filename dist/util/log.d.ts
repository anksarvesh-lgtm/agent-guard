/**
 * Appends a single line to `<project>/.agent/log.txt`:
 * Format: ISO_TIMESTAMP [TOOL] [STEP_ID] [RESULT_CODE]
 * Strictly avoids logging goal, prompt, notes, or secret values.
 * Rotates to log.1.txt if file exceeds 1 MB.
 */
export declare function logToolCall(toolName: string, stepId: string | undefined | null, resultCode: string, projectPath?: string): void;
//# sourceMappingURL=log.d.ts.map