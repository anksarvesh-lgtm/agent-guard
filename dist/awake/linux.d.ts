import { ChildProcess } from 'node:child_process';
import { SleepInhibitor } from './types.js';
export declare class LinuxSleepInhibitor implements SleepInhibitor {
    isSupported(): boolean;
    start(seconds: number): {
        process: ChildProcess;
        warning?: string;
    };
    stop(proc: ChildProcess): void;
}
//# sourceMappingURL=linux.d.ts.map