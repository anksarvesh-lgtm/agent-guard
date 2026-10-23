import { TaskLedger, Step } from './types.js';
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
//# sourceMappingURL=ledger.d.ts.map