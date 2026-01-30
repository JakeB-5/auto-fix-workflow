/**
 * @module common/error-handler/__tests__/masking.test
 * @description Unit tests for sensitive data masking
 */

import { describe, it, expect } from 'vitest';
import {
  maskSensitiveData,
  createMasker,
  looksLikeSensitiveValue,
} from '../masking.js';

describe('maskSensitiveData', () => {
  describe('string masking', () => {
    it('should mask api_key patterns', () => {
      const input = 'api_key: secret123abc';
      const result = maskSensitiveData(input);
      expect(result).not.toContain('secret123abc');
      expect(result).toContain('***MASKED***');
    });

    it('should mask apiKey patterns', () => {
      const input = 'apiKey=my-secret-key';
      const result = maskSensitiveData(input);
      expect(result).not.toContain('my-secret-key');
    });

    it('should mask access_token patterns', () => {
      const input = 'access_token: "abc123def456"';
      const result = maskSensitiveData(input);
      expect(result).not.toContain('abc123def456');
    });

    it('should mask Bearer tokens', () => {
      const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const result = maskSensitiveData(input);
      expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should mask password patterns', () => {
      const input = 'password: supersecret123';
      const result = maskSensitiveData(input);
      expect(result).not.toContain('supersecret123');
    });

    it('should mask GitHub personal access tokens', () => {
      const input = 'token: ghp_1234567890abcdefghijABCDEFGHIJ123456';
      const result = maskSensitiveData(input);
      expect(result).not.toContain('ghp_');
    });

    it('should mask GitHub OAuth tokens', () => {
      const input = 'gho_1234567890abcdefghijABCDEFGHIJ123456';
      const result = maskSensitiveData(input);
      expect(result).not.toContain('gho_');
    });

    it('should mask long hex strings', () => {
      const input = 'key: abcdef0123456789abcdef0123456789';
      const result = maskSensitiveData(input);
      expect(result).not.toContain('abcdef0123456789abcdef0123456789');
    });

    it('should preserve non-sensitive data', () => {
      const input = 'name: John Doe, age: 30';
      const result = maskSensitiveData(input);
      expect(result).toBe(input);
    });
  });

  describe('object masking', () => {
    it('should mask sensitive keys', () => {
      const input = {
        name: 'test',
        apiKey: 'secret123',
        password: 'pass456',
      };
      const result = maskSensitiveData(input) as Record<string, unknown>;

      expect(result['name']).toBe('test');
      expect(result['apiKey']).toBe('***MASKED***');
      expect(result['password']).toBe('***MASKED***');
    });

    it('should mask nested objects', () => {
      const input = {
        config: {
          auth: {
            token: 'secret',
          },
        },
      };
      const result = maskSensitiveData(input) as Record<string, unknown>;
      const config = result['config'] as Record<string, unknown>;
      const auth = config['auth'] as Record<string, unknown>;

      expect(auth['token']).toBe('***MASKED***');
    });

    it('should mask arrays and sensitive key values', () => {
      const input = {
        items: ['item1', 'item2'],
        config: {
          apiKey: 'secret',
        },
      };
      const result = maskSensitiveData(input) as Record<string, unknown>;
      const config = result['config'] as Record<string, unknown>;

      // 'apiKey' is a sensitive key, so its value should be masked
      expect(config['apiKey']).toBe('***MASKED***');
      // Arrays with non-sensitive values should be preserved
      expect(result['items']).toEqual(['item1', 'item2']);
    });

    it('should mask entire value when key is sensitive', () => {
      const input = {
        tokens: ['token1', 'token2'],
        credentials: {
          user: 'admin',
          pass: 'secret',
        },
      };
      const result = maskSensitiveData(input) as Record<string, unknown>;

      // 'tokens' and 'credentials' are sensitive keys, so entire values are masked
      expect(result['tokens']).toBe('***MASKED***');
      expect(result['credentials']).toBe('***MASKED***');
    });

    it('should handle circular references', () => {
      const input: Record<string, unknown> = { name: 'test' };
      input['self'] = input;

      const result = maskSensitiveData(input) as Record<string, unknown>;
      expect(result['self']).toEqual({ '[Circular Reference]': true });
    });

    it('should mask case-insensitive keys', () => {
      const input = {
        API_KEY: 'secret1',
        ApiKey: 'secret2',
        apikey: 'secret3',
      };
      const result = maskSensitiveData(input) as Record<string, unknown>;

      expect(result['API_KEY']).toBe('***MASKED***');
      expect(result['ApiKey']).toBe('***MASKED***');
      expect(result['apikey']).toBe('***MASKED***');
    });
  });

  describe('Error masking', () => {
    it('should mask Error objects', () => {
      const error = new Error('Failed with password: secret123');
      const result = maskSensitiveData(error) as Record<string, unknown>;

      expect(result['name']).toBe('Error');
      expect(result['message']).not.toContain('secret123');
    });

    it('should mask error stack traces', () => {
      const error = new Error('Test error');
      error.stack = 'Error at api_key=secret123';
      const result = maskSensitiveData(error) as Record<string, unknown>;

      expect(result['stack']).not.toContain('secret123');
    });
  });

  describe('primitive handling', () => {
    it('should return null as is', () => {
      expect(maskSensitiveData(null)).toBeNull();
    });

    it('should return undefined as is', () => {
      expect(maskSensitiveData(undefined)).toBeUndefined();
    });

    it('should return numbers as is', () => {
      expect(maskSensitiveData(42)).toBe(42);
    });

    it('should return booleans as is', () => {
      expect(maskSensitiveData(true)).toBe(true);
    });
  });

  describe('custom patterns', () => {
    it('should mask custom patterns', () => {
      const input = 'custom-secret-12345';
      const result = maskSensitiveData(input, ['custom-secret-\\d+']);

      expect(result).not.toContain('12345');
    });

    it('should combine custom and default patterns', () => {
      const input = {
        apiKey: 'secret',
        customField: 'CUSTOM_VALUE_123',
      };
      const result = maskSensitiveData(input, ['CUSTOM_VALUE_\\d+']) as Record<string, unknown>;

      expect(result['apiKey']).toBe('***MASKED***');
      expect(String(result['customField'])).not.toContain('123');
    });
  });
});

