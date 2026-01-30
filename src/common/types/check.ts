/**
 * @module common/types/check
 * @description 품질 체크 관련 타입 정의
 */

import type { Result } from './result.js';

/**
 * 체크 유형
 */
export type CheckType = 'test' | 'typecheck' | 'lint';

/**
 * 체크 상태
 */
export type CheckStatus =
  | 'pending'     // 대기 중
  | 'running'     // 실행 중
  | 'passed'      // 통과
  | 'failed'      // 실패
  | 'skipped'     // 건너뜀
  | 'timeout';    // 타임아웃

/**
 * 단일 체크 결과
 */
export interface SingleCheckResult {
  /** 체크 유형 */
  readonly check: CheckType;
  /** 통과 여부 */
  readonly passed: boolean;
  /** 체크 상태 */
  readonly status: CheckStatus;
  /** 표준 출력 */
  readonly stdout?: string;
  /** 표준 에러 */
  readonly stderr?: string;
  /** 실행 시간 (밀리초) */
  readonly durationMs: number;
  /** 종료 코드 */
  readonly exitCode?: number;
  /** 에러 메시지 */
  readonly error?: string;
}

/**
 * 이전 시도 에러 정보
 */
export interface PreviousError {
  /** 시도 횟수 */
  readonly attempt: number;
  /** 체크 유형 */
  readonly check: CheckType;
  /** 에러 메시지 */
  readonly error: string;
  /** 발생 시간 */
  readonly timestamp: string;
}

/**
 * 체크 실행 결과
 */
export interface CheckResult {
  /** 전체 통과 여부 */
  readonly passed: boolean;
  /** 개별 체크 결과 목록 */
  readonly results: readonly SingleCheckResult[];
  /** 현재 시도 횟수 (1-3) */
  readonly attempt: number;
  /** 최대 재시도 초과 여부 */
  readonly maxRetriesExceeded?: boolean;
  /** 이전 시도 에러 목록 */
  readonly previousErrors?: readonly PreviousError[];
  /** 총 실행 시간 (밀리초) */
  readonly totalDurationMs: number;
}

/**
 * 체크 실행 파라미터
 */
export interface RunChecksParams {
  /** Worktree 경로 */
  readonly worktreePath: string;
  /** 실행할 체크 목록 */
  readonly checks: readonly CheckType[];
  /** 첫 실패 시 중단 여부 (기본값: true) */
  readonly failFast?: boolean;
  /** 타임아웃 (밀리초) */
  readonly timeout?: number;
}

/**
 * 체크 명령어 정보
 */
export interface CheckCommand {
  /** 체크 유형 */
  readonly check: CheckType;
  /** 실행할 명령어 */
  readonly command: string;
  /** 명령어 인자 */
  readonly args: readonly string[];
  /** 타임아웃 (밀리초) */
  readonly timeoutMs: number;
  /** 작업 디렉토리 */
  readonly cwd: string;
}

/**
 * 패키지 매니저 유형
 */
export type PackageManager = 'npm' | 'pnpm' | 'yarn';

/**
 * 체크 구성 정보
 */
export interface CheckConfiguration {
  /** 패키지 매니저 */
  readonly packageManager: PackageManager;
  /** 체크별 명령어 매핑 */
  readonly commands: Readonly<Record<CheckType, CheckCommand>>;
  /** 실행 순서 */
  readonly order: readonly CheckType[];
}

/**
 * 체크 실행 결과 타입
 */
export type RunChecksResult = Result<CheckResult, CheckError>;

/**
 * 체크 에러
 */
export interface CheckError {
  /** 에러 코드 */
  readonly code: CheckErrorCode;
  /** 에러 메시지 */
  readonly message: string;
  /** 실패한 체크 유형 */
  readonly check?: CheckType;
  /** 추가 컨텍스트 */
  readonly context?: Record<string, unknown>;
}

/**
 * 체크 에러 코드
 */
export type CheckErrorCode =
  | 'WORKTREE_NOT_FOUND'
  | 'INVALID_CHECKS'
  | 'COMMAND_FAILED'
  | 'TIMEOUT'
  | 'MAX_RETRIES_EXCEEDED'
  | 'PACKAGE_MANAGER_NOT_FOUND'
  | 'UNKNOWN_ERROR';
