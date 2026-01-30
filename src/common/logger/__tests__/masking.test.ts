/**
 * @module common/logger/__tests__/masking.test
 * @description Tests for sensitive data masking
 */

import { describe, it, expect } from 'vitest';
import {
  maskSensitiveData,
  maskContext,
  createMasker,
  createMaskingFunction,
  getPinoRedactConfig,
  DEFAULT_MASKING_CONFIG,
} from '../index.js';

describe('maskSensitiveData', () => {
  describe('basic masking', () => {
    it('should mask sensitive keys', () => {
      const data = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com',
      };

      const masked = maskSensitiveData(data) as Record<string, unknown>;

      expect(masked['username']).toBe('john');
      expect(masked['password']).not.toBe('secret123');
      expect(masked['password']).toMatch(/^se\*+23$/);
      expect(masked['email']).toBe('john@example.com');
    });

    it('should mask token keys', () => {
      const data = {
        accessToken: 'abc123xyz789',
        refreshToken: 'refresh_token_value',
        apiKey: 'api_key_12345',
      };

      const masked = maskSensitiveData(data) as Record<string, unknown>;

      expect(masked['accessToken']).toMatch(/^\w{2}\*+\w{2}$/);
      expect(masked['refreshToken']).toMatch(/^\w{2}\*+\w{2}$/);
      expect(masked['apiKey']).toMatch(/^\w{2}\*+\w{2}$/);
    });

    it('should mask nested sensitive data', () => {
      const data = {
        user: {
          name: 'John',
          credentials: {
            password: 'nested_secret',
          },
        },
      };

      const masked = maskSensitiveData(data) as {
        user: { name: string; credentials: { password: string } };
      };

      expect(masked.user.name).toBe('John');
      expect(masked.user.credentials.password).not.toBe('nested_secret');
    });

    it('should mask arrays', () => {
      const data = {
        tokens: ['token1', 'token2'],
        users: [{ name: 'John', password: 'pass1' }, { name: 'Jane', password: 'pass2' }],
      };

      const masked = maskSensitiveData(data) as {
        tokens: string[];
        users: Array<{ name: string; password: string }>;
      };

      expect(masked.users[0]?.password).not.toBe('pass1');
      expect(masked.users[1]?.password).not.toBe('pass2');
      expect(masked.users[0]?.name).toBe('John');
    });
  });

  describe('pattern detection', () => {
    it('should mask JWT tokens in strings', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const data = { token: jwt };

      const masked = maskSensitiveData(data) as { token: string };

      expect(masked.token).not.toBe(jwt);
    });

    it('should mask Bearer tokens', () => {
      const data = {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      };

      const masked = maskSensitiveData(data) as { authorization: string };

      expect(masked.authorization).not.toBe(data.authorization);
    });

    it('should mask GitHub tokens', () => {
      const data = {
        githubToken: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      };

      const masked = maskSensitiveData(data) as { githubToken: string };

      expect(masked.githubToken).not.toBe(data.githubToken);
    });

    it('should mask AWS access keys', () => {
      const data = {
        awsKey: 'AKIAIOSFODNN7EXAMPLE',
      };

      const masked = maskSensitiveData(data) as { awsKey: string };

      expect(masked.awsKey).not.toBe(data.awsKey);
    });

    it('should mask connection strings with passwords', () => {
      const data = {
        dbUrl: 'mongodb://user:password123@localhost:27017/mydb',
      };

      const masked = maskSensitiveData(data) as { dbUrl: string };

      expect(masked.dbUrl).not.toBe(data.dbUrl);
    });
  });

  describe('primitives and edge cases', () => {
    it('should handle null and undefined', () => {
      expect(maskSensitiveData(null)).toBeNull();
      expect(maskSensitiveData(undefined)).toBeUndefined();
    });

    it('should handle numbers and booleans', () => {
      expect(maskSensitiveData(42)).toBe(42);
      expect(maskSensitiveData(true)).toBe(true);
      expect(maskSensitiveData(false)).toBe(false);
    });

    it('should handle empty objects', () => {
      expect(maskSensitiveData({})).toEqual({});
    });

    it('should handle empty arrays', () => {
      expect(maskSensitiveData([])).toEqual([]);
    });

    it('should handle short sensitive values', () => {
      const data = { password: 'abc' };
      const masked = maskSensitiveData(data) as { password: string };

      // Short values should be fully replaced
      expect(masked.password).toBe('[REDACTED]');
    });
  });

  describe('custom config', () => {
    it('should use custom censor string', () => {
      const data = { password: 'secret' };
      const masked = maskSensitiveData(data, {
        paths: DEFAULT_MASKING_CONFIG.paths,
        censor: '***HIDDEN***',
      }) as { password: string };

      expect(masked.password).toBe('***HIDDEN***');
    });

    it('should remove keys when remove is true', () => {
      const data = { username: 'john', password: 'secret' };
      const masked = maskSensitiveData(data, {
        paths: DEFAULT_MASKING_CONFIG.paths,
        remove: true,
      }) as { username?: string; password?: string };

      expect(masked.username).toBe('john');
      expect(masked.password).toBeUndefined();
      expect('password' in masked).toBe(false);
    });

    it('should respect custom paths', () => {
      // Use a value longer than 8 chars to get partial masking
      const data = { mySecret: 'secret_value_here', other: 'data' };
      const masked = maskSensitiveData(data, {
        paths: ['mySecret'],
      }) as { mySecret: string; other: string };

      expect(masked.mySecret).toMatch(/^se\*+re$/);
      expect(masked.other).toBe('data');
    });
  });
});

