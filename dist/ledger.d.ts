import { TaskLedger, Step, ActiveAgentSession, AgentDirective } from './types.js';
/**
 * Validates the basic structural shape of a TaskLedger.
 */
export declare function isValidLedger(obj: any): obj is TaskLedger;
/**
 * Reads the ledger from disk safely, restoring from ledger.prev.json if corrupt.
 */
export declare function readLedger(projectPath?: string): TaskLedger | null;
/**
 * Writes the ledger to disk atomically with file locking and backup.
 */
export declare function writeLedger(ledger: TaskLedger, projectPath?: string): void;
/**
 * Archives current active task into .agent/history/<task_id>.json
 */
export declare function archiveCurrentTask(projectPath?: string): void;
/**
 * Cascades blocked status to any pending or in_progress steps that depend on blocked steps.
 */
export declare function cascadeBlockedDependencies(steps: Step[]): boolean;
/**
 * Selects the next step to work on according to strict priority:
 * 1. Any in_progress step.
 * 2. Any failed step with tries < max_tries.
 * 3. First pending step whose dependencies are all 'done'.
 */
export declare function getNextStep(steps: Step[]): Step | null;
/**
 * Re-evaluates top-level task status based on all steps.
 */
export declare function evaluateTaskStatus(steps: Step[]): 'active' | 'done' | 'blocked';
/**
 * Record or update an active agent session in .agent/active_agents.json.
 */
export declare function recordActiveAgent(projectPath: string, agentId: string, role?: string, activeStepId?: string): void;
/**
 * Retrieve all known active agent sessions.
 */
export declare function getActiveAgents(projectPath: string): Record<string, ActiveAgentSession>;
/**
 * Dispatch an authoritative completion directive for active agents.
 */
export declare function dispatchAgentDirective(projectPath: string, directive: string, targetAgent?: string): AgentDirective;
/**
 * Retrieve currently active inter-agent directive.
 */
export declare function getActiveDirective(projectPath: string): AgentDirective | null;
//# sourceMappingURL=ledger.d.ts.map