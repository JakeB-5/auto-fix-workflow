/**
 * @module git/manage-worktree/__tests__/create.test
 * @description createWorktree 함수 단위 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWorktree } from '../create.js';
import type { CreateWorktreeParams } from '../../../common/types/index.js';
import type { WorktreeOptions } from '../types.js';
import { isSuccess, isFailure } from '../../../common/types/index.js';

// simple-git 모킹
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    revparse: vi.fn(),
    branchLocal: vi.fn(),
    raw: vi.fn(),
    log: vi.fn(),
  })),
}));

describe('createWorktree', () => {
  const mockOptions: WorktreeOptions = {
    basePath: '/test/worktrees',
    defaultBaseBranch: 'main',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('파라미터 검증', () => {
    it('브랜치 이름이 비어있으면 실패해야 함', async () => {
      const params: CreateWorktreeParams = {
        branchName: '',
        issueNumbers: [123],
      };

      const result = await createWorktree(params, mockOptions);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.code).toBe('INVALID_BRANCH');
        expect(result.error.message).toContain('Branch name is required');
      }
    });

    it('이슈 번호가 없으면 실패해야 함', async () => {
      const params: CreateWorktreeParams = {
        branchName: 'feature/test',
        issueNumbers: [],
      };

      const result = await createWorktree(params, mockOptions);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.code).toBe('INVALID_BRANCH');
        expect(result.error.message).toContain('At least one issue number');
      }
    });
  });

  describe('브랜치 이름 처리', () => {
    it('브랜치 이름 앞뒤 공백을 제거해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        revparse: vi.fn().mockResolvedValue('abc123'),
        branchLocal: vi.fn().mockResolvedValue({ all: [] }),
        raw: vi.fn().mockResolvedValue(''),
        log: vi.fn().mockResolvedValue({ latest: { hash: 'abc123' } }),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const params: CreateWorktreeParams = {
        branchName: '  feature/test  ',
        issueNumbers: [123],
      };

      await createWorktree(params, mockOptions);

      expect(mockGit.raw).toHaveBeenCalledWith(
        expect.arrayContaining(['feature/test'])
      );
    });
  });

  describe('베이스 브랜치', () => {
    it('baseBranch가 제공되지 않으면 defaultBaseBranch를 사용해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        revparse: vi.fn().mockResolvedValue('abc123'),
        branchLocal: vi.fn().mockResolvedValue({ all: [] }),
        raw: vi.fn().mockResolvedValue(''),
        log: vi.fn().mockResolvedValue({ latest: { hash: 'abc123' } }),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const params: CreateWorktreeParams = {
        branchName: 'feature/test',
        issueNumbers: [123],
      };

      await createWorktree(params, mockOptions);

      expect(mockGit.revparse).toHaveBeenCalledWith(['main']);
    });

    it('baseBranch가 제공되면 해당 브랜치를 사용해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        revparse: vi.fn().mockResolvedValue('abc123'),
        branchLocal: vi.fn().mockResolvedValue({ all: [] }),
        raw: vi.fn().mockResolvedValue(''),
        log: vi.fn().mockResolvedValue({ latest: { hash: 'abc123' } }),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const params: CreateWorktreeParams = {
        branchName: 'feature/test',
        baseBranch: 'develop',
        issueNumbers: [123],
      };

      await createWorktree(params, mockOptions);

      expect(mockGit.revparse).toHaveBeenCalledWith(['develop']);
    });

    it('베이스 브랜치가 존재하지 않으면 실패해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        revparse: vi.fn().mockRejectedValue(new Error('Not found')),
        branchLocal: vi.fn(),
        raw: vi.fn(),
        log: vi.fn(),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const params: CreateWorktreeParams = {
        branchName: 'feature/test',
        baseBranch: 'nonexistent',
        issueNumbers: [123],
      };

      const result = await createWorktree(params, mockOptions);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.code).toBe('BRANCH_NOT_FOUND');
        expect(result.error.message).toContain('nonexistent');
      }
    });
  });

  describe('브랜치 존재 확인', () => {
    it('브랜치가 이미 존재하면 실패해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        revparse: vi.fn().mockResolvedValue('abc123'),
        branchLocal: vi
          .fn()
          .mockResolvedValue({ all: ['feature/test', 'main'] }),
        raw: vi.fn(),
        log: vi.fn(),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const params: CreateWorktreeParams = {
        branchName: 'feature/test',
        issueNumbers: [123],
      };

      const result = await createWorktree(params, mockOptions);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.code).toBe('BRANCH_EXISTS');
        expect(result.error.message).toContain('feature/test');
      }
    });
  });

  describe('Worktree 경로', () => {
    it('경로가 제공되지 않으면 브랜치 이름으로 경로를 생성해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        revparse: vi.fn().mockResolvedValue('abc123'),
        branchLocal: vi.fn().mockResolvedValue({ all: [] }),
        raw: vi.fn().mockResolvedValue(''),
        log: vi.fn().mockResolvedValue({ latest: { hash: 'abc123' } }),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const params: CreateWorktreeParams = {
        branchName: 'feature/test',
        issueNumbers: [123],
      };

      const result = await createWorktree(params, mockOptions);

      if (isSuccess(result)) {
        expect(result.data.path).toContain('feature');
        expect(result.data.path).toContain('test');
      }
    });

    it('절대 경로가 제공되면 그대로 사용해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        revparse: vi.fn().mockResolvedValue('abc123'),
        branchLocal: vi.fn().mockResolvedValue({ all: [] }),
        raw: vi.fn().mockResolvedValue(''),
        log: vi.fn().mockResolvedValue({ latest: { hash: 'abc123' } }),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const params: CreateWorktreeParams = {
        branchName: 'feature/test',
        path: '/custom/path/worktree',
        issueNumbers: [123],
      };

      const result = await createWorktree(params, mockOptions);

      if (isSuccess(result)) {
        expect(result.data.path).toBe('/custom/path/worktree');
      }
    });
  });

  describe('성공 케이스', () => {
    it('올바른 파라미터로 Worktree를 생성하고 정보를 반환해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        revparse: vi.fn().mockResolvedValue('abc123'),
        branchLocal: vi.fn().mockResolvedValue({ all: [] }),
        raw: vi.fn().mockResolvedValue(''),
        log: vi
          .fn()
          .mockResolvedValue({ latest: { hash: 'abc123def456' } }),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const params: CreateWorktreeParams = {
        branchName: 'feature/new-feature',
        issueNumbers: [123, 456],
      };

      const result = await createWorktree(params, mockOptions);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.branch).toBe('feature/new-feature');
        expect(result.data.status).toBe('ready');
        expect(result.data.issueNumbers).toEqual([123, 456]);
        expect(result.data.headCommit).toBe('abc123def456');
        expect(result.data.createdAt).toBeInstanceOf(Date);
        expect(result.data.lastActivityAt).toBeInstanceOf(Date);
      }
    });
  });
});
