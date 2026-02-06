/**
 * @module github/create-issue/__tests__/create-issue
 * @description Unit tests for GitHub issue creation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createIssue, createIssueFromPartial } from '../create-issue.js';
import type { CreateIssueParams } from '../types.js';
import type { Issue } from '../../../common/types/index.js';

// Create shared mock functions
const mockCreate = vi.fn();
const mockSearch = vi.fn();

// Mock Octokit
vi.mock('@octokit/rest', () => {
  return {
    Octokit: vi.fn().mockImplementation(function () {
      return {
        rest: {
          issues: {
            create: mockCreate,
          },
          search: {
            issuesAndPullRequests: mockSearch,
          },
        },
      };
    }),
  };
});

describe('createIssue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockReset();
    mockSearch.mockReset();
    process.env.GITHUB_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  describe('basic issue creation', () => {
    it('should create issue successfully', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
        labels: ['bug'],
      };

      const mockResponse = {
        data: {
          number: 123,
          title: 'Test issue',
          body: 'Test description',
          state: 'open',
          labels: [{ name: 'bug' }],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/123',
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await createIssue(params, {
        token: 'test-token',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.number).toBe(123);
        expect(result.data.title).toBe('Test issue');
        expect(result.data.state).toBe('open');
        expect(result.data.labels).toContain('bug');
      }

      expect(mockCreate).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
        labels: ['bug'],
        assignees: undefined,
        milestone: undefined,
      });
    });

    it('should create issue with multiple labels', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
        labels: ['bug', 'priority:high', 'component:auth'],
      };

      const mockResponse = {
        data: {
          number: 124,
          title: 'Test issue',
          body: 'Test description',
          state: 'open',
          labels: [
            { name: 'bug' },
            { name: 'priority:high' },
            { name: 'component:auth' },
          ],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/124',
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await createIssue(params, {
        token: 'test-token',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.labels).toHaveLength(3);
        expect(result.data.labels).toContain('bug');
        expect(result.data.labels).toContain('priority:high');
        expect(result.data.labels).toContain('component:auth');
      }
    });

    it('should create issue with assignees', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
        assignees: ['user1', 'user2'],
      };

      const mockResponse = {
        data: {
          number: 125,
          title: 'Test issue',
          body: 'Test description',
          state: 'open',
          labels: [],
          assignees: [{ login: 'user1' }, { login: 'user2' }],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/125',
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await createIssue(params, {
        token: 'test-token',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.assignees).toEqual(['user1', 'user2']);
      }
    });

    it('should create issue with milestone', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
        milestone: 5,
      };

      const mockResponse = {
        data: {
          number: 126,
          title: 'Test issue',
          body: 'Test description',
          state: 'open',
          labels: [],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/126',
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await createIssue(params, {
        token: 'test-token',
      });

      expect(result.success).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          milestone: 5,
        })
      );
    });
  });

  describe('auto-fix label', () => {
    it('should add auto-fix label when no labels provided', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
      };

      const mockResponse = {
        data: {
          number: 127,
          title: 'Test issue',
          body: 'Test description',
          state: 'open',
          labels: [],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/127',
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await createIssue(params, {
        token: 'test-token',
        autoInferLabels: true,
      });

      expect(result.success).toBe(true);
      expect(mockCreate).toHaveBeenCalled();
    });

    it('should not override existing labels', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
        labels: ['custom-label'],
      };

      const mockResponse = {
        data: {
          number: 128,
          title: 'Test issue',
          body: 'Test description',
          state: 'open',
          labels: [{ name: 'custom-label' }],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/128',
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await createIssue(params, {
        token: 'test-token',
        autoInferLabels: true,
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.labels).toContain('custom-label');
      }
    });
  });

  describe('duplicate check', () => {
    it('should check for duplicates when enabled', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test duplicate issue',
        body: 'Test description',
      };

      // Mock search to return potential duplicate
      mockSearch.mockResolvedValueOnce({
        data: {
          items: [
            {
              number: 100,
              title: 'Test duplicate issue',
              body: 'Test description',
              state: 'open',
              labels: [],
              assignees: [],
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
              html_url: 'https://github.com/test-owner/test-repo/issues/100',
            },
          ],
        },
      });

      const result = await createIssue(params, {
        token: 'test-token',
        checkDuplicates: true,
        duplicateCheckOptions: {
          similarityThreshold: 0.9,
        },
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('DUPLICATE_ISSUE');
        expect(result.error.message).toContain('duplicate');
      }

      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should create issue when no duplicates found', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Unique issue',
        body: 'Test description',
      };

      // Mock search to return no duplicates
      mockSearch.mockResolvedValueOnce({
        data: {
          items: [],
        },
      });

      const mockResponse = {
        data: {
          number: 129,
          title: 'Unique issue',
          body: 'Test description',
          state: 'open',
          labels: [],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/129',
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await createIssue(params, {
        token: 'test-token',
        checkDuplicates: true,
      });

      expect(result.success).toBe(true);
      expect(mockCreate).toHaveBeenCalled();
    });

    it('should skip duplicate check when disabled', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
      };

      const mockResponse = {
        data: {
          number: 130,
          title: 'Test issue',
          body: 'Test description',
          state: 'open',
          labels: [],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/130',
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await createIssue(params, {
        token: 'test-token',
        checkDuplicates: false,
      });

      expect(result.success).toBe(true);
      expect(mockSearch).not.toHaveBeenCalled();
    });
  });

  describe('template validation', () => {
    it('should validate required parameters', async () => {
      const params = {
        owner: '',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
      } as CreateIssueParams;

      const result = await createIssue(params, {
        token: 'test-token',
      });

      // Should handle empty owner gracefully
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.message).toBeTruthy();
      }
    });

    it('should handle empty title', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: '',
        body: 'Test description',
      };

      mockCreate.mockRejectedValueOnce({
        status: 422,
        message: 'Validation Failed',
      });

      const result = await createIssue(params, {
        token: 'test-token',
      });

      expect(result.success).toBe(false);
    });

    it('should handle empty body', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: '',
      };

      const mockResponse = {
        data: {
          number: 131,
          title: 'Test issue',
          body: '',
          state: 'open',
          labels: [],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/131',
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await createIssue(params, {
        token: 'test-token',
      });

      expect(result.success).toBe(true);
    });

    it('should filter invalid labels', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
        labels: [
          'valid-label',
          '',
          'a'.repeat(60), // Too long
          '   ', // Whitespace only
        ],
      };

      const mockResponse = {
        data: {
          number: 132,
          title: 'Test issue',
          body: 'Test description',
          state: 'open',
          labels: [{ name: 'valid-label' }],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/132',
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await createIssue(params, {
        token: 'test-token',
      });

      expect(result.success).toBe(true);

      // Should only call with valid labels
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: ['valid-label'],
        })
      );
    });
  });

  describe('Asana integration', () => {
    it('should create issue from Asana task data', async () => {
      const partialIssue: Partial<Issue> & { title: string; body: string } = {
        title: '[BUG] Asana task issue',
        body: 'Description from Asana\n\nSteps to reproduce:\n1. Do this\n2. Do that',
        labels: ['type:bug', 'source:asana'],
        context: {
          component: 'auth',
          priority: 'high',
          relatedFiles: ['src/auth/login.ts'],
          relatedSymbols: ['handleLogin'],
          source: 'asana',
          sourceId: 'asana-123',
          sourceUrl: 'https://app.asana.com/0/123',
        },
      };

      const mockResponse = {
        data: {
          number: 133,
          title: '[BUG] Asana task issue',
          body: partialIssue.body,
          state: 'open',
          labels: [{ name: 'type:bug' }, { name: 'source:asana' }],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/133',
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await createIssueFromPartial(partialIssue, {
        owner: 'test-owner',
        repo: 'test-repo',
        token: 'test-token',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.title).toBe('[BUG] Asana task issue');
        expect(result.data.labels).toContain('type:bug');
        expect(result.data.labels).toContain('source:asana');
      }
    });

    it('should preserve context information', async () => {
      const partialIssue: Partial<Issue> & { title: string; body: string } = {
        title: 'Test issue',
        body: 'Test description',
        context: {
          component: 'ui',
          priority: 'critical',
          relatedFiles: ['src/components/Button.tsx'],
          relatedSymbols: ['Button', 'handleClick'],
          source: 'asana',
          sourceId: 'task-456',
        },
      };

      const mockResponse = {
        data: {
          number: 134,
          title: 'Test issue',
          body: 'Test description',
          state: 'open',
          labels: [],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/134',
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await createIssueFromPartial(partialIssue, {
        owner: 'test-owner',
        repo: 'test-repo',
        token: 'test-token',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('API error handling', () => {
    it('should handle authentication error', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
      };

      mockCreate.mockRejectedValueOnce({
        status: 401,
        message: 'Bad credentials',
      });

      const result = await createIssue(params, {
        token: 'invalid-token',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.status).toBe(401);
        expect(result.error.message).toContain('credentials');
      }
    });

    it('should handle not found error', async () => {
      const params: CreateIssueParams = {
        owner: 'non-existent',
        repo: 'repo',
        title: 'Test issue',
        body: 'Test description',
      };

      mockCreate.mockRejectedValueOnce({
        status: 404,
        message: 'Not Found',
      });

      const result = await createIssue(params, {
        token: 'test-token',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.status).toBe(404);
      }
    });

    it('should handle validation error', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
        labels: ['invalid label with spaces'],
      };

      mockCreate.mockRejectedValueOnce({
        status: 422,
        message: 'Validation Failed',
      });

      const result = await createIssue(params, {
        token: 'test-token',
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.status).toBe(422);
      }
    });

    it('should handle rate limit error', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
      };

      mockCreate.mockRejectedValueOnce({
        status: 429,
        message: 'API rate limit exceeded',
      });

      const result = await createIssue(params, {
        token: 'test-token',
        maxRetries: 1,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.status).toBe(429);
        expect(result.error.message).toContain('rate limit');
      }
    });

    it('should handle network error', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
      };

      const networkError = new Error('Connection refused');
      (networkError as any).code = 'ECONNREFUSED';

      mockCreate.mockRejectedValueOnce(networkError);

      const result = await createIssue(params, {
        token: 'test-token',
        maxRetries: 1,
      });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.code).toBe('ECONNREFUSED');
      }
    });

    it('should retry on retryable errors', async () => {
      vi.useFakeTimers();

      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
      };

      // Fail first 2 attempts, succeed on 3rd
      mockCreate
        .mockRejectedValueOnce({
          code: 'ETIMEDOUT',
          message: 'Timeout',
        })
        .mockRejectedValueOnce({
          code: 'ETIMEDOUT',
          message: 'Timeout',
        })
        .mockResolvedValueOnce({
          data: {
            number: 135,
            title: 'Test issue',
            body: 'Test description',
            state: 'open',
            labels: [],
            assignees: [],
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            html_url: 'https://github.com/test-owner/test-repo/issues/135',
          },
        });

      const resultPromise = createIssue(params, {
        token: 'test-token',
        maxRetries: 3,
      });

      // Advance fake timers to skip retry delays (1s + 2s)
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockCreate).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it('should stop retrying after max attempts', async () => {
      vi.useFakeTimers();

      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
      };

      mockCreate.mockRejectedValue({
        code: 'ETIMEDOUT',
        message: 'Timeout',
      });

      const resultPromise = createIssue(params, {
        token: 'test-token',
        maxRetries: 3,
      });

      // Advance fake timers to skip retry delays (1s + 2s)
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(mockCreate).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it('should not retry on non-retryable errors', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
      };

      mockCreate.mockRejectedValueOnce({
        status: 404,
        message: 'Not Found',
      });

      const result = await createIssue(params, {
        token: 'test-token',
        maxRetries: 3,
      });

      expect(result.success).toBe(false);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('required parameter validation', () => {
    it('should require owner parameter', async () => {
      const params = {
        owner: '',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
      } as CreateIssueParams;

      mockCreate.mockRejectedValueOnce({
        status: 422,
        message: 'Validation Failed',
      });

      const result = await createIssue(params, {
        token: 'test-token',
      });

      expect(result.success).toBe(false);
    });

    it('should require repo parameter', async () => {
      const params = {
        owner: 'test-owner',
        repo: '',
        title: 'Test issue',
        body: 'Test description',
      } as CreateIssueParams;

      mockCreate.mockRejectedValueOnce({
        status: 422,
        message: 'Validation Failed',
      });

      const result = await createIssue(params, {
        token: 'test-token',
      });

      expect(result.success).toBe(false);
    });

    it('should require title parameter', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: '',
        body: 'Test description',
      };

      mockCreate.mockRejectedValueOnce({
        status: 422,
        message: 'Validation Failed',
      });

      const result = await createIssue(params, {
        token: 'test-token',
      });

      expect(result.success).toBe(false);
    });

    it('should allow empty body', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: '',
      };

      const mockResponse = {
        data: {
          number: 136,
          title: 'Test issue',
          body: '',
          state: 'open',
          labels: [],
          assignees: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/136',
        },
      };

      mockCreate.mockResolvedValueOnce(mockResponse);

      const result = await createIssue(params, {
        token: 'test-token',
      });

      expect(result.success).toBe(true);
    });

    it('should require valid token', async () => {
      const params: CreateIssueParams = {
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test issue',
        body: 'Test description',
      };

      mockCreate.mockRejectedValueOnce({
        status: 401,
        message: 'Bad credentials',
      });

      const result = await createIssue(params, {
        token: '',
      });

      expect(result.success).toBe(false);
    });
  });
});
