/**
 * @module __tests__/helpers/fixtures
 * @description Common test fixtures shared across test files
 */

import type { Issue, IssueGroup, WorktreeInfo, PullRequest, IssueType } from '../../common/types/index.js';

/**
 * Creates a mock GitHub issue for testing
 */
export function createMockIssue(
  number: number,
  overrides: Partial<Issue> = {}
): Issue {
  return {
    number,
    title: `Test Issue #${number}`,
    body: `### Context\n- **컴포넌트**: test-component\n\nTest issue body`,
    state: 'open',
    type: 'bug' as IssueType,
    labels: ['auto-fix'],
    assignees: [],
    context: {
      component: 'test-component',
      priority: 'medium',
      relatedFiles: [],
      relatedSymbols: [],
      source: 'github',
    },
    acceptanceCriteria: [],
    relatedIssues: [],
    url: `https://github.com/test/repo/issues/${number}`,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Creates a mock issue group for testing
 */
export function createMockIssueGroup(
  overrides: Partial<IssueGroup> = {}
): IssueGroup {
  return {
    id: 'test-group',
    name: 'Test Group',
    groupBy: 'component',
    key: 'test-component',
    issues: [createMockIssue(1), createMockIssue(2)],
    branchName: 'fix/test-component',
    relatedFiles: [],
    components: ['test-component'],
    priority: 'medium',
    ...overrides,
  };
}

/**
 * Creates a mock worktree for testing
 */
export function createMockWorktree(
  branch: string,
  overrides: Partial<WorktreeInfo> = {}
): WorktreeInfo {
  return {
    path: `/test/worktree/${branch}`,
    branch,
    status: 'ready',
    issueNumbers: [1],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    lastActivityAt: new Date('2024-01-02T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Creates a mock pull request for testing
 */
export function createMockPullRequest(
  number: number,
  overrides: Partial<PullRequest> = {}
): PullRequest {
  return {
    number,
    title: `Fix test issue #${number}`,
    body: 'Test PR body',
    state: 'open',
    headBranch: 'fix/test',
    baseBranch: 'main',
    linkedIssues: [number],
    labels: [],
    reviewers: [],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    url: `https://github.com/test/repo/pull/${number}`,
    changedFiles: 1,
    additions: 10,
    deletions: 5,
    ...overrides,
  };
}

/**
 * Creates a mock Asana task for testing
 */
export function createMockAsanaTask(gid: string = 'task-1', overrides: any = {}) {
  return {
    gid,
    name: 'Test Task',
    completed: false,
    completedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    modifiedAt: '2024-01-02T00:00:00.000Z',
    dueOn: null,
    dueAt: null,
    assignee: null,
    tags: [],
    customFields: [],
    resourceSubtype: 'default_task',
    permalink: `https://app.asana.com/0/${gid}`,
    ...overrides,
  };
}

/**
 * Creates a mock config for testing
 */
export function createMockConfig(overrides: any = {}) {
  return {
    github: {
      repository: 'test/repo',
      token: 'test-token',
    },
    asana: {
      token: 'test-asana-token',
      workspaceGid: 'workspace-123',
    },
    git: {
      baseBranch: 'main',
      worktreeDir: '.worktrees',
    },
    checks: {
      enabled: ['lint', 'typecheck', 'test'],
      timeout: 300000,
    },
    ai: {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      maxRetries: 3,
    },
    ...overrides,
  };
}
