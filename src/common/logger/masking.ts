/**
 * @module common/logger/masking
 * @description Sensitive information masking for logs
 */

import type { LogContext, MaskingConfig } from './types.js';

/**
 * Default masking configuration (duplicated here to avoid circular dependency)
 */
const DEFAULT_MASKING_CONFIG_LOCAL: MaskingConfig = {
  paths: [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'authorization',
    'auth',
    'credentials',
    'privateKey',
    'private_key',
    'dsn',
    'connectionString',
    'connection_string',
    '*.password',
    '*.token',
    '*.secret',
    '*.apiKey',
    '*.api_key',
    'headers.authorization',
    'headers.cookie',
    'config.github.token',
    'config.asana.token',
    'config.sentry.dsn',
    'config.sentry.webhookSecret',
  ],
  censor: '[REDACTED]',
  remove: false,
} as const;

/**
 * Regular expressions for detecting sensitive patterns in string values
 */
const SENSITIVE_PATTERNS: readonly RegExp[] = [
  // API keys (various formats)
  /\b[a-zA-Z0-9_-]{20,}\b/,
  // JWT tokens
  /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
  // Bearer tokens
  /Bearer\s+[a-zA-Z0-9_-]+/i,
  // Basic auth
  /Basic\s+[a-zA-Z0-9+/=]+/i,
  // GitHub tokens
  /gh[pousr]_[a-zA-Z0-9]{36,}/,
  // npm tokens
  /npm_[a-zA-Z0-9]{36}/,
  // AWS keys
  /AKIA[0-9A-Z]{16}/,
  // Private keys
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
  // Connection strings with passwords
  /(?:mongodb|postgres|mysql|redis):\/\/[^:]+:[^@]+@/i,
] as const;

/**
 * Keys that should always be masked regardless of path matching
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
  'refreshtoken',
  'refresh_token',
  'refreshToken',
  'authorization',
  'auth',
  'credentials',
  'credential',
  'privatekey',
  'private_key',
  'privateKey',
  'dsn',
  'connectionstring',
  'connection_string',
  'connectionString',
  'bearer',
  'jwt',
  'session',
  'cookie',
]);

/**
 * Check if a key name indicates sensitive data
 */
function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.has(normalized) ||
    normalized.includes('password') ||
    normalized.includes('secret') ||
    normalized.includes('token') ||
    normalized.includes('key') && (normalized.includes('api') || normalized.includes('private'));
}

/**
 * Check if a string value contains sensitive patterns
 */
function containsSensitivePattern(value: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * Mask a sensitive string value
 */
function maskString(value: string, censor: string): string {
  // For short values, just replace entirely
  if (value.length <= 8) return censor;

  // For longer values, show first 2 and last 2 chars
  return `${value.slice(0, 2)}${'*'.repeat(Math.min(value.length - 4, 10))}${value.slice(-2)}`;
}

/**
 * Deep clone and mask sensitive data in an object
 */
export function maskSensitiveData(
  data: unknown,
  config: MaskingConfig = DEFAULT_MASKING_CONFIG_LOCAL,
  currentPath = ''
): unknown {
  const { censor = '[REDACTED]', remove = false } = config;

  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }

  // Handle primitive types
  if (typeof data === 'string') {
    if (containsSensitivePattern(data)) {
      return remove ? undefined : maskString(data, censor);
    }
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item, index) =>
      maskSensitiveData(item, config, `${currentPath}[${index}]`)
    );
  }

  // Handle objects
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const fullPath = currentPath ? `${currentPath}.${key}` : key;

    // Check if this key should be masked
    if (isSensitiveKey(key) || shouldMaskPath(fullPath, config.paths)) {
      if (remove) {
        continue; // Skip this key entirely
      }
      if (typeof value === 'string') {
        result[key] = maskString(value, censor);
      } else if (value !== null && value !== undefined) {
        result[key] = censor;
      } else {
        result[key] = value;
      }
    } else {
      result[key] = maskSensitiveData(value, config, fullPath);
    }
  }

  return result;
}

/**
 * Check if a path matches any of the configured redaction paths
 */
function shouldMaskPath(path: string, paths: readonly string[]): boolean {
  const normalizedPath = path.toLowerCase();

  return paths.some(pattern => {
    const normalizedPattern = pattern.toLowerCase();

    // Exact match
    if (normalizedPath === normalizedPattern) return true;

    // Ends with pattern (e.g., "*.password" matches "user.password")
    if (normalizedPattern.startsWith('*.')) {
      const suffix = normalizedPattern.slice(2);
      return normalizedPath.endsWith(`.${suffix}`) || normalizedPath === suffix;
    }

    // Path starts with pattern (e.g., "config.github" matches "config.github.token")
    if (normalizedPath.startsWith(`${normalizedPattern}.`)) return true;

    return false;
  });
}

/**
 * Create a masking function for use with pino redact
 */
export function createMaskingFunction(censor = '[REDACTED]'): (value: unknown) => unknown {
  return (value: unknown) => {
    if (typeof value === 'string') {
      return maskString(value, censor);
    }
    return censor;
  };
}

/**
 * Get pino-compatible redact configuration
 */
export function getPinoRedactConfig(config: MaskingConfig = DEFAULT_MASKING_CONFIG_LOCAL): {
  paths: string[];
  censor: string;
} {
  // Filter out wildcard patterns that pino/fast-redact doesn't support
  // fast-redact only supports explicit paths like "a.b.c" or array wildcards like "a[*].b"
  // It does NOT support "**.password" or "*.password" glob patterns
  const paths = [...config.paths].filter(path => {
    // Skip wildcard patterns - these are handled by our maskSensitiveData function
    return !path.startsWith('*.') && !path.includes('**');
  });

  return {
    paths,
    censor: config.censor ?? '[REDACTED]',
  };
}

/**
 * Mask context object for logging
 */
export function maskContext(context: LogContext, config?: MaskingConfig): LogContext {
  return maskSensitiveData(context, config) as LogContext;
}

/**
 * Create a pre-configured masker
 */
export function createMasker(config: MaskingConfig = DEFAULT_MASKING_CONFIG_LOCAL) {
  return {
    mask: (data: unknown) => maskSensitiveData(data, config),
    maskContext: (context: LogContext) => maskContext(context, config),
    isSensitiveKey,
    containsSensitivePattern,
  };
}
