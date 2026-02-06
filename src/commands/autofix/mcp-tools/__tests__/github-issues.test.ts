/**
 * @module commands/autofix/mcp-tools/__tests__/github-issues
 * @description Tests for GitHubIssuesTool MCP tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GitHubIssuesTool,
  createGitHubIssuesTool,
  FetchIssuesParamsSchema,
} from '../github-issues.js';
import type { GitHubIssuesConfig } from '../github-issues.js';

// Store original fetch
const originalFetch = globalThis.fetch;

describe('FetchIssuesParamsSchema', () => {
  it('should accept valid params with all fields', () => {
    const input = {
      issueNumbers: [1, 2, 3],
      labels: ['bug'],
      excludeLabels: ['wontfix'],
      state: 'open',
      limit: 50,
    };
    const result = FetchIssuesParamsSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should accept empty params with defaults', () => {
    const result = FetchIssuesParamsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.state).toBe('open');
      expect(result.data.limit).toBe(50);
    }
  });

  it('should reject limit below 1', () => {
    const result = FetchIssuesParamsSchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject limit above 100', () => {
    const result = FetchIssuesParamsSchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it('should accept all state values', () => {
    for (const state of ['open', 'closed', 'all']) {
      const result = FetchIssuesParamsSchema.safeParse({ state });
      expect(result.success).toBe(true);
    }
  });
});

describe('GitHubIssuesTool', () => {
  const config: GitHubIssuesConfig = {
    token: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
    apiBaseUrl: 'https://api.test.com',
    autoFixLabel: 'auto-fix',
  };

  let tool: GitHubIssuesTool;
  let mockFetch: ReturnType<typeof vi.fn>;

  const makeGitHubIssue = (overrides: Record<string, any> = {}) => ({
    id: 1001,
    number: 1,
    title: 'Test Issue',
    body: 'Issue body',
    state: 'open',
    html_url: 'https://github.com/test-owner/test-repo/issues/1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    labels: [{ name: 'bug' }],
    assignees: [{ login: 'user1' }],
    ...overrides,
  });

  beforeEach(() => {
    tool = new GitHubIssuesTool(config);
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('static properties', () => {
    it('should have correct tool name', () => {
      expect(GitHubIssuesTool.toolName).toBe('github_issues_fetch');
    });

    it('should have correct tool description', () => {
      expect(GitHubIssuesTool.toolDescription).toBe(
        'Fetch GitHub issues for auto-fix processing'
      );
    });

    it('should have inputSchema', () => {
      expect(GitHubIssuesTool.inputSchema).toBeDefined();
    });
  });

  describe('fetchIssues', () => {
    it('should return INVALID_PARAMS for invalid input', async () => {
      const result = await tool.fetchIssues({
        limit: -1,
      } as any);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_PARAMS');
      }
    });

    describe('fetch by issue numbers', () => {
      it('should fetch specific issues by number', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({ number: 10 }),
        });

        const result = await tool.fetchIssues({
          issueNumbers: [10],
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.issues).toHaveLength(1);
          expect(result.data.issues[0]!.number).toBe(10);
          expect(result.data.totalCount).toBe(1);
          expect(result.data.hasMore).toBe(false);
        }

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.test.com/repos/test-owner/test-repo/issues/10',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token',
            }),
          })
        );
      });

      it('should skip 404 issues (returns null)', async () => {
        mockFetch
          .mockResolvedValueOnce({ ok: true, json: async () => makeGitHubIssue({ number: 1 }) })
          .mockResolvedValueOnce({ ok: false, status: 404 })
          .mockResolvedValueOnce({ ok: true, json: async () => makeGitHubIssue({ number: 3 }) });

        const result = await tool.fetchIssues({
          issueNumbers: [1, 2, 3],
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.issues).toHaveLength(2);
          expect(result.data.issues[0]!.number).toBe(1);
          expect(result.data.issues[1]!.number).toBe(3);
        }
      });

      it('should throw on non-404 API error for single issue', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        const result = await tool.fetchIssues({
          issueNumbers: [1],
        });

        expect(result.success).toBe(false);
      });
    });

    describe('fetch by labels', () => {
      it('should fetch issues by labels', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [
            makeGitHubIssue({ number: 1 }),
            makeGitHubIssue({ number: 2 }),
          ],
        });

        const result = await tool.fetchIssues({
          labels: ['bug'],
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.issues).toHaveLength(2);
          expect(result.data.totalCount).toBe(2);
        }
      });

      it('should use auto-fix label by default', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

        await tool.fetchIssues({});

        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('labels=auto-fix');
      });

      it('should use custom autoFixLabel when no labels provided', async () => {
        const customConfig: GitHubIssuesConfig = {
          ...config,
          autoFixLabel: 'custom-label',
        };
        const customTool = new GitHubIssuesTool(customConfig);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

        await customTool.fetchIssues({});

        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('labels=custom-label');
      });

      it('should use default autoFixLabel when not configured', async () => {
        const configNoLabel: GitHubIssuesConfig = {
          token: 'tok',
          owner: 'o',
          repo: 'r',
          apiBaseUrl: 'https://api.test.com',
        };
        const toolNoLabel = new GitHubIssuesTool(configNoLabel);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

        await toolNoLabel.fetchIssues({});

        const url = mockFetch.mock.calls[0][0] as string;
        expect(url).toContain('labels=auto-fix');
      });

      it('should filter out pull requests', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [
            makeGitHubIssue({ number: 1 }),
            makeGitHubIssue({ number: 2, pull_request: { url: 'pr-url' } }),
          ],
        });

        const result = await tool.fetchIssues({});

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.issues).toHaveLength(1);
          expect(result.data.issues[0]!.number).toBe(1);
        }
      });

      it('should filter out excluded labels', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [
            makeGitHubIssue({ number: 1, labels: [{ name: 'bug' }] }),
            makeGitHubIssue({ number: 2, labels: [{ name: 'wontfix' }] }),
          ],
        });

        const result = await tool.fetchIssues({
          excludeLabels: ['wontfix'],
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.issues).toHaveLength(1);
          expect(result.data.issues[0]!.number).toBe(1);
        }
      });

      it('should handle string labels in response', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [
            makeGitHubIssue({ number: 1, labels: ['bug', 'auto-fix'] }),
          ],
        });

        const result = await tool.fetchIssues({});

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.issues[0]!.labels).toEqual(['bug', 'auto-fix']);
        }
      });

      it('should set hasMore=true when issues count equals limit', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [
            makeGitHubIssue({ number: 1 }),
            makeGitHubIssue({ number: 2 }),
          ],
        });

        const result = await tool.fetchIssues({
          limit: 2,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.hasMore).toBe(true);
        }
      });

      it('should set hasMore=false when issues count is less than limit', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [
            makeGitHubIssue({ number: 1 }),
          ],
        });

        const result = await tool.fetchIssues({
          limit: 10,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.hasMore).toBe(false);
        }
      });

      it('should throw on API error for labels fetch', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        const result = await tool.fetchIssues({});

        expect(result.success).toBe(false);
      });
    });

    describe('issue mapping', () => {
      it('should map state correctly (open)', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({ state: 'open' }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.state).toBe('open');
        }
      });

      it('should map state correctly (closed)', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({ state: 'closed' }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.state).toBe('closed');
        }
      });

      it('should default to open for unknown state', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({ state: 'something' }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.state).toBe('open');
        }
      });

      it('should infer type from labels - bug', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({ labels: [{ name: 'bug' }] }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.type).toBe('bug');
        }
      });

      it('should infer type from labels - feature', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({ labels: [{ name: 'feature' }] }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.type).toBe('feature');
        }
      });

      it('should infer type from labels - refactor', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({ labels: [{ name: 'refactor' }] }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.type).toBe('refactor');
        }
      });

      it('should infer type from labels - docs', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({ labels: [{ name: 'documentation' }] }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.type).toBe('docs');
        }
      });

      it('should infer type from labels - test', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({ labels: [{ name: 'test' }] }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.type).toBe('test');
        }
      });

      it('should infer type from labels - chore', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({ labels: [{ name: 'chore' }] }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.type).toBe('chore');
        }
      });

      it('should default to bug when no type label', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({ labels: [{ name: 'auto-fix' }] }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.type).toBe('bug');
        }
      });

      it('should infer component from "component:" label', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            labels: [{ name: 'component:auth' }],
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.context.component).toBe('auth');
        }
      });

      it('should infer component from "area/" label', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            labels: [{ name: 'area/api' }],
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.context.component).toBe('api');
        }
      });

      it('should infer component from title bracket notation', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            title: '[Auth] Login fails',
            labels: [],
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.context.component).toBe('auth');
        }
      });

      it('should default component to general', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            title: 'Something broke',
            labels: [],
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.context.component).toBe('general');
        }
      });

      it('should infer priority from labels - critical/p0', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            labels: [{ name: 'critical' }],
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.context.priority).toBe('critical');
        }
      });

      it('should infer priority p0', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            labels: [{ name: 'P0' }],
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.context.priority).toBe('critical');
        }
      });

      it('should infer priority from labels - high/p1', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            labels: [{ name: 'priority:high' }],
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.context.priority).toBe('high');
        }
      });

      it('should infer priority p1', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            labels: [{ name: 'p1' }],
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.context.priority).toBe('high');
        }
      });

      it('should infer priority medium/p2', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            labels: [{ name: 'p2' }],
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.context.priority).toBe('medium');
        }
      });

      it('should infer priority low/p3', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            labels: [{ name: 'p3' }],
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.context.priority).toBe('low');
        }
      });

      it('should default priority to medium', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({ labels: [] }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.context.priority).toBe('medium');
        }
      });

      it('should extract related files from body', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            body: 'Error in `src/auth/login.ts` and `lib/utils/helper.js`',
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.context.relatedFiles).toContain('src/auth/login.ts');
          expect(result.data.issues[0]!.context.relatedFiles).toContain('lib/utils/helper.js');
        }
      });

      it('should extract related files with app/ prefix', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            body: 'Check app/routes/index.tsx',
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.context.relatedFiles).toContain('app/routes/index.tsx');
        }
      });

      it('should deduplicate related files', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            body: 'Error in src/main.ts and also src/main.ts again',
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          const files = result.data.issues[0]!.context.relatedFiles;
          const uniqueFiles = [...new Set(files)];
          expect(files.length).toBe(uniqueFiles.length);
        }
      });

      it('should extract related issues from body', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            body: 'Related to #42 and #99',
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.relatedIssues).toContain(42);
          expect(result.data.issues[0]!.relatedIssues).toContain(99);
        }
      });

      it('should deduplicate related issues', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            body: '#42 #42 #42',
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.relatedIssues).toEqual([42]);
        }
      });

      it('should handle null body', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({ body: null }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.body).toBe('');
          expect(result.data.issues[0]!.context.relatedFiles).toEqual([]);
          expect(result.data.issues[0]!.relatedIssues).toEqual([]);
        }
      });

      it('should handle missing assignees', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({ assignees: undefined }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.assignees).toEqual([]);
        }
      });

      it('should set source to github with correct sourceId/sourceUrl', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => makeGitHubIssue({
            id: 555,
            html_url: 'https://github.com/o/r/issues/1',
          }),
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        if (result.success) {
          expect(result.data.issues[0]!.context.source).toBe('github');
          expect(result.data.issues[0]!.context.sourceId).toBe('555');
          expect(result.data.issues[0]!.context.sourceUrl).toBe(
            'https://github.com/o/r/issues/1'
          );
        }
      });
    });

    describe('error mapping', () => {
      it('should map 401 to AUTH_FAILED', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        });

        const result = await tool.fetchIssues({ issueNumbers: [1] });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('AUTH_FAILED');
        }
      });

      it('should map 403 to RATE_LIMITED', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'rate limit exceeded',
        });

        const result = await tool.fetchIssues({
          labels: ['auto-fix'],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('RATE_LIMITED');
        }
      });

      it('should map 404 to NOT_FOUND (labels fetch)', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

        const result = await tool.fetchIssues({
          labels: ['auto-fix'],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('NOT_FOUND');
        }
      });

      it('should map network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('network fetch failed'));

        const result = await tool.fetchIssues({
          labels: ['auto-fix'],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('NETWORK_ERROR');
        }
      });

      it('should map non-Error to UNKNOWN', async () => {
        mockFetch.mockRejectedValueOnce('string error');

        const result = await tool.fetchIssues({
          labels: ['auto-fix'],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('UNKNOWN');
          expect(result.error.message).toBe('string error');
        }
      });

      it('should map unknown Error to UNKNOWN', async () => {
        mockFetch.mockRejectedValueOnce(new Error('something else'));

        const result = await tool.fetchIssues({
          labels: ['auto-fix'],
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('UNKNOWN');
        }
      });
    });
  });

  describe('default api base URL', () => {
    it('should use default github.com URL when not configured', async () => {
      const toolDefault = new GitHubIssuesTool({
        token: 'tok',
        owner: 'o',
        repo: 'r',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeGitHubIssue(),
      });

      await toolDefault.fetchIssues({ issueNumbers: [1] });

      expect(mockFetch.mock.calls[0][0]).toContain('https://api.github.com/');
    });
  });
});

describe('createGitHubIssuesTool', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should return tool definition with correct properties', () => {
    const toolDef = createGitHubIssuesTool({
      token: 'tok',
      owner: 'o',
      repo: 'r',
    });

    expect(toolDef.name).toBe('github_issues_fetch');
    expect(toolDef.description).toBe('Fetch GitHub issues for auto-fix processing');
    expect(toolDef.inputSchema.type).toBe('object');
  });

  it('should have handler that fetches issues', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const toolDef = createGitHubIssuesTool({
      token: 'tok',
      owner: 'o',
      repo: 'r',
    });

    const result = await toolDef.handler({
      labels: ['bug'],
    });

    expect(result.success).toBe(true);
  });
});
