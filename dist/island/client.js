import net from 'net';
import fs from 'fs';
import { detectLiquidDynamo, PRIMARY_SOCKET_PATH, FALLBACK_SOCKET_PATH, ensureWatcherEnabled, } from './detector.js';
export class IslandSocketClient {
    socket = null;
    isConnected = false;
    isConnecting = false;
    queue = [];
    maxQueueSize = 50;
    reconnectTimer = null;
    commandCallbacks = [];
    receiveBuffer = '';
    constructor() {
        this.scheduleConnect(500);
    }
    get connected() {
        return this.isConnected;
    }
    onCommand(cb) {
        this.commandCallbacks.push(cb);
        return () => {
            this.commandCallbacks = this.commandCallbacks.filter((c) => c !== cb);
        };
    }
    send(payload) {
        const line = JSON.stringify(payload) + '\n';
        if (this.isConnected && this.socket && !this.socket.destroyed) {
            try {
                return this.socket.write(line);
            }
            catch (err) {
                this.isConnected = false;
                this.enqueue(line);
                this.scheduleConnect(1500);
                return false;
            }
        }
        else {
            this.enqueue(line);
            this.ensureConnected();
            return false;
        }
    }
    enqueue(line) {
        if (this.queue.length >= this.maxQueueSize) {
            this.queue.shift(); // Evict oldest
        }
        this.queue.push(line);
    }
    flushQueue() {
        if (!this.isConnected || !this.socket || this.socket.destroyed)
            return;
        while (this.queue.length > 0) {
            const line = this.queue.shift();
            if (line) {
                try {
                    this.socket.write(line);
                }
                catch {
                    this.queue.unshift(line);
                    break;
                }
            }
        }
    }
    ensureConnected() {
        if (this.isConnected || this.isConnecting)
            return;
        this.connect();
    }
    scheduleConnect(delayMs) {
        if (this.reconnectTimer)
            return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delayMs);
    }
    resolveActiveSocketPath() {
        if (fs.existsSync(PRIMARY_SOCKET_PATH))
            return PRIMARY_SOCKET_PATH;
        if (fs.existsSync(FALLBACK_SOCKET_PATH))
            return FALLBACK_SOCKET_PATH;
        // Check if app is installed and watcher isn't enabled yet
        const detection = detectLiquidDynamo();
        if (detection.isInstalled && !detection.isWatcherEnabled) {
            ensureWatcherEnabled();
        }
        return null;
    }
    connect() {
        if (process.platform !== 'darwin')
            return;
        if (this.isConnected || this.isConnecting)
            return;
        const socketPath = this.resolveActiveSocketPath();
        if (!socketPath) {
            // Re-poll later when LiquidDynamo launches
            this.scheduleConnect(4000);
            return;
        }
        this.isConnecting = true;
        try {
            const sock = net.createConnection(socketPath);
            sock.on('connect', () => {
                this.socket = sock;
                this.isConnected = true;
                this.isConnecting = false;
                this.flushQueue();
            });
            sock.on('data', (data) => {
                this.receiveBuffer += data.toString('utf8');
                const lines = this.receiveBuffer.split('\n');
                this.receiveBuffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    try {
                        const parsed = JSON.parse(trimmed);
                        for (const cb of this.commandCallbacks) {
                            cb(parsed);
                        }
                    }
                    catch {
                        // Ignore malformed incoming JSON
                    }
                }
            });
            sock.on('error', () => {
                this.cleanupSocket();
                this.scheduleConnect(3000);
            });
            sock.on('close', () => {
                this.cleanupSocket();
                this.scheduleConnect(3000);
            });
        }
        catch {
            this.cleanupSocket();
            this.scheduleConnect(4000);
        }
    }
    cleanupSocket() {
        this.isConnected = false;
        this.isConnecting = false;
        if (this.socket) {
            try {
                this.socket.destroy();
            }
            catch {
                // ignore
            }
            this.socket = null;
        }
    }
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.cleanupSocket();
    }
}
//# sourceMappingURL=client.js.map