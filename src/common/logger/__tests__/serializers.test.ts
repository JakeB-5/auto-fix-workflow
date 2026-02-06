/**
 * @module common/logger/__tests__/serializers
 * @description Tests for logger serializers
 */

import { describe, it, expect } from 'vitest';
import {
  errorSerializer,
  requestSerializer,
  responseSerializer,
  githubIssueSerializer,
  worktreeSerializer,
  processSerializer,
  defaultSerializers,
  createSerializers,
} from '../serializers.js';

describe('errorSerializer', () => {
  it('should serialize basic error', () => {
    const error = new Error('Test error');
    const result = errorSerializer(error);

    expect(result.type).toBe('Error');
    expect(result.message).toBe('Test error');
    expect(result.stack).toBeDefined();
    expect(typeof result.stack).toBe('string');
  });

  it('should serialize error with code', () => {
    const error = new Error('Test error') as Error & { code: string };
    error.code = 'ERR_TEST';
    const result = errorSerializer(error);

    expect(result.code).toBe('ERR_TEST');
  });

  it('should serialize error with numeric code', () => {
    const error = new Error('Test error') as Error & { code: number };
    error.code = 404;
    const result = errorSerializer(error);

    expect(result.code).toBe(404);
  });

  it('should serialize error with cause', () => {
    const cause = new Error('Cause error');
    const error = new Error('Main error', { cause });
    const result = errorSerializer(error);

    expect(result.cause).toBeDefined();
    expect(result.cause?.type).toBe('Error');
    expect(result.cause?.message).toBe('Cause error');
  });

  it('should handle nested causes', () => {
    const rootCause = new Error('Root cause');
    const cause = new Error('Middle cause', { cause: rootCause });
    const error = new Error('Main error', { cause });
    const result = errorSerializer(error);

    expect(result.cause).toBeDefined();
    expect(result.cause?.cause).toBeDefined();
    expect(result.cause?.cause?.message).toBe('Root cause');
  });

  it('should include custom enumerable properties', () => {
    const error = new Error('Test error') as Error & { customProp: string };
    error.customProp = 'custom value';
    const result = errorSerializer(error);

    expect(result.customProp).toBe('custom value');
  });

  it('should preserve constructor name', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    const error = new CustomError('Test');
    const result = errorSerializer(error);

    expect(result.type).toBe('CustomError');
  });

  it('should handle error without code', () => {
    const error = new Error('Test');
    const result = errorSerializer(error);

    expect(result.code).toBeUndefined();
  });

  it('should handle error with undefined code', () => {
    const error = new Error('Test') as Error & { code: undefined };
    error.code = undefined;
    const result = errorSerializer(error);

    expect(result.code).toBeUndefined();
  });

  it('should include non-error causes as properties', () => {
    const error = new Error('Test') as Error & { cause: string };
    error.cause = 'string cause';
    const result = errorSerializer(error);

    // Non-Error causes are included as enumerable properties, not as SerializedError.cause
    expect(result.cause).toBe('string cause');
  });
});

describe('requestSerializer', () => {
  it('should serialize basic request', () => {
    const req = { method: 'GET', url: '/api/test' };
    const result = requestSerializer(req);

    expect(result).toEqual({
      method: 'GET',
      url: '/api/test',
    });
  });

  it('should use path as fallback for url', () => {
    const req = { method: 'POST', path: '/api/test' };
    const result = requestSerializer(req);

    expect(result).toMatchObject({
      method: 'POST',
      url: '/api/test',
    });
  });

  it('should handle missing method and url', () => {
    const req = {};
    const result = requestSerializer(req);

    expect(result).toMatchObject({
      method: 'UNKNOWN',
      url: '/',
    });
  });

  it('should serialize headers', () => {
    const req = {
      method: 'GET',
      url: '/test',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'test-agent',
        'authorization': 'Bearer token',
      },
    };
    const result = requestSerializer(req);

    expect(result).toMatchObject({
      headers: {
        'content-type': 'application/json',
        'user-agent': 'test-agent',
        'authorization': 'Bearer token',
      },
    });
  });

  it('should include x-request-id header', () => {
    const req = {
      method: 'GET',
      url: '/test',
      headers: { 'x-request-id': 'abc-123' },
    };
    const result = requestSerializer(req);

    expect(result).toMatchObject({
      headers: { 'x-request-id': 'abc-123' },
    });
  });

  it('should serialize query parameters', () => {
    const req = {
      method: 'GET',
      url: '/test',
      query: { page: 1, limit: 10 },
    };
    const result = requestSerializer(req);

    expect(result).toMatchObject({
      query: { page: 1, limit: 10 },
    });
  });

  it('should serialize route params', () => {
    const req = {
      method: 'GET',
      url: '/test',
      params: { id: '123' },
    };
    const result = requestSerializer(req);

    expect(result).toMatchObject({
      params: { id: '123' },
    });
  });

  it('should serialize remote address from ip', () => {
    const req = {
      method: 'GET',
      url: '/test',
      ip: '192.168.1.1',
    };
    const result = requestSerializer(req);

    expect(result).toMatchObject({
      remoteAddress: '192.168.1.1',
    });
  });

  it('should serialize remote address from remoteAddress', () => {
    const req = {
      method: 'GET',
      url: '/test',
      remoteAddress: '192.168.1.2',
    };
    const result = requestSerializer(req);

    expect(result).toMatchObject({
      remoteAddress: '192.168.1.2',
    });
  });

  it('should prefer ip over remoteAddress', () => {
    const req = {
      method: 'GET',
      url: '/test',
      ip: '192.168.1.1',
      remoteAddress: '192.168.1.2',
    };
    const result = requestSerializer(req);

    expect(result).toMatchObject({
      remoteAddress: '192.168.1.1',
    });
  });

  it('should serialize request ID from id', () => {
    const req = {
      method: 'GET',
      url: '/test',
      id: 'req-123',
    };
    const result = requestSerializer(req);

    expect(result).toMatchObject({
      id: 'req-123',
    });
  });

  it('should serialize request ID from requestId', () => {
    const req = {
      method: 'GET',
      url: '/test',
      requestId: 'req-456',
    };
    const result = requestSerializer(req);

    expect(result).toMatchObject({
      id: 'req-456',
    });
  });

  it('should prefer id over requestId', () => {
    const req = {
      method: 'GET',
      url: '/test',
      id: 'req-123',
      requestId: 'req-456',
    };
    const result = requestSerializer(req);

    expect(result).toMatchObject({
      id: 'req-123',
    });
  });

  it('should return non-object values as-is', () => {
    expect(requestSerializer(null)).toBe(null);
    expect(requestSerializer(undefined)).toBe(undefined);
    expect(requestSerializer('string')).toBe('string');
    expect(requestSerializer(123)).toBe(123);
  });

  it('should handle empty headers', () => {
    const req = {
      method: 'GET',
      url: '/test',
      headers: {},
    };
    const result = requestSerializer(req);

    expect(result).toHaveProperty('headers');
  });
});

