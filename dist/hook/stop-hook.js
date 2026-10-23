#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getLedgerPath, getHookStatePath, resolveProjectPath, } from '../util/paths.js';
import { logToolCall } from '../util/log.js';
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
        // Debug: capture input from Antigravity to learn payload structure
        try {
            const inputLogPath = path.join(project, '.agent', 'hook-input.log');
            if (stdinData) {
                fs.appendFileSync(inputLogPath, `--- ${new Date().toISOString()} ---\n${stdinData}\n`, 'utf-8');
            }
        }
        catch { }
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
        const triesLeft = currentStep.max_tries - currentStep.tries;
        const reason = `${unfinished.length} step${unfinished.length === 1 ? '' : 's'} not finished. Current: ${currentStep.id} "${currentStep.title}" (${triesLeft} tries left). Call task_status and continue. Do not stop.`.slice(0, 290);
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