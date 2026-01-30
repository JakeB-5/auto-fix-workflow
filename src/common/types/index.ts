/**
 * @module common/types
 * @description 공통 타입 정의 배럴 파일
 */

// Issue 관련 타입
export type {
  IssueSource,
  IssueType,
  IssuePriority,
  IssueStatus,
  IssueContext,
  CodeAnalysis,
  SuggestedFix,
  AcceptanceCriteria,
  Issue,
  PRStatus,
  PullRequest,
  CreatePRParams,
} from './issue.js';

// Config 관련 타입
export type {
  GitHubConfig,
  AsanaConfig,
  SentryConfig,
  WorktreeConfig,
  ChecksConfig,
  LoggingConfig,
  Config,
  PartialConfig,
} from './config.js';

// Result 타입 및 유틸리티
export type {
  Success,
  Failure,
  Result,
} from './result.js';

export {
  isSuccess,
  isFailure,
  ok,
  err,
  unwrapOr,
  unwrap,
  map,
  flatMap,
  mapError,
  all,
  fromPromise,
  toPromise,
} from './result.js';

// Worktree 관련 타입
export type {
  WorktreeStatus,
  WorktreeInfo,
  WorktreeAction,
  CreateWorktreeParams,
  RemoveWorktreeParams,
  ListWorktreesParams,
  ManageWorktreeRequest,
  ManageWorktreeResponse,
  WorktreeEventType,
  WorktreeEvent,
} from './worktree.js';

// Check 관련 타입
export type {
  CheckType,
  CheckStatus,
  SingleCheckResult,
  PreviousError,
  CheckResult,
  RunChecksParams,
  CheckCommand,
  PackageManager,
  CheckConfiguration,
  RunChecksResult,
  CheckError,
  CheckErrorCode,
} from './check.js';

// IssueGroup 관련 타입
export type {
  GroupBy,
  IssueGroup,
  GroupIssuesParams,
  GroupIssuesResult,
  GroupProcessingStatus,
  GroupProcessingResult,
  BranchNameOptions,
  MergeStrategy,
  GroupingStrategy,
} from './issue-group.js';
