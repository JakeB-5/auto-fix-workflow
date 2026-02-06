/**
 * @module common/logger/config
 * @description Logger configuration management
 */

import type { LogLevel, LoggerOptions, MaskingConfig } from './types.js';

/**
 * Default log level based on NODE_ENV
 */
function getDefaultLevel(): LogLevel {
  const env = process.env['NODE_ENV'];
  if (env === 'production') return 'info';
  if (env === 'test') return 'error';
  return 'debug';
}

/**
 * Default paths to redact from logs
 */
const DEFAULT_REDACT_PATHS: readonly string[] = [
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
] as const;

/**
 * Default masking configuration
 */
export const DEFAULT_MASKING_CONFIG: MaskingConfig = {
  paths: DEFAULT_REDACT_PATHS,
  censor: '[REDACTED]',
  remove: false,
} as const;

/**
 * Default logger options
 */
export const DEFAULT_LOGGER_OPTIONS: Required<Omit<LoggerOptions, 'destination' | 'base'>> = {
  level: getDefaultLevel(),
  name: 'auto-fix-workflow',
  pretty: process.env['NODE_ENV'] !== 'production',
  redact: true,
  redactPaths: DEFAULT_REDACT_PATHS,
} as const;

/**
 * Environment-based configuration
 */
export interface LoggerEnvConfig {
  readonly level: LogLevel;
  readonly pretty: boolean;
  readonly redact: boolean;
}

/**
 * Get logger configuration from environment variables
 */
export function getEnvConfig(): LoggerEnvConfig {
  const levelEnv = process.env['LOG_LEVEL']?.toLowerCase();
  const validLevels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

  const level: LogLevel = validLevels.includes(levelEnv as LogLevel)
    ? (levelEnv as LogLevel)
    : getDefaultLevel();

  const pretty = process.env['LOG_PRETTY'] === 'true' ||
    (process.env['LOG_PRETTY'] !== 'false' && process.env['NODE_ENV'] !== 'production');

  const redact = process.env['LOG_REDACT'] !== 'false';

  return { level, pretty, redact };
}

/**
 * Merge user options with defaults and environment config
 */
export function resolveLoggerOptions(options?: LoggerOptions): Required<Omit<LoggerOptions, 'destination' | 'base'>> & { destination: LoggerOptions['destination']; base: LoggerOptions['base'] } {
  const envConfig = getEnvConfig();

  const result: Required<Omit<LoggerOptions, 'destination' | 'base'>> & { destination: LoggerOptions['destination']; base: LoggerOptions['base'] } = {
    level: options?.level ?? envConfig.level,
    name: options?.name ?? DEFAULT_LOGGER_OPTIONS.name,
    pretty: options?.pretty ?? envConfig.pretty,
    redact: options?.redact ?? envConfig.redact,
    redactPaths: options?.redactPaths ?? DEFAULT_LOGGER_OPTIONS.redactPaths,
    destination: undefined,
    base: undefined,
  };

  if (options?.destination !== undefined) {
    result.destination = options.destination;
  }

  if (options?.base !== undefined) {
    result.base = options.base;
  }

  return result;
}

/**
 * Validate log level string
 */
export function isValidLogLevel(level: string): level is LogLevel {
  return ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level);
}

/**
 * Parse log level from string with fallback
 */
export function parseLogLevel(level: string | undefined, fallback: LogLevel = 'info'): LogLevel {
  if (!level) return fallback;
  const normalized = level.toLowerCase();
  return isValidLogLevel(normalized) ? normalized : fallback;
}
