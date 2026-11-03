export interface RunningTask {
    id: string;
    name: string;
    type: 'packaging' | 'build' | 'test' | 'agent' | 'custom';
    status: 'running' | 'in_progress' | 'completed' | 'failed';
    current_phase?: string;
    details?: string;
    started_at: string;
    updated_at: string;
    progress_percent?: number;
    pid?: number;
    log_file?: string;
    error?: string;
}
export interface RunningTasksFile {
    version: number;
    tasks: RunningTask[];
}
export declare function getRunningTasksPath(projectPath?: string): string;
export declare function readRunningTasks(projectPath?: string): RunningTask[];
export declare function writeRunningTasks(tasks: RunningTask[], projectPath?: string): void;
export declare function registerRunningTask(taskInput: {
    name: string;
    type?: RunningTask['type'];
    current_phase?: string;
    details?: string;
    progress_percent?: number;
    pid?: number;
    log_file?: string;
}, projectPath?: string): RunningTask;
export declare function updateRunningTask(taskId: string, updates: Partial<RunningTask>, projectPath?: string): RunningTask | null;
export declare function completeRunningTask(taskId: string, result?: {
    success?: boolean;
    note?: string;
    error?: string;
}, projectPath?: string): boolean;
//# sourceMappingURL=taskRegistry.d.ts.map