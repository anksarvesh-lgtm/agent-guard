import { globalIslandBridge, detectLiquidDynamo, ensureWatcherEnabled } from '../island/index.js';

export function handleIslandStatus(): string {
  const d = detectLiquidDynamo();
  const isConnected = globalIslandBridge.isConnected();

  const lines = [
    `LiquidDynamo Dynamic Island Status:`,
    `- Installed: ${d.isInstalled ? 'YES' : 'NO'}${d.appPath ? ` (${d.appPath})` : ''}`,
    `- Running: ${d.isRunning ? `YES (PID: ${d.pid})` : 'NO'}`,
    `- IPC Socket: ${d.socketPath ? d.socketPath : 'NOT ACTIVE'}`,
    `- Socket Connected: ${isConnected ? '🟢 CONNECTED' : '🟡 WAITING FOR APP'}`,
    `- Watcher Integration: ${d.isWatcherEnabled ? 'ENABLED' : 'DISABLED'}`,
  ];

  if (d.isInstalled && !d.isWatcherEnabled) {
    ensureWatcherEnabled();
    lines.push(`- Action: Automatically enabled watcher integration in defaults.`);
  }

  return lines.join('\n');
}

export function handleIslandNotify(args: {
  title: string;
  message: string;
  icon?: string;
  tint?: string;
  duration?: number;
}): string {
  const ok = globalIslandBridge.broadcastNotification({
    title: args.title,
    message: args.message,
    iconName: args.icon,
    tintColor: args.tint,
    dwellDuration: args.duration,
  });

  return ok
    ? `Notification sent to LiquidDynamo Dynamic Island: "${args.title}"`
    : `Notification queued for LiquidDynamo Dynamic Island: "${args.title}" (waiting for socket)`;
}
