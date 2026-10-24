import fs from 'node:fs';
import { resolveModelProfile, SUPPORTED_MODELS } from './models.js';
// Calibrated characters-per-token ratio for source code and English text across Claude/GPT/Gemini BPE tokenizers
export const CODE_CHARS_PER_TOKEN = 3.3;
function isCjk(code) {
    return ((code >= 0x3040 && code <= 0x30ff) || // Hiragana + Katakana
        (code >= 0x3400 && code <= 0x4dbf) || // CJK Ext A
        (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified
        (code >= 0xac00 && code <= 0xd7a3) || // Hangul syllables
        (code >= 0xf900 && code <= 0xfaff) || // CJK compatibility
        (code >= 0xff00 && code <= 0xffef) || // Half/full-width
        (code >= 0x20000 && code <= 0x2fa1f) // CJK Ext B-F
    );
}
const NON_ASCII = /[^\x00-\x7F]/;
/**
 * Calibrated token estimator: CJK characters count ~1 token/char, rest ~3.3 chars/token.
 */
export function estimateTextTokens(text) {
    if (!text || text.length === 0)
        return 0;
    if (!NON_ASCII.test(text)) {
        return Math.max(1, Math.ceil(text.length / CODE_CHARS_PER_TOKEN));
    }
    let cjk = 0;
    for (const ch of text) {
        const code = ch.codePointAt(0);
        if (code !== undefined && isCjk(code))
            cjk += 1;
    }
    const other = text.length - cjk;
    return Math.max(1, Math.ceil(other / CODE_CHARS_PER_TOKEN) + cjk);
}
/**
 * Estimate tokens for a file on disk.
 */
export function estimateFileTokens(filePath) {
    if (!fs.existsSync(filePath))
        return 0;
    try {
        const stat = fs.statSync(filePath);
        if (stat.size > 2 * 1024 * 1024) {
            // For large files (>2MB), calculate from byte size to preserve memory
            return Math.max(1, Math.ceil(stat.size / CODE_CHARS_PER_TOKEN));
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return estimateTextTokens(content);
    }
    catch {
        return 0;
    }
}
/**
 * Calculate full context budget and safety status for an agent session.
 */
export function calculateContextBudget(usedTokens, modelIdentifier, sourceDescription) {
    const model = resolveModelProfile(modelIdentifier);
    const contextLimit = model.contextWindow;
    const clampedUsed = Math.max(0, Math.round(usedTokens));
    const remainingTokens = Math.max(0, contextLimit - clampedUsed);
    const percentUsed = Number(((clampedUsed / contextLimit) * 100).toFixed(1));
    const percentRemaining = Number(Math.max(0, 100 - percentUsed).toFixed(1));
    let status = 'OPTIMAL';
    let statusEmoji = '🟢';
    let recommendation = `Context usage is healthy (${percentUsed}%). You have ${formatTokenNumber(remainingTokens)} tokens remaining.`;
    if (percentUsed >= 90) {
        status = 'CRITICAL';
        statusEmoji = '🔴';
        recommendation = `CRITICAL: ${percentUsed}% of context window consumed! Overflow imminent. Run /compact immediately or checkpoint current task.`;
    }
    else if (percentUsed >= 75) {
        status = 'WARNING';
        statusEmoji = '🟠';
        recommendation = `WARNING: ${percentUsed}% of context window consumed. Approaching safety threshold for ${model.name}. Prioritize concluding current steps.`;
    }
    else if (percentUsed >= 50) {
        status = 'MODERATE';
        statusEmoji = '🟡';
        recommendation = `Moderate context usage (${percentUsed}%). Headroom remaining: ${formatTokenNumber(remainingTokens)} tokens.`;
    }
    return {
        model,
        usedTokens: clampedUsed,
        remainingTokens,
        contextLimit,
        percentUsed,
        percentRemaining,
        status,
        statusEmoji,
        recommendation,
        sourceDescription,
    };
}
/**
 * Compares current token consumption across all major AI agent models.
 */
export function compareAcrossModels(usedTokens) {
    const coreModelIds = [
        'gemini-1.5-pro',
        'gemini-2.0-flash',
        'claude-3-5-sonnet',
        'gpt-4o',
        'o1',
        'deepseek-chat',
        'llama-3.3-70b',
    ];
    return coreModelIds.map((id) => {
        const profile = SUPPORTED_MODELS[id];
        const percentUsed = Number(((usedTokens / profile.contextWindow) * 100).toFixed(1));
        const remainingTokens = Math.max(0, profile.contextWindow - usedTokens);
        let status = 'OPTIMAL';
        if (percentUsed >= 90)
            status = 'CRITICAL';
        else if (percentUsed >= 75)
            status = 'WARNING';
        else if (percentUsed >= 50)
            status = 'MODERATE';
        return {
            modelId: profile.id,
            modelName: profile.name,
            provider: profile.provider,
            contextLimit: profile.contextWindow,
            usedTokens,
            remainingTokens,
            percentUsed,
            status,
        };
    });
}
/**
 * Format token counts with human-readable suffix (e.g. 1.25M, 45.2k).
 */
export function formatTokenNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toLocaleString();
}
/**
 * Scans a transcript JSONL file and computes cumulative tokens consumed.
 */
export function parseTranscriptTokens(transcriptFilePath) {
    if (!transcriptFilePath || !fs.existsSync(transcriptFilePath)) {
        return {
            totalEstimatedTokens: 0,
            stepsCount: 0,
            userTokens: 0,
            assistantTokens: 0,
            thinkingTokens: 0,
            toolCallTokens: 0,
        };
    }
    let totalEstimatedTokens = 0;
    let stepsCount = 0;
    let userTokens = 0;
    let assistantTokens = 0;
    let thinkingTokens = 0;
    let toolCallTokens = 0;
    try {
        const content = fs.readFileSync(transcriptFilePath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
            if (!line.trim())
                continue;
            stepsCount++;
            try {
                const item = JSON.parse(line);
                if (item.content && typeof item.content === 'string') {
                    const t = estimateTextTokens(item.content);
                    if (item.source === 'USER' || item.type === 'USER_INPUT') {
                        userTokens += t;
                    }
                    else {
                        assistantTokens += t;
                    }
                    totalEstimatedTokens += t;
                }
                if (item.thinking && typeof item.thinking === 'string') {
                    const th = estimateTextTokens(item.thinking);
                    thinkingTokens += th;
                    totalEstimatedTokens += th;
                }
                if (item.tool_calls && Array.isArray(item.tool_calls)) {
                    const tcStr = JSON.stringify(item.tool_calls);
                    const tc = estimateTextTokens(tcStr);
                    toolCallTokens += tc;
                    totalEstimatedTokens += tc;
                }
            }
            catch {
                // Fallback for unstructured log lines
                totalEstimatedTokens += estimateTextTokens(line);
            }
        }
    }
    catch {
        // Read failure fallback
    }
    return {
        totalEstimatedTokens,
        stepsCount,
        userTokens,
        assistantTokens,
        thinkingTokens,
        toolCallTokens,
        transcriptPath: transcriptFilePath,
    };
}
//# sourceMappingURL=counter.js.map