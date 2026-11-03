import { TaskLedger, Step } from '../types.js';
import { readLedger, writeLedger, archiveCurrentTask } from '../ledger.js';
import { resolveProjectPath } from '../util/paths.js';
import { globalAwakeManager } from '../awake/manager.js';
import { logToolCall } from '../util/log.js';

export interface ParsedPromptResult {
  goal: string;
  steps: Array<{ title: string; depends_on?: string[] }>;
}

/**
 * Automatically parses freeform user prompts containing numbered lists, bullet points,
 * or step keywords into a structured, ordered array of steps.
 */
export function parsePromptSteps(rawPrompt: string): ParsedPromptResult {
  const lines = rawPrompt.split(/[\r\n]+/);
  const stepTitles: string[] = [];
  let goal = '';

  const stepRegex = /^(?:(?:step\s*\d+[\s:.-]*)|(?:\d+[\s:.)-]+)|(?:[-*•]\s+step\s*\d+[:\s]*)|(?:[-*•]\s+))(.*)$/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(stepRegex);
    if (match && match[1].trim().length > 3) {
      stepTitles.push(match[1].trim());
    } else if (!goal && trimmed.length > 5 && !trimmed.startsWith('#')) {
      goal = trimmed;
    }
  }

  // If no numbered steps found, split by sentences or punctuation
  if (stepTitles.length === 0) {
    const sentences = rawPrompt
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
    if (sentences.length >= 2) {
      goal = sentences[0];
      for (let i = 1; i < Math.min(sentences.length, 8); i++) {
        stepTitles.push(sentences[i]);
      }
    } else {
      goal = rawPrompt.slice(0, 120);
      stepTitles.push(rawPrompt.slice(0, 200));
    }
  }

  if (!goal) {
    goal = stepTitles.length > 0 ? stepTitles[0] : 'User Guided Prompt Task';
  }

  return {
    goal: goal.slice(0, 300),
    steps: stepTitles.map((title) => ({
      title: title.slice(0, 200),
    })),
  };
}

/**
 * Initializes a prompt-guided task from user instructions, locking the agent onto each step.
 */
export function initializePromptTask(
  prompt: string,
  projectPath?: string,
  options?: { maxTries?: number; replace?: boolean }
): { success: boolean; taskId: string; goal: string; stepCount: number; message: string } {
  const root = resolveProjectPath(projectPath || process.cwd());
  const parsed = parsePromptSteps(prompt);

  const existing = readLedger(root);
  if (existing && existing.status === 'active') {
    if (!options?.replace) {
      archiveCurrentTask(root);
    }
  }

  const now = new Date().toISOString();
  const dateStr = now.slice(0, 10).replace(/-/g, '');
  const randSuffix = Math.floor(1000 + Math.random() * 9000);
  const taskId = `t-${dateStr}-${randSuffix}`;
  const maxTries = options?.maxTries || 3;

  const ledgerSteps: Step[] = parsed.steps.map((s, idx) => ({
    id: `s${idx + 1}`,
    title: s.title,
    status: idx === 0 ? 'in_progress' : 'pending',
    tries: 0,
    max_tries: maxTries,
    depends_on: idx > 0 ? [`s${idx}`] : [],
    note: null,
    last_error: null,
    updated_at: now,
  }));

  const ledger: TaskLedger & { user_prompt?: string } = {
    version: 1,
    task_id: taskId,
    goal: parsed.goal,
    status: 'active',
    created_at: now,
    updated_at: now,
    checkpoint_count: 0,
    steps: ledgerSteps,
    user_prompt: prompt,
  };

  writeLedger(ledger, root);

  // Automatically acquire 30m sleep prevention lease
  try {
    globalAwakeManager.hold(30, `Prompt Guided Task: ${taskId}`);
  } catch {}

  logToolCall('task_start', 's1', 'PROMPT_TASK_INITIALIZED', root);

  return {
    success: true,
    taskId,
    goal: parsed.goal,
    stepCount: ledgerSteps.length,
    message: `Initialized ${ledgerSteps.length} prompt-guided steps for task ${taskId}. Agent is now strictly locked onto step s1.`,
  };
}