describe('responseSerializer', () => {
  it('should serialize basic response', () => {
    const res = { statusCode: 200 };
    const result = responseSerializer(res);

    expect(result).toEqual({ statusCode: 200 });
  });

  it('should use status as fallback for statusCode', () => {
    const res = { status: 404 };
    const result = responseSerializer(res);

    expect(result).toMatchObject({ statusCode: 404 });
  });

  it('should default statusCode to 0', () => {
    const res = {};
    const result = responseSerializer(res);

    expect(result).toMatchObject({ statusCode: 0 });
  });

  it('should serialize response headers', () => {
    const res = {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'content-length': '123',
      },
    };
    const result = responseSerializer(res);

    expect(result).toMatchObject({
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'content-length': '123',
      },
    });
  });

  it('should handle missing headers', () => {
    const res = { statusCode: 200 };
    const result = responseSerializer(res);

    expect(result.headers).toBeUndefined();
  });

  it('should return non-object values as-is', () => {
    expect(responseSerializer(null)).toBe(null);
    expect(responseSerializer(undefined)).toBe(undefined);
    expect(responseSerializer('string')).toBe('string');
    expect(responseSerializer(123)).toBe(123);
  });
});

describe('githubIssueSerializer', () => {
  it('should serialize GitHub issue', () => {
    const issue = {
      number: 123,
      title: 'Test issue',
      state: 'open',
      html_url: 'https://github.com/owner/repo/issues/123',
      labels: [{ name: 'bug' }, { name: 'enhancement' }],
    };
    const result = githubIssueSerializer(issue);

    expect(result).toEqual({
      number: 123,
      title: 'Test issue',
      state: 'open',
      url: 'https://github.com/owner/repo/issues/123',
      labels: ['bug', 'enhancement'],
    });
  });

  it('should use url as fallback for html_url', () => {
    const issue = {
      number: 123,
      title: 'Test',
      state: 'open',
      url: 'https://api.github.com/repos/owner/repo/issues/123',
    };
    const result = githubIssueSerializer(issue);

    expect(result).toMatchObject({
      url: 'https://api.github.com/repos/owner/repo/issues/123',
    });
  });

  it('should handle missing labels', () => {
    const issue = {
      number: 123,
      title: 'Test',
      state: 'open',
    };
    const result = githubIssueSerializer(issue);

    expect(result).toMatchObject({
      labels: undefined,
    });
  });

  it('should handle labels as strings', () => {
    const issue = {
      number: 123,
      title: 'Test',
      labels: ['bug', 'feature'],
    };
    const result = githubIssueSerializer(issue);

    expect(result).toMatchObject({
      labels: ['bug', 'feature'],
    });
  });

  it('should return non-object values as-is', () => {
    expect(githubIssueSerializer(null)).toBe(null);
    expect(githubIssueSerializer(undefined)).toBe(undefined);
    expect(githubIssueSerializer('string')).toBe('string');
  });

  it('should handle labels without name property', () => {
    const issue = {
      number: 123,
      title: 'Test',
      labels: [{ id: 1 }, { id: 2 }],
    };
    const result = githubIssueSerializer(issue);

    expect(result).toMatchObject({
      labels: [{ id: 1 }, { id: 2 }],
    });
  });
});

