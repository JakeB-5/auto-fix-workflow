/**
 * @fileoverview Unit tests for token validators
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateGitHubTokenFormat,
  validateAsanaTokenFormat,
  validateGitHubToken,
  validateAsanaToken,
  validateToken,
  type ValidationResult,
} from '../validators.js';

describe('Token Format Validators', () => {
  describe('validateGitHubTokenFormat', () => {
    it('should accept valid ghp_ token', () => {
      expect(validateGitHubTokenFormat('ghp_1234567890abcdef')).toBe(true);
    });

    it('should accept valid github_pat_ token', () => {
      expect(validateGitHubTokenFormat('github_pat_1234567890abcdef')).toBe(true);
    });

    it('should accept valid gho_ token', () => {
      expect(validateGitHubTokenFormat('gho_1234567890abcdef')).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(validateGitHubTokenFormat('invalid_token')).toBe(false);
      expect(validateGitHubTokenFormat('1234567890')).toBe(false);
      expect(validateGitHubTokenFormat('')).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(validateGitHubTokenFormat(null as any)).toBe(false);
      expect(validateGitHubTokenFormat(undefined as any)).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(validateGitHubTokenFormat('  ghp_1234567890  ')).toBe(true);
    });
  });

  describe('validateAsanaTokenFormat', () => {
    it('should accept token starting with 1/', () => {
      expect(validateAsanaTokenFormat('1/1234567890:abcdef')).toBe(true);
    });

    it('should accept token with 32+ characters', () => {
      expect(validateAsanaTokenFormat('a'.repeat(32))).toBe(true);
      expect(validateAsanaTokenFormat('a'.repeat(50))).toBe(true);
    });

    it('should reject short tokens', () => {
      expect(validateAsanaTokenFormat('short')).toBe(false);
      expect(validateAsanaTokenFormat('a'.repeat(20))).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateAsanaTokenFormat('')).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(validateAsanaTokenFormat(null as any)).toBe(false);
      expect(validateAsanaTokenFormat(undefined as any)).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(validateAsanaTokenFormat('  1/1234567890  ')).toBe(true);
    });
  });
});

describe('Online Token Validators', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateGitHubToken', () => {
    it('should return success with username on valid token', async () => {
      const mockResponse = {
        status: 200,
        json: async () => ({ login: 'testuser' }),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await validateGitHubToken('ghp_valid_token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(true);
        expect(result.data.username).toBe('testuser');
        expect(result.data.error).toBeUndefined();
      }

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer ghp_valid_token',
          }),
        })
      );
    });

    it('should return validation failure on 401 unauthorized', async () => {
      const mockResponse = {
        status: 401,
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await validateGitHubToken('ghp_invalid_token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(false);
        expect(result.data.error).toBe('Invalid GitHub token');
      }
    });

    it('should return validation failure on 403 forbidden', async () => {
      const mockResponse = {
        status: 403,
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await validateGitHubToken('ghp_no_perms');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(false);
        expect(result.data.error).toBe('GitHub token lacks required permissions');
      }
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await validateGitHubToken('ghp_token');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Network error');
      }
    });

    it('should handle timeout', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      global.fetch = vi.fn().mockRejectedValue(abortError);

      const result = await validateGitHubToken('ghp_token');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('timed out');
      }
    });
  });

  describe('validateAsanaToken', () => {
    it('should return success with username on valid token', async () => {
      const mockResponse = {
        status: 200,
        json: async () => ({
          data: {
            name: 'Test User',
            email: 'test@example.com',
          },
        }),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await validateAsanaToken('1/valid_token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(true);
        expect(result.data.username).toBe('Test User');
        expect(result.data.error).toBeUndefined();
      }

      expect(global.fetch).toHaveBeenCalledWith(
        'https://app.asana.com/api/1.0/users/me',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer 1/valid_token',
          }),
        })
      );
    });

    it('should fallback to email if name not available', async () => {
      const mockResponse = {
        status: 200,
        json: async () => ({
          data: {
            email: 'test@example.com',
          },
        }),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await validateAsanaToken('1/valid_token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(true);
        expect(result.data.username).toBe('test@example.com');
      }
    });

    it('should return validation failure on 401 unauthorized', async () => {
      const mockResponse = {
        status: 401,
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await validateAsanaToken('1/invalid_token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(false);
        expect(result.data.error).toBe('Invalid Asana token');
      }
    });

    it('should return validation failure on 403 forbidden', async () => {
      const mockResponse = {
        status: 403,
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await validateAsanaToken('1/no_perms');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(false);
        expect(result.data.error).toBe('Asana token lacks required permissions');
      }
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await validateAsanaToken('1/token');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Network error');
      }
    });

    it('should handle timeout', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      global.fetch = vi.fn().mockRejectedValue(abortError);

      const result = await validateAsanaToken('1/token');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('timed out');
      }
    });
  });
});

describe('Combined Validator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateToken', () => {
    it('should perform online validation when not skipped', async () => {
      const mockResponse = {
        status: 200,
        json: async () => ({ login: 'testuser' }),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await validateToken('github', 'ghp_valid_token', false);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(true);
        expect(result.data.username).toBe('testuser');
      }

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should skip online validation when requested', async () => {
      global.fetch = vi.fn();

      const result = await validateToken('github', 'ghp_valid_token', true);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(true);
        expect(result.data.error).toBeUndefined();
      }

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fallback to format validation on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await validateToken('github', 'ghp_valid_format');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(true);
      }
    });

    it('should fail format validation on network error with invalid format', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await validateToken('github', 'invalid_token');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(false);
        expect(result.data.error).toContain('Unable to verify token');
      }
    });

    it('should work with asana tokens', async () => {
      const mockResponse = {
        status: 200,
        json: async () => ({
          data: {
            name: 'Test User',
          },
        }),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await validateToken('asana', '1/valid_token', false);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(true);
        expect(result.data.username).toBe('Test User');
      }
    });

    it('should fallback to format validation for asana on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await validateToken('asana', '1/valid_format');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.valid).toBe(true);
      }
    });
  });
});
