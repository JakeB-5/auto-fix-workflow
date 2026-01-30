/**
 * @module github/create-pr/types
 * @description PR 생성 관련 타입 정의
 */

/**
 * PR 생성 파라미터
 */
export interface CreatePRParams {
  /** 리포지토리 소유자 */
  readonly owner: string;
  /** 리포지토리 이름 */
  readonly repo: string;
  /** PR 제목 */
  readonly title: string;
  /** PR 본문 */
  readonly body: string;
  /** 소스 브랜치 (head) */
  readonly head: string;
  /** 타겟 브랜치 (base) */
  readonly base: string;
  /** Draft PR 여부 */
  readonly draft?: boolean;
  /** 연결할 이슈 번호 목록 */
  readonly issueNumbers?: readonly number[];
}

/**
 * 변경사항 정보
 */
export interface ChangeInfo {
  /** 변경된 파일 경로 */
  readonly filePath: string;
  /** 추가된 라인 수 */
  readonly additions: number;
  /** 삭제된 라인 수 */
  readonly deletions: number;
  /** 변경 유형 (added, modified, deleted, renamed) */
  readonly changeType: 'added' | 'modified' | 'deleted' | 'renamed';
}

/**
 * Git 브랜치 정보
 */
export interface BranchInfo {
  /** 브랜치 이름 */
  readonly name: string;
  /** 최신 커밋 해시 */
  readonly commit: string;
  /** 리모트 추적 여부 */
  readonly isTracking: boolean;
}
