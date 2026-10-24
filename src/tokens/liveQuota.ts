import https from 'node:https';
import { execSync } from 'node:child_process';

export interface LiveQuotaBucket {
  bucketId: string;
  displayName: string;
  window: string;
  remainingFraction: number;
  remainingPercent: number;
  resetTime?: string;
  resetCountdown?: string;
}

export interface LiveQuotaGroup {
  displayName: string;
  description?: string;
  buckets: LiveQuotaBucket[];
}

export interface LiveQuotaSummary {
  isReachable: boolean;
  userEmail?: string;
  userName?: string;
  planName?: string;
  lowestRemainingPercent: number;
  groups: LiveQuotaGroup[];
  geminiFiveHourPercent?: number;
  geminiWeeklyPercent?: number;
  claudeFiveHourPercent?: number;
  claudeWeeklyPercent?: number;
  availablePromptCredits?: number;
  availableFlowCredits?: number;
  checkedAt: string;
  source: 'language_server' | 'fallback_cache';
}

interface LanguageServerTarget {
  pid: number;
  port: number;
  csrfToken: string;
}

let cachedSummary: LiveQuotaSummary | null = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 2500;

export function formatCountdown(dateStr?: string): string {
  if (!dateStr) return '';
  const target = new Date(dateStr).getTime();
  if (isNaN(target)) return '';
  const diffMs = target - Date.now();
  if (diffMs <= 0) return 'resetting';
  const totalMins = Math.ceil(diffMs / (60 * 1000));
  if (totalMins < 60) return `${totalMins}m`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Discovers running Antigravity Language Server processes, ports, and CSRF tokens.
 */
export function discoverLanguageServer(): LanguageServerTarget | null {
  if (process.platform === 'win32') {
    return discoverWindowsLanguageServer();
  }
  return discoverUnixLanguageServer();
}

function discoverUnixLanguageServer(): LanguageServerTarget | null {
  try {
    const psOut = execSync('ps -axo pid,command | grep -E "language_server.*--csrf_token" | grep -v grep', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const lines = psOut.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const matchPid = line.trim().match(/^(\d+)\s+(.+)$/);
      if (!matchPid) continue;

      const pid = parseInt(matchPid[1], 10);
      const cmd = matchPid[2];

      const csrfMatch = cmd.match(/--csrf_token\s+([a-f0-9-]+)/i);
      if (!csrfMatch) continue;
      const csrfToken = csrfMatch[1];

      // Check if port is specified on command line
      const portMatch = cmd.match(/--https_server_port\s+(\d+)/i);
      let port = portMatch ? parseInt(portMatch[1], 10) : 0;

      // If port is 0 or missing, query lsof for listening ports of this process
      if (!port || port === 0) {
        try {
          const lsofOut = execSync(`lsof -Pan -p ${pid} -iTCP -sTCP:LISTEN`, {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
          });
          const portMatches = Array.from(lsofOut.matchAll(/127\.0\.0\.1:(\d+)/g)).map((m) =>
            parseInt(m[1], 10)
          );
          if (portMatches.length > 0) {
            port = portMatches[0];
          }
        } catch {}
      }

      if (port > 0) {
        return { pid, port, csrfToken };
      }
    }
  } catch {}
  return null;
}

function discoverWindowsLanguageServer(): LanguageServerTarget | null {
  try {
    const wmicOut = execSync(
      'wmic process where "name like \'%language_server%\'" get ProcessId,CommandLine /format:csv',
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const lines = wmicOut.split('\n').filter((l) => l.includes('--csrf_token'));
    for (const line of lines) {
      const csrfMatch = line.match(/--csrf_token\s+([a-f0-9-]+)/i);
      const portMatch = line.match(/--https_server_port\s+(\d+)/i);
      const pidMatch = line.match(/,(\d+)\s*$/);
      if (csrfMatch && portMatch && pidMatch) {
        const port = parseInt(portMatch[1], 10);
        if (port > 0) {
          return {
            pid: parseInt(pidMatch[1], 10),
            port,
            csrfToken: csrfMatch[1],
          };
        }
      }
    }
  } catch {}
  return null;
}

/**
 * Sends a POST request to the local Antigravity Language Server HTTPS RPC endpoint.
 */
export function sendLanguageServerRpc(
  target: LanguageServerTarget,
  methodName: string,
  payload: Record<string, any> = {},
  timeoutMs: number = 3000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(payload);
    const options: https.RequestOptions = {
      hostname: '127.0.0.1',
      port: target.port,
      path: `/exa.language_server_pb.LanguageServerService/${methodName}`,
      method: 'POST',
      rejectUnauthorized: false, // Local self-signed SSL on 127.0.0.1
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Connect-Protocol-Version': '1',
        'x-codeium-csrf-token': target.csrfToken,
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
      res.on('end', () => {
        const full = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          return reject(new Error(`RPC ${methodName} returned HTTP ${res.statusCode}: ${full}`));
        }
        try {
          const parsed = JSON.parse(full);
          resolve(parsed);
        } catch {
          reject(new Error(`RPC ${methodName} returned non-JSON payload`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`RPC ${methodName} timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(bodyStr);
    req.end();
  });
}

/**
 * Sends a synchronous POST request to the local Antigravity Language Server via curl.
 */
export function sendLanguageServerRpcSync(
  target: LanguageServerTarget,
  methodName: string,
  payload: Record<string, any> = {},
  timeoutSec: number = 2
): any {
  try {
    const bodyStr = JSON.stringify(payload);
    const curlCmd = `curl -s -k --max-time ${timeoutSec} -X POST https://127.0.0.1:${target.port}/exa.language_server_pb.LanguageServerService/${methodName} ` +
      `-H "Content-Type: application/json" -H "Accept: application/json" -H "Connect-Protocol-Version: 1" ` +
      `-H "x-codeium-csrf-token: ${target.csrfToken}" -d '${bodyStr}'`;

    const out = execSync(curlCmd, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

export function processQuotaData(quotaRes: any, userRes: any): LiveQuotaSummary {
  const groups: LiveQuotaGroup[] = [];
  let lowestFraction = 1.0;
  let gemini5h: number | undefined;
  let geminiWeekly: number | undefined;
  let claude5h: number | undefined;
  let claudeWeekly: number | undefined;

  if (quotaRes && quotaRes.response && Array.isArray(quotaRes.response.groups)) {
    for (const g of quotaRes.response.groups) {
      const buckets: LiveQuotaBucket[] = [];
      const isGemini = String(g.displayName || '').toLowerCase().includes('gemini');
      const isClaude = String(g.displayName || '').toLowerCase().includes('claude');

      if (Array.isArray(g.buckets)) {
        for (const b of g.buckets) {
          const frac = typeof b.remainingFraction === 'number' ? b.remainingFraction : 1.0;
          const pct = Math.max(0, Math.min(100, Math.round(frac * 100)));
          if (!b.disabled && frac < lowestFraction) {
            lowestFraction = frac;
          }

          const win = String(b.window || '').toLowerCase();
          if (isGemini) {
            if (win === '5h') gemini5h = pct;
            else if (win === 'weekly') geminiWeekly = pct;
          } else if (isClaude) {
            if (win === '5h') claude5h = pct;
            else if (win === 'weekly') claudeWeekly = pct;
          }

          buckets.push({
            bucketId: b.bucketId || win,
            displayName: b.displayName || `${win} Limit`,
            window: b.window || '5h',
            remainingFraction: frac,
            remainingPercent: pct,
            resetTime: b.resetTime,
            resetCountdown: formatCountdown(b.resetTime),
          });
        }
      }

      groups.push({
        displayName: g.displayName || 'Quota Group',
        description: g.description,
        buckets,
      });
    }
  }

  const userStatus = userRes?.userStatus;
  const planInfo = userStatus?.planStatus?.planInfo;

  return {
    isReachable: true,
    userEmail: userStatus?.email,
    userName: userStatus?.name,
    planName: planInfo?.planName || planInfo?.teamsTier || 'Pro',
    lowestRemainingPercent: Math.max(0, Math.min(100, Math.round(lowestFraction * 100))),
    groups,
    geminiFiveHourPercent: gemini5h,
    geminiWeeklyPercent: geminiWeekly,
    claudeFiveHourPercent: claude5h,
    claudeWeeklyPercent: claudeWeekly,
    availablePromptCredits: userStatus?.planStatus?.availablePromptCredits,
    availableFlowCredits: userStatus?.planStatus?.availableFlowCredits,
    checkedAt: new Date().toISOString(),
    source: 'language_server',
  };
}

/**
 * Synchronous version of getLiveQuotaSummary using curl and internal caching.
 */
export function getLiveQuotaSummarySync(forceRefresh: boolean = false): LiveQuotaSummary {
  const now = Date.now();
  if (!forceRefresh && cachedSummary && now - lastCheckTime < CACHE_TTL_MS) {
    return cachedSummary;
  }

  const target = discoverLanguageServer();
  if (!target) {
    return {
      isReachable: false,
      lowestRemainingPercent: 100,
      groups: [],
      checkedAt: new Date().toISOString(),
      source: 'fallback_cache',
    };
  }

  try {
    const quotaRes = sendLanguageServerRpcSync(target, 'RetrieveUserQuotaSummary', {});
    const userRes = sendLanguageServerRpcSync(target, 'GetUserStatus', {});
    const summary = processQuotaData(quotaRes, userRes);
    cachedSummary = summary;
    lastCheckTime = now;
    return summary;
  } catch {
    return {
      isReachable: false,
      lowestRemainingPercent: 100,
      groups: [],
      checkedAt: new Date().toISOString(),
      source: 'fallback_cache',
    };
  }
}

/**
 * Fetches the real-time live quota summary and user status from the Antigravity Language Server.
 */
export async function getLiveQuotaSummary(forceRefresh: boolean = false): Promise<LiveQuotaSummary> {
  const now = Date.now();
  if (!forceRefresh && cachedSummary && now - lastCheckTime < CACHE_TTL_MS) {
    return cachedSummary;
  }

  const target = discoverLanguageServer();
  if (!target) {
    return {
      isReachable: false,
      lowestRemainingPercent: 100,
      groups: [],
      checkedAt: new Date().toISOString(),
      source: 'fallback_cache',
    };
  }

  try {
    // Query both RetrieveUserQuotaSummary and GetUserStatus in parallel
    const [quotaRes, userRes] = await Promise.all([
      sendLanguageServerRpc(target, 'RetrieveUserQuotaSummary', {}).catch(() => null),
      sendLanguageServerRpc(target, 'GetUserStatus', {}).catch(() => null),
    ]);

    const summary = processQuotaData(quotaRes, userRes);
    cachedSummary = summary;
    lastCheckTime = now;
    return summary;
  } catch (err) {
    return {
      isReachable: false,
      lowestRemainingPercent: 100,
      groups: [],
      checkedAt: new Date().toISOString(),
      source: 'fallback_cache',
    };
  }
}
