/**
 * @module workflow/code-fix-strategy/__tests__/forbidden-patterns
 * @description Tests for forbidden pattern detection
 */

import { describe, it, expect } from 'vitest';
import {
  detectForbiddenPatterns,
  hasForbiddenPatterns,
  formatForbiddenPatterns,
} from '../forbidden-patterns.js';
import type { FileChange } from '../types.js';

describe('forbidden-patterns', () => {
  describe('detectForbiddenPatterns', () => {
    it('should detect dangerous shell commands', () => {
      const changes: FileChange[] = [
        {
          path: 'src/cleanup.ts',
          type: 'modified',
          additions: 1,
          deletions: 0,
          content: 'exec("rm -rf /tmp/*");',
        },
      ];

      const matches = detectForbiddenPatterns(changes);
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('rm -rf');
      expect(matches[0].filePath).toBe('src/cleanup.ts');
    });

    it('should detect dangerous SQL operations', () => {
      const changes: FileChange[] = [
        {
          path: 'src/database.ts',
          type: 'modified',
          additions: 1,
          deletions: 0,
          content: 'await db.query("DROP TABLE users");',
        },
      ];

      const matches = detectForbiddenPatterns(changes);
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('DROP TABLE');
    });

    it('should detect credential patterns', () => {
      const changes: FileChange[] = [
        {
          path: 'src/config.ts',
          type: 'modified',
          additions: 1,
          deletions: 0,
          content: 'const password = "secret123";',
        },
      ];

      const matches = detectForbiddenPatterns(changes);
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toMatch(/password/i);
    });

    it('should detect debugger statements', () => {
      const changes: FileChange[] = [
        {
          path: 'src/utils.ts',
          type: 'modified',
          additions: 1,
          deletions: 0,
          content: 'debugger;',
        },
      ];

      const matches = detectForbiddenPatterns(changes);
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('debugger;');
    });

    it('should skip deleted files', () => {
      const changes: FileChange[] = [
        {
          path: 'src/old.ts',
          type: 'deleted',
          additions: 0,
          deletions: 10,
        },
      ];

      const matches = detectForbiddenPatterns(changes);
      expect(matches).toHaveLength(0);
    });

    it('should detect multiple patterns in one file', () => {
      const changes: FileChange[] = [
        {
          path: 'src/bad.ts',
          type: 'modified',
          additions: 3,
          deletions: 0,
          content: `
            debugger;
            const password = "secret";
            exec("rm -rf /");
          `,
        },
      ];

      const matches = detectForbiddenPatterns(changes);
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it('should support custom patterns', () => {
      const changes: FileChange[] = [
        {
          path: 'src/custom.ts',
          type: 'modified',
          additions: 1,
          deletions: 0,
          content: 'TODO: fix this later',
        },
      ];

      const customPatterns = ['TODO:'];
      const matches = detectForbiddenPatterns(changes, customPatterns);
      expect(matches).toHaveLength(1);
      expect(matches[0].pattern).toBe('TODO:');
    });

    it('should return empty array for clean changes', () => {
      const changes: FileChange[] = [
        {
          path: 'src/safe.ts',
          type: 'modified',
          additions: 5,
          deletions: 2,
          content: 'export function add(a: number, b: number) { return a + b; }',
        },
      ];

      const matches = detectForbiddenPatterns(changes);
      expect(matches).toHaveLength(0);
    });
  });

  describe('hasForbiddenPatterns', () => {
    it('should return true when patterns exist', () => {
      const changes: FileChange[] = [
        {
          path: 'src/bad.ts',
          type: 'modified',
          additions: 1,
          deletions: 0,
          content: 'debugger;',
        },
      ];

      expect(hasForbiddenPatterns(changes)).toBe(true);
    });

    it('should return false when no patterns exist', () => {
      const changes: FileChange[] = [
        {
          path: 'src/good.ts',
          type: 'modified',
          additions: 1,
          deletions: 0,
          content: 'console.log("Hello");',
        },
      ];

      expect(hasForbiddenPatterns(changes)).toBe(false);
    });
  });

  describe('formatForbiddenPatterns', () => {
    it('should format empty matches', () => {
      const formatted = formatForbiddenPatterns([]);
      expect(formatted).toBe('No forbidden patterns detected.');
    });

    it('should format single match', () => {
      const matches = [
        {
          pattern: 'debugger;',
          filePath: 'src/test.ts',
          lineNumber: 10,
          content: 'debugger;',
        },
      ];

      const formatted = formatForbiddenPatterns(matches);
      expect(formatted).toContain('Found 1 forbidden pattern');
      expect(formatted).toContain('src/test.ts:10');
      expect(formatted).toContain('debugger;');
    });

    it('should format multiple matches', () => {
      const matches = [
        {
          pattern: 'debugger;',
          filePath: 'src/a.ts',
          lineNumber: 5,
          content: 'debugger;',
        },
        {
          pattern: 'rm -rf',
          filePath: 'src/b.ts',
          lineNumber: 12,
          content: 'exec("rm -rf /tmp")',
        },
      ];

      const formatted = formatForbiddenPatterns(matches);
      expect(formatted).toContain('Found 2 forbidden pattern');
      expect(formatted).toContain('src/a.ts:5');
      expect(formatted).toContain('src/b.ts:12');
    });
  });
});
