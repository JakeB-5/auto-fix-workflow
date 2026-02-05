/**
 * @module git/manage-worktree/__tests__/integration.test
 * @description Worktree 관리 통합 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  ManageWorktreeRequest,
  CreateWorktreeParams,
  RemoveWorktreeParams,
} from '../../../common/types/index.js';
import type { WorktreeOptions } from '../types.js';

// simple-git 모킹
const mockRevparse = vi.fn();
const mockBranchLocal = vi.fn();
const mockRaw = vi.fn();
const mockLog = vi.fn();
const mockStatus = vi.fn();

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => ({
    revparse: mockRevparse,
    branchLocal: mockBranchLocal,
    raw: mockRaw,
    log: mockLog,
    status: mockStatus,
  })),
}));

// fs 모킹
const mockExistsSync = vi.fn();
const mockStat = vi.fn();

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
}));

vi.mock('fs/promises', () => ({
  stat: mockStat,
}));

describe('Worktree 관리 통합 테스트', () => {
  const mockOptions: WorktreeOptions = {
    basePath: '/test/worktrees',
    defaultBaseBranch: 'main',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockRevparse.mockReset();
    mockBranchLocal.mockReset();
    mockRaw.mockReset();
    mockLog.mockReset();
    mockStatus.mockReset();
    mockExistsSync.mockReset();
    mockStat.mockReset();
  });

  describe('create 액션', () => {
    it('createParams 없이 호출하면 실패해야 함', async () => {
      const { manageWorktree } = await import('../manager.js');
      const request: ManageWorktreeRequest = {
        action: 'create',
      };

      const response = await manageWorktree(request, mockOptions);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Create parameters are required');
    });

    it('올바른 파라미터로 worktree를 생성해야 함', async () => {
      mockRevparse.mockResolvedValue('abc123');
      mockBranchLocal.mockResolvedValue({ all: [] });
      mockRaw.mockResolvedValue('');
      mockLog.mockResolvedValue({ latest: { hash: 'abc123def456' } });

      const { manageWorktree } = await import('../manager.js');
      const createParams: CreateWorktreeParams = {
        branchName: 'feature/test',
        issueNumbers: [123],
      };

      const request: ManageWorktreeRequest = {
        action: 'create',
        createParams,
      };

      const response = await manageWorktree(request, mockOptions);

      expect(response.success).toBe(true);
      expect(response.worktree).toBeDefined();
      expect(response.worktree?.branch).toBe('feature/test');
      expect(response.worktree?.issueNumbers).toEqual([123]);
    });
  });

  describe('cleanup 액션', () => {
    it('removeParams 없이 호출하면 실패해야 함', async () => {
      const { manageWorktree } = await import('../manager.js');
      const request: ManageWorktreeRequest = {
        action: 'cleanup',
      };

      const response = await manageWorktree(request, mockOptions);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Remove parameters are required');
    });

    it('올바른 파라미터로 worktree를 제거해야 함', async () => {
      mockRaw
        .mockResolvedValueOnce(
          'worktree /test/path\nHEAD abc123\nbranch refs/heads/test\n\n'
        )
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');

      const { manageWorktree } = await import('../manager.js');
      const removeParams: RemoveWorktreeParams = {
        path: '/test/path',
      };

      const request: ManageWorktreeRequest = {
        action: 'cleanup',
        removeParams,
      };

      const response = await manageWorktree(request, mockOptions);

      expect(response.success).toBe(true);
      expect(response.worktree).toBeUndefined();
    });
  });

  describe('list 액션', () => {
    it('모든 worktree를 조회해야 함', async () => {
      mockRaw.mockResolvedValue(
        'worktree /test/path1\nHEAD abc123\nbranch refs/heads/main\n\n' +
          'worktree /test/path2\nHEAD def456\nbranch refs/heads/feature\n\n'
      );

      const { manageWorktree } = await import('../manager.js');
      const request: ManageWorktreeRequest = {
        action: 'list',
      };

      const response = await manageWorktree(request, mockOptions);

      expect(response.success).toBe(true);
      expect(response.worktrees).toBeDefined();
      expect(response.worktrees).toHaveLength(2);
    });

    it('필터를 적용하여 worktree를 조회해야 함', async () => {
      mockRaw.mockResolvedValue(
        'worktree /test/path1\nHEAD abc123\nbranch refs/heads/main\n\n'
      );

      const { manageWorktree } = await import('../manager.js');
      const request: ManageWorktreeRequest = {
        action: 'list',
        listParams: {
          status: 'ready',
        },
      };

      const response = await manageWorktree(request, mockOptions);

      expect(response.success).toBe(true);
      expect(response.worktrees).toBeDefined();
    });
  });

  describe('status 액션', () => {
    it('path 없이 호출하면 실패해야 함', async () => {
      const { manageWorktree } = await import('../manager.js');
      const request: ManageWorktreeRequest = {
        action: 'status',
      };

      const response = await manageWorktree(request, mockOptions);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Path is required');
    });

    it('worktree 상태를 조회해야 함', async () => {
      mockExistsSync.mockReturnValue(true);
      mockRevparse.mockResolvedValue('.git');
      mockLog.mockResolvedValue({ latest: { hash: 'abc123def456' } });
      mockStatus.mockResolvedValue({
        files: [],
        staged: [],
        modified: [],
        created: [],
        deleted: [],
      });
      mockStat.mockResolvedValue({
        mtime: new Date(),
      });

      const { manageWorktree } = await import('../manager.js');
      const request: ManageWorktreeRequest = {
        action: 'status',
        path: '/test/path',
      };

      const response = await manageWorktree(request, mockOptions);

      expect(response.success).toBe(true);
      expect(response.worktree).toBeDefined();
      expect(response.worktree?.path).toBe('/test/path');
    });
  });

  describe('알 수 없는 액션', () => {
    it('알 수 없는 액션에 대해 에러를 반환해야 함', async () => {
      const { manageWorktree } = await import('../manager.js');
      const request: ManageWorktreeRequest = {
        action: 'unknown' as any,
      };

      const response = await manageWorktree(request, mockOptions);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Unknown action');
    });
  });

  describe('워크플로우 시나리오', () => {
    it('생성 -> 목록 조회 -> 제거 순서로 동작해야 함', async () => {
      mockRevparse.mockResolvedValue('abc123');
      mockBranchLocal.mockResolvedValue({ all: [] });
      mockRaw
        .mockResolvedValueOnce('') // create
        .mockResolvedValueOnce(
          'worktree /test/worktrees/feature/test\nHEAD abc123def456\nbranch refs/heads/feature/test\n\n'
        ) // list
        .mockResolvedValueOnce(
          'worktree /test/worktrees/feature/test\nHEAD abc123def456\nbranch refs/heads/feature/test\n\n'
        ) // remove (list)
        .mockResolvedValueOnce('') // remove (actual)
        .mockResolvedValueOnce(''); // remove (branch delete)
      mockLog.mockResolvedValue({ latest: { hash: 'abc123def456' } });

      const { manageWorktree } = await import('../manager.js');

      // 1. 생성
      const createRequest: ManageWorktreeRequest = {
        action: 'create',
        createParams: {
          branchName: 'feature/test',
          issueNumbers: [123],
        },
      };
      const createResponse = await manageWorktree(
        createRequest,
        mockOptions
      );
      expect(createResponse.success).toBe(true);

      // 2. 목록 조회
      const listRequest: ManageWorktreeRequest = {
        action: 'list',
      };
      const listResponse = await manageWorktree(listRequest, mockOptions);
      expect(listResponse.success).toBe(true);
      expect(listResponse.worktrees).toHaveLength(1);

      // 3. 제거
      const removeRequest: ManageWorktreeRequest = {
        action: 'cleanup',
        removeParams: {
          path: '/test/worktrees/feature/test',
        },
      };
      const removeResponse = await manageWorktree(
        removeRequest,
        mockOptions
      );
      expect(removeResponse.success).toBe(true);
    });
  });
});
