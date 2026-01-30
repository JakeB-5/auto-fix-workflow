/**
 * @module git/manage-worktree/types
 * @description Worktree 관리 추가 타입 정의
 */

/**
 * Worktree 옵션
 */
export interface WorktreeOptions {
  /** 베이스 경로 */
  readonly basePath: string;
  /** 기본 베이스 브랜치 */
  readonly defaultBaseBranch: string;
  /** Git 저장소 경로 (기본값: 현재 디렉토리) */
  readonly repoPath?: string;
}

/**
 * Worktree 에러 코드
 */
export type WorktreeErrorCode =
  | 'WORKTREE_ALREADY_EXISTS'
  | 'WORKTREE_NOT_FOUND'
  | 'INVALID_PATH'
  | 'INVALID_BRANCH'
  | 'GIT_ERROR'
  | 'BRANCH_EXISTS'
  | 'BRANCH_NOT_FOUND'
  | 'WORKTREE_IN_USE'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN_ERROR';

/**
 * Worktree 에러
 */
export interface WorktreeError {
  /** 에러 코드 */
  readonly code: WorktreeErrorCode;
  /** 에러 메시지 */
  readonly message: string;
  /** 원본 에러 */
  readonly cause?: Error;
}
