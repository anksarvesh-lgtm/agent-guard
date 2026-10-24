import fs from 'node:fs';
import { AccountSwitcherSchema, formatZodError } from '../util/schema.js';
import { resolveProjectPath } from '../util/paths.js';
import { logToolCall } from '../util/log.js';
import { globalAccountManager } from '../accounts/index.js';

export function handleAccountSwitcher(rawArgs: any): string {
  const parseResult = AccountSwitcherSchema.safeParse(rawArgs);
  if (!parseResult.success) {
    const err = formatZodError(parseResult.error);
    logToolCall('account_switcher', null, 'BAD_INPUT', rawArgs?.project_path);
    return err;
  }

  const {
    action,
    account_id,
    name,
    provider,
    token_content,
    token_source_file,
    api_key,
    threshold_percent,
    enabled,
    reason,
    project_path,
  } = parseResult.data;

  let validatedProject: string | undefined;
  if (project_path) {
    try {
      validatedProject = resolveProjectPath(project_path);
    } catch (err: any) {
      logToolCall('account_switcher', null, 'BAD_PROJECT_PATH', project_path);
      return err.message;
    }
  }

  try {
    if (action === 'status') {
      const active = globalAccountManager.getActiveAccount();
      const cfg = globalAccountManager.getConfig();
      logToolCall('account_switcher', null, 'STATUS_OK', validatedProject);

      const statusEmoji = active ? (active.remainingPercent <= cfg.thresholdPercent ? '🔴' : active.remainingPercent <= 20 ? '🟡' : '🟢') : '⚪';
      const autoRotateText = cfg.autoRotateEnabled
        ? `ENABLED (automatically switches when quota drops to <= ${cfg.thresholdPercent}%)`
        : 'DISABLED';

      const lines = [
        `## 🔄 Antigravity Account Switcher Status`,
        `• **Active Account**: ${active ? `"${active.name}" (${active.id})` : 'None'}`,
        `• **Provider**: ${active ? active.provider : 'antigravity'} (${active?.type || 'oauth_token'})`,
        `• **Estimated Quota Remaining**: ${statusEmoji} **${active?.remainingPercent ?? 100}%**`,
        `• **Account Status**: **${active?.status?.toUpperCase() || 'STANDBY'}**`,
        `• **Auto-Switch at 1%**: ${autoRotateText}`,
        `• **Pool Capacity**: ${cfg.accounts.length} registered account(s)`,
        `• **Last Rotated**: ${active?.lastRotatedAt ? new Date(active.lastRotatedAt).toLocaleString() : 'Never'}`,
      ];
      return lines.join('\n');
    }

    if (action === 'list') {
      const accounts = globalAccountManager.listAccounts();
      const cfg = globalAccountManager.getConfig();
      logToolCall('account_switcher', null, 'LIST_OK', validatedProject);

      const lines = [
        `## 👥 Registered Account Pool (${accounts.length} accounts)`,
        `*Auto-rotate threshold*: <= **${cfg.thresholdPercent}%** remaining (${cfg.autoRotateEnabled ? 'ENABLED' : 'DISABLED'})`,
        '',
        '| ID | Name | Provider | Type | Quota % | Status | Active | Last Rotated |',
        '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |',
      ];

      for (const a of accounts) {
        const activeMarker = a.id === cfg.activeAccountId ? '⭐️ **ACTIVE**' : 'Standby';
        const emoji = a.status === 'active' ? '🟢' : a.status === 'standby' ? '⚪' : a.status === 'exhausted' ? '🔴' : '🟡';
        lines.push(
          `| **${a.id}** | ${a.name} | ${a.provider} | ${a.type} | ${a.remainingPercent}% | ${emoji} ${a.status} | ${activeMarker} | ${a.lastRotatedAt ? new Date(a.lastRotatedAt).toLocaleTimeString() : 'Never'} |`
        );
      }

      return lines.join('\n');
    }

    if (action === 'switch') {
      const result = globalAccountManager.switchAccount(account_id, reason || 'Manual user request');
      logToolCall('account_switcher', null, result.success ? 'SWITCH_OK' : 'SWITCH_FAILED', validatedProject);

      if (result.success) {
        return `✅ **Account Switched Successfully**\n• Active Account: "${result.currentAccountName}" (${result.currentAccountId})\n• Previous: ${result.previousAccountId || 'None'}\n• Mode: Seamless atomic swap (zero disruption to current task execution).`;
      }
      return `❌ **Switch Failed**: ${result.message}`;
    }

    if (action === 'snapshot') {
      const snapRes = globalAccountManager.snapshotActiveSession(account_id, name);
      logToolCall('account_switcher', null, snapRes.success ? 'SNAPSHOT_OK' : 'SNAPSHOT_FAILED', validatedProject);
      if (snapRes.success && snapRes.account) {
        return `✅ **Active Session Snapshot Saved**\n• Account ID: "${snapRes.account.id}"\n• Display Name: "${snapRes.account.name}"\n• Quota Headroom: ${snapRes.account.remainingPercent}%\n• Pool Size: ${globalAccountManager.getConfig().accounts.length} account(s)`;
      }
      return `❌ **Snapshot Failed**: ${snapRes.message}`;
    }

    if (action === 'import_stock') {
      const importRes = globalAccountManager.importStockAuth({ id: account_id, name });
      logToolCall('account_switcher', null, importRes.success ? 'IMPORT_STOCK_OK' : 'IMPORT_STOCK_FAILED', validatedProject);
      if (importRes.success && importRes.account) {
        return `✅ **Stock Auth Cache Preserved**\n• Account ID: "${importRes.account.id}"\n• Display Name: "${importRes.account.name}"\n• Auth Cache Bundle: ${importRes.account.authCachePath || 'Saved'}\n• Session Ready for Instant Switch/Sign-In`;
      }
      return `❌ **Import Stock Auth Failed**: ${importRes.message}`;
    }

    if (action === 'remove') {
      if (!account_id) {
        return 'BAD_INPUT: "account_id" is required to remove an account.';
      }
      const remRes = globalAccountManager.removeAccount(account_id);
      logToolCall('account_switcher', null, remRes.success ? 'REMOVE_OK' : 'REMOVE_FAILED', validatedProject);
      return remRes.success ? `✅ ${remRes.message}` : `❌ ${remRes.message}`;
    }

    if (action === 'add') {
      if (!account_id) {
        return 'BAD_INPUT: "account_id" is required to add an account (e.g. "acc-backup-1").';
      }
      if (token_source_file && !fs.existsSync(token_source_file)) {
        return `BAD_INPUT: token_source_file not found at "${token_source_file}".`;
      }
      const addRes = globalAccountManager.addAccount({
        id: account_id,
        name: name || account_id,
        provider,
        tokenContent: token_content,
        tokenSourceFile: token_source_file,
        apiKey: api_key,
      });
      logToolCall('account_switcher', null, addRes.success ? 'ADD_OK' : 'ADD_FAILED', validatedProject);
      return addRes.success ? `✅ ${addRes.message}` : `❌ ${addRes.message}`;
    }

    if (action === 'auto_rotate') {
      // Proactively triggers auto-rotation check
      const active = globalAccountManager.getActiveAccount();
      const quota = active?.remainingPercent ?? 100;
      const res = globalAccountManager.checkAndAutoRotate(quota, reason || 'Auto-rotate check requested');
      logToolCall('account_switcher', null, res.triggered ? 'AUTO_ROTATED' : 'HEADROOM_OK', validatedProject);

      if (res.triggered && res.switchResult?.success) {
        return `🔄 **Auto-Switch Triggered at ${res.currentRemainingPercent}% remaining**\n• New Active Account: "${res.switchResult.currentAccountName}" (${res.switchResult.currentAccountId})\n• Seamless atomic credential update complete.`;
      }
      return `ℹ️ No rotation needed: current account headroom is ${res.currentRemainingPercent}% (threshold: <= ${res.thresholdPercent}%).`;
    }

    if (action === 'configure') {
      const cfg = globalAccountManager.getConfig();
      const newEnabled = enabled !== undefined ? enabled : cfg.autoRotateEnabled;
      const newThreshold = threshold_percent !== undefined ? threshold_percent : cfg.thresholdPercent;
      globalAccountManager.setAutoRotateConfig(newEnabled, newThreshold);
      logToolCall('account_switcher', null, 'CONFIG_OK', validatedProject);
      return `✅ Account switcher configured: Auto-rotate is ${newEnabled ? 'ENABLED' : 'DISABLED'} with threshold <= ${newThreshold}%.`;
    }

    if (action === 'proxy' || action === 'failover_proxy') {
      logToolCall('account_switcher', null, 'PROXY_STATUS', validatedProject);
      return [
        '# 🛡️ Antigravity Seamless HTTP 429 Failover Proxy',
        '',
        '- **Transparent In-Memory Replay**: Intercepts HTTP 429 / 403 `RESOURCE_EXHAUSTED` responses and transparently rotates to next account without dropping client connection.',
        '- **Intra-Account Model Fallback**: Degrades from primary (`claude-sonnet-4-6`, `gemini-3.1-pro`) to secondary (`gemini-3.8-flash`) before account rotation.',
        '- **Process Supervisor**: Automatically discovers Antigravity 2.0 binary and sets `HTTP_PROXY=http://127.0.0.1:8080`.',
        '',
        '### How to Launch:',
        '```bash',
        '# 1. From workspace:',
        'node ../antigravity-account-switcher/bin/cli.js launch',
        '',
        '# 2. Or open web dashboard:',
        'node ../antigravity-account-switcher/bin/cli.js web',
        '```'
      ].join('\n');
    }

    return 'BAD_INPUT: Unknown action';
  } catch (err: any) {
    logToolCall('account_switcher', null, 'ERROR', validatedProject);
    return `ERROR: ${err.message}`;
  }
}
