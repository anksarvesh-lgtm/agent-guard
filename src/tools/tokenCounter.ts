import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { TokenCounterSchema, formatZodError } from '../util/schema.js';
import { resolveProjectPath } from '../util/paths.js';
import { logToolCall } from '../util/log.js';
import {
  estimateTextTokens,
  estimateFileTokens,
  calculateContextBudget,
  compareAcrossModels,
  parseTranscriptTokens,
  formatTokenNumber
} from '../tokens/index.js';

export function findRecentTranscript(workspacePath?: string): string | null {
  // 1. Check environment variable override
  if (process.env.AGENT_GUARD_TRANSCRIPT && fs.existsSync(process.env.AGENT_GUARD_TRANSCRIPT)) {
    return process.env.AGENT_GUARD_TRANSCRIPT;
  }

  // 2. Check Antigravity brain directories
  const home = process.env.AGENT_GUARD_HOME || os.homedir();
  const brainDir = path.join(home, '.gemini', 'antigravity', 'brain');
  if (fs.existsSync(brainDir)) {
    try {
      const entries = fs.readdirSync(brainDir, { withFileTypes: true });
      let newestFile: string | null = null;
      let newestMtime = 0;

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const transcriptCandidate = path.join(brainDir, entry.name, '.system_generated', 'logs', 'transcript.jsonl');
          if (fs.existsSync(transcriptCandidate)) {
            const stat = fs.statSync(transcriptCandidate);
            if (stat.mtimeMs > newestMtime) {
              newestMtime = stat.mtimeMs;
              newestFile = transcriptCandidate;
            }
          }
        }
      }
      if (newestFile) return newestFile;
    } catch {
      // Ignore directory read errors
    }
  }

  return null;
}

export function handleTokenCounter(rawArgs: any): string {
  const parseResult = TokenCounterSchema.safeParse(rawArgs);
  if (!parseResult.success) {
    const err = formatZodError(parseResult.error);
    logToolCall('token_counter', null, 'BAD_INPUT', rawArgs?.project_path);
    return err;
  }

  const { model, text, file_path, transcript_path, compare_all, project_path } = parseResult.data;

  let validatedProject: string | undefined;
  if (project_path) {
    try {
      validatedProject = resolveProjectPath(project_path);
    } catch (err: any) {
      logToolCall('token_counter', null, 'BAD_PROJECT_PATH', project_path);
      return err.message;
    }
  }

  let usedTokens = 0;
  let sourceDescription = '';
  let transcriptBreakdown: any = null;

  if (text !== undefined && text !== null) {
    usedTokens = estimateTextTokens(text);
    sourceDescription = `Custom text input (${text.length} characters)`;
  } else if (file_path) {
    const targetFile = path.isAbsolute(file_path) || !validatedProject
      ? file_path
      : path.join(validatedProject, file_path);

    if (!fs.existsSync(targetFile)) {
      logToolCall('token_counter', null, 'FILE_NOT_FOUND', validatedProject);
      return `FILE_NOT_FOUND: Could not find target file at ${targetFile}`;
    }
    usedTokens = estimateFileTokens(targetFile);
    sourceDescription = `File: ${path.basename(targetFile)}`;
  } else if (transcript_path) {
    if (!fs.existsSync(transcript_path)) {
      logToolCall('token_counter', null, 'TRANSCRIPT_NOT_FOUND', validatedProject);
      return `TRANSCRIPT_NOT_FOUND: Could not find transcript at ${transcript_path}`;
    }
    transcriptBreakdown = parseTranscriptTokens(transcript_path);
    usedTokens = transcriptBreakdown.totalEstimatedTokens;
    sourceDescription = `Session transcript (${transcriptBreakdown.stepsCount} turns)`;
  } else {
    // Auto-detect session transcript or ledger
    const recentTranscript = findRecentTranscript(validatedProject);
    if (recentTranscript) {
      transcriptBreakdown = parseTranscriptTokens(recentTranscript);
      usedTokens = transcriptBreakdown.totalEstimatedTokens;
      sourceDescription = `Active conversation transcript (${transcriptBreakdown.stepsCount} interaction turns)`;
    } else if (validatedProject) {
      // Estimate from active ledger
      const ledgerPath = path.join(validatedProject, '.agent', 'ledger.json');
      if (fs.existsSync(ledgerPath)) {
        try {
          const ledgerContent = fs.readFileSync(ledgerPath, 'utf-8');
          usedTokens = estimateTextTokens(ledgerContent);
          sourceDescription = `Task ledger (.agent/ledger.json)`;
        } catch {
          usedTokens = 1000;
          sourceDescription = 'Default baseline';
        }
      } else {
        usedTokens = 1200;
        sourceDescription = 'Session estimate';
      }
    } else {
      usedTokens = 1200;
      sourceDescription = 'Baseline estimate';
    }
  }

  const budget = calculateContextBudget(usedTokens, model, sourceDescription);

  logToolCall('token_counter', null, 'OK', validatedProject);

  const lines: string[] = [];
  lines.push(`## 📊 Token Counter & Context Budget: ${budget.model.name}`);
  lines.push(`• **Provider**: ${budget.model.provider}`);
  lines.push(`• **Context Window**: ${budget.contextLimit.toLocaleString()} tokens (${formatTokenNumber(budget.contextLimit)})`);
  lines.push(`• **Tokens Used**: ${budget.usedTokens.toLocaleString()} tokens (${budget.percentUsed}% consumed)`);
  lines.push(`• **Tokens Remaining**: ${budget.remainingTokens.toLocaleString()} tokens (${budget.percentRemaining}% headroom)`);
  lines.push(`• **Safety Status**: ${budget.statusEmoji} **${budget.status}**`);
  lines.push(`• **Source**: ${sourceDescription}`);
  lines.push(`• **Guidance**: ${budget.recommendation}`);

  if (transcriptBreakdown && transcriptBreakdown.stepsCount > 0) {
    lines.push('\n### 🔍 Transcript Token Breakdown:');
    lines.push(`- Assistant Responses: ~${formatTokenNumber(transcriptBreakdown.assistantTokens)} tokens`);
    lines.push(`- Thinking & CoT: ~${formatTokenNumber(transcriptBreakdown.thinkingTokens)} tokens`);
    lines.push(`- Tool Calls & Payloads: ~${formatTokenNumber(transcriptBreakdown.toolCallTokens)} tokens`);
    lines.push(`- User Input: ~${formatTokenNumber(transcriptBreakdown.userTokens)} tokens`);
  }

  if (compare_all) {
    const comparison = compareAcrossModels(usedTokens);
    lines.push('\n### 🌐 Cross-Model Context Consumption Comparison:');
    lines.push('| Model | Provider | Window | Tokens Used | Remaining | % Used | Status |');
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
    for (const item of comparison) {
      const emoji = item.status === 'OPTIMAL' ? '🟢' : item.status === 'MODERATE' ? '🟡' : item.status === 'WARNING' ? '🟠' : '🔴';
      lines.push(
        `| **${item.modelName}** | ${item.provider} | ${formatTokenNumber(item.contextLimit)} | ${formatTokenNumber(item.usedTokens)} | ${formatTokenNumber(item.remainingTokens)} | ${item.percentUsed}% | ${emoji} ${item.status} |`
      );
    }
  }

  return lines.join('\n');
}
