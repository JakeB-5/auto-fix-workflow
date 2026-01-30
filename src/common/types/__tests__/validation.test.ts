/**
 * @fileoverview Type validation integration tests
 * @description Tests for runtime type validation and type constraints
 */

import { describe, it, expect } from 'vitest';
import type {
  Issue,
  WorktreeInfo,
  CheckResult,
  Config,
  IssueGroup,
  CreatePRParams,
  ManageWorktreeRequest,
  GroupIssuesParams,
} from '../index.js';

describe('Issue Type Validation', () => {
  it('should validate required fields', () => {
    const issue: Issue = {
      number: 1,
      title: 'Test Issue',
      body: 'Issue body',
      state: 'open',
      type: 'bug',
      labels: [],
      assignees: [],
      context: {
        component: 'test',
        priority: 'high',
        relatedFiles: [],
        relatedSymbols: [],
        source: 'github',
      },
      acceptanceCriteria: [],
      relatedIssues: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      url: 'https://github.com/org/repo/issues/1',
    };

    expect(issue.number).toBeTypeOf('number');
    expect(issue.title).toBeTypeOf('string');
    expect(issue.context).toBeTypeOf('object');
    expect(Array.isArray(issue.labels)).toBe(true);
  });

  it('should support optional fields', () => {
    const issue: Issue = {
      number: 1,
      title: 'Test',
      body: 'Body',
      state: 'open',
      type: 'bug',
      labels: [],
      assignees: [],
      context: {
        component: 'test',
        priority: 'low',
        relatedFiles: [],
        relatedSymbols: [],
        source: 'github',
        sourceId: 'ext-123',
        sourceUrl: 'https://external.com/123',
      },
      codeAnalysis: {
        filePath: 'src/test.ts',
        startLine: 10,
        endLine: 20,
        functionName: 'testFn',
      },
      suggestedFix: {
        description: 'Fix it',
        steps: ['Step 1', 'Step 2'],
        confidence: 0.9,
      },
      acceptanceCriteria: [],
      relatedIssues: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      url: 'https://github.com',
    };

    expect(issue.context.sourceId).toBe('ext-123');
    expect(issue.codeAnalysis?.functionName).toBe('testFn');
    expect(issue.suggestedFix?.confidence).toBe(0.9);
  });

  it('should validate IssueStatus enum', () => {
    const validStatuses: Array<Issue['state']> = [
      'open',
      'in_progress',
      'resolved',
      'closed',
    ];

    validStatuses.forEach((status) => {
      const issue: Issue = {
        number: 1,
        title: 'Test',
        body: 'Body',
        state: status,
        type: 'bug',
        labels: [],
        assignees: [],
        context: {
          component: 'test',
          priority: 'low',
          relatedFiles: [],
          relatedSymbols: [],
          source: 'github',
        },
        acceptanceCriteria: [],
        relatedIssues: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com',
      };

      expect(issue.state).toBe(status);
    });
  });

  it('should validate IssueType enum', () => {
    const validTypes: Array<Issue['type']> = [
      'bug',
      'feature',
      'refactor',
      'docs',
      'test',
      'chore',
    ];

    validTypes.forEach((type) => {
      expect(type).toBeTruthy();
    });
  });

  it('should validate IssuePriority enum', () => {
    const validPriorities: Array<Issue['context']['priority']> = [
      'critical',
      'high',
      'medium',
      'low',
    ];

    validPriorities.forEach((priority) => {
      expect(priority).toBeTruthy();
    });
  });

  it('should validate IssueSource enum', () => {
    const validSources: Array<Issue['context']['source']> = [
      'asana',
      'sentry',
      'manual',
      'github',
    ];

    validSources.forEach((source) => {
      const issue: Issue = {
        number: 1,
        title: 'Test',
        body: 'Body',
        state: 'open',
        type: 'bug',
        labels: [],
        assignees: [],
        context: {
          component: 'test',
          priority: 'low',
          relatedFiles: [],
          relatedSymbols: [],
          source,
        },
        acceptanceCriteria: [],
        relatedIssues: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        url: 'https://github.com',
      };

      expect(issue.context.source).toBe(source);
    });
  });
});

