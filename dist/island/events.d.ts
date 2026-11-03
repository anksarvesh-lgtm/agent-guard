export type AgentStatusState = 'idle' | 'thinking' | 'working' | 'permissionRequested' | 'finished' | 'error';
export interface IslandNotificationConfig {
    title: string;
    subtitle?: string;
    body?: string;
    iconName?: string;
    tintColor?: string;
    dwellDuration?: number;
    kind?: 'alert' | 'notification' | 'progress';
}
export interface IslandEventPayload {
    version?: string;
    coucou_agent?: string;
    agent?: string;
    session_id?: string;
    hook_event_name?: string;
    event?: string;
    prompt?: string;
    tool_name?: string;
    tool?: string;
    file_path?: string;
    additions?: number;
    deletions?: number;
    goal?: string;
    step_id?: string;
    step_title?: string;
    step_index?: number;
    step_total?: number;
    progress?: number;
    status?: AgentStatusState;
    error?: string;
    notification?: IslandNotificationConfig;
    context?: {
        account?: string;
        keep_awake?: string;
        tokens?: string;
        [key: string]: any;
    };
    [key: string]: any;
}
export declare function createTaskStartEvent(params: {
    sessionId: string;
    goal: string;
    totalSteps: number;
    firstStepTitle?: string;
    account?: string;
    tokens?: string;
}): IslandEventPayload;
export declare function createStepCheckpointEvent(params: {
    sessionId: string;
    goal: string;
    stepId: string;
    stepTitle: string;
    stepIndex: number;
    totalSteps: number;
    status: 'done' | 'failed' | 'in_progress';
    note?: string;
    error?: string;
    account?: string;
    tokens?: string;
}): IslandEventPayload;
export declare function createToolEvent(params: {
    sessionId: string;
    toolName: string;
    stage: 'pre' | 'post';
    success?: boolean;
    filePath?: string;
    additions?: number;
    deletions?: number;
    summary?: string;
}): IslandEventPayload;
export declare function createAccountSwitchEvent(params: {
    oldAccount?: string;
    newAccount: string;
    quotaPercent: number;
}): IslandEventPayload;
export declare function createKeepAwakeEvent(params: {
    enabled: boolean;
    remainingMinutes?: number;
    reason?: string;
}): IslandEventPayload;
//# sourceMappingURL=events.d.ts.map