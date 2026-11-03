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
  progress?: number; // 0.0 to 1.0
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

export function createTaskStartEvent(params: {
  sessionId: string;
  goal: string;
  totalSteps: number;
  firstStepTitle?: string;
  account?: string;
  tokens?: string;
}): IslandEventPayload {
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

export function createStepCheckpointEvent(params: {
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
}): IslandEventPayload {
  const isFinished = params.stepIndex >= params.totalSteps && params.status === 'done';
  const progress = Math.min(1.0, Math.max(0.0, params.stepIndex / params.totalSteps));

  let eventName = 'StepCheckpoint';
  let agentStatus: AgentStatusState = 'working';
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
  } else if (isFinished) {
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

export function createToolEvent(params: {
  sessionId: string;
  toolName: string;
  stage: 'pre' | 'post';
  success?: boolean;
  filePath?: string;
  additions?: number;
  deletions?: number;
  summary?: string;
}): IslandEventPayload {
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

export function createAccountSwitchEvent(params: {
  oldAccount?: string;
  newAccount: string;
  quotaPercent: number;
}): IslandEventPayload {
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

export function createKeepAwakeEvent(params: {
  enabled: boolean;
  remainingMinutes?: number;
  reason?: string;
}): IslandEventPayload {
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
