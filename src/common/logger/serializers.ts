/**
 * @module common/logger/serializers
 * @description Custom Pino serializers for common objects
 */

import type { Serializer, Serializers } from './types.js';

/**
 * Serialized error object
 */
interface SerializedError {
  type: string;
  message: string;
  stack?: string | undefined;
  code?: string | number | undefined;
  cause?: SerializedError | undefined;
}

/**
 * Extended serialized error with additional properties
 */
type SerializedErrorWithExtras = SerializedError & Record<string, unknown>;

/**
 * Error serializer - extracts useful information from Error objects
 */
export const errorSerializer: Serializer<Error> = (error: Error): SerializedErrorWithExtras => {
  const serialized: SerializedErrorWithExtras = {
    type: error.constructor.name,
    message: error.message,
    stack: error.stack,
  };

  // Include error code if present
  if ('code' in error && error.code !== undefined) {
    serialized.code = error.code as string | number;
  }

  // Include cause if present (Error.cause from ES2022)
  if ('cause' in error && error.cause instanceof Error) {
    serialized.cause = errorSerializer(error.cause) as SerializedError;
  }

  // Include any additional enumerable properties
  for (const key of Object.keys(error)) {
    if (!(key in serialized)) {
      serialized[key] = (error as unknown as Record<string, unknown>)[key];
    }
  }

  return serialized;
};

/**
 * Serialized HTTP request object
 */
interface SerializedRequest {
  method: string;
  url: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  remoteAddress?: string;
  id?: string;
}

/**
 * HTTP Request serializer
 */
export const requestSerializer: Serializer = (req: unknown): SerializedRequest | unknown => {
  if (!req || typeof req !== 'object') return req;

  const request = req as Record<string, unknown>;
  const serialized: SerializedRequest = {
    method: String(request['method'] ?? 'UNKNOWN'),
    url: String(request['url'] ?? request['path'] ?? '/'),
  };

  // Include headers (excluding sensitive ones - masking handles the rest)
  if (request['headers'] && typeof request['headers'] === 'object') {
    const headers = request['headers'] as Record<string, string | string[] | undefined>;
    serialized['headers'] = {
      'content-type': headers['content-type'],
      'user-agent': headers['user-agent'],
      'x-request-id': headers['x-request-id'],
      // Authorization header will be masked by the masking config
      'authorization': headers['authorization'],
    };
  }

  // Include query parameters
  if (request['query'] && typeof request['query'] === 'object') {
    serialized['query'] = request['query'] as Record<string, unknown>;
  }

  // Include route parameters
  if (request['params'] && typeof request['params'] === 'object') {
    serialized['params'] = request['params'] as Record<string, unknown>;
  }

  // Include remote address
  if (request['ip'] || request['remoteAddress']) {
    serialized['remoteAddress'] = String(request['ip'] ?? request['remoteAddress']);
  }

  // Include request ID
  if (request['id'] || request['requestId']) {
    serialized['id'] = String(request['id'] ?? request['requestId']);
  }

  return serialized;
};

/**
 * Serialized HTTP response object
 */
interface SerializedResponse {
  statusCode: number;
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * HTTP Response serializer
 */
export const responseSerializer: Serializer = (res: unknown): SerializedResponse | unknown => {
  if (!res || typeof res !== 'object') return res;

  const response = res as Record<string, unknown>;
  const serialized: SerializedResponse = {
    statusCode: Number(response['statusCode'] ?? response['status'] ?? 0),
  };

  // Include select headers
  if (response['headers'] && typeof response['headers'] === 'object') {
    const headers = response['headers'] as Record<string, string | string[] | undefined>;
    serialized['headers'] = {
      'content-type': headers['content-type'],
      'content-length': headers['content-length'],
    };
  }

  return serialized;
};

/**
 * GitHub issue/PR serializer
 */
export const githubIssueSerializer: Serializer = (issue: unknown): unknown => {
  if (!issue || typeof issue !== 'object') return issue;

  const iss = issue as Record<string, unknown>;
  return {
    number: iss['number'],
    title: iss['title'],
    state: iss['state'],
    url: iss['html_url'] ?? iss['url'],
    labels: Array.isArray(iss['labels'])
      ? (iss['labels'] as Array<{ name?: string }>).map(l => l.name ?? l)
      : undefined,
  };
};

/**
 * Git worktree info serializer
 */
export const worktreeSerializer: Serializer = (worktree: unknown): unknown => {
  if (!worktree || typeof worktree !== 'object') return worktree;

  const wt = worktree as Record<string, unknown>;
  return {
    path: wt['path'],
    branch: wt['branch'],
    status: wt['status'],
    issueNumber: wt['issueNumber'],
  };
};

/**
 * Process info serializer (for debugging)
 */
export const processSerializer: Serializer = (): unknown => {
  return {
    pid: process.pid,
    ppid: process.ppid,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
  };
};

/**
 * Default serializers for pino
 */
export const defaultSerializers: Serializers = {
  err: errorSerializer as Serializer,
  error: errorSerializer as Serializer,
  req: requestSerializer,
  request: requestSerializer,
  res: responseSerializer,
  response: responseSerializer,
  issue: githubIssueSerializer,
  pr: githubIssueSerializer,
  pullRequest: githubIssueSerializer,
  worktree: worktreeSerializer,
  process: processSerializer,
} as const;

/**
 * Create a custom serializers object
 */
export function createSerializers(custom: Serializers = {}): Serializers {
  return {
    ...defaultSerializers,
    ...custom,
  };
}
