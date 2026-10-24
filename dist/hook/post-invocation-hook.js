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
export function runPostInvocationHook(projectDir, stdinData = '') {
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
        const ledgerPath = getLedgerPath(project);
        if (!fs.existsSync(ledgerPath)) {
            process.stdout.write(JSON.stringify({}));
            return;
        }
        let ledger;
        try {
            ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
        }
        catch {
            process.stdout.write(JSON.stringify({}));
            return;
        }
        if (ledger.status !== 'active') {
            process.stdout.write(JSON.stringify({}));
            return;
        }
        const unfinished = ledger.steps.filter((s) => s.status !== 'done' && s.status !== 'blocked');
        if (unfinished.length === 0) {
            process.stdout.write(JSON.stringify({}));
            return;
        }
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
        const hookStatePath = getHookStatePath(project);
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
        // Check if progress was made
        if (ledger.checkpoint_count > state.last_checkpoint_count) {
            state.pushes_in_a_row = 0;
        }
        // Loop breaker safety: do not force continue if agent has made 3 consecutive idle pushes
        if (state.pushes_in_a_row >= 3 || state.total_pushes >= 10) {
            process.stdout.write(JSON.stringify({}));
            return;
        }
        // Current step needing completion
        const currentStep = ledger.steps.find((s) => s.status === 'in_progress') ||
            ledger.steps.find((s) => s.status === 'failed') ||
            unfinished[0];
        const message = `[AGENT GUARD ENFORCEMENT] Task is in progress (${unfinished.length} remaining). You MUST complete step ${currentStep.id}: "${currentStep.title}". Execute instructions now and checkpoint proof via task_checkpoint.`;
        logToolCall('post_invocation_hook', currentStep.id, `FORCE_CONTINUE (unfinished=${unfinished.length})`, project);
        const payload = JSON.stringify({
            injectSteps: [
                {
                    ephemeralMessage: message
                }
            ],
            terminationBehavior: 'force_continue'
        });
        process.stdout.write(payload);
    }
    catch (err) {
        // Fail-safe: empty output allows normal flow
        process.stdout.write(JSON.stringify({}));
    }
}
if (import.meta.url === `file://${process.argv[1]}`) {
    const stdinContent = readStdinSilently();
    runPostInvocationHook(process.cwd(), stdinContent);
}
//# sourceMappingURL=post-invocation-hook.js.map