describe('maskContext', () => {
  it('should mask LogContext objects', () => {
    const context = {
      requestId: '123',
      user: {
        id: 'user-1',
        token: 'secret_token_value',
      },
    };

    const masked = maskContext(context) as typeof context;

    expect(masked.requestId).toBe('123');
    expect(masked.user.id).toBe('user-1');
    expect(masked.user.token).not.toBe('secret_token_value');
  });
});

describe('createMasker', () => {
  it('should create reusable masker with config', () => {
    const masker = createMasker({
      paths: ['secret'],
      censor: '[HIDDEN]',
    });

    const result = masker.mask({ secret: 'value', normal: 'data' }) as Record<string, unknown>;

    expect(result['secret']).toBe('[HIDDEN]');
    expect(result['normal']).toBe('data');
  });

  it('should provide utility functions', () => {
    const masker = createMasker();

    expect(masker.isSensitiveKey('password')).toBe(true);
    expect(masker.isSensitiveKey('username')).toBe(false);
    expect(masker.containsSensitivePattern('Bearer token123')).toBe(true);
  });
});

describe('createMaskingFunction', () => {
  it('should create function for pino redact', () => {
    const maskFn = createMaskingFunction('[MASKED]');

    expect(maskFn('short')).toBe('[MASKED]');
    expect(maskFn('longer_value_here')).toMatch(/^lo\*+re$/);
    expect(maskFn(12345)).toBe('[MASKED]');
  });
});

describe('getPinoRedactConfig', () => {
  it('should return pino-compatible config', () => {
    const config = getPinoRedactConfig();

    expect(config).toHaveProperty('paths');
    expect(config).toHaveProperty('censor');
    expect(Array.isArray(config.paths)).toBe(true);
    expect(config.censor).toBe('[REDACTED]');
  });

  it('should filter out wildcard paths (not supported by pino)', () => {
    const config = getPinoRedactConfig({
      paths: ['*.password', 'user.token', '**.secret'],
      censor: '[X]',
    });

    // Wildcard paths are filtered out as pino/fast-redact doesn't support them
    expect(config.paths).not.toContain('*.password');
    expect(config.paths).not.toContain('**.password');
    expect(config.paths).not.toContain('**.secret');
    expect(config.paths).toContain('user.token');
  });
});

describe('Common masking scenarios', () => {
  it('should handle GitHub API response', () => {
    const response = {
      id: 123,
      name: 'my-repo',
      owner: { login: 'user' },
      private: false,
      auth: {
        token: 'github_pat_xxxxxxxxxxxx',
      },
    };

    const masked = maskSensitiveData(response) as typeof response;

    expect(masked.id).toBe(123);
    expect(masked.name).toBe('my-repo');
    expect(masked.auth.token).not.toBe('github_pat_xxxxxxxxxxxx');
  });

  it('should handle config objects', () => {
    const config = {
      github: {
        owner: 'org',
        repo: 'project',
        token: 'ghp_xxxxxxxxxxxxxxxx',
      },
      asana: {
        token: 'asana_token_value',
        workspaceGid: '12345',
      },
      sentry: {
        dsn: 'https://key@sentry.io/123',
      },
    };

    const masked = maskSensitiveData(config) as typeof config;

    expect(masked.github.owner).toBe('org');
    expect(masked.github.repo).toBe('project');
    expect(masked.github.token).not.toBe('ghp_xxxxxxxxxxxxxxxx');
    expect(masked.asana.token).not.toBe('asana_token_value');
    expect(masked.asana.workspaceGid).toBe('12345');
    expect(masked.sentry.dsn).not.toBe('https://key@sentry.io/123');
  });

  it('should handle HTTP headers', () => {
    const headers = {
      'content-type': 'application/json',
      'user-agent': 'my-client/1.0',
      authorization: 'Bearer secret_token',
      cookie: 'session=abc123',
    };

    const masked = maskSensitiveData(headers) as typeof headers;

    expect(masked['content-type']).toBe('application/json');
    expect(masked['user-agent']).toBe('my-client/1.0');
    expect(masked['authorization']).not.toBe('Bearer secret_token');
    expect(masked['cookie']).not.toBe('session=abc123');
  });

  it('should handle error objects with sensitive data', () => {
    const error = {
      message: 'Authentication failed',
      code: 'AUTH_ERROR',
      details: {
        attemptedPassword: 'wrong_password',
        token: 'invalid_token',
      },
    };

    const masked = maskSensitiveData(error) as typeof error;

    expect(masked.message).toBe('Authentication failed');
    expect(masked.code).toBe('AUTH_ERROR');
    expect(masked.details.attemptedPassword).not.toBe('wrong_password');
    expect(masked.details.token).not.toBe('invalid_token');
  });
});
