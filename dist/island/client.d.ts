import { IslandEventPayload } from './events.js';
export type IslandCommandCallback = (command: {
    action?: string;
    decision?: string;
    session_id?: string;
    [key: string]: any;
}) => void;
export declare class IslandSocketClient {
    private socket;
    private isConnected;
    private isConnecting;
    private queue;
    private readonly maxQueueSize;
    private reconnectTimer;
    private commandCallbacks;
    private receiveBuffer;
    constructor();
    get connected(): boolean;
    onCommand(cb: IslandCommandCallback): () => void;
    send(payload: IslandEventPayload | Record<string, any>): boolean;
    private enqueue;
    private flushQueue;
    ensureConnected(): void;
    private scheduleConnect;
    private resolveActiveSocketPath;
    private connect;
    private cleanupSocket;
    disconnect(): void;
}
//# sourceMappingURL=client.d.ts.map