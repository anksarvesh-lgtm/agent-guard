#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getLedgerPath, getHookStatePath, resolveProjectPath, } from '../util/paths.js';
import { logToolCall } from '../util/log.js';
import { findRecentTranscript } from '../tools/tokenCounter.js';
import { calculateContextBudget, parseTranscriptTokens } from '../tokens/index.js';
function readStdinSilently() {
    try {
        if (process.stdin.isTTY) {
            return '';
        }
        return fs.readFileSync(0, 'utf-8');
    }
    catch {
        return '';
    }
}
export function runStopHook(projectDir, stdinData = '') {
    try {
        const project = resolveProjectPath(projectDir || process.cwd());
        let conversationId = '';
        if (stdinData) {
            try {
                const parsed = JSON.parse(stdinData);
                conversationId = parsed.conversationId || '';
            }
            catch { }
        }
        // Debug: capture input from Antigravity to learn payload structure
        try {
            const inputLogPath = path.join(project, '.agent', 'hook-input.log');
            if (stdinData) {
                fs.appendFileSync(inputLogPath, `--- ${new Date().toISOString()} ---\n${stdinData}\n`, 'utf-8');
            }
        }
        catch { }
        // Register active agent conversation ID in .agent/active_agents.json
        if (conversationId) {
            try {
                const agentFile = path.join(project, '.agent', 'active_agents.json');
                let agents = {};
                if (fs.existsSync(agentFile)) {
                    agents = JSON.parse(fs.readFileSync(agentFile, 'utf-8'));
                }
                agents[conversationId] = {
                    last_seen: new Date().toISOString(),
                    role: 'active_worker'
                };
                fs.writeFileSync(agentFile, JSON.stringify(agents, null, 2), 'utf-8');
            }
            catch { }
        }
        const ledgerPath = getLedgerPath(project);
        if (!fs.existsSync(ledgerPath)) {
            // No ledger exists, allow stop
            return;
        }
        let ledger;
        try {
            ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
        }
        catch {
            // Corrupt ledger, allow stop
            return;
        }
        if (ledger.status !== 'active') {
            // Task not active, allow stop
            return;
        }
        // Unfinished and unblocked steps
        const unfinished = ledger.steps.filter((s) => s.status !== 'done' && s.status !== 'blocked');
        const hookStatePath = getHookStatePath(project);
        if (unfinished.length === 0) {
            // Reset state and allow stop
            try {
                const cleanState = {
                    pushes_in_a_row: 0,
                    total_pushes: 0,
                    last_checkpoint_count: ledger.checkpoint_count,
                };
                fs.writeFileSync(hookStatePath, JSON.stringify(cleanState, null, 2), 'utf-8');
            }
            catch { }
            return;
        }
        // Read current hook state
        let state = {
            pushes_in_a_row: 0,
            total_pushes: 0,
            last_checkpoint_count: 0,
        };
        if (fs.existsSync(hookStatePath)) {
            try {
                state = JSON.parse(fs.readFileSync(hookStatePath, 'utf-8'));
            }
            catch { }
        }
        // If checkpoint_count increased, agent made progress
        if (ledger.checkpoint_count > state.last_checkpoint_count) {
            state.pushes_in_a_row = 0;
        }
        // Loop breaker: max 3 pushes without progress, or 10 total pushes
        if (state.pushes_in_a_row >= 3 || state.total_pushes >= 10) {
            logToolCall('stop_hook', null, `LOOP_BREAKER_ALLOWED (idle_pushes=${state.pushes_in_a_row}, total=${state.total_pushes})`, project);
            return;
        }
        // Context budget guard: if context is >92% full, allow stop to prevent crash/truncation
        try {
            const recentTranscript = findRecentTranscript(project);
            const used = recentTranscript ? parseTranscriptTokens(recentTranscript).totalEstimatedTokens : 0;
            if (used > 0) {
                const budget = calculateContextBudget(used);
                if (budget.percentUsed >= 92) {
                    logToolCall('stop_hook', null, `CONTEXT_OVERFLOW_GUARD_ALLOWED (${budget.percentUsed}% consumed)`, project);
                    return;
                }
            }
        }
        catch { }
        // Increment push counters
        state.pushes_in_a_row += 1;
        state.total_pushes += 1;
        state.last_checkpoint_count = ledger.checkpoint_count;
        try {
            fs.writeFileSync(hookStatePath, JSON.stringify(state, null, 2), 'utf-8');
        }
        catch { }
        // Identify active or next step
        const currentStep = ledger.steps.find((s) => s.status === 'in_progress') ||
            ledger.steps.find((s) => s.status === 'failed') ||
            unfinished[0];
        // Check for pending inter-agent directive
        let directivePrefix = '';
        try {
            const directiveFile = path.join(project, '.agent', 'agent_directives.json');
            if (fs.existsSync(directiveFile)) {
                const d = JSON.parse(fs.readFileSync(directiveFile, 'utf-8'));
                if (d.active && d.directive) {
                    directivePrefix = `[SUPERVISOR DIRECTIVE: ${d.directive}] `;
                }
            }
        }
        catch { }
        const triesLeft = currentStep.max_tries - currentStep.tries;
        const reason = `${directivePrefix}[AGENT GUARD ENFORCEMENT] STOP REJECTED. Task is incomplete (${unfinished.length} remaining). You MUST complete step ${currentStep.id}: "${currentStep.title}" (${triesLeft} tries left). Execute work and report proof via task_checkpoint. Do NOT stop.`.slice(0, 350);
        logToolCall('stop_hook', currentStep.id, `PUSH_BACK (idle=${state.pushes_in_a_row}, total=${state.total_pushes})`, project);
        const payload = JSON.stringify({
            decision: 'continue',
            reason,
        });
        process.stdout.write(payload);
    }
    catch (err) {
        // Fail-safe: Any uncaught error allows agent to stop safely
    }
}
// Execute if run as CLI script
if (import.meta.url === `file://${process.argv[1]}`) {
    const stdinContent = readStdinSilently();
    runStopHook(process.cwd(), stdinContent);
}
//# sourceMappingURL=stop-hook.js.map