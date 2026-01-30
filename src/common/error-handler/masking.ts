/**
 * @module common/error-handler/masking
 * @description Sensitive information masking utilities
 */

/**
 * Default patterns for sensitive data detection
 */
const DEFAULT_SENSITIVE_PATTERNS: readonly RegExp[] = [
  // API tokens and keys
  /(?:api[_-]?key|apikey)\s*[:=]\s*["']?([^"'\s,}]+)/gi,
  /(?:access[_-]?token|accesstoken)\s*[:=]\s*["']?([^"'\s,}]+)/gi,
  /(?:auth[_-]?token|authtoken)\s*[:=]\s*["']?([^"'\s,}]+)/gi,
  /(?:bearer)\s+([^\s,}]+)/gi,

  // GitHub tokens (various formats)
  /ghp_[a-zA-Z0-9]+/g,
  /gho_[a-zA-Z0-9]+/g,
  /ghs_[a-zA-Z0-9]+/g,
  /ghr_[a-zA-Z0-9]+/g,
  /github_pat_[a-zA-Z0-9_]+/g,

  // Generic secrets
  /(?:password|passwd|pwd)\s*[:=]\s*["']?([^"'\s,}]+)/gi,
  /(?:secret)\s*[:=]\s*["']?([^"'\s,}]+)/gi,
  /(?:private[_-]?key|privatekey)\s*[:=]\s*["']?([^"'\s,}]+)/gi,

  // Asana tokens
  /[0-9]\/[0-9]{16}:[a-f0-9]{32}/g,

  // Generic long hex strings (potential tokens)
  /\b[a-f0-9]{32,}\b/gi,
];

/**
 * Keys that typically contain sensitive data
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'apiKey',
  'accesstoken',
  'access_token',
  'accessToken',
  'authtoken',
  'auth_token',
  'authToken',
  'privatekey',
  'private_key',
  'privateKey',
  'credentials',
  'authorization',
]);

/**
 * Mask placeholder
 */
const MASK = '***MASKED***';

/**
 * Check if a key name suggests sensitive data
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.has(lowerKey) ||
    lowerKey.includes('password') ||
    lowerKey.includes('secret') ||
    lowerKey.includes('token') ||
    lowerKey.includes('key') ||
    lowerKey.includes('credential');
}

/**
 * Mask sensitive patterns in a string
 */
function maskString(value: string, customPatterns: RegExp[] = []): string {
  let result = value;
  const allPatterns = [...DEFAULT_SENSITIVE_PATTERNS, ...customPatterns];

  for (const pattern of allPatterns) {
    // Reset lastIndex for global patterns
    if (pattern.global) {
      pattern.lastIndex = 0;
    }
    result = result.replace(pattern, (match) => {
      // For patterns with capturing groups, mask only the captured part
      const colonIndex = match.indexOf(':');
      const equalsIndex = match.indexOf('=');
      const separatorIndex = Math.max(colonIndex, equalsIndex);

      if (separatorIndex !== -1) {
        return match.substring(0, separatorIndex + 1) + ' ' + MASK;
      }
      return MASK;
    });
  }

  return result;
}

/**
 * Recursively mask sensitive data in an object
 */
function maskObject(
  obj: Record<string, unknown>,
  customPatterns: RegExp[] = [],
  visited = new WeakSet<object>()
): Record<string, unknown> {
  // Prevent circular reference issues
  if (visited.has(obj)) {
    return { '[Circular Reference]': true };
  }
  visited.add(obj);

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      result[key] = MASK;
    } else {
      result[key] = maskSensitiveDataInternal(value, customPatterns, visited);
    }
  }

  return result;
}

/**
 * Internal implementation of maskSensitiveData with cycle detection
 */
function maskSensitiveDataInternal(
  data: unknown,
  customPatterns: RegExp[] = [],
  visited = new WeakSet<object>()
): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return maskString(data, customPatterns);
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveDataInternal(item, customPatterns, visited));
  }

  if (typeof data === 'object') {
    // Handle Error objects specially
    if (data instanceof Error) {
      return {
        name: data.name,
        message: maskString(data.message, customPatterns),
        stack: data.stack ? maskString(data.stack, customPatterns) : undefined,
      };
    }

    return maskObject(data as Record<string, unknown>, customPatterns, visited);
  }

  // For functions, symbols, etc., return a placeholder
  return `[${typeof data}]`;
}

/**
 * Mask sensitive information in data
 *
 * Automatically masks:
 * - API tokens and keys
 * - Passwords and secrets
 * - GitHub/Asana tokens
 * - Long hex strings that may be tokens
 *
 * @param data - Data to mask (can be any type)
 * @param patterns - Optional additional regex patterns to mask
 * @returns Masked copy of the data
 *
 * @example
 * ```typescript
 * const config = { apiKey: 'secret123', name: 'test' };
 * const masked = maskSensitiveData(config);
 * // { apiKey: '***MASKED***', name: 'test' }
 * ```
 */
export function maskSensitiveData(
  data: unknown,
  patterns?: string[]
): unknown {
  const customPatterns = patterns?.map((p) => new RegExp(p, 'gi')) ?? [];
  return maskSensitiveDataInternal(data, customPatterns, new WeakSet());
}

/**
 * Create a masking function with custom patterns
 *
 * @param patterns - Additional patterns to mask
 * @returns A function that masks data with the configured patterns
 */
export function createMasker(patterns: string[] = []): (data: unknown) => unknown {
  const compiledPatterns = patterns.map((p) => new RegExp(p, 'gi'));
  return (data: unknown) => maskSensitiveDataInternal(data, compiledPatterns, new WeakSet());
}

/**
 * Check if a value appears to be sensitive (for validation purposes)
 */
export function looksLikeSensitiveValue(value: string): boolean {
  for (const pattern of DEFAULT_SENSITIVE_PATTERNS) {
    if (pattern.global) {
      pattern.lastIndex = 0;
    }
    if (pattern.test(value)) {
      return true;
    }
  }
  return false;
}
