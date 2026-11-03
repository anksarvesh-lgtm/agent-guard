import { detectLiquidDynamo, LiquidDynamoDetection, ensureWatcherEnabled } from './detector.js';
import { IslandSocketClient, IslandCommandCallback } from './client.js';
import {
  IslandEventPayload,
  createTaskStartEvent,
  createStepCheckpointEvent,
  createToolEvent,
  createAccountSwitchEvent,
  createKeepAwakeEvent,
} from './events.js';

export class IslandBridge {
  private client: IslandSocketClient;

  constructor() {
    this.client = new IslandSocketClient();
  }

  public getDetection(): LiquidDynamoDetection {
    return detectLiquidDynamo();
  }

  public isAvailable(): boolean {
    const d = this.getDetection();
    return d.isInstalled && (d.isRunning || d.socketPath !== null);
  }

  public isConnected(): boolean {
    return this.client.connected;
  }

  public enableAppIntegration(): boolean {
    return ensureWatcherEnabled();
  }

  public onCommand(cb: IslandCommandCallback): () => void {
    return this.client.onCommand(cb);
  }

  public sendEvent(payload: IslandEventPayload | Record<string, any>): boolean {
    return this.client.send(payload);
  }

  public broadcastTaskStart(params: {
    sessionId: string;
    goal: string;
    totalSteps: number;
    firstStepTitle?: string;
    account?: string;
    tokens?: string;
  }): boolean {
    const evt = createTaskStartEvent(params);
    return this.client.send(evt);
  }

  public broadcastStepCheckpoint(params: {
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
  }): boolean {
    const evt = createStepCheckpointEvent(params);
    return this.client.send(evt);
  }

  public broadcastToolPre(params: {
    sessionId: string;
    toolName: string;
    filePath?: string;
    summary?: string;
  }): boolean {
    const evt = createToolEvent({
      sessionId: params.sessionId,
      toolName: params.toolName,
      stage: 'pre',
      filePath: params.filePath,
      summary: params.summary,
    });
    return this.client.send(evt);
  }

  public broadcastToolPost(params: {
    sessionId: string;
    toolName: string;
    success: boolean;
    filePath?: string;
    additions?: number;
    deletions?: number;
    summary?: string;
  }): boolean {
    const evt = createToolEvent({
      sessionId: params.sessionId,
      toolName: params.toolName,
      stage: 'post',
      success: params.success,
      filePath: params.filePath,
      additions: params.additions,
      deletions: params.deletions,
      summary: params.summary,
    });
    return this.client.send(evt);
  }

  public broadcastAccountSwitch(params: {
    oldAccount?: string;
    newAccount: string;
    quotaPercent: number;
  }): boolean {
    const evt = createAccountSwitchEvent(params);
    return this.client.send(evt);
  }

  public broadcastKeepAwake(params: {
    enabled: boolean;
    remainingMinutes?: number;
    reason?: string;
  }): boolean {
    const evt = createKeepAwakeEvent(params);
    return this.client.send(evt);
  }

  public broadcastNotification(params: {
    title: string;
    message: string;
    iconName?: string;
    tintColor?: string;
    dwellDuration?: number;
  }): boolean {
    const evt: IslandEventPayload = {
      version: '1.0',
      coucou_agent: 'antigravity',
      agent: 'antigravity',
      session_id: 'notification',
      hook_event_name: 'Notification',
      event: 'Notification',
      prompt: params.message,
      notification: {
        title: params.title,
        subtitle: params.message,
        iconName: params.iconName || 'bell.fill',
        tintColor: params.tintColor || '#38bdf8',
        dwellDuration: params.dwellDuration || 4.0,
        kind: 'alert',
      },
    };
    return this.client.send(evt);
  }
}

export const globalIslandBridge = new IslandBridge();
export * from './detector.js';
export * from './events.js';
export * from './client.js';
