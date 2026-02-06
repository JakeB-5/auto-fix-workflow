/**
 * @module workflow/code-fix-strategy/__tests__/checker
 * @description Tests for verification check integration
 */

import { describe, it, expect } from 'vitest';
import {
  runVerificationChecks,
  isValidWorktreePath,
  getRecommendedChecks,
  formatCheckResult,
  canSkipChecks,
} from '../checker.js';
import type { CheckResult } from '../../../common/types/index.js';

describe('checker', () => {
  describe('runVerificationChecks', () => {
    it('should return success result with default checks', async () => {
      const result = await runVerificationChecks('/tmp/worktree-test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.passed).toBe(true);
        expect(result.data.results).toHaveLength(3);
        expect(result.data.attempt).toBe(1);
        expect(result.data.totalDurationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return success result with specific checks', async () => {
      const result = await runVerificationChecks('/tmp/worktree-test', [
        'test',
        'lint',
      ]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.results).toHaveLength(2);
        expect(result.data.results[0]?.check).toBe('test');
        expect(result.data.results[1]?.check).toBe('lint');
      }
    });

    it('should return success result with single check', async () => {
      const result = await runVerificationChecks('/tmp/worktree-test', [
        'typecheck',
      ]);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.results).toHaveLength(1);
        expect(result.data.results[0]?.check).toBe('typecheck');
        expect(result.data.results[0]?.passed).toBe(true);
        expect(result.data.results[0]?.status).toBe('passed');
      }
    });

    it('should return success result with empty checks array', async () => {
      const result = await runVerificationChecks('/tmp/worktree-test', []);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.results).toHaveLength(0);
        expect(result.data.passed).toBe(true);
      }
    });

    it('should include durationMs for each check result', async () => {
      const result = await runVerificationChecks('/tmp/worktree-test');

      expect(result.success).toBe(true);
      if (result.success) {
        for (const check of result.data.results) {
          expect(check.durationMs).toBeDefined();
          expect(typeof check.durationMs).toBe('number');
        }
      }
    });
  });

  describe('isValidWorktreePath', () => {
    it('should return true for valid paths', () => {
      expect(isValidWorktreePath('/tmp/worktree')).toBe(true);
      expect(isValidWorktreePath('/home/user/projects')).toBe(true);
      expect(isValidWorktreePath('src/code')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isValidWorktreePath('')).toBe(false);
    });

    it('should return false for paths with ..', () => {
      expect(isValidWorktreePath('/tmp/../etc/passwd')).toBe(false);
      expect(isValidWorktreePath('../../root')).toBe(false);
      expect(isValidWorktreePath('src/../../../etc')).toBe(false);
    });

    it('should return true for paths without ..', () => {
      expect(isValidWorktreePath('/tmp/safe/path')).toBe(true);
      expect(isValidWorktreePath('relative/path')).toBe(true);
    });
  });

  describe('getRecommendedChecks', () => {
    it('should always include lint', () => {
      const checks = getRecommendedChecks(['readme.md']);
      expect(checks).toContain('lint');
    });

    it('should add typecheck and test for TypeScript files', () => {
      const checks = getRecommendedChecks(['src/app.ts']);
      expect(checks).toContain('lint');
      expect(checks).toContain('typecheck');
      expect(checks).toContain('test');
    });

    it('should add typecheck and test for TSX files', () => {
      const checks = getRecommendedChecks(['src/App.tsx']);
      expect(checks).toContain('typecheck');
      expect(checks).toContain('test');
    });

    it('should add typecheck and test for JavaScript files', () => {
      const checks = getRecommendedChecks(['src/utils.js']);
      expect(checks).toContain('typecheck');
      expect(checks).toContain('test');
    });

    it('should add typecheck and test for JSX files', () => {
      const checks = getRecommendedChecks(['src/Component.jsx']);
      expect(checks).toContain('typecheck');
      expect(checks).toContain('test');
    });

    it('should add test for test files', () => {
      const checks = getRecommendedChecks(['src/app.test.ts']);
      expect(checks).toContain('test');
    });

    it('should add test for spec files', () => {
      const checks = getRecommendedChecks(['src/app.spec.tsx']);
      expect(checks).toContain('test');
    });

    it('should return only lint for non-code files', () => {
      const checks = getRecommendedChecks(['data.json', 'config.yml']);
      expect(checks).toEqual(['lint']);
    });

    it('should handle empty array', () => {
      const checks = getRecommendedChecks([]);
      expect(checks).toContain('lint');
      expect(checks).toHaveLength(1);
    });

    it('should deduplicate checks for multiple TS files', () => {
      const checks = getRecommendedChecks([
        'src/a.ts',
        'src/b.ts',
        'src/c.tsx',
      ]);
      const uniqueChecks = Array.from(new Set(checks));
      expect(checks).toHaveLength(uniqueChecks.length);
    });
  });

  describe('formatCheckResult', () => {
    it('should format passed result', () => {
      const result: CheckResult = {
        passed: true,
        results: [
          {
            check: 'test',
            passed: true,
            status: 'passed',
            durationMs: 1000,
          },
          {
            check: 'lint',
            passed: true,
            status: 'passed',
            durationMs: 500,
          },
        ],
        attempt: 1,
        totalDurationMs: 1500,
      };

      const formatted = formatCheckResult(result);
      expect(formatted).toContain('PASSED');
      expect(formatted).toContain('attempt 1');
      expect(formatted).toContain('Duration: 1500ms');
      expect(formatted).toContain('test: passed');
      expect(formatted).toContain('lint: passed');
    });

    it('should format failed result', () => {
      const result: CheckResult = {
        passed: false,
        results: [
          {
            check: 'test',
            passed: false,
            status: 'failed',
            durationMs: 2000,
            error: 'Test assertion failed',
          },
        ],
        attempt: 2,
        totalDurationMs: 2000,
      };

      const formatted = formatCheckResult(result);
      expect(formatted).toContain('FAILED');
      expect(formatted).toContain('attempt 2');
      expect(formatted).toContain('test: failed');
      expect(formatted).toContain('Error: Test assertion failed');
    });

    it('should include stderr for failed checks', () => {
      const result: CheckResult = {
        passed: false,
        results: [
          {
            check: 'typecheck',
            passed: false,
            status: 'failed',
            durationMs: 3000,
            stderr: 'TS2345: Argument of type string\nTS2322: Type number not assignable\nTS2339: Property does not exist\nFourth line truncated',
          },
        ],
        attempt: 1,
        totalDurationMs: 3000,
      };

      const formatted = formatCheckResult(result);
      expect(formatted).toContain('TS2345');
      expect(formatted).toContain('TS2322');
      expect(formatted).toContain('TS2339');
      // Only first 3 lines of stderr
      expect(formatted).not.toContain('Fourth line truncated');
    });

    it('should not include stderr for passed checks', () => {
      const result: CheckResult = {
        passed: true,
        results: [
          {
            check: 'lint',
            passed: true,
            status: 'passed',
            durationMs: 500,
            stderr: 'Some warning output',
          },
        ],
        attempt: 1,
        totalDurationMs: 500,
      };

      const formatted = formatCheckResult(result);
      expect(formatted).not.toContain('Some warning output');
    });

    it('should use checkmark for passed and x for failed', () => {
      const result: CheckResult = {
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
      };

      const formatted = formatCheckResult(result);
      // Contains both passed and failed indicators
      expect(formatted).toMatch(/[^\n]*test: passed/);
      expect(formatted).toMatch(/[^\n]*lint: failed/);
    });

    it('should handle empty results', () => {
      const result: CheckResult = {
        passed: true,
        results: [],
        attempt: 1,
        totalDurationMs: 0,
      };

      const formatted = formatCheckResult(result);
      expect(formatted).toContain('PASSED');
      expect(formatted).toContain('Duration: 0ms');
    });
  });

  describe('canSkipChecks', () => {
    it('should return true for only markdown files', () => {
      expect(canSkipChecks(['README.md', 'CHANGELOG.md'])).toBe(true);
    });

    it('should return true for only text files', () => {
      expect(canSkipChecks(['notes.txt', 'LICENSE.txt'])).toBe(true);
    });

    it('should return true for pdf files', () => {
      expect(canSkipChecks(['doc.pdf'])).toBe(true);
    });

    it('should return true for doc/docx files', () => {
      expect(canSkipChecks(['file.doc', 'file.docx'])).toBe(true);
    });

    it('should be case insensitive for extensions', () => {
      expect(canSkipChecks(['README.MD', 'notes.TXT'])).toBe(true);
    });

    it('should return false for TypeScript files', () => {
      expect(canSkipChecks(['src/app.ts'])).toBe(false);
    });

    it('should return false for mixed code and doc files', () => {
      expect(canSkipChecks(['README.md', 'src/app.ts'])).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(canSkipChecks([])).toBe(false);
    });

    it('should return false for JavaScript files', () => {
      expect(canSkipChecks(['utils.js'])).toBe(false);
    });

    it('should return false for JSON files', () => {
      expect(canSkipChecks(['package.json'])).toBe(false);
    });
  });
});
