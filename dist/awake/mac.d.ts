import { ChildProcess } from 'node:child_process';
import { SleepInhibitor } from './types.js';
export declare class MacSleepInhibitor implements SleepInhibitor {
    isSupported(): boolean;
    start(seconds: number): {
        process: ChildProcess;
        warning?: string;
    };
    stop(proc: ChildProcess): void;
}
//# sourceMappingURL=mac.d.ts.map