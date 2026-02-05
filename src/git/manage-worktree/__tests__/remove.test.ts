/**
 * @module git/manage-worktree/__tests__/remove.test
 * @description removeWorktree 함수 단위 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RemoveWorktreeParams } from '../../../common/types/index.js';
import { isSuccess, isFailure } from '../../../common/types/index.js';

// simple-git 모킹
const mockRaw = vi.fn();
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    raw: mockRaw,
  })),
}));

describe('removeWorktree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockRaw.mockReset();
  });

  describe('파라미터 검증', () => {
    it('경로가 비어있으면 실패해야 함', async () => {
      const { removeWorktree } = await import('../remove.js');
      const params: RemoveWorktreeParams = {
        path: '',
      };

      const result = await removeWorktree(params);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.code).toBe('INVALID_PATH');
        expect(result.error.message).toContain('path is required');
      }
    });

    it('경로 앞뒤 공백을 제거해야 함', async () => {
      mockRaw
        .mockResolvedValueOnce(
          'worktree /test/path\nHEAD abc123\nbranch refs/heads/test\n\n'
        )
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');
      const { removeWorktree } = await import('../remove.js');

      const params: RemoveWorktreeParams = {
        path: '  /test/path  ',
      };

      await removeWorktree(params);

      expect(mockRaw).toHaveBeenCalledWith(
        expect.arrayContaining(['/test/path'])
      );
    });
  });

  describe('Worktree 존재 확인', () => {
    it('Worktree가 존재하지 않으면 실패해야 함', async () => {
      mockRaw.mockResolvedValueOnce(
        'worktree /other/path\nHEAD abc123\nbranch refs/heads/other\n\n'
      );
      const { removeWorktree } = await import('../remove.js');

      const params: RemoveWorktreeParams = {
        path: '/test/path',
      };

      const result = await removeWorktree(params);

      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) {
        expect(result.error.code).toBe('WORKTREE_NOT_FOUND');
        expect(result.error.message).toContain('/test/path');
      }
    });
  });

  describe('force 옵션', () => {
    it('force가 false이면 --force 플래그를 사용하지 않아야 함', async () => {
      mockRaw
        .mockResolvedValueOnce(
          'worktree /test/path\nHEAD abc123\nbranch refs/heads/test\n\n'
        )
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');
      const { removeWorktree } = await import('../remove.js');

      const params: RemoveWorktreeParams = {
        path: '/test/path',
        force: false,
      };

      await removeWorktree(params);

      expect(mockRaw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '/test/path',
      ]);
    });

    it('force가 true이면 --force 플래그를 사용해야 함', async () => {
      mockRaw
        .mockResolvedValueOnce(
          'worktree /test/path\nHEAD abc123\nbranch refs/heads/test\n\n'
        )
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');
      const { removeWorktree } = await import('../remove.js');

      const params: RemoveWorktreeParams = {
        path: '/test/path',
        force: true,
      };

      await removeWorktree(params);

      expect(mockRaw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '/test/path',
        '--force',
      ]);
    });
  });

  describe('deleteBranch 옵션', () => {
    it('deleteBranch가 기본값(true)이면 브랜치를 삭제해야 함', async () => {
      mockRaw
        .mockResolvedValueOnce(
          'worktree /test/path\nHEAD abc123\nbranch refs/heads/test-branch\n\n'
        )
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');
      const { removeWorktree } = await import('../remove.js');

      const params: RemoveWorktreeParams = {
        path: '/test/path',
      };

      await removeWorktree(params);

      expect(mockRaw).toHaveBeenCalledWith([
        'branch',
        '-d',
        'test-branch',
      ]);
    });

    it('deleteBranch가 false이면 브랜치를 삭제하지 않아야 함', async () => {
      mockRaw
        .mockResolvedValueOnce(
          'worktree /test/path\nHEAD abc123\nbranch refs/heads/test-branch\n\n'
        )
        .mockResolvedValueOnce('');
      const { removeWorktree } = await import('../remove.js');

      const params: RemoveWorktreeParams = {
        path: '/test/path',
        deleteBranch: false,
      };

      await removeWorktree(params);

      expect(mockRaw).toHaveBeenCalledTimes(2); // list, remove만
      expect(mockRaw).not.toHaveBeenCalledWith(
        expect.arrayContaining(['branch'])
      );
    });

    it('force와 deleteBranch가 모두 true이면 -D 플래그를 사용해야 함', async () => {
      mockRaw
        .mockResolvedValueOnce(
          'worktree /test/path\nHEAD abc123\nbranch refs/heads/test-branch\n\n'
        )
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');
      const { removeWorktree } = await import('../remove.js');

      const params: RemoveWorktreeParams = {
        path: '/test/path',
        force: true,
        deleteBranch: true,
      };

      await removeWorktree(params);

      expect(mockRaw).toHaveBeenCalledWith([
        'branch',
        '-D',
        'test-branch',
      ]);
    });
  });

  describe('성공 케이스', () => {
    it('올바른 파라미터로 Worktree를 제거해야 함', async () => {
      mockRaw
        .mockResolvedValueOnce(
          'worktree /test/path\nHEAD abc123\nbranch refs/heads/test-branch\n\n'
        )
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');
      const { removeWorktree } = await import('../remove.js');

      const params: RemoveWorktreeParams = {
        path: '/test/path',
      };

      const result = await removeWorktree(params);

      expect(isSuccess(result)).toBe(true);
      expect(mockRaw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '/test/path',
      ]);
    });

    it('브랜치 삭제 실패 시에도 Worktree 제거는 성공으로 처리해야 함', async () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      mockRaw
        .mockResolvedValueOnce(
          'worktree /test/path\nHEAD abc123\nbranch refs/heads/test-branch\n\n'
        )
        .mockResolvedValueOnce('')
        .mockRejectedValueOnce(new Error('Branch delete failed'));
      const { removeWorktree } = await import('../remove.js');

      const params: RemoveWorktreeParams = {
        path: '/test/path',
      };

      const result = await removeWorktree(params);

      expect(isSuccess(result)).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete branch')
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
