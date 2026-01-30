/**
 * @module common/types/issue
 * @description Issue 관련 타입 정의
 */

/**
 * 이슈 소스 유형
 */
export type IssueSource = 'asana' | 'sentry' | 'manual' | 'github';

/**
 * 이슈 타입
 */
export type IssueType = 'bug' | 'feature' | 'refactor' | 'docs' | 'test' | 'chore';

/**
 * 이슈 우선순위
 */
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * 이슈 상태
 */
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

/**
 * 이슈 컨텍스트 정보
 */
export interface IssueContext {
  /** 컴포넌트명 */
  readonly component: string;
  /** 우선순위 */
  readonly priority: IssuePriority;
  /** 관련 파일 경로 목록 */
  readonly relatedFiles: readonly string[];
  /** 관련 함수/클래스명 목록 */
  readonly relatedSymbols: readonly string[];
  /** 원본 소스 정보 */
  readonly source: IssueSource;
  /** 원본 소스 ID (Asana task ID, Sentry issue ID 등) */
  readonly sourceId?: string;
  /** 원본 소스 URL */
  readonly sourceUrl?: string;
}

/**
 * 코드 분석 정보
 */
export interface CodeAnalysis {
  /** 파일 경로 */
  readonly filePath: string;
  /** 시작 라인 */
  readonly startLine?: number;
  /** 종료 라인 */
  readonly endLine?: number;
  /** 함수/메서드 명 */
  readonly functionName?: string;
  /** 클래스명 */
  readonly className?: string;
  /** 코드 스니펫 */
  readonly snippet?: string;
}

/**
 * 수정 제안 방향
 */
export interface SuggestedFix {
  /** 제안 설명 */
  readonly description: string;
  /** 수정 단계 */
  readonly steps: readonly string[];
  /** 신뢰도 (0-1) */
  readonly confidence: number;
}

/**
 * 완료 기준
 */
export interface AcceptanceCriteria {
  /** 기준 설명 */
  readonly description: string;
  /** 완료 여부 */
  readonly completed: boolean;
}

/**
 * GitHub Issue 인터페이스
 */
export interface Issue {
  /** 이슈 번호 */
  readonly number: number;
  /** 이슈 제목 */
  readonly title: string;
  /** 이슈 본문 (Markdown) */
  readonly body: string;
  /** 이슈 상태 */
  readonly state: IssueStatus;
  /** 이슈 타입 */
  readonly type: IssueType;
  /** 라벨 목록 */
  readonly labels: readonly string[];
  /** 담당자 목록 */
  readonly assignees: readonly string[];
  /** 이슈 컨텍스트 */
  readonly context: IssueContext;
  /** 코드 분석 정보 */
  readonly codeAnalysis?: CodeAnalysis;
  /** 수정 제안 */
  readonly suggestedFix?: SuggestedFix;
  /** 완료 기준 목록 */
  readonly acceptanceCriteria: readonly AcceptanceCriteria[];
  /** 관련 이슈 번호 목록 */
  readonly relatedIssues: readonly number[];
  /** 생성일 */
  readonly createdAt: Date;
  /** 수정일 */
  readonly updatedAt: Date;
  /** GitHub 이슈 URL */
  readonly url: string;
}

/**
 * Pull Request 상태
 */
export type PRStatus = 'draft' | 'open' | 'merged' | 'closed';

/**
 * Pull Request 인터페이스
 */
export interface PullRequest {
  /** PR 번호 */
  readonly number: number;
  /** PR 제목 */
  readonly title: string;
  /** PR 본문 (Markdown) */
  readonly body: string;
  /** PR 상태 */
  readonly state: PRStatus;
  /** 소스 브랜치 */
  readonly headBranch: string;
  /** 타겟 브랜치 */
  readonly baseBranch: string;
  /** 연결된 이슈 번호 목록 */
  readonly linkedIssues: readonly number[];
  /** 라벨 목록 */
  readonly labels: readonly string[];
  /** 리뷰어 목록 */
  readonly reviewers: readonly string[];
  /** 생성일 */
  readonly createdAt: Date;
  /** 수정일 */
  readonly updatedAt: Date;
  /** GitHub PR URL */
  readonly url: string;
  /** 변경된 파일 수 */
  readonly changedFiles: number;
  /** 추가된 라인 수 */
  readonly additions: number;
  /** 삭제된 라인 수 */
  readonly deletions: number;
}

/**
 * PR 생성 파라미터
 */
export interface CreatePRParams {
  /** PR 제목 */
  readonly title: string;
  /** PR 본문 */
  readonly body: string;
  /** 소스 브랜치 */
  readonly headBranch: string;
  /** 타겟 브랜치 (기본값: main) */
  readonly baseBranch?: string;
  /** 연결할 이슈 번호 목록 */
  readonly linkedIssues?: readonly number[];
  /** 라벨 목록 */
  readonly labels?: readonly string[];
  /** 리뷰어 목록 */
  readonly reviewers?: readonly string[];
  /** Draft PR 여부 */
  readonly draft?: boolean;
}
