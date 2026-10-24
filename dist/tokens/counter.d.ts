import { ContextBudgetResult, ModelComparisonItem, TranscriptTokenBreakdown } from './types.js';
export declare const CODE_CHARS_PER_TOKEN = 3.3;
/**
 * Calibrated token estimator: CJK characters count ~1 token/char, rest ~3.3 chars/token.
 */
export declare function estimateTextTokens(text: string): number;
/**
 * Estimate tokens for a file on disk.
 */
export declare function estimateFileTokens(filePath: string): number;
/**
 * Calculate full context budget and safety status for an agent session.
 */
export declare function calculateContextBudget(usedTokens: number, modelIdentifier?: string, sourceDescription?: string): ContextBudgetResult;
/**
 * Compares current token consumption across all major AI agent models.
 */
export declare function compareAcrossModels(usedTokens: number): ModelComparisonItem[];
/**
 * Format token counts with human-readable suffix (e.g. 1.25M, 45.2k).
 */
export declare function formatTokenNumber(num: number): string;
/**
 * Scans a transcript JSONL file and computes cumulative tokens consumed.
 */
export declare function parseTranscriptTokens(transcriptFilePath?: string): TranscriptTokenBreakdown;
//# sourceMappingURL=counter.d.ts.map