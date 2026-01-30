/**
 * @module common/logger/memory-logger
 * @description In-memory logger for testing
 */

import type { Logger, LogContext, LogEntry, LogLevel, LoggerOptions } from './types.js';
import { LOG_LEVELS } from './types.js';
import { maskContext } from './masking.js';

/**
 * In-memory logger that stores log entries for testing assertions
 */
export class MemoryLogger implements Logger {
  private entries: LogEntry[];
  private readonly level: LogLevel;
  private readonly bindings: LogContext;
  private readonly redact: boolean;

  constructor(options?: LoggerOptions & { bindings?: LogContext; sharedEntries?: LogEntry[] }) {
    this.level = options?.level ?? 'trace';
    this.bindings = options?.bindings ?? {};
    this.redact = options?.redact ?? false;
    // Allow sharing entries array with parent logger
    this.entries = options?.sharedEntries ?? [];
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private log(level: LogLevel, msg: string, ctx?: LogContext): void {
    if (!this.shouldLog(level)) return;

    let context = { ...this.bindings, ...ctx };
    if (this.redact) {
      context = maskContext(context);
    }

    const entry: LogEntry = {
      level,
      message: msg,
      context,
      timestamp: new Date(),
    };

    this.entries.push(entry);
  }

  trace(msg: string, ctx?: LogContext): void {
    this.log('trace', msg, ctx);
  }

  debug(msg: string, ctx?: LogContext): void {
    this.log('debug', msg, ctx);
  }

  info(msg: string, ctx?: LogContext): void {
    this.log('info', msg, ctx);
  }

  warn(msg: string, ctx?: LogContext): void {
    this.log('warn', msg, ctx);
  }

  error(msg: string, ctx?: LogContext): void {
    this.log('error', msg, ctx);
  }

  fatal(msg: string, ctx?: LogContext): void {
    this.log('fatal', msg, ctx);
  }

  child(bindings: LogContext): Logger {
    return new MemoryLogger({
      level: this.level,
      bindings: { ...this.bindings, ...bindings },
      redact: this.redact,
      sharedEntries: this.entries, // Share entries with child
    });
  }

  flush(): void {
    // No-op for memory logger
  }

  // ============ Testing utilities ============

  /**
   * Get all log entries
   */
  getEntries(): readonly LogEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries filtered by level
   */
  getEntriesByLevel(level: LogLevel): readonly LogEntry[] {
    return this.entries.filter(e => e.level === level);
  }

  /**
   * Get entries filtered by message pattern
   */
  getEntriesByMessage(pattern: string | RegExp): readonly LogEntry[] {
    return this.entries.filter(e => {
      if (typeof pattern === 'string') {
        return e.message.includes(pattern);
      }
      return pattern.test(e.message);
    });
  }

  /**
   * Get entries that contain specific context keys
   */
  getEntriesByContext(key: string, value?: unknown): readonly LogEntry[] {
    return this.entries.filter(e => {
      if (!(key in e.context)) return false;
      if (value !== undefined) {
        return e.context[key] === value;
      }
      return true;
    });
  }

  /**
   * Check if any entry matches the criteria
   */
  hasEntry(criteria: Partial<{ level: LogLevel; message: string | RegExp; context: LogContext }>): boolean {
    return this.entries.some(e => {
      if (criteria.level && e.level !== criteria.level) return false;
      if (criteria.message) {
        if (typeof criteria.message === 'string') {
          if (!e.message.includes(criteria.message)) return false;
        } else if (!criteria.message.test(e.message)) {
          return false;
        }
      }
      if (criteria.context) {
        for (const [key, value] of Object.entries(criteria.context)) {
          if (e.context[key] !== value) return false;
        }
      }
      return true;
    });
  }

  /**
   * Get the last entry
   */
  getLastEntry(): LogEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  /**
   * Get the last N entries
   */
  getLastEntries(n: number): readonly LogEntry[] {
    return this.entries.slice(-n);
  }

  /**
   * Get entry count
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Assert that a specific log was made (throws if not found)
   */
  assertLogged(criteria: Partial<{ level: LogLevel; message: string | RegExp; context: LogContext }>): void {
    if (!this.hasEntry(criteria)) {
      const criteriaStr = JSON.stringify(criteria, null, 2);
      const entriesStr = JSON.stringify(this.entries, null, 2);
      throw new Error(`Expected log entry not found.\nCriteria: ${criteriaStr}\nEntries: ${entriesStr}`);
    }
  }

  /**
   * Assert that no logs were made matching criteria
   */
  assertNotLogged(criteria: Partial<{ level: LogLevel; message: string | RegExp; context: LogContext }>): void {
    if (this.hasEntry(criteria)) {
      const criteriaStr = JSON.stringify(criteria, null, 2);
      throw new Error(`Unexpected log entry found.\nCriteria: ${criteriaStr}`);
    }
  }

  /**
   * Assert entry count
   */
  assertEntryCount(expected: number): void {
    if (this.entries.length !== expected) {
      throw new Error(`Expected ${expected} log entries, got ${this.entries.length}`);
    }
  }

  /**
   * Format entries for debugging
   */
  toString(): string {
    return this.entries
      .map(e => `[${e.level.toUpperCase()}] ${e.message} ${JSON.stringify(e.context)}`)
      .join('\n');
  }
}

/**
 * Create an in-memory logger for testing
 */
export function createMemoryLogger(options?: LoggerOptions): MemoryLogger {
  return new MemoryLogger(options);
}
