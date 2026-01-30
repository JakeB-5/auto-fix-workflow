/**
 * @module workflow/code-fix-strategy/__tests__/orchestrator
 * @description Tests for fix strategy orchestrator
 */

import { describe, it, expect, vi } from 'vitest';
import { getFixStatus } from '../orchestrator.js';
import type { FixAttempt } from '../types.js';

describe('orchestrator', () => {
  describe('getFixStatus', () => {
    it('should return initial status for no attempts', () => {
      const status = getFixStatus([], 3);

      expect(status).toEqual({
        currentAttempt: 0,
        maxAttempts: 3,
        attempts: [],
        complete: false,
        success: false,
      });
    });

    it('should return status for successful attempt', () => {
      const attempts: FixAttempt[] = [
        {
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
        },
      ];

      const status = getFixStatus(attempts, 3);

      expect(status).toEqual({
        currentAttempt: 1,
        maxAttempts: 3,
        attempts,
        complete: true,
        success: true,
      });
    });

    it('should return status for failed attempts', () => {
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
                error: 'Test failed',
              },
            ],
            attempt: 1,
            totalDurationMs: 1000,
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
                error: 'Test failed',
              },
            ],
            attempt: 2,
            totalDurationMs: 1000,
          },
          success: false,
          timestamp: new Date(),
        },
      ];

      const status = getFixStatus(attempts, 3);

      expect(status).toEqual({
        currentAttempt: 2,
        maxAttempts: 3,
        attempts,
        complete: false,
        success: false,
      });
    });

    it('should mark complete when max retries reached', () => {
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
        {
          attempt: 2,
          changes: [],
          checkResult: {
            passed: false,
            results: [],
            attempt: 2,
            totalDurationMs: 1000,
          },
          success: false,
          timestamp: new Date(),
        },
        {
          attempt: 3,
          changes: [],
          checkResult: {
            passed: false,
            results: [],
            attempt: 3,
            totalDurationMs: 1000,
          },
          success: false,
          timestamp: new Date(),
        },
      ];

      const status = getFixStatus(attempts, 3);

      expect(status.complete).toBe(true);
      expect(status.success).toBe(false);
      expect(status.currentAttempt).toBe(3);
    });

    it('should handle in-progress attempts', () => {
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
                error: 'Lint error',
              },
            ],
            attempt: 1,
            totalDurationMs: 1500,
          },
          success: false,
          timestamp: new Date(),
        },
      ];

      const status = getFixStatus(attempts, 3);

      expect(status.complete).toBe(false);
      expect(status.success).toBe(false);
      expect(status.currentAttempt).toBe(1);
      expect(status.maxAttempts).toBe(3);
    });
  });
});
