/**
 * @module workflow/group-issues/__tests__/branch-name.test
 * @description Branch name generator 테스트
 */

import { describe, it, expect } from 'vitest';
import { generateBranchName } from '../branch-name.js';
import type { IssueGroup, Issue } from '../../../common/types/index.js';

describe('generateBranchName', () => {
  const createMockIssue = (number: number): Issue => ({
    number,
    title: `Issue #${number}`,
    body: '',
    state: 'open',
    type: 'bug',
    labels: [],
    assignees: [],
    context: {
      component: 'Button',
      priority: 'medium',
      relatedFiles: [],
      relatedSymbols: [],
      source: 'github',
    },
    acceptanceCriteria: [],
    relatedIssues: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    url: `https://github.com/owner/repo/issues/${number}`,
  });

  const createMockGroup = (overrides: Partial<IssueGroup> = {}): IssueGroup => ({
    id: 'test-group',
    name: 'Test Group',
    groupBy: 'component',
    key: 'Button',
    issues: [createMockIssue(123), createMockIssue(456)],
    branchName: '',
    relatedFiles: [],
    components: ['Button'],
    priority: 'high',
    ...overrides,
  });

  it('should generate default branch name format', () => {
    const group = createMockGroup();
    const branchName = generateBranchName(group);

    expect(branchName).toBe('fix/button/issue-123-456');
  });

  it('should use custom prefix', () => {
    const group = createMockGroup();
    const branchName = generateBranchName(group, { prefix: 'feature' });

    expect(branchName).toBe('feature/button/issue-123-456');
  });

  it('should exclude issue numbers when specified', () => {
    const group = createMockGroup();
    const branchName = generateBranchName(group, {
      includeIssueNumbers: false,
    });

    expect(branchName).toBe('fix/button');
  });

  it('should use custom separator', () => {
    const group = createMockGroup();
    const branchName = generateBranchName(group, { separator: '_' });

    expect(branchName).toBe('fix/button/issue_123_456');
  });

  it('should truncate long branch names', () => {
    const group = createMockGroup({
      components: ['VeryLongComponentNameThatExceedsMaxLength'],
      issues: [
        createMockIssue(123),
        createMockIssue(456),
        createMockIssue(789),
        createMockIssue(1011),
      ],
    });

    const branchName = generateBranchName(group, { maxLength: 30 });

    expect(branchName.length).toBeLessThanOrEqual(30);
    expect(branchName).toContain('issue');
  });

  it('should sanitize special characters', () => {
    const group = createMockGroup({
      components: ['Button@Component!'],
      key: 'Button@Component!',
    });

    const branchName = generateBranchName(group);

    expect(branchName).toBe('fix/button-component/issue-123-456');
  });

  it('should handle file-based grouping', () => {
    const group = createMockGroup({
      groupBy: 'file',
      key: 'components/Button',
      components: [],
    });

    const branchName = generateBranchName(group);

    expect(branchName).toContain('components-button');
  });

  it('should handle label-based grouping', () => {
    const group = createMockGroup({
      groupBy: 'label',
      key: 'bug',
      components: [],
    });

    const branchName = generateBranchName(group);

    expect(branchName).toBe('fix/bug/issue-123-456');
  });

  it('should sort issue numbers', () => {
    const group = createMockGroup({
      issues: [createMockIssue(999), createMockIssue(100), createMockIssue(500)],
    });

    const branchName = generateBranchName(group);

    expect(branchName).toBe('fix/button/issue-100-500-999');
  });

  it('should handle single issue', () => {
    const group = createMockGroup({
      issues: [createMockIssue(42)],
    });

    const branchName = generateBranchName(group);

    expect(branchName).toBe('fix/button/issue-42');
  });

  it('should handle empty prefix', () => {
    const group = createMockGroup();
    const branchName = generateBranchName(group, { prefix: '' });

    expect(branchName).toBe('button/issue-123-456');
  });

  it('should preserve issue numbers when truncating', () => {
    const group = createMockGroup({
      components: ['VeryLongComponentName'],
      issues: [createMockIssue(12345)],
    });

    const branchName = generateBranchName(group, { maxLength: 25 });

    expect(branchName).toContain('12345');
    expect(branchName.length).toBeLessThanOrEqual(25);
  });
});
