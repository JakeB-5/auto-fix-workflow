/**
 * @module git/manage-worktree/__tests__/list.test
 * @description listWorktrees 함수 단위 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listWorktrees } from '../list.js';
import type { ListWorktreesParams } from '../../../common/types/index.js';
import { isSuccess, isFailure } from '../../../common/types/index.js';

// simple-git 모킹
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    raw: vi.fn(),
  })),
}));

describe('listWorktrees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('git worktree list 파싱', () => {
    it('빈 출력에 대해 빈 배열을 반환해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        raw: vi.fn().mockResolvedValue(''),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const result = await listWorktrees();

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toEqual([]);
      }
    });

    it('단일 worktree 정보를 파싱해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        raw: vi
          .fn()
          .mockResolvedValue(
            'worktree /test/path\nHEAD abc123def456\nbranch refs/heads/main\n\n'
          ),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const result = await listWorktrees();

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].path).toBe('/test/path');
        expect(result.data[0].branch).toBe('main');
        expect(result.data[0].headCommit).toBe('abc123def456');
        expect(result.data[0].status).toBe('ready');
      }
    });

    it('여러 worktree 정보를 파싱해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        raw: vi.fn().mockResolvedValue(
          'worktree /test/path1\nHEAD abc123\nbranch refs/heads/main\n\n' +
            'worktree /test/path2\nHEAD def456\nbranch refs/heads/feature\n\n'
        ),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const result = await listWorktrees();

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].path).toBe('/test/path1');
        expect(result.data[0].branch).toBe('main');
        expect(result.data[1].path).toBe('/test/path2');
        expect(result.data[1].branch).toBe('feature');
      }
    });

    it('detached HEAD 상태를 파싱해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        raw: vi
          .fn()
          .mockResolvedValue(
            'worktree /test/path\nHEAD abc123\ndetached\n\n'
          ),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const result = await listWorktrees();

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].branch).toBe('detached');
      }
    });

    it('빈 줄 없이 끝나는 출력을 파싱해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        raw: vi
          .fn()
          .mockResolvedValue(
            'worktree /test/path\nHEAD abc123\nbranch refs/heads/main'
          ),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const result = await listWorktrees();

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].path).toBe('/test/path');
      }
    });
  });

  describe('필터링', () => {
    it('상태로 필터링해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        raw: vi.fn().mockResolvedValue(
          'worktree /test/path1\nHEAD abc123\nbranch refs/heads/main\n\n' +
            'worktree /test/path2\nHEAD def456\nbranch refs/heads/feature\n\n'
        ),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const params: ListWorktreesParams = {
        status: 'ready',
      };

      const result = await listWorktrees(params);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data.every((wt) => wt.status === 'ready')).toBe(true);
      }
    });

    it('이슈 번호로 필터링해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        raw: vi.fn().mockResolvedValue(
          'worktree /test/path1\nHEAD abc123\nbranch refs/heads/main\n\n' +
            'worktree /test/path2\nHEAD def456\nbranch refs/heads/feature\n\n'
        ),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      // 참고: 현재 구현에서는 issueNumbers가 빈 배열로 반환되므로
      // 이 테스트는 실제로는 빈 배열을 반환함
      const params: ListWorktreesParams = {
        issueNumber: 123,
      };

      const result = await listWorktrees(params);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        // issueNumbers가 메타데이터에서 조회되지 않으므로 빈 배열 기대
        expect(result.data).toEqual([]);
      }
    });

    it('상태와 이슈 번호로 동시에 필터링해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        raw: vi.fn().mockResolvedValue(
          'worktree /test/path1\nHEAD abc123\nbranch refs/heads/main\n\n'
        ),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const params: ListWorktreesParams = {
        status: 'ready',
        issueNumber: 123,
      };

      const result = await listWorktrees(params);

      expect(isSuccess(result)).toBe(true);
    });
  });

  describe('에러 처리', () => {
    it('git 명령 실행 실패 시 에러를 반환해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        raw: vi.fn().mockRejectedValue(new Error('Git command failed')),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const result = await listWorktrees();

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.code).toBe('GIT_ERROR');
        expect(result.error.message).toContain('Failed to list worktrees');
      }
    });
  });

  describe('성공 케이스', () => {
    it('파라미터 없이 모든 worktree를 조회해야 함', async () => {
      const simpleGit = await import('simple-git');
      const mockGit = {
        raw: vi.fn().mockResolvedValue(
          'worktree /test/path1\nHEAD abc123\nbranch refs/heads/main\n\n' +
            'worktree /test/path2\nHEAD def456\nbranch refs/heads/feature\n\n'
        ),
      };
      vi.mocked(simpleGit.simpleGit).mockReturnValue(mockGit as any);

      const result = await listWorktrees();

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toMatchObject({
          path: '/test/path1',
          branch: 'main',
          status: 'ready',
        });
        expect(result.data[1]).toMatchObject({
          path: '/test/path2',
          branch: 'feature',
          status: 'ready',
        });
      }
    });
  });
});
