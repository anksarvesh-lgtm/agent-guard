import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

export interface StateDbCredentials {
  oauthToken?: string;
  userStatus?: string;
  profileUrl?: string;
}

export function getStateDbPath(customHome?: string): string | null {
  const home = customHome || process.env.AGENT_GUARD_HOME || os.homedir();

  const candidates: string[] = [];

  if (process.platform === 'darwin') {
    candidates.push(
      path.join(home, 'Library', 'Application Support', 'Antigravity IDE', 'User', 'globalStorage', 'state.vscdb'),
      path.join(home, 'Library', 'Application Support', 'Antigravity', 'User', 'globalStorage', 'state.vscdb')
    );
  } else if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    candidates.push(
      path.join(appData, 'Antigravity IDE', 'User', 'globalStorage', 'state.vscdb'),
      path.join(appData, 'Antigravity', 'User', 'globalStorage', 'state.vscdb')
    );
  } else {
    candidates.push(
      path.join(home, '.config', 'Antigravity IDE', 'User', 'globalStorage', 'state.vscdb'),
      path.join(home, '.config', 'Antigravity', 'User', 'globalStorage', 'state.vscdb')
    );
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }

  return candidates[0] || null;
}

/**
 * Reads Antigravity IDE credential entries from state.vscdb.
 */
export function readStateDbCredentials(dbPath: string): StateDbCredentials {
  if (!fs.existsSync(dbPath)) return {};

  try {
    const pythonScript = `
import sqlite3, json, sys
try:
    conn = sqlite3.connect(sys.argv[1])
    cur = conn.cursor()
    cur.execute("SELECT key, value FROM ItemTable WHERE key IN ('antigravityUnifiedStateSync.oauthToken', 'antigravityUnifiedStateSync.userStatus', 'antigravity.profileUrl')")
    rows = dict(cur.fetchall())
    conn.close()
    print(json.dumps({
        'oauthToken': rows.get('antigravityUnifiedStateSync.oauthToken'),
        'userStatus': rows.get('antigravityUnifiedStateSync.userStatus'),
        'profileUrl': rows.get('antigravity.profileUrl')
    }))
except Exception as e:
    sys.exit(1)
`;

    const out = execSync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}" "${dbPath}"`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(out.trim());
  } catch {
    // Fallback: try sqlite3 CLI
    try {
      const oauthToken = execSync(
        `sqlite3 "${dbPath}" "SELECT value FROM ItemTable WHERE key = 'antigravityUnifiedStateSync.oauthToken';"`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      const userStatus = execSync(
        `sqlite3 "${dbPath}" "SELECT value FROM ItemTable WHERE key = 'antigravityUnifiedStateSync.userStatus';"`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      return {
        oauthToken: oauthToken || undefined,
        userStatus: userStatus || undefined,
      };
    } catch {
      return {};
    }
  }
}

/**
 * Writes Antigravity IDE credential entries into state.vscdb atomically.
 */
export function writeStateDbCredentials(dbPath: string, creds: StateDbCredentials): boolean {
  if (!fs.existsSync(dbPath)) return false;

  try {
    const pythonScript = `
import sqlite3, json, sys
try:
    conn = sqlite3.connect(sys.argv[1])
    cur = conn.cursor()
    creds = json.loads(sys.argv[2])
    if creds.get('oauthToken'):
        cur.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('antigravityUnifiedStateSync.oauthToken', ?)", (creds['oauthToken'],))
    if creds.get('userStatus'):
        cur.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('antigravityUnifiedStateSync.userStatus', ?)", (creds['userStatus'],))
    if creds.get('profileUrl'):
        cur.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('antigravity.profileUrl', ?)", (creds['profileUrl'],))
    conn.commit()
    conn.close()
    print("OK")
except Exception as e:
    sys.exit(1)
`;

    const payload = JSON.stringify(creds);
    const out = execSync(`python3 -c "${pythonScript.replace(/"/g, '\\"')}" "${dbPath}" '${payload}'`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() === 'OK';
  } catch {
    // Fallback: sqlite3 CLI
    try {
      if (creds.oauthToken) {
        const escaped = creds.oauthToken.replace(/'/g, "''");
        execSync(
          `sqlite3 "${dbPath}" "INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('antigravityUnifiedStateSync.oauthToken', '${escaped}');"`,
          { stdio: 'ignore' }
        );
      }
      if (creds.userStatus) {
        const escaped = creds.userStatus.replace(/'/g, "''");
        execSync(
          `sqlite3 "${dbPath}" "INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('antigravityUnifiedStateSync.userStatus', '${escaped}');"`,
          { stdio: 'ignore' }
        );
      }
      return true;
    } catch {
      return false;
    }
  }
}
