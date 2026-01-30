/**
 * @module workflow/code-fix-strategy/__tests__/retry-strategy
 * @description Tests for retry strategy
 */

import { describe, it, expect } from 'vitest';
import {
  shouldRetry,
  generateRetryFeedback,
  getRetryDelay,
  calculateSuccessProbability,
  isImproving,
} from '../retry-strategy.js';
import type { FixAttempt, FixStrategy } from '../types.js';

describe('retry-strategy', () => {
  const mockStrategy: FixStrategy = {
    maxRetries: 3,
    forbiddenPatterns: [],
    allowedScopes: [],
  };

  describe('shouldRetry', () => {
    it('should not retry if successful', () => {
      const attempt: FixAttempt = {
        attempt: 1,
        changes: [],
        checkResult: {
          passed: true,
          results: [
            {
              check: 'test',
              passed: true,
              status: 'passed',
              durationMs: 1000,
            },
          ],
          attempt: 1,
          totalDurationMs: 1000,
        },
        success: true,
        timestamp: new Date(),
      };

      expect(shouldRetry(attempt, mockStrategy)).toBe(false);
    });

    it('should not retry if max retries exceeded', () => {
      const attempt: FixAttempt = {
        attempt: 3,
        changes: [],
        checkResult: {
          passed: false,
          results: [
            {
              check: 'test',
              passed: false,
              status: 'failed',
              durationMs: 1000,
              error: 'Test failed',
            },
          ],
          attempt: 3,
          totalDurationMs: 1000,
        },
        success: false,
        timestamp: new Date(),
      };

      expect(shouldRetry(attempt, mockStrategy)).toBe(false);
    });

    it('should retry if check failed and retries available', () => {
      const attempt: FixAttempt = {
        attempt: 1,
        changes: [],
        checkResult: {
          passed: false,
          results: [
            {
              check: 'test',
              passed: false,
              status: 'failed',
              durationMs: 1000,
              error: 'Test failed',
            },
          ],
          attempt: 1,
          totalDurationMs: 1000,
        },
        success: false,
        timestamp: new Date(),
      };

      expect(shouldRetry(attempt, mockStrategy)).toBe(true);
    });

    it('should not retry if no checks were run', () => {
      const attempt: FixAttempt = {
        attempt: 1,
        changes: [],
        checkResult: {
          passed: false,
          results: [],
          attempt: 1,
          totalDurationMs: 0,
        },
        success: false,
        timestamp: new Date(),
      };

      expect(shouldRetry(attempt, mockStrategy)).toBe(false);
    });
  });

  describe('generateRetryFeedback', () => {
    it('should generate feedback for failed attempt', () => {
      const attempt: FixAttempt = {
        attempt: 1,
        changes: [],
        checkResult: {
          passed: false,
          results: [
            {
              check: 'test',
              passed: false,
              status: 'failed',
              durationMs: 1000,
              error: 'Expected 2 to equal 3',
              stderr: 'Test suite failed',
            },
          ],
          attempt: 1,
          totalDurationMs: 1000,
        },
        success: false,
        timestamp: new Date(),
      };

      const feedback = generateRetryFeedback(attempt);
      expect(feedback).toContain('Attempt 1 failed');
      expect(feedback).toContain('test');
      expect(feedback).toContain('Expected 2 to equal 3');
      expect(feedback).toContain('Suggestions for next attempt');
    });

    it('should include stderr in feedback', () => {
      const attempt: FixAttempt = {
        attempt: 2,
        changes: [],
        checkResult: {
          passed: false,
          results: [
            {
              check: 'typecheck',
              passed: false,
              status: 'failed',
              durationMs: 2000,
              error: 'Type error',
              stderr: 'Property X does not exist on type Y',
            },
          ],
          attempt: 2,
          totalDurationMs: 2000,
        },
        success: false,
        timestamp: new Date(),
      };

      const feedback = generateRetryFeedback(attempt);
      expect(feedback).toContain('Property X does not exist on type Y');
    });
  });

  describe('getRetryDelay', () => {
    it('should use exponential backoff', () => {
      expect(getRetryDelay(1)).toBe(1000); // 1s
      expect(getRetryDelay(2)).toBe(2000); // 2s
      expect(getRetryDelay(3)).toBe(4000); // 4s
      expect(getRetryDelay(4)).toBe(8000); // 8s
    });

    it('should cap at max delay', () => {
      expect(getRetryDelay(10)).toBe(10000); // Max 10s
      expect(getRetryDelay(20)).toBe(10000); // Max 10s
    });
  });

  describe('calculateSuccessProbability', () => {
    it('should return 1.0 for first attempt', () => {
      expect(calculateSuccessProbability([])).toBe(1.0);
    });

    it('should decrease with each failure', () => {
      const attempts: FixAttempt[] = [
        {
          attempt: 1,
          changes: [],
          checkResult: {
            passed: false,
            results: [],
            attempt: 1,
            totalDurationMs: 1000,
          },
          success: false,
          timestamp: new Date(),
        },
      ];

      const prob = calculateSuccessProbability(attempts);
      expect(prob).toBeLessThan(1.0);
      expect(prob).toBeGreaterThanOrEqual(0.1);
    });

    it('should not go below minimum', () => {
      const attempts: FixAttempt[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          attempt: i + 1,
          changes: [],
          checkResult: {
            passed: false,
            results: [],
            attempt: i + 1,
            totalDurationMs: 1000,
          },
          success: false,
          timestamp: new Date(),
        }));

      const prob = calculateSuccessProbability(attempts);
      expect(prob).toBe(0.1);
    });
  });

  describe('isImproving', () => {
    it('should return true for first attempt', () => {
      const attempts: FixAttempt[] = [
        {
          attempt: 1,
          changes: [],
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: false,
                status: 'failed',
                durationMs: 1000,
              },
            ],
            attempt: 1,
            totalDurationMs: 1000,
          },
          success: false,
          timestamp: new Date(),
        },
      ];

      expect(isImproving(attempts)).toBe(true);
    });

    it('should return true when more checks pass', () => {
      const attempts: FixAttempt[] = [
        {
          attempt: 1,
          changes: [],
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: false,
                status: 'failed',
                durationMs: 1000,
              },
              {
                check: 'lint',
                passed: false,
                status: 'failed',
                durationMs: 500,
              },
            ],
            attempt: 1,
            totalDurationMs: 1500,
          },
          success: false,
          timestamp: new Date(),
        },
        {
          attempt: 2,
          changes: [],
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: false,
                status: 'failed',
                durationMs: 1000,
              },
              {
                check: 'lint',
                passed: true,
                status: 'passed',
                durationMs: 500,
              },
            ],
            attempt: 2,
            totalDurationMs: 1500,
          },
          success: false,
          timestamp: new Date(),
        },
      ];

      expect(isImproving(attempts)).toBe(true);
    });

    it('should return false when no improvement', () => {
      const attempts: FixAttempt[] = [
        {
          attempt: 1,
          changes: [],
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: true,
                status: 'passed',
                durationMs: 1000,
              },
              {
                check: 'lint',
                passed: false,
                status: 'failed',
                durationMs: 500,
              },
            ],
            attempt: 1,
            totalDurationMs: 1500,
          },
          success: false,
          timestamp: new Date(),
        },
        {
          attempt: 2,
          changes: [],
          checkResult: {
            passed: false,
            results: [
              {
                check: 'test',
                passed: false,
                status: 'failed',
                durationMs: 1000,
              },
              {
                check: 'lint',
                passed: false,
                status: 'failed',
                durationMs: 500,
              },
            ],
            attempt: 2,
            totalDurationMs: 1500,
          },
          success: false,
          timestamp: new Date(),
        },
      ];

      expect(isImproving(attempts)).toBe(false);
    });
  });
});
