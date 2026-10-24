import { TaskStatusSchema, formatZodError } from '../util/schema.js';
import { resolveProjectPath } from '../util/paths.js';
import { readLedger, getNextStep } from '../ledger.js';
import { logToolCall } from '../util/log.js';
import { findRecentTranscript } from './tokenCounter.js';
import { globalAccountManager } from '../accounts/index.js';
import { calculateContextBudget, formatTokenNumber, parseTranscriptTokens, estimateTextTokens } from '../tokens/index.js';
export function handleTaskStatus(rawArgs) {
    const parseResult = TaskStatusSchema.safeParse(rawArgs);
    if (!parseResult.success) {
        const err = formatZodError(parseResult.error);
        logToolCall('task_status', null, 'BAD_INPUT', rawArgs?.project_path);
        return err;
    }
    const { project_path } = parseResult.data;
    let validatedProject;
    try {
        validatedProject = resolveProjectPath(project_path);
    }
    catch (err) {
        logToolCall('task_status', null, 'BAD_PROJECT_PATH', project_path);
        return err.message;
    }
    const ledger = readLedger(validatedProject);
    if (!ledger) {
        logToolCall('task_status', null, 'NO_TASK', validatedProject);
        return 'No task found in .agent/ledger.json. Call repo_brief then task_start to begin.';
    }
    const doneCount = ledger.steps.filter((s) => s.status === 'done').length;
    const blockedCount = ledger.steps.filter((s) => s.status === 'blocked').length;
    const remainingCount = ledger.steps.length - doneCount - blockedCount;
    const inProgressStep = ledger.steps.find((s) => s.status === 'in_progress');
    const nextCandidate = getNextStep(ledger.steps);
    const blockedSteps = ledger.steps
        .filter((s) => s.status === 'blocked')
        .map((s) => `- [${s.id}] ${s.title}: ${s.last_error || 'Blocked'}`);
    let nextActionLine = '';
    if (ledger.status === 'done') {
        nextActionLine = 'All steps complete. Summarize what changed and what was tested.';
    }
    else if (ledger.status === 'blocked') {
        nextActionLine = 'Task is blocked. Report the blocker to the user.';
    }
    else if (inProgressStep) {
        const triesLeft = inProgressStep.max_tries - inProgressStep.tries;
        nextActionLine = `Continue step ${inProgressStep.id}: "${inProgressStep.title}" (${triesLeft} tries remaining).`;
    }
    else if (nextCandidate) {
        nextActionLine = `Next ready step is ${nextCandidate.id}: "${nextCandidate.title}".`;
    }
    else {
        nextActionLine = 'No eligible steps ready. Check dependencies.';
    }
    const lines = [
        `Task: ${ledger.task_id} [${ledger.status.toUpperCase()}]`,
        `Goal: ${ledger.goal}`,
        `Progress: ${doneCount} done, ${remainingCount} remaining, ${blockedCount} blocked (total ${ledger.steps.length} steps, ${ledger.checkpoint_count} checkpoints)`,
    ];
    if (blockedSteps.length > 0) {
        lines.push(`Blocked Steps:\n${blockedSteps.slice(0, 5).join('\n')}`);
    }
    lines.push(`Next Action: ${nextActionLine}`);
    // Context token budget badge
    try {
        const recentTranscript = findRecentTranscript(validatedProject);
        let usedTokens = 1200;
        if (recentTranscript) {
            const tBreakdown = parseTranscriptTokens(recentTranscript);
            usedTokens = tBreakdown.totalEstimatedTokens;
        }
        else {
            usedTokens = estimateTextTokens(JSON.stringify(ledger));
        }
        const budget = calculateContextBudget(usedTokens);
        lines.push(`Context Budget: ${budget.statusEmoji} ${formatTokenNumber(budget.usedTokens)} used / ${formatTokenNumber(budget.remainingTokens)} remaining (${budget.percentUsed}% of ${budget.model.name}) [${budget.status}]`);
    }
    catch { }
    // Active Account and auto-rotate badge
    try {
        const activeAcc = globalAccountManager.getActiveAccount();
        const accConfig = globalAccountManager.getConfig();
        if (activeAcc) {
            const rotateStatus = accConfig.autoRotateEnabled
                ? `[Auto-Switch at <=${accConfig.thresholdPercent}%: ON]`
                : '[Auto-Switch: OFF]';
            lines.push(`Active Account: "${activeAcc.name}" (${activeAcc.id}, ${activeAcc.remainingPercent}% quota) ${rotateStatus}`);
        }
    }
    catch { }
    logToolCall('task_status', inProgressStep?.id || nextCandidate?.id || null, 'OK', validatedProject);
    return lines.join('\n');
}
//# sourceMappingURL=taskStatus.js.map