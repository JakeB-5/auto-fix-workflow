/**
 * @module github/create-issue/__tests__/labels
 * @description Unit tests for label inference and validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  inferLabels,
  mergeLabels,
  isValidLabel,
  filterValidLabels,
} from '../labels.js';
import type { Issue } from '../../../common/types/index.js';

describe('labels', () => {
  describe('inferLabels', () => {
    it('should infer type label', () => {
      const issue: Partial<Issue> = {
        type: 'bug',
      };

      const labels = inferLabels(issue);

      expect(labels).toContain('type:bug');
    });

    it('should infer all type labels', () => {
      const types = ['bug', 'feature', 'refactor', 'docs', 'test', 'chore'] as const;

      types.forEach((type) => {
        const issue: Partial<Issue> = { type };
        const labels = inferLabels(issue);
        expect(labels).toContain(`type:${type}`);
      });
    });

    it('should infer priority label', () => {
      const issue: Partial<Issue> = {
        context: {
          priority: 'high',
        },
      };

      const labels = inferLabels(issue);

      expect(labels).toContain('priority:high');
    });

    it('should infer all priority labels', () => {
      const priorities = ['critical', 'high', 'medium', 'low'] as const;

      priorities.forEach((priority) => {
        const issue: Partial<Issue> = {
          context: { priority },
        };
        const labels = inferLabels(issue);
        expect(labels).toContain(`priority:${priority}`);
      });
    });

    it('should infer source label', () => {
      const issue: Partial<Issue> = {
        context: {
          source: 'sentry',
        },
      };

      const labels = inferLabels(issue);

      expect(labels).toContain('source:sentry');
    });

    it('should infer component label', () => {
      const issue: Partial<Issue> = {
        context: {
          component: 'auth',
        },
      };

      const labels = inferLabels(issue);

      expect(labels).toContain('component:auth');
    });

    it('should add auto-fix label for high confidence', () => {
      const issue: Partial<Issue> = {
        suggestedFix: {
          description: 'Fix the bug',
          changes: [],
          confidence: 0.9,
        },
      };

      const labels = inferLabels(issue);

      expect(labels).toContain('auto-fix');
    });

    it('should add auto-fix label at exactly 0.7 confidence', () => {
      const issue: Partial<Issue> = {
        suggestedFix: {
          description: 'Fix',
          changes: [],
          confidence: 0.7,
        },
      };

      const labels = inferLabels(issue);

      expect(labels).toContain('auto-fix');
    });

    it('should not add auto-fix label for low confidence', () => {
      const issue: Partial<Issue> = {
        suggestedFix: {
          description: 'Fix',
          changes: [],
          confidence: 0.5,
        },
      };

      const labels = inferLabels(issue);

      expect(labels).not.toContain('auto-fix');
    });

    it('should combine multiple labels', () => {
      const issue: Partial<Issue> = {
        type: 'bug',
        context: {
          priority: 'critical',
          source: 'sentry',
          component: 'database',
        },
        suggestedFix: {
          description: 'Fix',
          changes: [],
          confidence: 0.9,
        },
      };

      const labels = inferLabels(issue);

      expect(labels).toContain('type:bug');
      expect(labels).toContain('priority:critical');
      expect(labels).toContain('source:sentry');
      expect(labels).toContain('component:database');
      expect(labels).toContain('auto-fix');
    });

    it('should return sorted labels', () => {
      const issue: Partial<Issue> = {
        type: 'feature',
        context: {
          priority: 'low',
          source: 'asana',
        },
      };

      const labels = inferLabels(issue);

      expect(labels).toEqual([...labels].sort());
    });

    it('should deduplicate labels', () => {
      const issue: Partial<Issue> = {
        type: 'bug',
        context: {
          priority: 'high',
        },
      };

      const labels = inferLabels(issue);
      const uniqueLabels = Array.from(new Set(labels));

      expect(labels).toEqual(uniqueLabels);
    });

    it('should handle empty issue', () => {
      const issue: Partial<Issue> = {};

      const labels = inferLabels(issue);

      expect(labels).toEqual([]);
    });

    it('should handle issue with no context', () => {
      const issue: Partial<Issue> = {
        type: 'bug',
      };

      const labels = inferLabels(issue);

      expect(labels).toContain('type:bug');
      expect(labels).toHaveLength(1);
    });

    it('should handle context without priority', () => {
      const issue: Partial<Issue> = {
        context: {
          source: 'github',
        },
      };

      const labels = inferLabels(issue);

      expect(labels).toContain('source:github');
      expect(labels).not.toContain('priority');
    });

    it('should handle context without source', () => {
      const issue: Partial<Issue> = {
        context: {
          priority: 'medium',
        },
      };

      const labels = inferLabels(issue);

      expect(labels).toContain('priority:medium');
      expect(labels.length).toBe(1);
    });

    it('should handle suggested fix without confidence', () => {
      const issue: Partial<Issue> = {
        suggestedFix: {
          description: 'Fix',
          changes: [],
          confidence: 0,
        },
      };

      const labels = inferLabels(issue);

      expect(labels).not.toContain('auto-fix');
    });
  });

  describe('mergeLabels', () => {
    it('should merge inferred and user labels', () => {
      const inferred = ['type:bug', 'priority:high'];
      const user = ['custom-label'];

      const result = mergeLabels(inferred, user);

      expect(result).toContain('type:bug');
      expect(result).toContain('priority:high');
      expect(result).toContain('custom-label');
    });

    it('should deduplicate merged labels', () => {
      const inferred = ['type:bug', 'priority:high'];
      const user = ['type:bug', 'custom-label'];

      const result = mergeLabels(inferred, user);

      expect(result).toEqual(['custom-label', 'priority:high', 'type:bug']);
      expect(result.filter((l) => l === 'type:bug')).toHaveLength(1);
    });

    it('should handle undefined user labels', () => {
      const inferred = ['type:bug'];

      const result = mergeLabels(inferred, undefined);

      expect(result).toEqual(['type:bug']);
    });

    it('should handle empty user labels', () => {
      const inferred = ['type:bug'];
      const user: string[] = [];

      const result = mergeLabels(inferred, user);

      expect(result).toEqual(['type:bug']);
    });

    it('should handle empty inferred labels', () => {
      const inferred: string[] = [];
      const user = ['custom-label'];

      const result = mergeLabels(inferred, user);

      expect(result).toEqual(['custom-label']);
    });

    it('should return sorted labels', () => {
      const inferred = ['z-label', 'a-label'];
      const user = ['m-label'];

      const result = mergeLabels(inferred, user);

      expect(result).toEqual(['a-label', 'm-label', 'z-label']);
    });

    it('should handle readonly arrays', () => {
      const inferred: readonly string[] = ['type:bug'];
      const user: readonly string[] = ['custom'];

      const result = mergeLabels(inferred, user);

      expect(result).toEqual(['custom', 'type:bug']);
    });
  });

  describe('isValidLabel', () => {
    it('should return true for valid label', () => {
      expect(isValidLabel('bug')).toBe(true);
      expect(isValidLabel('type:bug')).toBe(true);
      expect(isValidLabel('priority:high')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isValidLabel('')).toBe(false);
    });

    it('should return false for whitespace only', () => {
      expect(isValidLabel('   ')).toBe(false);
      expect(isValidLabel('\t')).toBe(false);
      expect(isValidLabel('\n')).toBe(false);
    });

    it('should return false for label exceeding 50 characters', () => {
      const longLabel = 'a'.repeat(51);
      expect(isValidLabel(longLabel)).toBe(false);
    });

    it('should return true for label with exactly 50 characters', () => {
      const maxLabel = 'a'.repeat(50);
      expect(isValidLabel(maxLabel)).toBe(true);
    });

    it('should return true for label with spaces', () => {
      expect(isValidLabel('my label')).toBe(true);
    });

    it('should return true for label with special characters', () => {
      expect(isValidLabel('bug-fix')).toBe(true);
      expect(isValidLabel('feature_request')).toBe(true);
      expect(isValidLabel('v1.0.0')).toBe(true);
    });

    it('should handle labels with leading/trailing spaces', () => {
      // Labels with only whitespace after trim should be invalid
      expect(isValidLabel('  ')).toBe(false);
      // Labels with content should be valid even with spaces
      expect(isValidLabel(' bug ')).toBe(true);
    });
  });

  describe('filterValidLabels', () => {
    it('should filter out invalid labels', () => {
      const labels = [
        'valid',
        '',
        'also-valid',
        '   ',
        'a'.repeat(51),
      ];

      const result = filterValidLabels(labels);

      expect(result).toEqual(['valid', 'also-valid']);
    });

    it('should keep all valid labels', () => {
      const labels = ['bug', 'feature', 'priority:high'];

      const result = filterValidLabels(labels);

      expect(result).toEqual(labels);
    });

    it('should handle empty array', () => {
      const result = filterValidLabels([]);

      expect(result).toEqual([]);
    });

    it('should handle array with only invalid labels', () => {
      const labels = ['', '   ', 'a'.repeat(51)];

      const result = filterValidLabels(labels);

      expect(result).toEqual([]);
    });

    it('should handle readonly arrays', () => {
      const labels: readonly string[] = ['valid', '', 'also-valid'];

      const result = filterValidLabels(labels);

      expect(result).toEqual(['valid', 'also-valid']);
    });

    it('should preserve order of valid labels', () => {
      const labels = ['z-label', '', 'a-label', '   ', 'm-label'];

      const result = filterValidLabels(labels);

      expect(result).toEqual(['z-label', 'a-label', 'm-label']);
    });
  });
});
