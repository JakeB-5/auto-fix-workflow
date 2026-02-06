/**
 * @module common/types/issue-group
 * @description 이슈 그룹핑 관련 타입 정의
 */

import type { Issue } from './issue.js';

/**
 * 그룹화 기준
 */
export type GroupBy = 'component' | 'file' | 'label' | 'type' | 'priority';

/**
 * 이슈 그룹
 */
export interface IssueGroup {
  /** 그룹 ID */
  readonly id: string;
  /** 그룹 이름 */
  readonly name: string;
  /** 그룹화 기준 */
  readonly groupBy: GroupBy;
  /** 그룹화 키 값 */
  readonly key: string;
  /** 그룹에 포함된 이슈 목록 */
  readonly issues: readonly Issue[];
  /** 생성될 브랜치 이름 */
  readonly branchName: string;
  /** 관련 파일 경로 목록 (모든 이슈의 합집합) */
  readonly relatedFiles: readonly string[];
  /** 관련 컴포넌트 목록 */
  readonly components: readonly string[];
  /** 총 예상 작업량 */
  readonly estimatedEffort?: number | undefined;
  /** 우선순위 (그룹 내 최고 우선순위) */
  readonly priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * 그룹화 파라미터
 */
export interface GroupIssuesParams {
  /** 그룹화할 이슈 번호 목록 */
  readonly issueNumbers: readonly number[];
  /** 그룹화 기준 */
  readonly groupBy: GroupBy;
  /** 최대 그룹 크기 (기본값: 5) */
  readonly maxGroupSize?: number | undefined;
  /** 최소 그룹 크기 (기본값: 1) */
  readonly minGroupSize?: number | undefined;
  /** 라벨 필터 */
  readonly labels?: readonly string[] | undefined;
  /** 제외 라벨 */
  readonly excludeLabels?: readonly string[] | undefined;
}

/**
 * 그룹화 결과
 */
export interface GroupIssuesResult {
  /** 생성된 그룹 목록 */
  readonly groups: readonly IssueGroup[];
  /** 그룹화되지 않은 이슈 번호 목록 */
  readonly ungroupedIssues: readonly number[];
  /** 총 이슈 수 */
  readonly totalIssues: number;
  /** 총 그룹 수 */
  readonly totalGroups: number;
}

/**
 * 그룹 처리 상태
 */
export type GroupProcessingStatus =
  | 'pending'       // 대기 중
  | 'processing'    // 처리 중
  | 'checks_running' // 체크 실행 중
  | 'pr_creating'   // PR 생성 중
  | 'completed'     // 완료
  | 'failed';       // 실패

/**
 * 그룹 처리 결과
 */
export interface GroupProcessingResult {
  /** 그룹 ID */
  readonly groupId: string;
  /** 처리 상태 */
  readonly status: GroupProcessingStatus;
  /** Worktree 경로 */
  readonly worktreePath?: string | undefined;
  /** 생성된 PR 번호 */
  readonly prNumber?: number | undefined;
  /** 에러 메시지 */
  readonly error?: string | undefined;
  /** 시작 시간 */
  readonly startedAt?: Date | undefined;
  /** 완료 시간 */
  readonly completedAt?: Date | undefined;
}

/**
 * 브랜치명 생성 옵션
 */
export interface BranchNameOptions {
  /** 접두사 (기본값: fix/) */
  readonly prefix?: string | undefined;
  /** 최대 길이 (기본값: 50) */
  readonly maxLength?: number | undefined;
  /** 구분자 (기본값: -) */
  readonly separator?: string | undefined;
  /** 이슈 번호 포함 여부 (기본값: true) */
  readonly includeIssueNumbers?: boolean | undefined;
}

/**
 * 그룹 병합 전략
 */
export type MergeStrategy =
  | 'none'          // 병합 안 함
  | 'same_component' // 같은 컴포넌트끼리
  | 'same_file'     // 같은 파일 수정 시
  | 'related';      // 관련성 있는 이슈끼리

/**
 * 그룹화 전략 설정
 */
export interface GroupingStrategy {
  /** 기본 그룹화 기준 */
  readonly primaryGroupBy: GroupBy;
  /** 보조 그룹화 기준 (선택사항) */
  readonly secondaryGroupBy?: GroupBy | undefined;
  /** 병합 전략 */
  readonly mergeStrategy: MergeStrategy;
  /** 최대 그룹 크기 */
  readonly maxGroupSize: number;
  /** 최소 그룹 크기 */
  readonly minGroupSize: number;
}