describe('worktreeSerializer', () => {
  it('should serialize worktree info', () => {
    const worktree = {
      path: '/test/path',
      branch: 'test-branch',
      status: 'active',
      issueNumber: 123,
    };
    const result = worktreeSerializer(worktree);

    expect(result).toEqual({
      path: '/test/path',
      branch: 'test-branch',
      status: 'active',
      issueNumber: 123,
    });
  });

  it('should handle partial worktree info', () => {
    const worktree = {
      path: '/test/path',
      branch: 'test-branch',
    };
    const result = worktreeSerializer(worktree);

    expect(result).toMatchObject({
      path: '/test/path',
      branch: 'test-branch',
      status: undefined,
      issueNumber: undefined,
    });
  });

  it('should return non-object values as-is', () => {
    expect(worktreeSerializer(null)).toBe(null);
    expect(worktreeSerializer(undefined)).toBe(undefined);
    expect(worktreeSerializer('string')).toBe('string');
  });
});

describe('processSerializer', () => {
  it('should serialize process info', () => {
    const result = processSerializer();

    expect(result).toHaveProperty('pid');
    expect(result).toHaveProperty('ppid');
    expect(result).toHaveProperty('nodeVersion');
    expect(result).toHaveProperty('platform');
    expect(result).toHaveProperty('arch');
    expect(result).toHaveProperty('memoryUsage');
    expect(result).toHaveProperty('uptime');
  });

  it('should have correct types', () => {
    const result = processSerializer() as {
      pid: number;
      ppid: number;
      nodeVersion: string;
      platform: string;
      arch: string;
      memoryUsage: NodeJS.MemoryUsage;
      uptime: number;
    };

    expect(typeof result.pid).toBe('number');
    expect(typeof result.ppid).toBe('number');
    expect(typeof result.nodeVersion).toBe('string');
    expect(typeof result.platform).toBe('string');
    expect(typeof result.arch).toBe('string');
    expect(typeof result.memoryUsage).toBe('object');
    expect(typeof result.uptime).toBe('number');
  });

  it('should return valid memory usage', () => {
    const result = processSerializer() as { memoryUsage: NodeJS.MemoryUsage };

    expect(result.memoryUsage).toHaveProperty('rss');
    expect(result.memoryUsage).toHaveProperty('heapTotal');
    expect(result.memoryUsage).toHaveProperty('heapUsed');
    expect(result.memoryUsage).toHaveProperty('external');
  });
});

describe('defaultSerializers', () => {
  it('should have all required serializers', () => {
    expect(defaultSerializers.err).toBeDefined();
    expect(defaultSerializers.error).toBeDefined();
    expect(defaultSerializers.req).toBeDefined();
    expect(defaultSerializers.request).toBeDefined();
    expect(defaultSerializers.res).toBeDefined();
    expect(defaultSerializers.response).toBeDefined();
    expect(defaultSerializers.issue).toBeDefined();
    expect(defaultSerializers.pr).toBeDefined();
    expect(defaultSerializers.pullRequest).toBeDefined();
    expect(defaultSerializers.worktree).toBeDefined();
    expect(defaultSerializers.process).toBeDefined();
  });

  it('should have err and error point to errorSerializer', () => {
    expect(defaultSerializers.err).toBe(errorSerializer);
    expect(defaultSerializers.error).toBe(errorSerializer);
  });

  it('should have req and request point to requestSerializer', () => {
    expect(defaultSerializers.req).toBe(requestSerializer);
    expect(defaultSerializers.request).toBe(requestSerializer);
  });

  it('should have res and response point to responseSerializer', () => {
    expect(defaultSerializers.res).toBe(responseSerializer);
    expect(defaultSerializers.response).toBe(responseSerializer);
  });

  it('should have issue, pr, and pullRequest point to githubIssueSerializer', () => {
    expect(defaultSerializers.issue).toBe(githubIssueSerializer);
    expect(defaultSerializers.pr).toBe(githubIssueSerializer);
    expect(defaultSerializers.pullRequest).toBe(githubIssueSerializer);
  });
});

describe('createSerializers', () => {
  it('should return default serializers when no custom provided', () => {
    const serializers = createSerializers();

    expect(serializers).toEqual(defaultSerializers);
  });

  it('should merge custom serializers with defaults', () => {
    const custom = {
      customField: (val: unknown) => `custom: ${val}`,
    };
    const serializers = createSerializers(custom);

    expect(serializers.err).toBe(defaultSerializers.err);
    expect(serializers.customField).toBe(custom.customField);
  });

  it('should override default serializers', () => {
    const customError = (err: Error) => ({ custom: err.message });
    const serializers = createSerializers({ error: customError });

    expect(serializers.error).toBe(customError);
    expect(serializers.error).not.toBe(defaultSerializers.error);
  });

  it('should preserve all default serializers when adding custom', () => {
    const serializers = createSerializers({ custom: (val: unknown) => val });

    expect(Object.keys(serializers).length).toBeGreaterThan(
      Object.keys(defaultSerializers).length
    );
  });
});