describe('WorktreeInfo Type Validation', () => {
  it('should validate required fields', () => {
    const worktree: WorktreeInfo = {
      path: '/path/to/worktree',
      branch: 'fix/test',
      status: 'ready',
      issueNumbers: [1, 2, 3],
      createdAt: new Date('2024-01-01'),
      lastActivityAt: new Date('2024-01-02'),
    };

    expect(worktree.path).toBe('/path/to/worktree');
    expect(worktree.issueNumbers).toHaveLength(3);
    expect(worktree.createdAt).toBeInstanceOf(Date);
  });

  it('should validate WorktreeStatus enum', () => {
    const validStatuses: Array<WorktreeInfo['status']> = [
      'creating',
      'ready',
      'in_use',
      'checking',
      'committing',
      'cleaning',
      'error',
    ];

    validStatuses.forEach((status) => {
      const worktree: WorktreeInfo = {
        path: '/path',
        branch: 'test',
        status,
        issueNumbers: [],
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      expect(worktree.status).toBe(status);
    });
  });

  it('should support optional error message', () => {
    const worktree: WorktreeInfo = {
      path: '/path',
      branch: 'test',
      status: 'error',
      issueNumbers: [],
      createdAt: new Date(),
      lastActivityAt: new Date(),
      errorMessage: 'Something went wrong',
      headCommit: 'abc123',
    };

    expect(worktree.errorMessage).toBe('Something went wrong');
    expect(worktree.headCommit).toBe('abc123');
  });
});

describe('CheckResult Type Validation', () => {
  it('should validate successful check result', () => {
    const result: CheckResult = {
      passed: true,
      results: [
        {
          check: 'test',
          passed: true,
          status: 'passed',
          durationMs: 1234,
          exitCode: 0,
          stdout: 'All tests passed',
        },
      ],
      attempt: 1,
      totalDurationMs: 1234,
    };

    expect(result.passed).toBe(true);
    expect(result.results[0].check).toBe('test');
    expect(result.attempt).toBe(1);
  });

  it('should validate CheckType enum', () => {
    const validCheckTypes: Array<CheckResult['results'][number]['check']> = [
      'test',
      'typecheck',
      'lint',
    ];

    validCheckTypes.forEach((checkType) => {
      expect(['test', 'typecheck', 'lint']).toContain(checkType);
    });
  });

  it('should validate CheckStatus enum', () => {
    const validStatuses: Array<CheckResult['results'][number]['status']> = [
      'pending',
      'running',
      'passed',
      'failed',
      'skipped',
      'timeout',
    ];

    validStatuses.forEach((status) => {
      expect(status).toBeTruthy();
    });
  });

  it('should support retry information', () => {
    const result: CheckResult = {
      passed: false,
      results: [],
      attempt: 3,
      maxRetriesExceeded: true,
      previousErrors: [
        {
          attempt: 1,
          check: 'test',
          error: 'First error',
          timestamp: '2024-01-01T00:00:00Z',
        },
      ],
      totalDurationMs: 5000,
    };

    expect(result.maxRetriesExceeded).toBe(true);
    expect(result.previousErrors).toHaveLength(1);
  });
});

describe('Config Type Validation', () => {
  it('should validate minimal config', () => {
    const config: Config = {
      github: {
        token: 'ghp_test',
        owner: 'org',
        repo: 'repo',
      },
      asana: {
        token: 'asana_test',
        workspaceGid: '123',
        projectGids: ['456', '789'],
      },
      worktree: {
        baseDir: '/tmp/worktrees',
      },
    };

    expect(config.github.token).toBe('ghp_test');
    expect(config.asana.projectGids).toHaveLength(2);
    expect(config.worktree.baseDir).toBe('/tmp/worktrees');
  });

  it('should validate full config with all optional fields', () => {
    const config: Config = {
      github: {
        token: 'ghp_test',
        owner: 'org',
        repo: 'repo',
        apiBaseUrl: 'https://api.github.com',
        defaultBranch: 'main',
        autoFixLabel: 'auto-fix',
        skipLabel: 'skip',
      },
      asana: {
        token: 'asana_test',
        workspaceGid: '123',
        projectGids: ['456'],
        triageSection: 'Triage',
        doneSection: 'Done',
        syncedTag: 'synced',
      },
      sentry: {
        dsn: 'https://sentry.io',
        organization: 'org',
        project: 'project',
        webhookSecret: 'secret',
      },
      worktree: {
        baseDir: '/tmp',
        maxConcurrent: 5,
        autoCleanupMinutes: 120,
        prefix: 'fix-',
      },
      checks: {
        testCommand: 'npm test',
        typeCheckCommand: 'tsc',
        lintCommand: 'eslint .',
        testTimeout: 600,
        typeCheckTimeout: 120,
        lintTimeout: 180,
        maxRetries: 5,
      },
      logging: {
        level: 'debug',
        pretty: true,
        filePath: '/var/log/app.log',
        redact: true,
      },
    };

    expect(config.sentry?.organization).toBe('org');
    expect(config.checks?.maxRetries).toBe(5);
    expect(config.logging?.level).toBe('debug');
  });

  it('should validate logging levels', () => {
    const validLevels: Array<NonNullable<Config['logging']>['level']> = [
      'trace',
      'debug',
      'info',
      'warn',
      'error',
      'fatal',
    ];

    validLevels.forEach((level) => {
      const config: Config = {
        github: { token: 'test', owner: 'o', repo: 'r' },
        asana: { token: 'test', workspaceGid: '1', projectGids: ['2'] },
        worktree: { baseDir: '/tmp' },
        logging: { level },
      };

      expect(config.logging?.level).toBe(level);
    });
  });
});

describe('IssueGroup Type Validation', () => {
  it('should validate required fields', () => {
    const group: IssueGroup = {
      id: 'group-1',
      name: 'Auth Fixes',
      groupBy: 'component',
      key: 'auth',
      issues: [],
      branchName: 'fix/auth',
      relatedFiles: ['src/auth.ts'],
      components: ['auth'],
      priority: 'high',
    };

    expect(group.id).toBe('group-1');
    expect(group.groupBy).toBe('component');
    expect(group.priority).toBe('high');
  });

  it('should validate GroupBy enum', () => {
    const validGroupBy: Array<IssueGroup['groupBy']> = [
      'component',
      'file',
      'label',
      'type',
      'priority',
    ];

    validGroupBy.forEach((groupBy) => {
      const group: IssueGroup = {
        id: 'test',
        name: 'Test',
        groupBy,
        key: 'test',
        issues: [],
        branchName: 'test',
        relatedFiles: [],
        components: [],
        priority: 'low',
      };

      expect(group.groupBy).toBe(groupBy);
    });
  });

  it('should support optional estimatedEffort', () => {
    const group: IssueGroup = {
      id: 'test',
      name: 'Test',
      groupBy: 'component',
      key: 'test',
      issues: [],
      branchName: 'test',
      relatedFiles: [],
      components: [],
      estimatedEffort: 8,
      priority: 'medium',
    };

    expect(group.estimatedEffort).toBe(8);
  });
});

describe('Request/Response Type Validation', () => {
  it('should validate CreatePRParams', () => {
    const params: CreatePRParams = {
      title: 'Fix auth bug',
      body: 'This PR fixes the auth bug',
      headBranch: 'fix/auth',
      baseBranch: 'main',
      linkedIssues: [1, 2],
      labels: ['bug', 'auth'],
      reviewers: ['user1', 'user2'],
      draft: true,
    };

    expect(params.title).toBe('Fix auth bug');
    expect(params.linkedIssues).toHaveLength(2);
    expect(params.draft).toBe(true);
  });

  it('should validate ManageWorktreeRequest for create action', () => {
    const request: ManageWorktreeRequest = {
      action: 'create',
      createParams: {
        branchName: 'fix/issue-1',
        baseBranch: 'main',
        issueNumbers: [1, 2],
        path: '/tmp/worktree',
      },
    };

    expect(request.action).toBe('create');
    expect(request.createParams?.branchName).toBe('fix/issue-1');
  });

  it('should validate ManageWorktreeRequest for cleanup action', () => {
    const request: ManageWorktreeRequest = {
      action: 'cleanup',
      removeParams: {
        path: '/tmp/worktree',
        force: true,
        deleteBranch: false,
      },
    };

    expect(request.action).toBe('cleanup');
    expect(request.removeParams?.force).toBe(true);
  });

  it('should validate ManageWorktreeRequest for list action', () => {
    const request: ManageWorktreeRequest = {
      action: 'list',
      listParams: {
        status: 'ready',
        issueNumber: 1,
      },
    };

    expect(request.action).toBe('list');
    expect(request.listParams?.status).toBe('ready');
  });

  it('should validate GroupIssuesParams', () => {
    const params: GroupIssuesParams = {
      issueNumbers: [1, 2, 3, 4, 5],
      groupBy: 'component',
      maxGroupSize: 5,
      minGroupSize: 2,
      labels: ['bug'],
      excludeLabels: ['wontfix'],
    };

    expect(params.issueNumbers).toHaveLength(5);
    expect(params.groupBy).toBe('component');
    expect(params.maxGroupSize).toBe(5);
  });
});

describe('Type Compatibility', () => {
  it('should allow readonly arrays in mutable contexts', () => {
    const issue: Issue = {
      number: 1,
      title: 'Test',
      body: 'Body',
      state: 'open',
      type: 'bug',
      labels: ['bug', 'test'],
      assignees: ['user1'],
      context: {
        component: 'test',
        priority: 'low',
        relatedFiles: ['src/test.ts'],
        relatedSymbols: ['testFn'],
        source: 'github',
      },
      acceptanceCriteria: [],
      relatedIssues: [2, 3],
      createdAt: new Date(),
      updatedAt: new Date(),
      url: 'https://github.com',
    };

    // Should be able to read
    expect(issue.labels.length).toBe(2);
    expect(issue.relatedIssues[0]).toBe(2);

    // Should be able to use array methods that don't mutate
    const hasTestLabel = issue.labels.includes('test');
    expect(hasTestLabel).toBe(true);

    const labelCount = issue.labels.filter((l) => l.startsWith('t')).length;
    expect(labelCount).toBe(1);
  });

  it('should handle Date objects correctly', () => {
    const now = new Date();
    const issue: Issue = {
      number: 1,
      title: 'Test',
      body: 'Body',
      state: 'open',
      type: 'bug',
      labels: [],
      assignees: [],
      context: {
        component: 'test',
        priority: 'low',
        relatedFiles: [],
        relatedSymbols: [],
        source: 'github',
      },
      acceptanceCriteria: [],
      relatedIssues: [],
      createdAt: now,
      updatedAt: now,
      url: 'https://github.com',
    };

    expect(issue.createdAt).toBeInstanceOf(Date);
    expect(issue.updatedAt.getTime()).toBe(now.getTime());
  });
});

describe('Complex Type Scenarios', () => {
  it('should handle nested optional fields', () => {
    const issue: Issue = {
      number: 1,
      title: 'Test',
      body: 'Body',
      state: 'open',
      type: 'bug',
      labels: [],
      assignees: [],
      context: {
        component: 'test',
        priority: 'low',
        relatedFiles: [],
        relatedSymbols: [],
        source: 'sentry',
        sourceId: 'sentry-123',
      },
      codeAnalysis: {
        filePath: 'src/test.ts',
        snippet: 'const x = 1;',
      },
      acceptanceCriteria: [],
      relatedIssues: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      url: 'https://github.com',
    };

    // Optional fields should be accessible when present
    expect(issue.context.sourceId).toBe('sentry-123');
    expect(issue.codeAnalysis?.snippet).toBe('const x = 1;');

    // Missing optional fields should be undefined
    expect(issue.codeAnalysis?.startLine).toBeUndefined();
    expect(issue.suggestedFix).toBeUndefined();
  });

  it('should handle union types correctly', () => {
    const worktree1: WorktreeInfo = {
      path: '/tmp/wt1',
      branch: 'fix/1',
      status: 'ready',
      issueNumbers: [],
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    const worktree2: WorktreeInfo = {
      path: '/tmp/wt2',
      branch: 'fix/2',
      status: 'error',
      issueNumbers: [],
      createdAt: new Date(),
      lastActivityAt: new Date(),
      errorMessage: 'Failed',
    };

    const worktrees = [worktree1, worktree2];

    const errorWorktrees = worktrees.filter((wt) => wt.status === 'error');
    expect(errorWorktrees).toHaveLength(1);
    expect(errorWorktrees[0].errorMessage).toBe('Failed');
  });
});
