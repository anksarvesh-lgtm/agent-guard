export interface ModelProfile {
    id: string;
    name: string;
    provider: 'Google Gemini' | 'Anthropic Claude' | 'OpenAI' | 'DeepSeek' | 'Open Source' | 'Other';
    contextWindow: number;
    maxOutputTokens: number;
    description: string;
    recommendedThreshold: number;
}
export type BudgetHealthStatus = 'OPTIMAL' | 'MODERATE' | 'WARNING' | 'CRITICAL';
export interface ContextBudgetResult {
    model: ModelProfile;
    usedTokens: number;
    remainingTokens: number;
    contextLimit: number;
    percentUsed: number;
    percentRemaining: number;
    status: BudgetHealthStatus;
    statusEmoji: string;
    recommendation: string;
    sourceDescription?: string;
}
export interface ModelComparisonItem {
    modelId: string;
    modelName: string;
    provider: string;
    contextLimit: number;
    usedTokens: number;
    remainingTokens: number;
    percentUsed: number;
    status: BudgetHealthStatus;
}
export interface TranscriptTokenBreakdown {
    totalEstimatedTokens: number;
    stepsCount: number;
    userTokens: number;
    assistantTokens: number;
    thinkingTokens: number;
    toolCallTokens: number;
    transcriptPath?: string;
}
//# sourceMappingURL=types.d.ts.map