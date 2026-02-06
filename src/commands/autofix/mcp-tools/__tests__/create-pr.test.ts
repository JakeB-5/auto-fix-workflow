/**
 * @module commands/autofix/mcp-tools/__tests__/create-pr
 * @description Tests for CreatePRTool MCP tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CreatePRTool,
  createCreatePRTool,
  CreatePRInputSchema,
} from '../create-pr.js';
import type { CreatePRConfig, CreatePRInput } from '../create-pr.js';
import type { Issue, CreatePRParams } from '../../../../common/types/index.js';

// Store original fetch
const originalFetch = globalThis.fetch;

describe('CreatePRInputSchema', () => {
  it('should accept valid input with all fields', () => {
    const input = {
      title: 'Fix bug',
      body: 'Description',
      headBranch: 'fix/bug-1',
      baseBranch: 'main',
      linkedIssues: [1, 2],
      labels: ['bug'],
      reviewers: ['user1'],
      draft: true,
    };
    const result = CreatePRInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept minimal required input', () => {
    const input = {
      title: 'Fix',
      body: 'desc',
      headBranch: 'fix/branch',
    };
    const result = CreatePRInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.baseBranch).toBe('main');
      expect(result.data.draft).toBe(false);
    }
  });

  it('should reject empty title', () => {
    const input = {
      title: '',
      body: 'desc',
      headBranch: 'fix/branch',
    };
    const result = CreatePRInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject title exceeding 256 chars', () => {
    const input = {
      title: 'x'.repeat(257),
      body: 'desc',
      headBranch: 'fix/branch',
    };
    const result = CreatePRInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject missing headBranch', () => {
    const input = {
      title: 'Fix',
      body: 'desc',
    };
    const result = CreatePRInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('CreatePRTool', () => {
  const config: CreatePRConfig = {
    token: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
    apiBaseUrl: 'https://api.test.com',
  };

  let tool: CreatePRTool;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tool = new CreatePRTool(config);
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('static properties', () => {
    it('should have correct tool name', () => {
      expect(CreatePRTool.toolName).toBe('create_pr');
    });

    it('should have correct tool description', () => {
      expect(CreatePRTool.toolDescription).toBe('Create a pull request on GitHub');
    });
  });

  describe('createPR', () => {
    const basePRResponse = {
      number: 42,
      title: 'Fix bug',
      body: 'Description',
      state: 'open',
      draft: false,
      html_url: 'https://github.com/test-owner/test-repo/pull/42',
      created_at: '2026-01-30T10:00:00Z',
      updated_at: '2026-01-30T10:00:00Z',
      head: { ref: 'fix/bug-1' },
      base: { ref: 'main' },
      labels: [{ name: 'bug' }],
      requested_reviewers: [{ login: 'reviewer1' }],
      changed_files: 3,
      additions: 50,
      deletions: 10,
    };

    it('should create PR successfully with basic params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => basePRResponse,
      });

      const params: CreatePRParams = {
        title: 'Fix bug',
        body: 'Description',
        headBranch: 'fix/bug-1',
        baseBranch: 'main',
      };

      const result = await tool.createPR(params);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.number).toBe(42);
        expect(result.data.title).toBe('Fix bug');
        expect(result.data.headBranch).toBe('fix/bug-1');
        expect(result.data.baseBranch).toBe('main');
        expect(result.data.labels).toEqual(['bug']);
        expect(result.data.reviewers).toEqual(['reviewer1']);
        expect(result.data.changedFiles).toBe(3);
        expect(result.data.additions).toBe(50);
        expect(result.data.deletions).toBe(10);
        expect(result.data.url).toBe('https://github.com/test-owner/test-repo/pull/42');
      }

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/repos/test-owner/test-repo/pulls',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should use default baseBranch when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => basePRResponse,
      });

      const params: CreatePRParams = {
        title: 'Fix',
        body: 'Description',
        headBranch: 'fix/bug-1',
      };

      await tool.createPR(params);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.base).toBe('main');
    });

    it('should use default api base URL when not configured', async () => {
      const configNoBase: CreatePRConfig = {
        token: 'tok',
        owner: 'o',
        repo: 'r',
      };
      const toolNoBase = new CreatePRTool(configNoBase);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => basePRResponse,
      });

      await toolNoBase.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      expect(mockFetch.mock.calls[0][0]).toContain('https://api.github.com/');
    });

    it('should build body with linked issues', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => basePRResponse,
      });

      const params: CreatePRParams = {
        title: 'Fix',
        body: 'Description',
        headBranch: 'fix/branch',
        linkedIssues: [10, 20],
      };

      await tool.createPR(params);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.body).toContain('Closes #10');
      expect(callBody.body).toContain('Closes #20');
      expect(callBody.body).toContain('auto-generated by auto-fix-workflow');
    });

    it('should add labels when specified', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => basePRResponse,
        })
        .mockResolvedValueOnce({ ok: true });

      const params: CreatePRParams = {
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/branch',
        labels: ['bug', 'auto-fix'],
      };

      await tool.createPR(params);

      // Second call should be addLabels
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const labelsCall = mockFetch.mock.calls[1];
      expect(labelsCall[0]).toContain('/issues/42/labels');
      const labelsBody = JSON.parse(labelsCall[1].body);
      expect(labelsBody.labels).toEqual(['bug', 'auto-fix']);
    });

    it('should request reviewers when specified', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => basePRResponse,
        })
        .mockResolvedValueOnce({ ok: true });

      const params: CreatePRParams = {
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/branch',
        reviewers: ['user1', 'user2'],
      };

      await tool.createPR(params);

      // Second call should be requestReviewers
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const reviewersCall = mockFetch.mock.calls[1];
      expect(reviewersCall[0]).toContain('/pulls/42/requested_reviewers');
      const reviewersBody = JSON.parse(reviewersCall[1].body);
      expect(reviewersBody.reviewers).toEqual(['user1', 'user2']);
    });

    it('should add both labels and reviewers when both specified', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => basePRResponse,
        })
        .mockResolvedValueOnce({ ok: true }) // labels
        .mockResolvedValueOnce({ ok: true }); // reviewers

      const params: CreatePRParams = {
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/branch',
        labels: ['bug'],
        reviewers: ['user1'],
      };

      await tool.createPR(params);

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should create draft PR when draft is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...basePRResponse, draft: true }),
      });

      const params: CreatePRParams = {
        title: 'WIP',
        body: 'Desc',
        headBranch: 'fix/branch',
        draft: true,
      };

      const result = await tool.createPR(params);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.draft).toBe(true);

      if (result.success) {
        expect(result.data.state).toBe('draft');
      }
    });

    it('should map PR state correctly for open', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...basePRResponse, state: 'open', draft: false }),
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      if (result.success) {
        expect(result.data.state).toBe('open');
      }
    });

    it('should map PR state correctly for closed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...basePRResponse, state: 'closed' }),
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      if (result.success) {
        expect(result.data.state).toBe('closed');
      }
    });

    it('should map PR state correctly for merged', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...basePRResponse, state: 'merged' }),
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      if (result.success) {
        expect(result.data.state).toBe('merged');
      }
    });

    it('should default PR state to open for unknown state', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...basePRResponse, state: 'something-else', draft: undefined }),
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      if (result.success) {
        expect(result.data.state).toBe('open');
      }
    });

    it('should handle null body in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...basePRResponse, body: null }),
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      if (result.success) {
        expect(result.data.body).toBe('');
      }
    });

    it('should handle missing requested_reviewers in response', async () => {
      const responseNoReviewers = { ...basePRResponse };
      delete (responseNoReviewers as any).requested_reviewers;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => responseNoReviewers,
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      if (result.success) {
        expect(result.data.reviewers).toEqual([]);
      }
    });

    it('should handle missing changed_files/additions/deletions in response', async () => {
      const resp = { ...basePRResponse };
      delete (resp as any).changed_files;
      delete (resp as any).additions;
      delete (resp as any).deletions;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => resp,
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      if (result.success) {
        expect(result.data.changedFiles).toBe(0);
        expect(result.data.additions).toBe(0);
        expect(result.data.deletions).toBe(0);
      }
    });

    // Error handling
    it('should return AUTH_FAILED on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Bad credentials' }),
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AUTH_FAILED');
      }
    });

    it('should return BRANCH_NOT_FOUND on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not Found' }),
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('BRANCH_NOT_FOUND');
        expect(result.error.message).toBe('Not Found');
      }
    });

    it('should return BRANCH_NOT_FOUND with default message on 404 without message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('BRANCH_NOT_FOUND');
        expect(result.error.message).toBe('Branch or repository not found');
      }
    });

    it('should return PR_EXISTS on 422 with pull request already exists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'A pull request already exists for this branch' }),
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PR_EXISTS');
      }
    });

    it('should return VALIDATION_FAILED on 422 without PR exists message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Validation failed: title is required' }),
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
      }
    });

    it('should return VALIDATION_FAILED with default message on 422 without message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({}),
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toBe('Validation failed');
      }
    });

    it('should return API_ERROR on other status codes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal Server Error' }),
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('API_ERROR');
      }
    });

    it('should return API_ERROR with default message on unknown status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('API_ERROR');
        expect(result.error.message).toContain('503');
      }
    });

    it('should handle json parse failure on error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('invalid json'); },
      });

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('API_ERROR');
      }
    });

    it('should return UNKNOWN on thrown Error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failed'));

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNKNOWN');
        expect(result.error.message).toBe('Network failed');
        expect(result.error.cause).toBeInstanceOf(Error);
      }
    });

    it('should return UNKNOWN on thrown non-Error', async () => {
      mockFetch.mockRejectedValueOnce('string error');

      const result = await tool.createPR({
        title: 'Fix',
        body: 'Desc',
        headBranch: 'fix/x',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNKNOWN');
        expect(result.error.message).toBe('string error');
      }
    });
  });

  describe('createPRFromIssues', () => {
    const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
      number: 1,
      title: 'Test Issue',
      body: 'Body',
      state: 'open',
      type: 'bug',
      labels: ['bug'],
      assignees: [],
      context: {
        component: 'auth',
        priority: 'medium',
        relatedFiles: [],
        relatedSymbols: [],
        source: 'github',
      },
      acceptanceCriteria: [],
      relatedIssues: [],
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
      url: 'https://github.com/test/test/issues/1',
      ...overrides,
    });

    it('should create PR from single issue', async () => {
      const prResponse = {
        number: 10,
        title: 'fix: Test Issue',
        body: 'Body',
        state: 'open',
        draft: false,
        html_url: 'https://github.com/test/test/pull/10',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        head: { ref: 'fix/branch' },
        base: { ref: 'main' },
        labels: [],
        requested_reviewers: [],
      };

      // PR creation + labels
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => prResponse })
        .mockResolvedValueOnce({ ok: true });

      const issues = [makeIssue()];
      const result = await tool.createPRFromIssues(issues, 'fix/branch');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.number).toBe(10);
      }

      // Verify PR body contains issue reference
      const createCallBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(createCallBody.title).toBe('fix: Test Issue');
    });

    it('should create PR title for multiple issues with same component', async () => {
      const prResponse = {
        number: 11,
        title: 'fix(auth): address 2 issues',
        body: '',
        state: 'open',
        draft: false,
        html_url: 'https://github.com/test/test/pull/11',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        head: { ref: 'fix/branch' },
        base: { ref: 'main' },
        labels: [],
        requested_reviewers: [],
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => prResponse })
        .mockResolvedValueOnce({ ok: true });

      const issues = [
        makeIssue({ number: 1, title: 'Bug 1' }),
        makeIssue({ number: 2, title: 'Bug 2' }),
      ];

      await tool.createPRFromIssues(issues, 'fix/branch');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.title).toBe('fix(auth): address 2 issues');
    });

    it('should create PR title for multiple issues with different components', async () => {
      const prResponse = {
        number: 12,
        title: 'fix: address 2 issues',
        body: '',
        state: 'open',
        draft: false,
        html_url: 'https://github.com/test/test/pull/12',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        head: { ref: 'fix/branch' },
        base: { ref: 'main' },
        labels: [],
        requested_reviewers: [],
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => prResponse })
        .mockResolvedValueOnce({ ok: true });

      const issues = [
        makeIssue({ number: 1, context: { ...makeIssue().context, component: 'auth' } }),
        makeIssue({ number: 2, context: { ...makeIssue().context, component: 'api' } }),
      ];

      await tool.createPRFromIssues(issues, 'fix/branch');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.title).toBe('fix: address 2 issues');
    });

    it('should include suggestedFix in PR body when available', async () => {
      const prResponse = {
        number: 13,
        title: 'fix: Issue',
        body: '',
        state: 'open',
        draft: false,
        html_url: 'https://github.com/test/test/pull/13',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        head: { ref: 'fix/branch' },
        base: { ref: 'main' },
        labels: [],
        requested_reviewers: [],
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => prResponse })
        .mockResolvedValueOnce({ ok: true });

      const issues = [
        makeIssue({
          suggestedFix: {
            description: 'Add null check',
            steps: ['Step 1'],
            confidence: 0.9,
          },
        }),
      ];

      await tool.createPRFromIssues(issues, 'fix/branch');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.body).toContain('Add null check');
    });

    it('should extract labels including priority:critical', async () => {
      const prResponse = {
        number: 14,
        title: 'fix: Issue',
        body: '',
        state: 'open',
        draft: false,
        html_url: 'https://github.com/test/test/pull/14',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        head: { ref: 'fix/branch' },
        base: { ref: 'main' },
        labels: [],
        requested_reviewers: [],
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => prResponse })
        .mockResolvedValueOnce({ ok: true });

      const issues = [
        makeIssue({
          context: { ...makeIssue().context, priority: 'critical' },
        }),
      ];

      await tool.createPRFromIssues(issues, 'fix/branch');

      // The second fetch call should be addLabels
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const labelsBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(labelsBody.labels).toContain('priority:critical');
      expect(labelsBody.labels).toContain('auto-fix');
    });

    it('should extract labels including priority:high when no critical', async () => {
      const prResponse = {
        number: 15,
        title: 'fix: Issue',
        body: '',
        state: 'open',
        draft: false,
        html_url: 'https://github.com/test/test/pull/15',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        head: { ref: 'fix/branch' },
        base: { ref: 'main' },
        labels: [],
        requested_reviewers: [],
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => prResponse })
        .mockResolvedValueOnce({ ok: true });

      const issues = [
        makeIssue({
          context: { ...makeIssue().context, priority: 'high' },
        }),
      ];

      await tool.createPRFromIssues(issues, 'fix/branch');

      const labelsBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(labelsBody.labels).toContain('priority:high');
    });

    it('should use custom baseBranch', async () => {
      const prResponse = {
        number: 16,
        title: 'fix: Issue',
        body: '',
        state: 'open',
        draft: false,
        html_url: 'https://github.com/test/test/pull/16',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        head: { ref: 'fix/branch' },
        base: { ref: 'develop' },
        labels: [],
        requested_reviewers: [],
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => prResponse })
        .mockResolvedValueOnce({ ok: true });

      await tool.createPRFromIssues([makeIssue()], 'fix/branch', 'develop');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.base).toBe('develop');
    });
  });
});

describe('createCreatePRTool', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should return tool definition with correct name and description', () => {
    const toolDef = createCreatePRTool({
      token: 'tok',
      owner: 'o',
      repo: 'r',
    });

    expect(toolDef.name).toBe('create_pr');
    expect(toolDef.description).toBe('Create a pull request on GitHub');
    expect(toolDef.inputSchema.type).toBe('object');
    expect(toolDef.inputSchema.required).toEqual(['title', 'body', 'headBranch']);
  });

  it('should have handler that creates PR', async () => {
    const prResponse = {
      number: 99,
      title: 'Fix',
      body: 'Desc',
      state: 'open',
      draft: false,
      html_url: 'https://github.com/o/r/pull/99',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      head: { ref: 'fix/x' },
      base: { ref: 'main' },
      labels: [],
      requested_reviewers: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => prResponse,
    });

    const toolDef = createCreatePRTool({
      token: 'tok',
      owner: 'o',
      repo: 'r',
    });

    const result = await toolDef.handler({
      title: 'Fix',
      body: 'Desc',
      headBranch: 'fix/x',
      baseBranch: 'main',
      draft: false,
    });

    expect(result.success).toBe(true);
  });

  it('should pass linkedIssues, labels, reviewers from handler params', async () => {
    const prResponse = {
      number: 100,
      title: 'Fix',
      body: 'Desc',
      state: 'open',
      draft: false,
      html_url: 'https://github.com/o/r/pull/100',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      head: { ref: 'fix/x' },
      base: { ref: 'main' },
      labels: [],
      requested_reviewers: [],
    };

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => prResponse })
      .mockResolvedValueOnce({ ok: true }) // labels
      .mockResolvedValueOnce({ ok: true }); // reviewers

    const toolDef = createCreatePRTool({
      token: 'tok',
      owner: 'o',
      repo: 'r',
    });

    await toolDef.handler({
      title: 'Fix',
      body: 'Desc',
      headBranch: 'fix/x',
      baseBranch: 'main',
      draft: false,
      linkedIssues: [1, 2],
      labels: ['bug'],
      reviewers: ['user1'],
    });

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
