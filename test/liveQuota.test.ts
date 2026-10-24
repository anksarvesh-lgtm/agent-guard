import { describe, it, expect } from 'vitest';
import {
  formatCountdown,
  processQuotaData,
  discoverLanguageServer,
  getLiveQuotaSummarySync,
  getLiveQuotaSummary,
} from '../src/tokens/liveQuota.js';

describe('Live Quota Probe & Language Server Integration', () => {
  describe('formatCountdown', () => {
    it('returns empty string for missing or invalid dates', () => {
      expect(formatCountdown(undefined)).toBe('');
      expect(formatCountdown('')).toBe('');
      expect(formatCountdown('not-a-valid-date')).toBe('');
    });

    it('returns "resetting" for timestamps in the past', () => {
      const past = new Date(Date.now() - 5000).toISOString();
      expect(formatCountdown(past)).toBe('resetting');
    });

    it('returns minutes for timestamps less than 1 hour away', () => {
      const soon = new Date(Date.now() + 25 * 60 * 1000).toISOString();
      const result = formatCountdown(soon);
      expect(result).toMatch(/^(24m|25m|26m)$/);
    });

    it('returns hours and minutes for timestamps over 1 hour away', () => {
      const future = new Date(Date.now() + (2 * 60 + 35) * 60 * 1000).toISOString();
      const result = formatCountdown(future);
      expect(result).toMatch(/^2h (34m|35m|36m)$/);
    });
  });

  describe('processQuotaData', () => {
    it('parses realistic Antigravity Language Server RPC response payload', () => {
      const mockQuota = {
        response: {
          groups: [
            {
              displayName: 'Gemini Models',
              description: 'Gemini 2.5 Flash and Pro models',
              buckets: [
                {
                  bucketId: 'gemini-5h',
                  displayName: '5h Limit',
                  window: '5h',
                  remainingFraction: 0.77,
                  resetTime: '2026-10-24T20:00:00Z',
                },
                {
                  bucketId: 'gemini-weekly',
                  displayName: 'Weekly Limit',
                  window: 'weekly',
                  remainingFraction: 0.95,
                  resetTime: '2026-10-31T00:00:00Z',
                },
              ],
            },
            {
              displayName: 'Claude and GPT models',
              description: 'Claude 3.5 Sonnet and GPT-4o models',
              buckets: [
                {
                  bucketId: 'claude-5h',
                  displayName: '5h Limit',
                  window: '5h',
                  remainingFraction: 0.42,
                  resetTime: '2026-10-24T19:00:00Z',
                },
                {
                  bucketId: 'claude-weekly',
                  displayName: 'Weekly Limit',
                  window: 'weekly',
                  remainingFraction: 0.88,
                },
              ],
            },
          ],
        },
      };

      const mockUser = {
        userStatus: {
          name: 'Developer Ankit',
          email: 'dev@example.com',
          planStatus: {
            planInfo: {
              planName: 'Pro Tier',
            },
            availablePromptCredits: 250,
            availableFlowCredits: 50,
          },
        },
      };

      const summary = processQuotaData(mockQuota, mockUser);

      expect(summary.isReachable).toBe(true);
      expect(summary.userName).toBe('Developer Ankit');
      expect(summary.userEmail).toBe('dev@example.com');
      expect(summary.planName).toBe('Pro Tier');
      expect(summary.geminiFiveHourPercent).toBe(77);
      expect(summary.geminiWeeklyPercent).toBe(95);
      expect(summary.claudeFiveHourPercent).toBe(42);
      expect(summary.claudeWeeklyPercent).toBe(88);
      // Lowest fraction across active buckets is 0.42 -> 42%
      expect(summary.lowestRemainingPercent).toBe(42);
      expect(summary.availablePromptCredits).toBe(250);
      expect(summary.availableFlowCredits).toBe(50);
      expect(summary.groups.length).toBe(2);
      expect(summary.groups[0].buckets.length).toBe(2);
    });

    it('handles empty or malformed RPC responses safely', () => {
      const summary = processQuotaData(null, null);
      expect(summary.isReachable).toBe(true);
      expect(summary.lowestRemainingPercent).toBe(100);
      expect(summary.groups).toEqual([]);
      expect(summary.planName).toBe('Pro');
    });

    it('ignores disabled buckets when calculating lowest quota', () => {
      const mockQuota = {
        response: {
          groups: [
            {
              displayName: 'Gemini Models',
              buckets: [
                {
                  bucketId: 'gemini-5h',
                  window: '5h',
                  remainingFraction: 0.05,
                  disabled: true, // Should be ignored
                },
                {
                  bucketId: 'gemini-weekly',
                  window: 'weekly',
                  remainingFraction: 0.80,
                  disabled: false,
                },
              ],
            },
          ],
        },
      };

      const summary = processQuotaData(mockQuota, null);
      expect(summary.lowestRemainingPercent).toBe(80);
    });
  });

  describe('Language Server Discovery & Live Probe', () => {
    it('discovers language server without throwing errors', () => {
      const target = discoverLanguageServer();
      if (target) {
        expect(typeof target.pid).toBe('number');
        expect(typeof target.port).toBe('number');
        expect(target.port).toBeGreaterThan(0);
        expect(typeof target.csrfToken).toBe('string');
        expect(target.csrfToken.length).toBeGreaterThan(5);
      } else {
        // If no language server is running in this environment, target should be null
        expect(target).toBeNull();
      }
    });

    it('queries live quota synchronously and returns consistent data structure', () => {
      const live = getLiveQuotaSummarySync();
      expect(live).toBeDefined();
      expect(typeof live.isReachable).toBe('boolean');
      expect(typeof live.lowestRemainingPercent).toBe('number');
      expect(Array.isArray(live.groups)).toBe(true);
      expect(live.lowestRemainingPercent).toBeGreaterThanOrEqual(0);
      expect(live.lowestRemainingPercent).toBeLessThanOrEqual(100);
    });

    it('queries live quota asynchronously and returns matching summary', async () => {
      const liveAsync = await getLiveQuotaSummary();
      expect(liveAsync).toBeDefined();
      expect(typeof liveAsync.isReachable).toBe('boolean');
      expect(typeof liveAsync.lowestRemainingPercent).toBe('number');
    });
  });
});
