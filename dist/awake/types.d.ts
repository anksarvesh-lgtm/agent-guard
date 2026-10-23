import { ChildProcess } from 'node:child_process';
export interface SleepInhibitor {
    start(seconds: number): {
        process: ChildProcess;
        warning?: string;
    };
    stop(proc: ChildProcess): void;
    isSupported(): boolean;
}
export interface LeaseStatus {
    isHolding: boolean;
    heldUntil: string | null;
    minutesRemaining: number;
    totalTaskHeldMinutes: number;
    warning?: string;
}
//# sourceMappingURL=types.d.ts.map