/**
 * @module github/create-pr/error-handling
 * @description PR 생성 오류 처리
 */

/**
 * GitHub API 오류 코드
 */
export enum GitHubApiErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN',
}

/**
 * GitHub API 오류 클래스
 */
export class GitHubApiError extends Error {
  constructor(
    public readonly code: GitHubApiErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'GitHubApiError';
    Object.setPrototypeOf(this, GitHubApiError.prototype);
  }

  /**
   * 오류를 사용자 친화적인 메시지로 변환
   */
  toUserMessage(): string {
    switch (this.code) {
      case GitHubApiErrorCode.UNAUTHORIZED:
        return 'Authentication failed. Please check your GitHub token.';
      case GitHubApiErrorCode.NOT_FOUND:
        return 'Repository or branch not found. Please check the owner, repo, and branch names.';
      case GitHubApiErrorCode.VALIDATION_FAILED:
        return `Validation failed: ${this.message}`;
      case GitHubApiErrorCode.ALREADY_EXISTS:
        return 'A pull request already exists for this branch.';
      case GitHubApiErrorCode.NETWORK_ERROR:
        return 'Network error occurred. Please check your internet connection.';
      case GitHubApiErrorCode.RATE_LIMIT:
        return 'GitHub API rate limit exceeded. Please try again later.';
      default:
        return `An error occurred: ${this.message}`;
    }
  }
}

/**
 * Octokit 오류를 GitHubApiError로 변환
 *
 * @param error - 원본 오류
 * @returns GitHubApiError 인스턴스
 */
export function handleOctokitError(error: unknown): GitHubApiError {
  if (error instanceof GitHubApiError) {
    return error;
  }

  // Octokit RequestError 처리
  if (isOctokitError(error)) {
    const status = error.status;
    const message = error.message;

    switch (status) {
      case 401:
        return new GitHubApiError(
          GitHubApiErrorCode.UNAUTHORIZED,
          'Unauthorized: Invalid or missing GitHub token',
          status,
          error
        );
      case 404:
        return new GitHubApiError(
          GitHubApiErrorCode.NOT_FOUND,
          'Not found: Repository, branch, or resource does not exist',
          status,
          error
        );
      case 422:
        // Validation failed 또는 already exists
        if (message.includes('already exists')) {
          return new GitHubApiError(
            GitHubApiErrorCode.ALREADY_EXISTS,
            'A pull request already exists for this head and base',
            status,
            error
          );
        }
        return new GitHubApiError(
          GitHubApiErrorCode.VALIDATION_FAILED,
          message,
          status,
          error
        );
      case 403:
        if (message.includes('rate limit')) {
          return new GitHubApiError(
            GitHubApiErrorCode.RATE_LIMIT,
            'API rate limit exceeded',
            status,
            error
          );
        }
        return new GitHubApiError(
          GitHubApiErrorCode.UNAUTHORIZED,
          'Forbidden: Insufficient permissions',
          status,
          error
        );
      default:
        return new GitHubApiError(
          GitHubApiErrorCode.UNKNOWN,
          message || 'Unknown GitHub API error',
          status,
          error
        );
    }
  }

  // 네트워크 오류
  if (isNetworkError(error)) {
    return new GitHubApiError(
      GitHubApiErrorCode.NETWORK_ERROR,
      'Network error: Unable to reach GitHub API',
      undefined,
      error
    );
  }

  // 일반 오류
  if (error instanceof Error) {
    return new GitHubApiError(
      GitHubApiErrorCode.UNKNOWN,
      error.message,
      undefined,
      error
    );
  }

  return new GitHubApiError(
    GitHubApiErrorCode.UNKNOWN,
    'An unknown error occurred',
    undefined,
    error
  );
}

/**
 * Octokit 오류 타입 가드
 */
function isOctokitError(error: unknown): error is {
  status: number;
  message: string;
  response?: {
    data?: {
      message?: string;
      errors?: Array<{ message: string }>;
    };
  };
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  );
}

/**
 * 네트워크 오류 타입 가드
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('timeout')
    );
  }
  return false;
}

/**
 * Git 오류 클래스
 */
export class GitError extends Error {
  constructor(
    message: string,
    public readonly command?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'GitError';
    Object.setPrototypeOf(this, GitError.prototype);
  }

  toUserMessage(): string {
    if (this.command) {
      return `Git command failed (${this.command}): ${this.message}`;
    }
    return `Git error: ${this.message}`;
  }
}

/**
 * Git 오류 처리
 *
 * @param error - 원본 오류
 * @param command - 실행한 Git 명령어
 * @returns GitError 인스턴스
 */
export function handleGitError(error: unknown, command?: string): GitError {
  if (error instanceof GitError) {
    return error;
  }

  if (error instanceof Error) {
    return new GitError(error.message, command, error);
  }

  return new GitError('Unknown git error', command, error);
}