describe('createMasker', () => {
  it('should create reusable masker', () => {
    const masker = createMasker(['SECRET_\\d+']);

    const result1 = masker('SECRET_123');
    const result2 = masker('SECRET_456');

    expect(result1).not.toContain('123');
    expect(result2).not.toContain('456');
  });

  it('should work without custom patterns', () => {
    const masker = createMasker();
    const result = masker({ apiKey: 'secret' }) as Record<string, unknown>;

    expect(result['apiKey']).toBe('***MASKED***');
  });
});

describe('looksLikeSensitiveValue', () => {
  it('should detect API keys', () => {
    expect(looksLikeSensitiveValue('api_key: secret')).toBe(true);
    expect(looksLikeSensitiveValue('apiKey=secret')).toBe(true);
  });

  it('should detect tokens', () => {
    expect(looksLikeSensitiveValue('access_token: abc')).toBe(true);
    expect(looksLikeSensitiveValue('Bearer token123')).toBe(true);
  });

  it('should detect GitHub tokens', () => {
    expect(looksLikeSensitiveValue('ghp_1234567890abcdefghijABCDEFGHIJ123456')).toBe(true);
  });

  it('should detect passwords', () => {
    expect(looksLikeSensitiveValue('password: secret')).toBe(true);
  });

  it('should detect long hex strings', () => {
    expect(looksLikeSensitiveValue('abcdef0123456789abcdef0123456789')).toBe(true);
  });

  it('should return false for normal text', () => {
    expect(looksLikeSensitiveValue('hello world')).toBe(false);
    expect(looksLikeSensitiveValue('name: John')).toBe(false);
  });
});
