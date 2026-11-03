import { LiquidDynamoDetection } from './detector.js';
import { IslandCommandCallback } from './client.js';
import { IslandEventPayload } from './events.js';
export declare class IslandBridge {
    private client;
    constructor();
    getDetection(): LiquidDynamoDetection;
    isAvailable(): boolean;
    isConnected(): boolean;
    enableAppIntegration(): boolean;
    onCommand(cb: IslandCommandCallback): () => void;
    sendEvent(payload: IslandEventPayload | Record<string, any>): boolean;
    broadcastTaskStart(params: {
        sessionId: string;
        goal: string;
        totalSteps: number;
        firstStepTitle?: string;
        account?: string;
        tokens?: string;
    }): boolean;
    broadcastStepCheckpoint(params: {
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
    }): boolean;
    broadcastToolPre(params: {
        sessionId: string;
        toolName: string;
        filePath?: string;
        summary?: string;
    }): boolean;
    broadcastToolPost(params: {
        sessionId: string;
        toolName: string;
        success: boolean;
        filePath?: string;
        additions?: number;
        deletions?: number;
        summary?: string;
    }): boolean;
    broadcastAccountSwitch(params: {
        oldAccount?: string;
        newAccount: string;
        quotaPercent: number;
    }): boolean;
    broadcastKeepAwake(params: {
        enabled: boolean;
        remainingMinutes?: number;
        reason?: string;
    }): boolean;
    broadcastNotification(params: {
        title: string;
        message: string;
        iconName?: string;
        tintColor?: string;
        dwellDuration?: number;
    }): boolean;
}
export declare const globalIslandBridge: IslandBridge;
export * from './detector.js';
export * from './events.js';
export * from './client.js';
//# sourceMappingURL=index.d.ts.map