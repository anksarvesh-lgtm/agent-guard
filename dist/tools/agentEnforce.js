import { resolveProjectPath, getLedgerPath } from '../util/paths.js';
import { readLedger, getNextStep, getActiveAgents, dispatchAgentDirective, getActiveDirective } from '../ledger.js';
import { logToolCall } from '../util/log.js';
import { globalAwakeManager } from '../awake/manager.js';
import fs from 'node:fs';
export function handleAgentEnforce(params) {
    const project = resolveProjectPath(params.project_path);
    const ledgerPath = getLedgerPath(project);
    if (!fs.existsSync(ledgerPath)) {
        return 'No active task found in .agent/ledger.json. Call task_start to begin.';
    }
    const ledger = readLedger(project);
    if (!ledger) {
        return 'Corrupted or unreadable ledger in .agent/ledger.json.';
    }
    if (ledger.status !== 'active') {
        return `Task ${ledger.task_id} is ${ledger.status.toUpperCase()}. No active enforcement required.`;
    }
    const unfinished = ledger.steps.filter((s) => s.status !== 'done' && s.status !== 'blocked');
    const nextStep = getNextStep(ledger.steps);
    const activeAgents = getActiveAgents(project);
    const agentList = Object.entries(activeAgents);
    if (params.action === 'status') {
        const lines = [
            `Active Agents: ${agentList.length > 0 ? agentList.map(([id, a]) => `${id.slice(0, 8)} (${a.role})`).join(', ') : 'Primary Agent'}`,
            `Task Status: ${unfinished.length} unfinished step(s)`,
        ];
        if (nextStep) {
            lines.push(`Next Target: [${nextStep.id}] "${nextStep.title}" (${nextStep.status})`);
        }
        const currentDirective = getActiveDirective(project);
        if (currentDirective) {
            lines.push(`Active Directive: "${currentDirective.directive}"`);
        }
        return lines.join('\n');
    }
    if (params.action === 'broadcast') {
        const directiveText = params.directive || (nextStep ? `Complete step ${nextStep.id}: "${nextStep.title}"` : 'Complete remaining tasks');
        const directive = dispatchAgentDirective(project, directiveText, params.target_agent || 'all');
        logToolCall('agent_enforce', null, `BROADCAST: ${directive.directive}`, project);
        return `DIRECTIVE BROADCAST to active agents (${agentList.length || 1} agents): "${directive.directive}". Injected into Stop & PostInvocation hooks.`;
    }
    // Action: force_next
    if (!nextStep) {
        return 'No unblocked steps available to enforce.';
    }
    // Extend keep awake lease to ensure agent has time to complete
    try {
        globalAwakeManager.hold(30, `Forcing completion of ${nextStep.id}`);
    }
    catch { }
    const orderText = params.directive || `Execute step ${nextStep.id} ("${nextStep.title}"), verify tests, and report proof via task_checkpoint.`;
    dispatchAgentDirective(project, orderText, params.target_agent || 'all');
    logToolCall('agent_enforce', nextStep.id, `FORCE_NEXT: ${nextStep.id}`, project);
    return [
        `🚨 ENFORCEMENT ORDER DISPATCHED TO ACTIVE AGENTS:`,
        `- Target Step: [${nextStep.id}] "${nextStep.title}"`,
        `- Directive: ${orderText}`,
        `- Unfinished: ${unfinished.length} step(s) remaining`,
        `Stop hooks and PostInvocation hooks are active to prevent premature halting.`
    ].join('\n');
}
//# sourceMappingURL=agentEnforce.js.map