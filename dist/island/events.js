export function createTaskStartEvent(params) {
    return {
        version: '1.0',
        coucou_agent: 'antigravity',
        agent: 'antigravity',
        session_id: params.sessionId,
        hook_event_name: 'TaskStart',
        event: 'TaskStart',
        goal: params.goal,
        prompt: params.goal,
        step_id: 's1',
        step_index: 1,
        step_total: params.totalSteps,
        step_title: params.firstStepTitle || 'Starting task...',
        progress: 0.0,
        status: 'working',
        tool_name: 'task_start',
        tool: 'task_start',
        context: {
            account: params.account,
            tokens: params.tokens,
        },
        notification: {
            title: 'Antigravity Task Started',
            subtitle: params.goal,
            iconName: 'bolt.shield.fill',
            tintColor: 'cyan',
            dwellDuration: 4.0,
            kind: 'alert',
        },
    };
}
export function createStepCheckpointEvent(params) {
    const isFinished = params.stepIndex >= params.totalSteps && params.status === 'done';
    const progress = Math.min(1.0, Math.max(0.0, params.stepIndex / params.totalSteps));
    let eventName = 'StepCheckpoint';
    let agentStatus = 'working';
    let notifTitle = `Step ${params.stepIndex}/${params.totalSteps} Completed`;
    let notifSub = params.note || params.stepTitle;
    let tint = '#06c77a'; // Emerald
    let iconName = 'checkmark.circle.fill';
    if (params.status === 'failed') {
        eventName = 'PostToolUseFailure';
        agentStatus = 'error';
        notifTitle = `Step ${params.stepId} Failed (Retrying)`;
        notifSub = params.error || 'Check logs for details';
        tint = '#ff4d4f';
        iconName = 'exclamationmark.triangle.fill';
    }
    else if (isFinished) {
        eventName = 'Stop';
        agentStatus = 'finished';
        notifTitle = 'Antigravity Task Finished 🎉';
        notifSub = `All ${params.totalSteps} steps completed successfully`;
        tint = '#06c77a';
        iconName = 'checkmark.seal.fill';
    }
    return {
        version: '1.0',
        coucou_agent: 'antigravity',
        agent: 'antigravity',
        session_id: params.sessionId,
        hook_event_name: eventName,
        event: eventName,
        goal: params.goal,
        prompt: params.goal,
        step_id: params.stepId,
        step_title: params.stepTitle,
        step_index: params.stepIndex,
        step_total: params.totalSteps,
        progress,
        status: agentStatus,
        tool_name: 'task_checkpoint',
        tool: 'task_checkpoint',
        error: params.error,
        context: {
            account: params.account,
            tokens: params.tokens,
        },
        notification: {
            title: notifTitle,
            subtitle: notifSub,
            iconName,
            tintColor: tint,
            dwellDuration: isFinished ? 5.0 : 3.5,
            kind: isFinished ? 'alert' : 'notification',
        },
    };
}
export function createToolEvent(params) {
    const isPre = params.stage === 'pre';
    const eventName = isPre
        ? 'PreToolUse'
        : params.success !== false
            ? 'PostToolUse'
            : 'PostToolUseFailure';
    return {
        version: '1.0',
        coucou_agent: 'antigravity',
        agent: 'antigravity',
        session_id: params.sessionId,
        hook_event_name: eventName,
        event: eventName,
        tool_name: params.toolName,
        tool: params.toolName,
        file_path: params.filePath,
        additions: params.additions,
        deletions: params.deletions,
        status: 'working',
        prompt: params.summary,
    };
}
export function createAccountSwitchEvent(params) {
    return {
        version: '1.0',
        coucou_agent: 'antigravity',
        agent: 'antigravity',
        session_id: 'account_switch',
        hook_event_name: 'AccountSwitch',
        event: 'AccountSwitch',
        status: 'working',
        tool_name: 'account_switcher',
        notification: {
            title: 'Antigravity Account Rotated',
            subtitle: `Switched to ${params.newAccount} (${params.quotaPercent}% quota)`,
            iconName: 'person.crop.circle.badge.checkmark',
            tintColor: '#3b82f6', // Blue
            dwellDuration: 4.5,
            kind: 'alert',
        },
    };
}
export function createKeepAwakeEvent(params) {
    const subtitle = params.enabled
        ? params.remainingMinutes
            ? `Sleep timer active · ${params.remainingMinutes} min remaining`
            : 'Infinite keep-awake lease active'
        : 'Keep-awake lease released';
    return {
        version: '1.0',
        coucou_agent: 'antigravity',
        agent: 'antigravity',
        session_id: 'keep_awake',
        hook_event_name: 'KeepAwakeChanged',
        event: 'KeepAwakeChanged',
        status: params.enabled ? 'working' : 'idle',
        tool_name: 'keep_awake',
        notification: {
            title: params.enabled ? 'Sleep Prevention Active' : 'Sleep Prevention Disabled',
            subtitle,
            iconName: params.enabled ? 'cup.and.saucer.fill' : 'moon.zzz.fill',
            tintColor: params.enabled ? '#ff9800' : '#888888',
            dwellDuration: 3.5,
            kind: 'notification',
        },
    };
}
//# sourceMappingURL=events.js.map