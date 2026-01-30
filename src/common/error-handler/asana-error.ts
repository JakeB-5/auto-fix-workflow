/**
 * @module common/error-handler/asana-error
 * @description Asana API error class
 */

import { AutofixError } from './base.js';
import type { AsanaErrorCode } from './codes.js';

/**
 * Context for Asana API errors
 */
export interface AsanaApiErrorContext {
  /** HTTP status code */
  readonly statusCode?: number | undefined;
  /** Asana API endpoint */
  readonly endpoint?: string | undefined;
  /** HTTP method used */
  readonly method?: string | undefined;
  /** Workspace GID */
  readonly workspaceGid?: string | undefined;
  /** Project GID */
  readonly projectGid?: string | undefined;
  /** Task GID */
  readonly taskGid?: string | undefined;
  /** Rate limit info */
  readonly retryAfter?: number | undefined;
  /** Asana error code/phrase */
  readonly asanaErrorCode?: string | undefined;
}

/**
 * Error class for Asana API errors
 *
 * @example
 * ```typescript
 * throw new AsanaApiError(
 *   'ASANA_NOT_FOUND',
 *   'Task not found',
 *   { taskGid: '12345', statusCode: 404 }
 * );
 * ```
 */
export class AsanaApiError extends AutofixError {
  readonly code: AsanaErrorCode;
  readonly context: Readonly<AsanaApiErrorContext>;

  constructor(
    code: AsanaErrorCode,
    message: string,
    context: AsanaApiErrorContext = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.code = code;
    this.context = Object.freeze({ ...context });
    Object.freeze(this);
  }

  /**
   * Create from an Asana API response error
   */
  static fromResponse(
    statusCode: number,
    message: string,
    context: Omit<AsanaApiErrorContext, 'statusCode'> = {},
    cause?: unknown
  ): AsanaApiError {
    const code = AsanaApiError.statusToCode(statusCode);
    return new AsanaApiError(
      code,
      message,
      { ...context, statusCode },
      cause ? { cause } : undefined
    );
  }

  /**
   * Map HTTP status code to error code
   */
  static statusToCode(statusCode: number): AsanaErrorCode {
    switch (statusCode) {
      case 401:
        return 'ASANA_AUTH_FAILED';
      case 403:
        return 'ASANA_FORBIDDEN';
      case 404:
        return 'ASANA_NOT_FOUND';
      case 422:
        return 'ASANA_VALIDATION_ERROR';
      case 429:
        return 'ASANA_RATE_LIMITED';
      default:
        if (statusCode >= 500) {
          return 'ASANA_SERVER_ERROR';
        }
        return 'ASANA_UNKNOWN';
    }
  }

  /**
   * Create an AsanaApiError for authentication failures
   */
  static authFailed(message = 'Asana authentication failed'): AsanaApiError {
    return new AsanaApiError(
      'ASANA_AUTH_FAILED',
      message,
      { statusCode: 401 }
    );
  }

  /**
   * Create an AsanaApiError for rate limiting
   */
  static rateLimited(retryAfter?: number): AsanaApiError {
    const message = retryAfter
      ? `Asana API rate limit exceeded. Retry after ${retryAfter} seconds`
      : 'Asana API rate limit exceeded';

    return new AsanaApiError(
      'ASANA_RATE_LIMITED',
      message,
      { statusCode: 429, retryAfter }
    );
  }

  /**
   * Create an AsanaApiError for not found resources
   */
  static notFound(
    resourceType: string,
    gid: string,
    context: Pick<AsanaApiErrorContext, 'workspaceGid' | 'projectGid'> = {}
  ): AsanaApiError {
    return new AsanaApiError(
      'ASANA_NOT_FOUND',
      `${resourceType} not found: ${gid}`,
      { ...context, taskGid: gid, statusCode: 404 }
    );
  }

  /**
   * Create an AsanaApiError for network errors
   */
  static networkError(message: string, cause?: unknown): AsanaApiError {
    return new AsanaApiError(
      'ASANA_NETWORK_ERROR',
      `Asana API network error: ${message}`,
      {},
      cause ? { cause } : undefined
    );
  }

  /**
   * Create an AsanaApiError for validation errors
   */
  static validationError(
    message: string,
    context: Omit<AsanaApiErrorContext, 'statusCode'> = {}
  ): AsanaApiError {
    return new AsanaApiError(
      'ASANA_VALIDATION_ERROR',
      message,
      { ...context, statusCode: 422 }
    );
  }

  /**
   * Create an AsanaApiError for forbidden access
   */
  static forbidden(
    message: string,
    context: Omit<AsanaApiErrorContext, 'statusCode'> = {}
  ): AsanaApiError {
    return new AsanaApiError(
      'ASANA_FORBIDDEN',
      message,
      { ...context, statusCode: 403 }
    );
  }

  /**
   * Check if the error indicates rate limiting
   */
  get isRateLimited(): boolean {
    return this.code === 'ASANA_RATE_LIMITED';
  }

  /**
   * Get retry delay in milliseconds
   */
  get retryDelayMs(): number | undefined {
    if (this.context.retryAfter !== undefined) {
      return this.context.retryAfter * 1000;
    }
    return undefined;
  }
}
