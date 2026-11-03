import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  getAntigravityNativeCredentials,
  isTokenExpired,
  decodeJwtPayload,
  generateOAuthEnrollmentUrl,
  ensureAccountTokenFreshSync,
  startOAuthEnrollmentServer,
} from '../src/accounts/tokenRefresh.js';
import { AccountManager, setGlobalAccountManager } from '../src/accounts/manager.js';
import { handleAccountSwitcher } from '../src/tools/accountSwitcher.js';

describe('Antigravity Zero-Reauth Token Refresh Engine', () => {
  let tempDir: string;
  let manager: AccountManager;
  const originalEnvHome = process.env.AGENT_GUARD_HOME;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-guard-refresh-test-'));
    process.env.AGENT_GUARD_HOME = tempDir;

    // Create a mock active session in tempDir
    const geminiDir = path.join(tempDir, '.gemini');
    fs.mkdirSync(geminiDir, { recursive: true });
    const freshExpiry = new Date(Date.now() + 50 * 60 * 1000).toISOString();
    fs.writeFileSync(
      path.join(geminiDir, 'jetski-standalone-oauth-token'),
      JSON.stringify({
        token: 'ya29.test-primary-token',
        refresh_token: '1//test-primary-refresh',
        expiry: freshExpiry,
      }),
      'utf-8'
    );

    manager = new AccountManager(tempDir);
    setGlobalAccountManager(manager);
  });

  afterEach(() => {
    if (originalEnvHome !== undefined) {
      process.env.AGENT_GUARD_HOME = originalEnvHome;
    } else {
      delete process.env.AGENT_GUARD_HOME;
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('getAntigravityNativeCredentials', () => {
    it('de-obfuscates native Google OAuth credentials accurately at runtime', () => {
      const creds = getAntigravityNativeCredentials();
      expect(creds.clientId).toMatch(/^1071006060591-[\w-]+\.apps\.googleusercontent\.com$/);
      expect(creds.clientSecret).toMatch(/^GOCSPX-[\w-]+$/);
    });
  });

  describe('isTokenExpired', () => {
    it('returns true for null, undefined, or empty objects', () => {
      expect(isTokenExpired(null)).toBe(true);
      expect(isTokenExpired(undefined)).toBe(true);
      expect(isTokenExpired({})).toBe(true);
    });

    it('returns true when expiry date is in the past', () => {
      const past = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      expect(isTokenExpired({ expiry: past })).toBe(true);
      expect(isTokenExpired({ token: { expiry: past } })).toBe(true);
    });

    it('returns true when expiry date is within buffer window (default 5m)', () => {
      const nearFuture = new Date(Date.now() + 3 * 60 * 1000).toISOString();
      expect(isTokenExpired({ expiry: nearFuture }, 5)).toBe(true);
      // With smaller buffer (e.g. 2m), 3m should still be valid
      expect(isTokenExpired({ expiry: nearFuture }, 2)).toBe(false);
    });

    it('returns false when token is fresh (> buffer window)', () => {
      const future = new Date(Date.now() + 45 * 60 * 1000).toISOString();
      expect(isTokenExpired({ expiry: future })).toBe(false);
      expect(isTokenExpired({ token: { expiry: future } })).toBe(false);
    });

    it('supports expires_in seconds calculation fallback', () => {
      expect(isTokenExpired({ expires_in: 120 }, 5)).toBe(true); // 2m < 5m buffer
      expect(isTokenExpired({ expires_in: 3600 }, 5)).toBe(false); // 60m > 5m buffer
    });
  });

  describe('decodeJwtPayload', () => {
    it('extracts claims correctly from a standard JWT token', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          email: 'developer@example.com',
          name: 'Lead Developer',
          sub: '10987654321',
        })
      ).toString('base64url');
      const signature = 'mock_signature';
      const jwt = `${header}.${payload}.${signature}`;

      const decoded = decodeJwtPayload(jwt);
      expect(decoded).not.toBeNull();
      expect(decoded?.email).toBe('developer@example.com');
      expect(decoded?.name).toBe('Lead Developer');
      expect(decoded?.sub).toBe('10987654321');
    });

    it('returns null on invalid or malformed tokens', () => {
      expect(decodeJwtPayload('not-a-jwt')).toBeNull();
      expect(decodeJwtPayload('header.invalid-base64-json.sig')).toBeNull();
      expect(decodeJwtPayload('')).toBeNull();
    });
  });

  describe('generateOAuthEnrollmentUrl', () => {
    it('constructs authorization URL with loopback redirect, scopes, and offline prompt', () => {
      const urlString = generateOAuthEnrollmentUrl(52132, 'test-csrf-state');
      const url = new URL(urlString);

      expect(url.origin).toBe('https://accounts.google.com');
      expect(url.pathname).toBe('/o/oauth2/v2/auth');
      expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:52132/oauth/callback');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('prompt')).toContain('select_account');
      expect(url.searchParams.get('state')).toBe('test-csrf-state');
      expect(url.searchParams.get('scope')).toContain('email');
    });
  });

  describe('ensureAccountTokenFreshSync', () => {
    it('returns refreshed: false without file rewrite when token is still fresh', () => {
      const tokenPath = path.join(tempDir, '.gemini', 'jetski-standalone-oauth-token');
      const result = ensureAccountTokenFreshSync(tokenPath, 5);

      expect(result.refreshed).toBe(false);
      expect(result.tokenData.token).toBe('ya29.test-primary-token');
    });
  });

  describe('startOAuthEnrollmentServer', () => {
    it('binds loopback HTTP server and cleans up on cancel', async () => {
      const { authUrl, cancel } = startOAuthEnrollmentServer(52188, 5000);
      expect(authUrl).toContain('127.0.0.1%3A52188');
      expect(authUrl).toContain('accounts.google.com');

      // Cancel closes server cleanly
      cancel();
    });
  });

  describe('handleAccountSwitcher refresh & enrol MCP actions', () => {
    it('handles refresh action on active fresh account', () => {
      const output = handleAccountSwitcher({ action: 'refresh' });
      expect(output).toContain('Token is Already Fresh');
      expect(output).toContain('primary');
    });

    it('handles enrol action returning enrollment URL and instructions', () => {
      const output = handleAccountSwitcher({ action: 'enrol' });
      expect(output).toContain('Antigravity Standby Account Enrolment');
      expect(output).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(output).toContain('127.0.0.1:52132/oauth/callback');
    });
  });
});
