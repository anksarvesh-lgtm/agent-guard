import { TaskCheckpointSchema, formatZodError } from '../util/schema.js';
import { resolveProjectPath } from '../util/paths.js';
import { readLedger, writeLedger, cascadeBlockedDependencies, getNextStep, evaluateTaskStatus, } from '../ledger.js';
import { logToolCall } from '../util/log.js';
import { globalAwakeManager } from '../awake/manager.js';
import { globalAccountManager } from '../accounts/index.js';
import { findRecentTranscript } from './tokenCounter.js';
import { calculateContextBudget, formatTokenNumber, parseTranscriptTokens, estimateTextTokens } from '../tokens/index.js';
export function handleTaskCheckpoint(rawArgs) {
    const parseResult = TaskCheckpointSchema.safeParse(rawArgs);
    if (!parseResult.success) {
        const err = formatZodError(parseResult.error);
        logToolCall('task_checkpoint', rawArgs?.step_id, 'BAD_INPUT', rawArgs?.project_path);
        return err;
    }
    const { step_id, status, note, error, add_steps, project_path } = parseResult.data;
    let validatedProject;
    try {
        validatedProject = resolveProjectPath(project_path);
    }
    catch (err) {
        logToolCall('task_checkpoint', step_id, 'BAD_PROJECT_PATH', project_path);
        return err.message;
    }
    const ledger = readLedger(validatedProject);
    if (!ledger || ledger.status !== 'active') {
        logToolCall('task_checkpoint', step_id, 'NO_ACTIVE_TASK', validatedProject);
        return 'NO_ACTIVE_TASK: No active task in .agent/ledger.json. Call task_start first.';
    }
    const step = ledger.steps.find((s) => s.id === step_id);
    if (!step) {
        logToolCall('task_checkpoint', step_id, 'UNKNOWN_STEP', validatedProject);
        return `UNKNOWN_STEP: Step ${step_id} not found in active task.`;
    }
    const now = new Date().toISOString();
    // Add new steps if requested (up to limit of 30)
    if (add_steps && add_steps.length > 0) {
        const remainingSlots = 30 - ledger.steps.length;
        if (remainingSlots > 0) {
            const toAdd = add_steps.slice(0, remainingSlots);
            let nextIdx = ledger.steps.length + 1;
            for (const s of toAdd) {
                ledger.steps.push({
                    id: `s${nextIdx++}`,
                    title: s.title,
                    status: 'pending',
                    tries: 0,
                    max_tries: step.max_tries,
                    depends_on: s.depends_on || [],
                    note: null,
                    last_error: null,
                    updated_at: now,
                });
            }
        }
    }
    let instruction = '';
    // Process status transition
    if (status === 'in_progress') {
        step.status = 'in_progress';
        step.note = note;
        step.updated_at = now;
        instruction = `Step ${step.id} in progress: ${step.title}. Continue working.`;
        logToolCall('task_checkpoint', step_id, 'OK', validatedProject);
    }
    else if (status === 'done') {
        // Enforce proof requirement (min 10 non-whitespace characters)
        if (note.trim().length < 10) {
            logToolCall('task_checkpoint', step_id, 'NEED_PROOF', validatedProject);
            return `NEED_PROOF: Provide verification proof in the note (e.g. test results, build output) at least 10 chars. Step ${step.id} remains unchanged.`;
        }
        step.status = 'done';
        step.note = note;
        step.last_error = null;
        step.updated_at = now;
        logToolCall('task_checkpoint', step_id, 'DONE', validatedProject);
    }
    else if (status === 'failed') {
        step.tries += 1;
        step.note = note;
        step.last_error = error || note;
        step.updated_at = now;
        if (step.tries < step.max_tries) {
            step.status = 'failed';
            instruction = `Step ${step.id} failed (try ${step.tries} of ${step.max_tries}). Fix the cause and retry ${step.id}. Do not start another step.`;
            logToolCall('task_checkpoint', step_id, 'FAILED_RETRY', validatedProject);
        }
        else {
            step.status = 'blocked';
            cascadeBlockedDependencies(ledger.steps);
            instruction = `Step ${step.id} is blocked after ${step.max_tries} tries. Moving to next eligible unblocked step.`;
            logToolCall('task_checkpoint', step_id, 'BLOCKED', validatedProject);
        }
    }
    // Update overall task status & next step instruction
    ledger.status = evaluateTaskStatus(ledger.steps);
    ledger.checkpoint_count += 1;
    ledger.updated_at = now;
    if (ledger.status === 'done') {
        instruction = `Task complete. All steps finished. Reply with 3 lines: what changed, what was tested, and any blocked items.`;
    }
    else if (ledger.status === 'blocked') {
        if (status === 'failed' && step.status === 'blocked') {
            instruction = `Step ${step.id} is blocked after ${step.max_tries} tries. Task blocked: No remaining runnable steps. Stop and report the blocker to the user.`;
        }
        else {
            instruction = `Task blocked: No remaining runnable steps. Stop and report the blocker to the user.`;
        }
    }
    else if (status === 'done') {
        const nextStep = getNextStep(ledger.steps);
        if (nextStep) {
            instruction = `${step.id} done. Next: ${nextStep.id}, ${nextStep.title}`;
        }
        else {
            instruction = `${step.id} done. No pending steps ready.`;
        }
    }
    // Manage keep-awake lease: release upon task completion, renew while active
    try {
        if (ledger.status === 'done') {
            globalAwakeManager.release();
        }
        else {
            globalAwakeManager.renew(30);
        }
    }
    catch { }
    writeLedger(ledger, validatedProject);
    // Check context budget headroom and append warning badge if nearing limits
    try {
        const recentTranscript = findRecentTranscript(validatedProject);
        const used = recentTranscript ? parseTranscriptTokens(recentTranscript).totalEstimatedTokens : estimateTextTokens(JSON.stringify(ledger));
        const budget = calculateContextBudget(used);
        // 1% Quota Tripwire: Seamless auto-switch
        if (budget.percentRemaining <= 1.0) {
            const rotateRes = globalAccountManager.checkAndAutoRotate(budget.percentRemaining, `Task checkpoint detected ${budget.percentRemaining}% token headroom`);
            if (rotateRes.triggered && rotateRes.switchResult?.success) {
                instruction += ` [Auto-switched account to "${rotateRes.switchResult.currentAccountName}"]`;
            }
        }
        else if (budget.status === 'WARNING' || budget.status === 'CRITICAL') {
            instruction += ` [Context: ${budget.statusEmoji} ${budget.percentUsed}% used, ${formatTokenNumber(budget.remainingTokens)} remaining]`;
        }
    }
    catch { }
    // Return instruction capped to 300 characters
    return instruction.slice(0, 300);
}
//# sourceMappingURL=taskCheckpoint.js.map