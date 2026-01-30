/**
 * @module common/types/worktree
 * @description Git Worktree 관련 타입 정의
 */

/**
 * Worktree 상태
 */
export type WorktreeStatus =
  | 'creating'    // 생성 중
  | 'ready'       // 사용 가능
  | 'in_use'      // 사용 중 (코드 수정 진행 중)
  | 'checking'    // 체크 실행 중
  | 'committing'  // 커밋 중
  | 'cleaning'    // 정리 중
  | 'error';      // 에러 상태

/**
 * Worktree 정보
 */
export interface WorktreeInfo {
  /** Worktree 경로 */
  readonly path: string;
  /** 브랜치 이름 */
  readonly branch: string;
  /** 현재 상태 */
  readonly status: WorktreeStatus;
  /** 처리 중인 이슈 번호 목록 */
  readonly issueNumbers: readonly number[];
  /** 생성 시간 */
  readonly createdAt: Date;
  /** 마지막 활동 시간 */
  readonly lastActivityAt: Date;
  /** 에러 메시지 (에러 상태일 때) */
  readonly errorMessage?: string;
  /** HEAD 커밋 SHA */
  readonly headCommit?: string;
}

/**
 * Worktree 액션 유형
 */
export type WorktreeAction = 'create' | 'cleanup' | 'list' | 'status';

/**
 * Worktree 생성 파라미터
 */
export interface CreateWorktreeParams {
  /** 브랜치 이름 */
  readonly branchName: string;
  /** 베이스 브랜치 (기본값: main) */
  readonly baseBranch?: string;
  /** 처리할 이슈 번호 목록 */
  readonly issueNumbers: readonly number[];
  /** Worktree 경로 (자동 생성 시 생략 가능) */
  readonly path?: string;
}

/**
 * Worktree 제거 파라미터
 */
export interface RemoveWorktreeParams {
  /** 제거할 Worktree 경로 */
  readonly path: string;
  /** 강제 제거 여부 (기본값: false) */
  readonly force?: boolean;
  /** 브랜치도 함께 삭제 여부 (기본값: true) */
  readonly deleteBranch?: boolean;
}

/**
 * Worktree 목록 조회 파라미터
 */
export interface ListWorktreesParams {
  /** 상태 필터 */
  readonly status?: WorktreeStatus;
  /** 특정 이슈와 연결된 Worktree만 조회 */
  readonly issueNumber?: number;
}

/**
 * Worktree 관리 요청
 */
export interface ManageWorktreeRequest {
  /** 액션 유형 */
  readonly action: WorktreeAction;
  /** 생성 파라미터 (action이 'create'일 때) */
  readonly createParams?: CreateWorktreeParams;
  /** 제거 파라미터 (action이 'cleanup'일 때) */
  readonly removeParams?: RemoveWorktreeParams;
  /** 목록 조회 파라미터 (action이 'list'일 때) */
  readonly listParams?: ListWorktreesParams;
  /** 상태 조회 대상 경로 (action이 'status'일 때) */
  readonly path?: string;
}

/**
 * Worktree 관리 응답
 */
export interface ManageWorktreeResponse {
  /** 성공 여부 */
  readonly success: boolean;
  /** 생성/상태 조회된 Worktree 정보 */
  readonly worktree?: WorktreeInfo;
  /** 목록 조회 결과 */
  readonly worktrees?: readonly WorktreeInfo[];
  /** 에러 메시지 */
  readonly error?: string;
}

/**
 * Worktree 이벤트 유형
 */
export type WorktreeEventType =
  | 'created'
  | 'status_changed'
  | 'issue_assigned'
  | 'check_started'
  | 'check_completed'
  | 'commit_created'
  | 'removed'
  | 'error';

/**
 * Worktree 이벤트
 */
export interface WorktreeEvent {
  /** 이벤트 유형 */
  readonly type: WorktreeEventType;
  /** Worktree 경로 */
  readonly path: string;
  /** 이벤트 발생 시간 */
  readonly timestamp: Date;
  /** 추가 데이터 */
  readonly data?: Record<string, unknown>;
}
