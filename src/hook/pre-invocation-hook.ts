#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { resolveProjectPath } from '../util/paths.js';
import { logToolCall } from '../util/log.js';
import { globalJitSkillRouter } from '../skills/router.js';
import { findRecentTranscript } from '../tools/tokenCounter.js';

function readStdinSilently(): string {
  try {
    if (process.stdin.isTTY) {
      return '';
    }
    return fs.readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

interface PreInvocationInput {
  conversationId?: string;
  workspacePaths?: string[];
  transcriptPath?: string;
  modelName?: string;
  invocationNum?: number;
  initialNumSteps?: number;
  prompt?: string;
  userMessage?: string;
}

/**
 * Extracts the most recent user prompt/request from a transcript JSONL file.
 */
function extractLatestUserMessage(transcriptPath: string): string {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return '';

  try {
    const content = fs.readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');

    // Scan backwards from bottom to find the last user input
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const item = JSON.parse(line);
        const isUser =
          item.source === 'USER' ||
          item.source === 'USER_EXPLICIT' ||
          item.type === 'USER_INPUT' ||
          item.type === 'user';

        if (isUser && item.content) {
          if (typeof item.content === 'string') {
            return item.content;
          }
          if (Array.isArray(item.content)) {
            const texts = item.content
              .filter((c: any) => c && typeof c.text === 'string')
              .map((c: any) => c.text);
            if (texts.length > 0) return texts.join('\n');
          }
        }
      } catch {}
    }
  } catch {}

  return '';
}

export function runPreInvocationHook(projectDir?: string, stdinData: string = ''): void {
  const defaultResponse = JSON.stringify({ injectSteps: [] });

  try {
    const project = resolveProjectPath(projectDir || process.cwd());
    let input: PreInvocationInput = {};

    if (stdinData) {
      try {
        input = JSON.parse(stdinData);
      } catch {}
    }

    const conversationId = input.conversationId || 'default-session';
    let userQuery = input.prompt || input.userMessage || '';

    // If query not in stdin, read from transcript
    if (!userQuery) {
      const transcriptFile = input.transcriptPath || findRecentTranscript(conversationId);
      if (transcriptFile) {
        userQuery = extractLatestUserMessage(transcriptFile);
      }
    }

    // If no query detected, continue quietly
    if (!userQuery || userQuery.trim().length < 5) {
      process.stdout.write(defaultResponse);
      return;
    }

    // Filter out common noise phrases
    const cleanQuery = userQuery.replace(/<[^>]*>/g, ' ').trim();
    if (cleanQuery.length < 5) {
      process.stdout.write(defaultResponse);
      return;
    }

    // Route against 3,600+ skills library
    const matches = globalJitSkillRouter.route(cleanQuery, {
      limit: 1,
      minScore: 0.65,
      loadContent: true,
    });

    if (matches.length === 0) {
      process.stdout.write(defaultResponse);
      return;
    }

    const topMatch = matches[0];

    // Check if this skill has already been activated in this conversation
    const activatedPath = path.join(project, '.agent', 'activated_skills.json');
    let activatedMap: Record<string, string[]> = {};
    if (fs.existsSync(activatedPath)) {
      try {
        activatedMap = JSON.parse(fs.readFileSync(activatedPath, 'utf-8'));
      } catch {}
    }

    const activeList = activatedMap[conversationId] || [];
    if (activeList.includes(topMatch.id)) {
      // Already activated in this session, don't spam
      process.stdout.write(defaultResponse);
      return;
    }

    // Record activation
    activeList.push(topMatch.id);
    activatedMap[conversationId] = activeList;
    try {
      const agentDir = path.join(project, '.agent');
      if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(activatedPath, JSON.stringify(activatedMap, null, 2), 'utf-8');
    } catch {}

    logToolCall(
      'pre_invocation_hook',
      topMatch.id,
      `JIT_ACTIVATED (score=${topMatch.score.toFixed(2)}, tier=${topMatch.tier})`,
      project
    );

    // Format ephemeral guidance message
    let guidance = topMatch.content || '';
    // Truncate guidance if too long to prevent prompt saturation
    if (guidance.length > 2000) {
      guidance = guidance.slice(0, 2000) + '\n... [Remaining runbook available via `skill_activate` tool]';
    }

    const message = [
      `⚡ [Agent Guard Autonomous Skill JIT-Activation]`,
      `Dynamically routed specialized skill from 3,600+ library:`,
      `• **Skill**: ${topMatch.name} (\`${topMatch.id}\`)`,
      `• **Category**: ${topMatch.category} | **Tier**: ${topMatch.tier.toUpperCase()} | **Confidence**: ${topMatch.confidence} (${(topMatch.score * 100).toFixed(0)}%)`,
      `• **Summary**: ${topMatch.description}`,
      guidance ? `\n### 📖 Procedural Guidance & Runbook:\n${guidance}` : '',
      `\n*(Zero-turn ambient injection via Agent Guard JIT Semantic Router. Consumes zero persistent system prompt tokens.)*`
    ].filter(Boolean).join('\n');

    const payload = JSON.stringify({
      injectSteps: [
        {
          ephemeralMessage: message
        }
      ]
    });

    process.stdout.write(payload);
  } catch (err: any) {
    // Fail-safe: empty injectSteps ensures zero disruption to agent execution
    process.stdout.write(defaultResponse);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stdinContent = readStdinSilently();
  runPreInvocationHook(process.cwd(), stdinContent);
}
