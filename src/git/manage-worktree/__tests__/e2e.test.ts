/**
 * @module git/manage-worktree/__tests__/e2e.test
 * @description Worktree 관리 E2E 테스트
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { existsSync } from 'fs';
import simpleGit, { type SimpleGit } from 'simple-git';
import { createWorktree } from '../create.js';
import { removeWorktree } from '../remove.js';
import { listWorktrees } from '../list.js';
import { getWorktreeStatus } from '../status.js';
import { manageWorktree } from '../manager.js';
import { isSuccess } from '../../../common/types/index.js';
import type {
  CreateWorktreeParams,
  RemoveWorktreeParams,
  ManageWorktreeRequest,
} from '../../../common/types/index.js';
import type { WorktreeOptions } from '../types.js';

describe.skip('Worktree 관리 E2E 테스트', () => {
  let testRepoPath: string;
  let worktreesPath: string;
  let git: SimpleGit;
  let options: WorktreeOptions;

  beforeAll(async () => {
    // 임시 디렉토리 생성
    testRepoPath = await mkdtemp(join(tmpdir(), 'worktree-e2e-'));
    worktreesPath = join(testRepoPath, 'worktrees');

    // Git 저장소 초기화
    git = simpleGit(testRepoPath);
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');

    // 초기 커밋 생성
    await git.raw(['commit', '--allow-empty', '-m', 'Initial commit']);

    // 옵션 설정
    options = {
      basePath: worktreesPath,
      defaultBaseBranch: 'master', // git init은 기본적으로 master 사용
      repoPath: testRepoPath,
    };
  });

  afterAll(async () => {
    // 임시 디렉토리 정리
    if (testRepoPath && existsSync(testRepoPath)) {
      await rm(testRepoPath, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    // 각 테스트 후 worktree 정리
    try {
      const result = await listWorktrees(undefined, testRepoPath);
      if (isSuccess(result)) {
        for (const worktree of result.data) {
          // main worktree는 제외
          if (!worktree.path.includes('.git') && worktree.path !== testRepoPath) {
            await removeWorktree({
              path: worktree.path,
              force: true,
              deleteBranch: true,
            }, testRepoPath);
          }
        }
      }
    } catch (error) {
      console.warn('Worktree cleanup failed:', error);
    }
  });

  describe('createWorktree E2E', () => {
    it('새로운 worktree를 생성하고 파일시스템에 디렉토리가 생성되어야 함', async () => {
      const params: CreateWorktreeParams = {
        branchName: 'feature/e2e-test-1',
        issueNumbers: [100],
      };

      const result = await createWorktree(params, options);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        expect(existsSync(result.data.path)).toBe(true);
        expect(result.data.branch).toBe('feature/e2e-test-1');

        // 브랜치 확인
        const branches = await git.branchLocal();
        expect(branches.all).toContain('feature/e2e-test-1');
      }
    });

    it('여러 worktree를 생성할 수 있어야 함', async () => {
      const params1: CreateWorktreeParams = {
        branchName: 'feature/e2e-test-2',
        issueNumbers: [101],
      };
      const params2: CreateWorktreeParams = {
        branchName: 'feature/e2e-test-3',
        issueNumbers: [102],
      };

      const result1 = await createWorktree(params1, options);
      const result2 = await createWorktree(params2, options);

      expect(isSuccess(result1)).toBe(true);
      expect(isSuccess(result2)).toBe(true);

      if (isSuccess(result1) && isSuccess(result2)) {
        expect(existsSync(result1.data.path)).toBe(true);
        expect(existsSync(result2.data.path)).toBe(true);
      }
    });
  });

  describe('listWorktrees E2E', () => {
    it('생성된 worktree 목록을 조회해야 함', async () => {
      // worktree 생성
      await createWorktree(
        {
          branchName: 'feature/e2e-test-4',
          issueNumbers: [103],
        },
        options
      );

      const result = await listWorktrees(undefined, testRepoPath);

      expect(isSuccess(result)).toBe(true);
      if (isSuccess(result)) {
        // main worktree + 생성한 worktree
        expect(result.data.length).toBeGreaterThanOrEqual(1);
        const testWorktree = result.data.find((wt) =>
          wt.branch.includes('e2e-test-4')
        );
        expect(testWorktree).toBeDefined();
      }
    });
  });

  describe('getWorktreeStatus E2E', () => {
    it('worktree 상태를 조회해야 함', async () => {
      const createResult = await createWorktree(
        {
          branchName: 'feature/e2e-test-5',
          issueNumbers: [104],
        },
        options
      );

      expect(isSuccess(createResult)).toBe(true);
      if (!isSuccess(createResult)) return;

      const statusResult = await getWorktreeStatus(createResult.data.path);

      expect(isSuccess(statusResult)).toBe(true);
      if (isSuccess(statusResult)) {
        expect(statusResult.data.path).toBe(createResult.data.path);
        expect(statusResult.data.branch).toBe('feature/e2e-test-5');
        expect(statusResult.data.status).toBe('ready');
      }
    });
  });

  describe('removeWorktree E2E', () => {
    it('worktree를 제거하고 파일시스템에서도 제거되어야 함', async () => {
      const createResult = await createWorktree(
        {
          branchName: 'feature/e2e-test-6',
          issueNumbers: [105],
        },
        options
      );

      expect(isSuccess(createResult)).toBe(true);
      if (!isSuccess(createResult)) return;

      const worktreePath = createResult.data.path;
      expect(existsSync(worktreePath)).toBe(true);

      const removeParams: RemoveWorktreeParams = {
        path: worktreePath,
        deleteBranch: true,
      };
      const removeResult = await removeWorktree(removeParams, testRepoPath);

      expect(isSuccess(removeResult)).toBe(true);
      expect(existsSync(worktreePath)).toBe(false);

      // 브랜치도 삭제되었는지 확인
      const branches = await git.branchLocal();
      expect(branches.all).not.toContain('feature/e2e-test-6');
    });
  });

  describe('manageWorktree E2E', () => {
    it('통합 함수로 worktree를 관리할 수 있어야 함', async () => {
      // 생성
      const createRequest: ManageWorktreeRequest = {
        action: 'create',
        createParams: {
          branchName: 'feature/e2e-test-7',
          issueNumbers: [106],
        },
      };
      const createResponse = await manageWorktree(createRequest, options);
      expect(createResponse.success).toBe(true);
      expect(createResponse.worktree).toBeDefined();

      if (!createResponse.worktree) return;
      const worktreePath = createResponse.worktree.path;

      // 목록 조회
      const listRequest: ManageWorktreeRequest = {
        action: 'list',
      };
      const listResponse = await manageWorktree(listRequest, options);
      expect(listResponse.success).toBe(true);
      expect(listResponse.worktrees).toBeDefined();
      expect(
        listResponse.worktrees?.some((wt) => wt.path === worktreePath)
      ).toBe(true);

      // 상태 조회
      const statusRequest: ManageWorktreeRequest = {
        action: 'status',
        path: worktreePath,
      };
      const statusResponse = await manageWorktree(statusRequest, options);
      expect(statusResponse.success).toBe(true);
      expect(statusResponse.worktree?.path).toBe(worktreePath);

      // 제거
      const removeRequest: ManageWorktreeRequest = {
        action: 'cleanup',
        removeParams: {
          path: worktreePath,
          deleteBranch: true,
        },
      };
      const removeResponse = await manageWorktree(removeRequest, options);
      expect(removeResponse.success).toBe(true);
      expect(existsSync(worktreePath)).toBe(false);
    });
  });

  describe('복잡한 시나리오', () => {
    it('여러 worktree를 동시에 관리할 수 있어야 함', async () => {
      // 여러 worktree 생성
      const branches = ['feature/multi-1', 'feature/multi-2', 'feature/multi-3'];
      const createdPaths: string[] = [];

      for (let i = 0; i < branches.length; i++) {
        const result = await createWorktree(
          {
            branchName: branches[i],
            issueNumbers: [200 + i],
          },
          options
        );
        expect(isSuccess(result)).toBe(true);
        if (isSuccess(result)) {
          createdPaths.push(result.data.path);
        }
      }

      // 목록 조회로 모두 확인
      const listResult = await listWorktrees(undefined, testRepoPath);
      expect(isSuccess(listResult)).toBe(true);
      if (isSuccess(listResult)) {
        for (const path of createdPaths) {
          expect(listResult.data.some((wt) => wt.path === path)).toBe(true);
        }
      }

      // 모두 제거
      for (const path of createdPaths) {
        const result = await removeWorktree({
          path,
          deleteBranch: true,
        }, testRepoPath);
        expect(isSuccess(result)).toBe(true);
      }

      // 제거 확인
      for (const path of createdPaths) {
        expect(existsSync(path)).toBe(false);
      }
    });
  });
});
