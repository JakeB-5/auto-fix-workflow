/**
 * @module common/types/config
 * @description 설정 관련 타입 정의
 */

/**
 * GitHub 설정
 */
export interface GitHubConfig {
  /** GitHub Personal Access Token */
  readonly token: string;
  /** Repository 소유자 (organization 또는 user) */
  readonly owner: string;
  /** Repository 이름 */
  readonly repo: string;
  /** API 베이스 URL (기본값: https://api.github.com) */
  readonly apiBaseUrl?: string;
  /** 기본 브랜치 (기본값: main) */
  readonly defaultBranch?: string;
  /** auto-fix 대상 라벨 (기본값: auto-fix) */
  readonly autoFixLabel?: string;
  /** auto-fix 제외 라벨 (기본값: auto-fix-skip) */
  readonly skipLabel?: string;
}

/**
 * Asana 설정
 */
export interface AsanaConfig {
  /** Asana Personal Access Token */
  readonly token: string;
  /** Workspace GID */
  readonly workspaceGid: string;
  /** 프로젝트 GID 목록 */
  readonly projectGids: readonly string[];
  /** Triage 대상 섹션 이름 (기본값: Triage) */
  readonly triageSection?: string;
  /** 완료 섹션 이름 (기본값: Done) */
  readonly doneSection?: string;
  /** GitHub 연동 후 태그 (기본값: github-synced) */
  readonly syncedTag?: string;
}

/**
 * Sentry 설정 (선택사항)
 */
export interface SentryConfig {
  /** Sentry DSN */
  readonly dsn?: string;
  /** Organization slug */
  readonly organization?: string;
  /** Project slug */
  readonly project?: string;
  /** Webhook secret */
  readonly webhookSecret?: string;
}

/**
 * Git Worktree 설정
 */
export interface WorktreeConfig {
  /** Worktree 베이스 디렉토리 */
  readonly baseDir: string;
  /** 최대 동시 Worktree 수 (기본값: 3) */
  readonly maxConcurrent?: number;
  /** 자동 정리 시간 (분, 기본값: 60) */
  readonly autoCleanupMinutes?: number;
  /** Worktree 이름 접두사 (기본값: autofix-) */
  readonly prefix?: string;
}

/**
 * 체크 설정
 */
export interface ChecksConfig {
  /** 테스트 명령어 (기본값: npm test) */
  readonly testCommand?: string;
  /** 타입 체크 명령어 (기본값: npm run type-check) */
  readonly typeCheckCommand?: string;
  /** 린트 명령어 (기본값: npm run lint) */
  readonly lintCommand?: string;
  /** 테스트 타임아웃 (초, 기본값: 300) */
  readonly testTimeout?: number;
  /** 타입체크 타임아웃 (초, 기본값: 60) */
  readonly typeCheckTimeout?: number;
  /** 린트 타임아웃 (초, 기본값: 120) */
  readonly lintTimeout?: number;
  /** 최대 재시도 횟수 (기본값: 3) */
  readonly maxRetries?: number;
}

/**
 * 로깅 설정
 */
export interface LoggingConfig {
  /** 로그 레벨 */
  readonly level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  /** Pretty 출력 여부 (개발 환경) */
  readonly pretty?: boolean;
  /** 파일 로깅 경로 */
  readonly filePath?: string;
  /** 민감 정보 마스킹 여부 (기본값: true) */
  readonly redact?: boolean;
}

/**
 * 전체 설정
 */
export interface Config {
  /** GitHub 설정 */
  readonly github: GitHubConfig;
  /** Asana 설정 */
  readonly asana: AsanaConfig;
  /** Sentry 설정 (선택사항) */
  readonly sentry?: SentryConfig;
  /** Worktree 설정 */
  readonly worktree: WorktreeConfig;
  /** 체크 설정 */
  readonly checks?: ChecksConfig;
  /** 로깅 설정 */
  readonly logging?: LoggingConfig;
}

/**
 * 부분 설정 (환경변수 오버라이드용)
 */
export type PartialConfig = {
  readonly github?: Partial<GitHubConfig>;
  readonly asana?: Partial<AsanaConfig>;
  readonly sentry?: Partial<SentryConfig>;
  readonly worktree?: Partial<WorktreeConfig>;
  readonly checks?: Partial<ChecksConfig>;
  readonly logging?: Partial<LoggingConfig>;
};
