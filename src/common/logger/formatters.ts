/**
 * @module common/logger/formatters
 * @description Conditional formatting for pino (pino-pretty in development)
 */

import type { LogLevel } from './types.js';

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
} as const;

/**
 * Log level colors
 */
const LEVEL_COLORS: Record<LogLevel, string> = {
  trace: COLORS.gray,
  debug: COLORS.blue,
  info: COLORS.green,
  warn: COLORS.yellow,
  error: COLORS.red,
  fatal: `${COLORS.bright}${COLORS.red}`,
} as const;

/**
 * Log level labels (fixed width for alignment)
 */
const LEVEL_LABELS: Record<LogLevel, string> = {
  trace: 'TRACE',
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
  fatal: 'FATAL',
} as const;

/**
 * Pino-pretty transport options
 */
export interface PrettyOptions {
  /** Colorize output */
  colorize?: boolean;
  /** Translate timestamps to human-readable format */
  translateTime?: string;
  /** Ignore specific keys in output */
  ignore?: string;
  /** Message key name */
  messageKey?: string;
  /** Single line output */
  singleLine?: boolean;
  /** Custom message format */
  messageFormat?: string | boolean;
  /** Level key name */
  levelKey?: string;
  /** Use level labels instead of numbers */
  levelLabel?: string;
  /** Sync flush */
  sync?: boolean;
}

/**
 * Default pino-pretty options for development
 */
export const DEFAULT_PRETTY_OPTIONS: PrettyOptions = {
  colorize: true,
  translateTime: 'SYS:HH:MM:ss.l',
  ignore: 'pid,hostname',
  messageKey: 'msg',
  singleLine: false,
  levelLabel: 'level',
  sync: false,
} as const;

/**
 * Minimal pretty options (for CI/testing)
 */
export const MINIMAL_PRETTY_OPTIONS: PrettyOptions = {
  colorize: false,
  translateTime: 'SYS:HH:MM:ss',
  ignore: 'pid,hostname,time',
  singleLine: true,
  sync: true,
} as const;

/**
 * Get pino transport configuration for pretty printing
 */
export function getPrettyTransport(options: PrettyOptions = DEFAULT_PRETTY_OPTIONS): {
  target: string;
  options: PrettyOptions;
} {
  return {
    target: 'pino-pretty',
    options: {
      ...DEFAULT_PRETTY_OPTIONS,
      ...options,
    },
  };
}

/**
 * Format a log level with color for terminal output
 */
export function formatLevel(level: LogLevel, colorize = true): string {
  const label = LEVEL_LABELS[level];
  if (!colorize) return label;
  return `${LEVEL_COLORS[level]}${label}${COLORS.reset}`;
}

/**
 * Format a timestamp for human-readable output
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Format a log message for terminal output
 */
export function formatMessage(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  colorize = true
): string {
  const timestamp = formatTimestamp();
  const levelStr = formatLevel(level, colorize);

  let output = `${COLORS.gray}${timestamp}${COLORS.reset} ${levelStr} ${message}`;

  if (context && Object.keys(context).length > 0) {
    const contextStr = JSON.stringify(context, null, 2);
    if (colorize) {
      output += ` ${COLORS.dim}${contextStr}${COLORS.reset}`;
    } else {
      output += ` ${contextStr}`;
    }
  }

  return output;
}

/**
 * Get pino formatters configuration
 */
export function getPinoFormatters(): {
  level: (label: string, number: number) => { level: string };
  bindings: (bindings: Record<string, unknown>) => Record<string, unknown>;
  log: (object: Record<string, unknown>) => Record<string, unknown>;
} {
  return {
    level(label: string) {
      return { level: label };
    },
    bindings(bindings: Record<string, unknown>) {
      // Remove default pino bindings we don't want
      const { pid, hostname, ...rest } = bindings;
      void pid;
      void hostname;
      return rest;
    },
    log(object: Record<string, unknown>) {
      // Pass through, serializers handle the rest
      return object;
    },
  };
}

/**
 * Determine if pretty printing should be enabled
 */
export function shouldUsePretty(): boolean {
  // Explicit environment variable
  if (process.env['LOG_PRETTY'] === 'true') return true;
  if (process.env['LOG_PRETTY'] === 'false') return false;

  // Check if output is a TTY (interactive terminal)
  if (process.stdout.isTTY) return true;

  // Default based on NODE_ENV
  return process.env['NODE_ENV'] !== 'production';
}

/**
 * Check if colors should be used
 */
export function shouldUseColors(): boolean {
  // Respect NO_COLOR environment variable (https://no-color.org/)
  if (process.env['NO_COLOR'] !== undefined) return false;

  // Respect FORCE_COLOR environment variable
  if (process.env['FORCE_COLOR'] === '1') return true;
  if (process.env['FORCE_COLOR'] === '0') return false;

  // Check if output is a TTY
  return process.stdout.isTTY === true;
}
