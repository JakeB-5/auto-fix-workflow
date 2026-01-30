/**
 * @module workflow/group-issues/__tests__/integration.test
 * @description 통합 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { groupIssues } from '../group-issues.js';
import type { GroupIssuesParams } from '../../../common/types/index.js';
import * as githubApi from '../github-api.js';

describe('groupIssues integration', () => {
  it('should successfully group issues by component', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3],
      groupBy: 'component',
      maxGroupSize: 5,
      minGroupSize: 1,
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groups.length).toBeGreaterThan(0);
      expect(result.data.totalIssues).toBe(3);
    }
  });

  it('should filter issues by labels', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3],
      groupBy: 'component',
      labels: ['bug'],
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (result.success) {
      // All issues should have 'bug' label
      const allIssues = result.data.groups.flatMap(g => g.issues);
      allIssues.forEach(issue => {
        expect(issue.labels).toContain('bug');
      });
    }
  });

  it('should exclude issues by labels', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3],
      groupBy: 'component',
      excludeLabels: ['wontfix'],
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (result.success) {
      const allIssues = result.data.groups.flatMap(g => g.issues);
      allIssues.forEach(issue => {
        expect(issue.labels).not.toContain('wontfix');
      });
    }
  });

  it('should validate group sizes', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3, 4, 5, 6],
      groupBy: 'component',
      maxGroupSize: 2,
      minGroupSize: 1,
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (result.success) {
      // Each group should not exceed maxGroupSize
      result.data.groups.forEach(group => {
        expect(group.issues.length).toBeLessThanOrEqual(2);
      });
    }
  });

  it('should handle invalid parameters', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [],
      groupBy: 'component',
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_PARAMS');
    }
  });

  it('should handle invalid group size parameters', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2],
      groupBy: 'component',
      maxGroupSize: 1,
      minGroupSize: 5,
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_GROUP_SIZE');
    }
  });

  it('should group by file', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3],
      groupBy: 'file',
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groups.length).toBeGreaterThan(0);
      result.data.groups.forEach(group => {
        expect(group.groupBy).toBe('file');
      });
    }
  });

  it('should group by label', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3],
      groupBy: 'label',
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groups.length).toBeGreaterThan(0);
      result.data.groups.forEach(group => {
        expect(group.groupBy).toBe('label');
      });
    }
  });

  it('should generate branch names for all groups', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3],
      groupBy: 'component',
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (result.success) {
      result.data.groups.forEach(group => {
        expect(group.branchName).toBeTruthy();
        expect(group.branchName.length).toBeGreaterThan(0);
      });
    }
  });

  it('should collect related files from all issues in group', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3],
      groupBy: 'component',
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (result.success) {
      result.data.groups.forEach(group => {
        expect(Array.isArray(group.relatedFiles)).toBe(true);
      });
    }
  });

  it('should determine highest priority in group', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3],
      groupBy: 'component',
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (result.success) {
      result.data.groups.forEach(group => {
        expect(['critical', 'high', 'medium', 'low']).toContain(group.priority);
      });
    }
  });
});
