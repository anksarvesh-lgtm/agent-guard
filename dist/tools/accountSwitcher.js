import { AccountSwitcherSchema, formatZodError } from '../util/schema.js';
import { resolveProjectPath } from '../util/paths.js';
import { logToolCall } from '../util/log.js';
import { globalAccountManager } from '../accounts/index.js';
export function handleAccountSwitcher(rawArgs) {
    const parseResult = AccountSwitcherSchema.safeParse(rawArgs);
    if (!parseResult.success) {
        const err = formatZodError(parseResult.error);
        logToolCall('account_switcher', null, 'BAD_INPUT', rawArgs?.project_path);
        return err;
    }
    const { action, account_id, name, provider, token_content, token_source_file, api_key, threshold_percent, enabled, reason, project_path, } = parseResult.data;
    let validatedProject;
    if (project_path) {
        try {
            validatedProject = resolveProjectPath(project_path);
        }
        catch (err) {
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
                lines.push(`| **${a.id}** | ${a.name} | ${a.provider} | ${a.type} | ${a.remainingPercent}% | ${emoji} ${a.status} | ${activeMarker} | ${a.lastRotatedAt ? new Date(a.lastRotatedAt).toLocaleTimeString() : 'Never'} |`);
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
        if (action === 'add') {
            if (!account_id) {
                return 'BAD_INPUT: "account_id" is required to add an account (e.g. "acc-backup-1").';
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
        return 'BAD_INPUT: Unknown action';
    }
    catch (err) {
        logToolCall('account_switcher', null, 'ERROR', validatedProject);
        return `ERROR: ${err.message}`;
    }
}
//# sourceMappingURL=accountSwitcher.js.map