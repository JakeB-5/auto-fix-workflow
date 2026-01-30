/**
 * @module workflow/group-issues/__tests__/e2e.test
 * @description End-to-end 테스트
 */

import { describe, it, expect } from 'vitest';
import { groupIssues } from '../group-issues.js';
import { extractComponent } from '../component-extractor.js';
import { extractFilePaths } from '../file-extractor.js';
import { generateBranchName } from '../branch-name.js';
import type { GroupIssuesParams } from '../../../common/types/index.js';

describe('group-issues E2E', () => {
  it('should complete full workflow: fetch -> extract -> group -> generate names', async () => {
    // 1. Grouping
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3, 4, 5],
      groupBy: 'component',
      maxGroupSize: 3,
      minGroupSize: 1,
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // 2. Verify groups created
    expect(result.data.groups.length).toBeGreaterThan(0);
    expect(result.data.totalIssues).toBe(5);

    // 3. Verify each group has required properties
    for (const group of result.data.groups) {
      expect(group.id).toBeTruthy();
      expect(group.name).toBeTruthy();
      expect(group.groupBy).toBe('component');
      expect(group.key).toBeTruthy();
      expect(group.issues.length).toBeGreaterThan(0);
      expect(group.branchName).toBeTruthy();
      expect(Array.isArray(group.relatedFiles)).toBe(true);
      expect(Array.isArray(group.components)).toBe(true);
      expect(['critical', 'high', 'medium', 'low']).toContain(group.priority);
    }

    // 4. Verify group size constraints
    for (const group of result.data.groups) {
      expect(group.issues.length).toBeLessThanOrEqual(3);
      expect(group.issues.length).toBeGreaterThanOrEqual(1);
    }

    // 5. Verify branch names are valid
    for (const group of result.data.groups) {
      expect(group.branchName).toMatch(/^[a-z0-9\-/]+$/);
      expect(group.branchName).not.toContain(' ');
      expect(group.branchName).not.toContain('_');
    }
  });

  it('should handle component extraction across different sources', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3],
      groupBy: 'component',
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Verify component extraction worked
    for (const group of result.data.groups) {
      for (const issue of group.issues) {
        const component = extractComponent(issue);
        // Component might be null for uncategorized
        if (component) {
          expect(component.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('should handle file extraction from various formats', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3],
      groupBy: 'file',
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Verify file extraction
    for (const group of result.data.groups) {
      for (const issue of group.issues) {
        const files = extractFilePaths(issue);
        expect(Array.isArray(files)).toBe(true);
      }
    }
  });

  it('should maintain consistency between group data and issues', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3, 4],
      groupBy: 'component',
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (!result.success) return;

    for (const group of result.data.groups) {
      // All files in group should come from group issues
      const issueFiles = new Set<string>();
      for (const issue of group.issues) {
        const files = extractFilePaths(issue);
        files.forEach(f => issueFiles.add(f));
      }

      for (const file of group.relatedFiles) {
        expect(issueFiles.has(file)).toBe(true);
      }
    }
  });

  it('should handle mixed grouping scenarios', async () => {
    // Test component grouping
    const componentResult = await groupIssues({
      issueNumbers: [1, 2, 3],
      groupBy: 'component',
    });
    expect(componentResult.success).toBe(true);

    // Test file grouping
    const fileResult = await groupIssues({
      issueNumbers: [1, 2, 3],
      groupBy: 'file',
    });
    expect(fileResult.success).toBe(true);

    // Test label grouping
    const labelResult = await groupIssues({
      issueNumbers: [1, 2, 3],
      groupBy: 'label',
    });
    expect(labelResult.success).toBe(true);
  });

  it('should generate unique branch names for all groups', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3, 4, 5, 6],
      groupBy: 'component',
      maxGroupSize: 2,
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const branchNames = new Set<string>();
    for (const group of result.data.groups) {
      expect(branchNames.has(group.branchName)).toBe(false);
      branchNames.add(group.branchName);
    }

    expect(branchNames.size).toBe(result.data.groups.length);
  });

  it('should properly split large groups', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
      groupBy: 'component',
      maxGroupSize: 3,
      minGroupSize: 1,
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Verify no group exceeds maxGroupSize
    for (const group of result.data.groups) {
      expect(group.issues.length).toBeLessThanOrEqual(3);
    }

    // Verify split groups have proper naming
    const splitGroups = result.data.groups.filter(g => g.name.includes('Part'));
    for (const group of splitGroups) {
      expect(group.name).toMatch(/Part \d+/);
    }
  });

  it('should handle ungrouped issues correctly', async () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3, 4, 5],
      groupBy: 'component',
      minGroupSize: 3, // Force some issues to be ungrouped
    };

    const result = await groupIssues(params);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // If there are ungrouped issues, verify they're reported
    if (result.data.ungroupedIssues.length > 0) {
      expect(Array.isArray(result.data.ungroupedIssues)).toBe(true);
      for (const issueNum of result.data.ungroupedIssues) {
        expect(typeof issueNum).toBe('number');
        expect(params.issueNumbers).toContain(issueNum);
      }
    }
  });
});
