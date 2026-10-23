import { SleepInhibitor, LeaseStatus } from './types.js';
export declare class AwakeManager {
    private inhibitor;
    private currentProcess;
    private leaseEndTime;
    private taskStartTime;
    private ticker;
    private warning;
    constructor(customInhibitor?: SleepInhibitor);
    private registerExitHandlers;
    private startTicker;
    private stopTicker;
    hold(requestedMinutes: number, reason?: string): LeaseStatus;
    renew(minutes?: number): LeaseStatus;
    release(): LeaseStatus;
    resetTaskCap(): void;
    status(): LeaseStatus;
}
export declare const globalAwakeManager: AwakeManager;
//# sourceMappingURL=manager.d.ts.map