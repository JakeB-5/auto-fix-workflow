/**
 * @module common/logger
 * @description Logger module public API
 */

// ============ Types ============
export type {
  LogLevel,
  LogContext,
  LogEntry,
  Logger,
  LoggerOptions,
  MaskingConfig,
  Serializer,
  Serializers,
} from './types.js';

export { LOG_LEVELS } from './types.js';

// ============ Configuration ============
export {
  DEFAULT_MASKING_CONFIG,
  DEFAULT_LOGGER_OPTIONS,
  getEnvConfig,
  resolveLoggerOptions,
  isValidLogLevel,
  parseLogLevel,
} from './config.js';

export type { LoggerEnvConfig } from './config.js';

// ============ Factory ============
export {
  createLogger,
  createTestLogger,
  createChildLogger,
  createScopedLogger,
  getNoopLogger,
} from './factory.js';

export type { LoggerType, FactoryOptions } from './factory.js';

// ============ Global Logger ============
export {
  getLogger,
  initLogger,
  resetLogger,
  setLogger,
  getChildLogger,
  log,
} from './global.js';

// ============ Implementations ============
export { PinoLoggerImpl, createPinoLogger } from './pino-logger.js';
export { MemoryLogger, createMemoryLogger } from './memory-logger.js';

// ============ Masking ============
export {
  maskSensitiveData,
  maskContext,
  createMasker,
  createMaskingFunction,
  getPinoRedactConfig,
} from './masking.js';

// ============ Serializers ============
export {
  errorSerializer,
  requestSerializer,
  responseSerializer,
  githubIssueSerializer,
  worktreeSerializer,
  processSerializer,
  defaultSerializers,
  createSerializers,
} from './serializers.js';

// ============ Formatters ============
export {
  DEFAULT_PRETTY_OPTIONS,
  MINIMAL_PRETTY_OPTIONS,
  getPrettyTransport,
  formatLevel,
  formatTimestamp,
  formatMessage,
  getPinoFormatters,
  shouldUsePretty,
  shouldUseColors,
} from './formatters.js';

export type { PrettyOptions } from './formatters.js';

// ============ Utilities ============
export {
  safeStringify,
  errorToContext,
  mergeContexts,
  createTimer,
  withTiming,
  withTimingSync,
  createPrefixedLogger,
  createRateLimitedLogger,
  isLevelEnabled,
  parseLevel,
  redactUrl,
  truncate,
  httpRequestContext,
} from './utils.js';
