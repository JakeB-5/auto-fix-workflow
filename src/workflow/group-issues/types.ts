/**
 * @module workflow/group-issues/types
 * @description 그룹 이슈 모듈 전용 타입 정의
 */

import type {
  GroupBy,
  IssueGroup,
  GroupIssuesParams,
  GroupIssuesResult,
  BranchNameOptions,
} from '../../common/types/index.js';

/**
 * 그룹화 에러 코드
 */
export type GroupErrorCode =
  | 'INVALID_PARAMS'
  | 'FETCH_FAILED'
  | 'EMPTY_ISSUES'
  | 'INVALID_GROUP_SIZE'
  | 'EXTRACTION_FAILED'
  | 'GROUPING_FAILED';

/**
 * 그룹화 에러
 */
export interface GroupError {
  readonly code: GroupErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

/**
 * 내부 그룹 빌더 (변경 가능)
 */
export interface GroupBuilder {
  id: string;
  name: string;
  groupBy: GroupBy;
  key: string;
  issues: any[];
  relatedFiles: Set<string>;
  components: Set<string>;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

// Re-export common types
export type {
  GroupBy,
  IssueGroup,
  GroupIssuesParams,
  GroupIssuesResult,
  BranchNameOptions,
};
