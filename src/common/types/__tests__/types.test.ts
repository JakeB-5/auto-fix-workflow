/**
 * @fileoverview Unit tests for common types module
 */

import { describe, it, expect } from 'vitest';
import {
  isSuccess,
  isFailure,
  ok,
  err,
  unwrapOr,
  unwrap,
  map,
  flatMap,
  mapError,
  all,
  fromPromise,
  toPromise,
  type Result,
  type Issue,
  type WorktreeInfo,
  type CheckResult,
  type IssueGroup,
  type Config,
} from '../index.js';

describe('Result Type', () => {
  describe('ok and err helpers', () => {
    it('should create success result', () => {
      const result = ok(42);
      expect(result).toEqual({ success: true, data: 42 });
    });

    it('should create failure result', () => {
      const result = err('error message');
      expect(result).toEqual({ success: false, error: 'error message' });
    });
  });

  describe('Type guards', () => {
    it('should correctly identify success results', () => {
      const result = ok(42);
      expect(isSuccess(result)).toBe(true);
      expect(isFailure(result)).toBe(false);

      if (isSuccess(result)) {
        expect(result.data).toBe(42);
      }
    });

    it('should correctly identify failure results', () => {
      const result = err('error');
      expect(isSuccess(result)).toBe(false);
      expect(isFailure(result)).toBe(true);

      if (isFailure(result)) {
        expect(result.error).toBe('error');
      }
    });
  });

  describe('unwrapOr', () => {
    it('should return data for success', () => {
      const result = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it('should return default value for failure', () => {
      const result = err('error');
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });

  describe('unwrap', () => {
    it('should return data for success', () => {
      const result = ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it('should throw for failure', () => {
      const result = err('error message');
      expect(() => unwrap(result)).toThrow('error message');
    });
  });

  describe('map', () => {
    it('should transform success result', () => {
      const result = ok(5);
      const mapped = map(result, (n) => n * 2);

      expect(isSuccess(mapped)).toBe(true);
      if (isSuccess(mapped)) {
        expect(mapped.data).toBe(10);
      }
    });

    it('should pass through failure result', () => {
      const result: Result<number, string> = err('error');
      const mapped = map(result, (n: number) => n * 2);

      expect(isFailure(mapped)).toBe(true);
      if (isFailure(mapped)) {
        expect(mapped.error).toBe('error');
      }
    });
  });

  describe('flatMap', () => {
    it('should chain success results', () => {
      const result = ok(5);
      const chained = flatMap(result, (n) => ok(n * 2));

      expect(isSuccess(chained)).toBe(true);
      if (isSuccess(chained)) {
        expect(chained.data).toBe(10);
      }
    });

    it('should pass through failure', () => {
      const result: Result<number, string> = err('error');
      const chained = flatMap(result, (n: number) => ok(n * 2));

      expect(isFailure(chained)).toBe(true);
      if (isFailure(chained)) {
        expect(chained.error).toBe('error');
      }
    });

    it('should propagate inner failure', () => {
      const result = ok(5);
      const chained = flatMap(result, () => err('inner error'));

      expect(isFailure(chained)).toBe(true);
      if (isFailure(chained)) {
        expect(chained.error).toBe('inner error');
      }
    });
  });

  describe('mapError', () => {
    it('should transform error', () => {
      const result: Result<number, string> = err('error');
      const mapped = mapError(result, (e) => new Error(e));

      expect(isFailure(mapped)).toBe(true);
      if (isFailure(mapped)) {
        expect(mapped.error).toBeInstanceOf(Error);
        expect(mapped.error.message).toBe('error');
      }
    });

    it('should pass through success', () => {
      const result = ok(42);
      const mapped = mapError(result, (e: string) => new Error(e));

      expect(isSuccess(mapped)).toBe(true);
      if (isSuccess(mapped)) {
        expect(mapped.data).toBe(42);
      }
    });
  });

  describe('all', () => {
    it('should combine all successful results', () => {
      const results = [ok(1), ok(2), ok(3)];
      const combined = all(results);

      expect(isSuccess(combined)).toBe(true);
      if (isSuccess(combined)) {
        expect(combined.data).toEqual([1, 2, 3]);
      }
    });

    it('should return first failure', () => {
      const results: Result<number, string>[] = [
        ok(1),
        err('first error'),
        err('second error'),
      ];
      const combined = all(results);

      expect(isFailure(combined)).toBe(true);
      if (isFailure(combined)) {
        expect(combined.error).toBe('first error');
      }
    });

    it('should handle empty array', () => {
      const results: Result<number, string>[] = [];
      const combined = all(results);

      expect(isSuccess(combined)).toBe(true);
      if (isSuccess(combined)) {
        expect(combined.data).toEqual([]);
      }
    });
  });

  describe('fromPromise', () => {
    it('should convert resolved promise to success', async () => {
      const promise = Promise.resolve(42);
      const result = await fromPromise(promise);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toBe(42);
      }
    });

    it('should convert rejected promise to failure', async () => {
      const promise = Promise.reject(new Error('error'));
      const result = await fromPromise(promise);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });
  });

  describe('toPromise', () => {
    it('should convert success to resolved promise', async () => {
      const result = ok(42);
      const promise = toPromise(result);

      await expect(promise).resolves.toBe(42);
    });

    it('should convert failure to rejected promise', async () => {
      const result = err('error');
      const promise = toPromise(result);

      await expect(promise).rejects.toBe('error');
    });
  });
});

describe('Issue Type', () => {
  it('should have correct shape', () => {
    const issue: Issue = {
      number: 1,
      title: 'Test Issue',
      body: 'Test body',
      state: 'open',
      type: 'bug',
      labels: ['bug', 'high-priority'],
      assignees: ['user1'],
      context: {
        component: 'auth',
        priority: 'high',
        relatedFiles: ['src/auth/login.ts'],
        relatedSymbols: ['login'],
        source: 'github',
        sourceId: 'gh-123',
        sourceUrl: 'https://github.com/org/repo/issues/1',
      },
      codeAnalysis: {
        filePath: 'src/auth/login.ts',
        startLine: 10,
        endLine: 20,
        functionName: 'login',
        snippet: 'async function login() {}',
      },
      suggestedFix: {
        description: 'Add error handling',
        steps: ['Add try-catch', 'Log errors'],
        confidence: 0.8,
      },
      acceptanceCriteria: [
        {
          description: 'Login works',
          completed: false,
        },
      ],
      relatedIssues: [2, 3],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
      url: 'https://github.com/org/repo/issues/1',
    };

    expect(issue.number).toBe(1);
    expect(issue.context.priority).toBe('high');
    expect(issue.acceptanceCriteria).toHaveLength(1);
  });
});

describe('WorktreeInfo Type', () => {
  it('should have correct shape', () => {
    const worktree: WorktreeInfo = {
      path: '/tmp/worktree',
      branch: 'fix/issue-1',
      status: 'ready',
      issueNumbers: [1, 2],
      createdAt: new Date('2024-01-01'),
      lastActivityAt: new Date('2024-01-02'),
      headCommit: 'abc123',
    };

    expect(worktree.path).toBe('/tmp/worktree');
    expect(worktree.issueNumbers).toEqual([1, 2]);
  });

  it('should support error state', () => {
    const worktree: WorktreeInfo = {
      path: '/tmp/worktree',
      branch: 'fix/issue-1',
      status: 'error',
      issueNumbers: [1],
      createdAt: new Date(),
      lastActivityAt: new Date(),
      errorMessage: 'Failed to create',
    };

    expect(worktree.status).toBe('error');
    expect(worktree.errorMessage).toBe('Failed to create');
  });
});

describe('CheckResult Type', () => {
  it('should have correct shape for passed checks', () => {
    const result: CheckResult = {
      passed: true,
      results: [
        {
          check: 'test',
          passed: true,
          status: 'passed',
          durationMs: 1000,
          exitCode: 0,
        },
        {
          check: 'lint',
          passed: true,
          status: 'passed',
          durationMs: 500,
          exitCode: 0,
        },
      ],
      attempt: 1,
      totalDurationMs: 1500,
    };

    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.totalDurationMs).toBe(1500);
  });

  it('should handle failed checks with retries', () => {
    const result: CheckResult = {
      passed: false,
      results: [
        {
          check: 'test',
          passed: false,
          status: 'failed',
          durationMs: 1000,
          exitCode: 1,
          stderr: 'Test failed',
          error: 'Test suite failed',
        },
      ],
      attempt: 3,
      maxRetriesExceeded: true,
      previousErrors: [
        {
          attempt: 1,
          check: 'test',
          error: 'First attempt failed',
          timestamp: '2024-01-01T00:00:00Z',
        },
        {
          attempt: 2,
          check: 'test',
          error: 'Second attempt failed',
          timestamp: '2024-01-01T00:01:00Z',
        },
      ],
      totalDurationMs: 3000,
    };

    expect(result.passed).toBe(false);
    expect(result.attempt).toBe(3);
    expect(result.maxRetriesExceeded).toBe(true);
    expect(result.previousErrors).toHaveLength(2);
  });
});

describe('IssueGroup Type', () => {
  it('should have correct shape', () => {
    const group: IssueGroup = {
      id: 'group-1',
      name: 'Auth Component Fixes',
      groupBy: 'component',
      key: 'auth',
      issues: [],
      branchName: 'fix/auth-issues',
      relatedFiles: ['src/auth/login.ts', 'src/auth/signup.ts'],
      components: ['auth'],
      estimatedEffort: 5,
      priority: 'high',
    };

    expect(group.id).toBe('group-1');
    expect(group.groupBy).toBe('component');
    expect(group.relatedFiles).toHaveLength(2);
  });
});

describe('Config Type', () => {
  it('should have correct shape', () => {
    const config: Config = {
      github: {
        token: 'ghp_test',
        owner: 'org',
        repo: 'repo',
        defaultBranch: 'main',
        autoFixLabel: 'auto-fix',
        skipLabel: 'auto-fix-skip',
      },
      asana: {
        token: 'asana_test',
        workspaceGid: '123',
        projectGids: ['456'],
        triageSection: 'Triage',
        doneSection: 'Done',
      },
      worktree: {
        baseDir: '/tmp/worktrees',
        maxConcurrent: 3,
        autoCleanupMinutes: 60,
        prefix: 'autofix-',
      },
      checks: {
        testCommand: 'npm test',
        typeCheckCommand: 'npm run type-check',
        lintCommand: 'npm run lint',
        testTimeout: 300,
        maxRetries: 3,
      },
      logging: {
        level: 'info',
        pretty: true,
        redact: true,
      },
    };

    expect(config.github.owner).toBe('org');
    expect(config.worktree.maxConcurrent).toBe(3);
    expect(config.logging?.level).toBe('info');
  });

  it('should allow optional sentry config', () => {
    const config: Config = {
      github: {
        token: 'ghp_test',
        owner: 'org',
        repo: 'repo',
      },
      asana: {
        token: 'asana_test',
        workspaceGid: '123',
        projectGids: ['456'],
      },
      worktree: {
        baseDir: '/tmp/worktrees',
      },
      sentry: {
        dsn: 'https://sentry.io/123',
        organization: 'org',
        project: 'project',
      },
    };

    expect(config.sentry?.organization).toBe('org');
  });
});

describe('Type Discriminated Unions', () => {
  it('should correctly narrow WorktreeStatus union', () => {
    const statuses: Array<WorktreeInfo['status']> = [
      'creating',
      'ready',
      'in_use',
      'checking',
      'committing',
      'cleaning',
      'error',
    ];

    statuses.forEach((status) => {
      const worktree: WorktreeInfo = {
        path: '/tmp/worktree',
        branch: 'test',
        status,
        issueNumbers: [],
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      expect(worktree.status).toBe(status);
    });
  });

  it('should correctly narrow CheckStatus union', () => {
    const statuses: Array<import('../check.js').CheckStatus> = [
      'pending',
      'running',
      'passed',
      'failed',
      'skipped',
      'timeout',
    ];

    statuses.forEach((status) => {
      expect(status).toBeTruthy();
    });
  });

  it('should correctly narrow IssueType union', () => {
    const types: Array<import('../issue.js').IssueType> = [
      'bug',
      'feature',
      'refactor',
      'docs',
      'test',
      'chore',
    ];

    types.forEach((type) => {
      expect(type).toBeTruthy();
    });
  });
});

describe('Type Readonly Properties', () => {
  it('should have readonly properties on Issue', () => {
    const issue: Issue = {
      number: 1,
      title: 'Test',
      body: 'Test body',
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
      createdAt: new Date(),
      updatedAt: new Date(),
      url: 'https://github.com',
    };

    // This should cause a TypeScript error if properties are not readonly
    // @ts-expect-error - Testing readonly constraint
    issue.number = 2;
  });

  it('should have readonly arrays', () => {
    const issue: Issue = {
      number: 1,
      title: 'Test',
      body: 'Test body',
      state: 'open',
      type: 'bug',
      labels: ['test'],
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

    // This should cause a TypeScript error if arrays are not readonly
    // @ts-expect-error - Testing readonly array constraint
    issue.labels.push('new-label');
  });
});
