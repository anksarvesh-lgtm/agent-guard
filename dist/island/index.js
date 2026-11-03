import { detectLiquidDynamo, ensureWatcherEnabled } from './detector.js';
import { IslandSocketClient } from './client.js';
import { createTaskStartEvent, createStepCheckpointEvent, createToolEvent, createAccountSwitchEvent, createKeepAwakeEvent, } from './events.js';
export class IslandBridge {
    client;
    constructor() {
        this.client = new IslandSocketClient();
    }
    getDetection() {
        return detectLiquidDynamo();
    }
    isAvailable() {
        const d = this.getDetection();
        return d.isInstalled && (d.isRunning || d.socketPath !== null);
    }
    isConnected() {
        return this.client.connected;
    }
    enableAppIntegration() {
        return ensureWatcherEnabled();
    }
    onCommand(cb) {
        return this.client.onCommand(cb);
    }
    sendEvent(payload) {
        return this.client.send(payload);
    }
    broadcastTaskStart(params) {
        const evt = createTaskStartEvent(params);
        return this.client.send(evt);
    }
    broadcastStepCheckpoint(params) {
        const evt = createStepCheckpointEvent(params);
        return this.client.send(evt);
    }
    broadcastToolPre(params) {
        const evt = createToolEvent({
            sessionId: params.sessionId,
            toolName: params.toolName,
            stage: 'pre',
            filePath: params.filePath,
            summary: params.summary,
        });
        return this.client.send(evt);
    }
    broadcastToolPost(params) {
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
    broadcastAccountSwitch(params) {
        const evt = createAccountSwitchEvent(params);
        return this.client.send(evt);
    }
    broadcastKeepAwake(params) {
        const evt = createKeepAwakeEvent(params);
        return this.client.send(evt);
    }
    broadcastNotification(params) {
        const evt = {
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
//# sourceMappingURL=index.js.map