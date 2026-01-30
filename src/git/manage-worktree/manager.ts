/**
 * @module git/manage-worktree/manager
 * @description Worktree 관리 통합 함수
 */

import type {
  ManageWorktreeRequest,
  ManageWorktreeResponse,
} from '../../common/types/index.js';
import { isSuccess } from '../../common/types/index.js';
import { createWorktree } from './create.js';
import { removeWorktree } from './remove.js';
import { listWorktrees } from './list.js';
import { getWorktreeStatus } from './status.js';
import type { WorktreeOptions } from './types.js';

/**
 * Worktree 관리 요청 처리
 *
 * @param request - 관리 요청
 * @param options - Worktree 옵션
 * @returns 관리 응답
 */
export async function manageWorktree(
  request: ManageWorktreeRequest,
  options: WorktreeOptions
): Promise<ManageWorktreeResponse> {
  switch (request.action) {
    case 'create': {
      if (!request.createParams) {
        return {
          success: false,
          error: 'Create parameters are required for create action',
        };
      }

      const result = await createWorktree(request.createParams, options);
      if (isSuccess(result)) {
        return {
          success: true,
          worktree: result.data,
        };
      }

      return {
        success: false,
        error: result.error.message,
      };
    }

    case 'cleanup': {
      if (!request.removeParams) {
        return {
          success: false,
          error: 'Remove parameters are required for cleanup action',
        };
      }

      const result = await removeWorktree(request.removeParams, options.repoPath);
      if (isSuccess(result)) {
        return {
          success: true,
        };
      }

      return {
        success: false,
        error: result.error.message,
      };
    }

    case 'list': {
      const result = await listWorktrees(request.listParams, options.repoPath);
      if (isSuccess(result)) {
        return {
          success: true,
          worktrees: result.data,
        };
      }

      return {
        success: false,
        error: result.error.message,
      };
    }

    case 'status': {
      if (request.path === undefined || request.path === '') {
        return {
          success: false,
          error: 'Path is required for status action',
        };
      }

      const result = await getWorktreeStatus(request.path);
      if (isSuccess(result)) {
        return {
          success: true,
          worktree: result.data,
        };
      }

      return {
        success: false,
        error: result.error.message,
      };
    }

    default: {
      const action = request.action as string;
      return {
        success: false,
        error: `Unknown action: ${action}`,
      };
    }
  }
}
