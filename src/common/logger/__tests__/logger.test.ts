/**
 * @module common/logger/__tests__/logger.test
 * @description Unit tests for the logger module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createLogger,
  createTestLogger,
  createScopedLogger,
  createChildLogger,
  getNoopLogger,
  MemoryLogger,
  initLogger,
  getLogger,
  resetLogger,
  setLogger,
  getChildLogger,
  log,
  createTimer,
  withTiming,
  withTimingSync,
  createPrefixedLogger,
  createRateLimitedLogger,
  isLevelEnabled,
  parseLevel,
  errorToContext,
  mergeContexts,
  safeStringify,
  truncate,
  redactUrl,
} from '../index.js';

describe('MemoryLogger', () => {
  let logger: MemoryLogger;

  beforeEach(() => {
    logger = createTestLogger();
  });

  describe('basic logging', () => {
    it('should log messages at all levels', () => {
      logger.trace('trace message');
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');
      logger.fatal('fatal message');

      expect(logger.getEntryCount()).toBe(6);
      expect(logger.getEntriesByLevel('trace')).toHaveLength(1);
      expect(logger.getEntriesByLevel('debug')).toHaveLength(1);
      expect(logger.getEntriesByLevel('info')).toHaveLength(1);
      expect(logger.getEntriesByLevel('warn')).toHaveLength(1);
      expect(logger.getEntriesByLevel('error')).toHaveLength(1);
      expect(logger.getEntriesByLevel('fatal')).toHaveLength(1);
    });

    it('should include context in log entries', () => {
      logger.info('test message', { key: 'value', count: 42 });

      const entry = logger.getLastEntry();
      expect(entry).toBeDefined();
      expect(entry?.message).toBe('test message');
      expect(entry?.context).toEqual({ key: 'value', count: 42 });
    });

    it('should include timestamps', () => {
      const before = new Date();
      logger.info('test');
      const after = new Date();

      const entry = logger.getLastEntry();
      expect(entry?.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entry?.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('filtering', () => {
    it('should filter entries by level', () => {
      logger.info('info 1');
      logger.error('error 1');
      logger.info('info 2');
      logger.error('error 2');

      expect(logger.getEntriesByLevel('info')).toHaveLength(2);
      expect(logger.getEntriesByLevel('error')).toHaveLength(2);
    });

    it('should filter entries by message string', () => {
      logger.info('user logged in');
      logger.info('user logged out');
      logger.info('system started');

      expect(logger.getEntriesByMessage('user')).toHaveLength(2);
      expect(logger.getEntriesByMessage('system')).toHaveLength(1);
    });

    it('should filter entries by message regex', () => {
      logger.info('request completed in 100ms');
      logger.info('request completed in 200ms');
      logger.error('request failed');

      expect(logger.getEntriesByMessage(/completed in \d+ms/)).toHaveLength(2);
    });

    it('should filter entries by context key', () => {
      logger.info('event 1', { userId: '123' });
      logger.info('event 2', { userId: '456' });
      logger.info('event 3', { orderId: '789' });

      expect(logger.getEntriesByContext('userId')).toHaveLength(2);
      expect(logger.getEntriesByContext('orderId')).toHaveLength(1);
    });

    it('should filter entries by context key and value', () => {
      logger.info('event 1', { status: 'success' });
      logger.info('event 2', { status: 'failure' });
      logger.info('event 3', { status: 'success' });

      expect(logger.getEntriesByContext('status', 'success')).toHaveLength(2);
      expect(logger.getEntriesByContext('status', 'failure')).toHaveLength(1);
    });
  });

  describe('assertions', () => {
    it('should pass hasEntry for matching criteria', () => {
      logger.info('test message', { key: 'value' });

      expect(logger.hasEntry({ message: 'test' })).toBe(true);
      expect(logger.hasEntry({ level: 'info' })).toBe(true);
      expect(logger.hasEntry({ context: { key: 'value' } })).toBe(true);
      expect(logger.hasEntry({ level: 'info', message: 'test' })).toBe(true);
    });

    it('should fail hasEntry for non-matching criteria', () => {
      logger.info('test message');

      expect(logger.hasEntry({ message: 'other' })).toBe(false);
      expect(logger.hasEntry({ level: 'error' })).toBe(false);
    });

    it('should assertLogged pass for matching entry', () => {
      logger.error('something went wrong', { code: 500 });

      expect(() => logger.assertLogged({ level: 'error', message: 'wrong' })).not.toThrow();
    });

    it('should assertLogged throw for non-matching entry', () => {
      logger.info('normal message');

      expect(() => logger.assertLogged({ level: 'error' })).toThrow('Expected log entry not found');
    });

    it('should assertNotLogged pass for non-matching entry', () => {
      logger.info('normal message');

      expect(() => logger.assertNotLogged({ level: 'error' })).not.toThrow();
    });

    it('should assertNotLogged throw for matching entry', () => {
      logger.error('bad thing happened');

      expect(() => logger.assertNotLogged({ level: 'error' })).toThrow('Unexpected log entry found');
    });

    it('should assertEntryCount validate count', () => {
      logger.info('one');
      logger.info('two');
      logger.info('three');

      expect(() => logger.assertEntryCount(3)).not.toThrow();
      expect(() => logger.assertEntryCount(2)).toThrow('Expected 2 log entries, got 3');
    });
  });

  describe('child logger', () => {
    it('should create child with bound context', () => {
      const child = logger.child({ requestId: '123' });
      child.info('child message', { extra: 'data' });

      const entry = logger.getLastEntry();
      expect(entry?.context).toEqual({ requestId: '123', extra: 'data' });
    });

    it('should allow nested children', () => {
      const child1 = logger.child({ level1: 'a' });
      const child2 = child1.child({ level2: 'b' });
      child2.info('deep message');

      const entry = logger.getLastEntry();
      expect(entry?.context).toEqual({ level1: 'a', level2: 'b' });
    });
  });

  describe('level filtering', () => {
    it('should respect configured level', () => {
      const warnLogger = createTestLogger({ level: 'warn' });

      warnLogger.trace('trace');
      warnLogger.debug('debug');
      warnLogger.info('info');
      warnLogger.warn('warn');
      warnLogger.error('error');

      expect(warnLogger.getEntryCount()).toBe(2);
      expect(warnLogger.getEntriesByLevel('warn')).toHaveLength(1);
      expect(warnLogger.getEntriesByLevel('error')).toHaveLength(1);
    });
  });

  describe('clear and utilities', () => {
    it('should clear all entries', () => {
      logger.info('one');
      logger.info('two');
      expect(logger.getEntryCount()).toBe(2);

      logger.clear();
      expect(logger.getEntryCount()).toBe(0);
    });

    it('should get last N entries', () => {
      logger.info('one');
      logger.info('two');
      logger.info('three');
      logger.info('four');

      const last2 = logger.getLastEntries(2);
      expect(last2).toHaveLength(2);
      expect(last2[0]?.message).toBe('three');
      expect(last2[1]?.message).toBe('four');
    });

    it('should format to string', () => {
      logger.info('test message', { key: 'value' });
      const str = logger.toString();

      expect(str).toContain('[INFO]');
      expect(str).toContain('test message');
      expect(str).toContain('"key":"value"');
    });
  });
});

describe('createLogger', () => {
  it('should create memory logger with type option', () => {
    const logger = createLogger({ type: 'memory' });
    expect(logger).toBeInstanceOf(MemoryLogger);
  });

  it('should create noop logger with type option', () => {
    const logger = getNoopLogger();

    // Should not throw
    logger.trace('test');
    logger.debug('test');
    logger.info('test');
    logger.warn('test');
    logger.error('test');
    logger.fatal('test');
    logger.flush();

    const child = logger.child({ key: 'value' });
    expect(child).toBe(logger);
  });
});

describe('createScopedLogger', () => {
  it('should create logger with scope binding', () => {
    const logger = createScopedLogger('MyModule', { type: 'memory' }) as MemoryLogger;
    logger.info('test message');

    const entry = logger.getLastEntry();
    expect(entry?.context).toEqual({ scope: 'MyModule' });
  });
});

describe('createChildLogger', () => {
  it('should create child with additional bindings', () => {
    const parent = createTestLogger();
    const child = createChildLogger(parent, { component: 'auth' }) as MemoryLogger;
    child.info('test');

    const entries = parent.getEntries();
    expect(entries[0]?.context).toEqual({ component: 'auth' });
  });
});

describe('Global logger', () => {
  beforeEach(() => {
    resetLogger();
  });

  afterEach(() => {
    resetLogger();
  });

  it('should initialize global logger', () => {
    const logger = initLogger({ type: 'memory' });
    expect(logger).toBeInstanceOf(MemoryLogger);
    expect(getLogger()).toBe(logger);
  });

  it('should return same instance on subsequent getLogger calls', () => {
    const logger1 = getLogger();
    const logger2 = getLogger();
    expect(logger1).toBe(logger2);
  });

  it('should allow setting logger directly', () => {
    const mockLogger = createTestLogger();
    setLogger(mockLogger);

    expect(getLogger()).toBe(mockLogger);
  });

  it('should create child from global logger', () => {
    setLogger(createTestLogger());
    const child = getChildLogger({ requestId: '123' });

    child.info('test');
    const parent = getLogger() as MemoryLogger;
    expect(parent.hasEntry({ context: { requestId: '123' } })).toBe(true);
  });

  it('should provide convenience log functions', () => {
    const memoryLogger = createTestLogger();
    setLogger(memoryLogger);

    log.trace('trace');
    log.debug('debug');
    log.info('info');
    log.warn('warn');
    log.error('error');
    log.fatal('fatal');

    expect(memoryLogger.getEntryCount()).toBe(6);
  });
});

describe('Timer utilities', () => {
  it('should measure elapsed time', async () => {
    const timer = createTimer();
    await new Promise(resolve => setTimeout(resolve, 10));
    const elapsed = timer.elapsed();

    expect(elapsed).toBeGreaterThan(5);
    expect(elapsed).toBeLessThan(100);
  });

  it('should format elapsed time as string', () => {
    const timer = createTimer();
    const ms = timer.elapsedMs();

    expect(ms).toMatch(/^\d+\.\d{2}ms$/);
  });
});

describe('withTiming', () => {
  it('should log timing for successful async operations', async () => {
    const logger = createTestLogger();
    const result = await withTiming(logger, 'test operation', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'result';
    });

    expect(result).toBe('result');
    expect(logger.hasEntry({ level: 'debug', message: 'test operation starting' })).toBe(true);
    expect(logger.hasEntry({ level: 'info', message: /completed/ })).toBe(true);
  });

  it('should log timing for failed async operations', async () => {
    const logger = createTestLogger();
    const error = new Error('test error');

    await expect(
      withTiming(logger, 'failing operation', async () => {
        throw error;
      })
    ).rejects.toThrow('test error');

    expect(logger.hasEntry({ level: 'error', message: /failed/ })).toBe(true);
  });
});

describe('withTimingSync', () => {
  it('should log timing for successful sync operations', () => {
    const logger = createTestLogger();
    const result = withTimingSync(logger, 'sync operation', () => 42);

    expect(result).toBe(42);
    expect(logger.hasEntry({ level: 'info', message: /completed/ })).toBe(true);
  });

  it('should log timing for failed sync operations', () => {
    const logger = createTestLogger();

    expect(() =>
      withTimingSync(logger, 'sync operation', () => {
        throw new Error('sync error');
      })
    ).toThrow('sync error');

    expect(logger.hasEntry({ level: 'error', message: /failed/ })).toBe(true);
  });
});

describe('createPrefixedLogger', () => {
  it('should prefix all messages', () => {
    const base = createTestLogger();
    const prefixed = createPrefixedLogger(base, '[Auth]');

    prefixed.info('user logged in');

    const entry = base.getLastEntry();
    expect(entry?.message).toBe('[Auth] user logged in');
  });
});

describe('createRateLimitedLogger', () => {
  it('should rate limit logs', () => {
    const base = createTestLogger();
    const limited = createRateLimitedLogger(base, { maxLogs: 2, windowMs: 1000 });

    limited.info('one');
    limited.info('two');
    limited.info('three'); // Should be dropped
    limited.info('four'); // Should be dropped

    expect(base.getEntriesByLevel('info')).toHaveLength(2);
  });

  it('should always allow error and fatal logs', () => {
    const base = createTestLogger();
    const limited = createRateLimitedLogger(base, { maxLogs: 1, windowMs: 1000 });

    limited.info('info 1');
    limited.info('info 2'); // Dropped
    limited.error('error 1');
    limited.error('error 2');
    limited.fatal('fatal 1');

    expect(base.getEntriesByLevel('info')).toHaveLength(1);
    expect(base.getEntriesByLevel('error')).toHaveLength(2);
    expect(base.getEntriesByLevel('fatal')).toHaveLength(1);
  });
});

describe('isLevelEnabled', () => {
  it('should return true for enabled levels', () => {
    expect(isLevelEnabled('info', 'info')).toBe(true);
    expect(isLevelEnabled('info', 'warn')).toBe(true);
    expect(isLevelEnabled('info', 'error')).toBe(true);
    expect(isLevelEnabled('debug', 'info')).toBe(true);
  });

  it('should return false for disabled levels', () => {
    expect(isLevelEnabled('warn', 'info')).toBe(false);
    expect(isLevelEnabled('error', 'warn')).toBe(false);
    expect(isLevelEnabled('info', 'debug')).toBe(false);
  });
});

describe('parseLevel', () => {
  it('should parse valid levels', () => {
    expect(parseLevel('trace')).toBe('trace');
    expect(parseLevel('DEBUG')).toBe('debug');
    expect(parseLevel('Info')).toBe('info');
  });

  it('should return undefined for invalid levels', () => {
    expect(parseLevel('invalid')).toBeUndefined();
    expect(parseLevel('')).toBeUndefined();
  });
});

describe('errorToContext', () => {
  it('should convert Error to context', () => {
    const error = new Error('test error');
    const ctx = errorToContext(error);

    expect(ctx['error']).toHaveProperty('name', 'Error');
    expect(ctx['error']).toHaveProperty('message', 'test error');
    expect(ctx['error']).toHaveProperty('stack');
  });

  it('should include error code if present', () => {
    const error = new Error('test') as Error & { code: string };
    error.code = 'ENOENT';
    const ctx = errorToContext(error);

    expect((ctx['error'] as Record<string, unknown>)['code']).toBe('ENOENT');
  });

  it('should handle string errors', () => {
    const ctx = errorToContext('string error');
    expect(ctx['error']).toEqual({ message: 'string error' });
  });
});

describe('mergeContexts', () => {
  it('should merge multiple contexts', () => {
    const result = mergeContexts(
      { a: 1 },
      { b: 2 },
      { c: 3 }
    );

    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('should handle undefined contexts', () => {
    const result = mergeContexts({ a: 1 }, undefined, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('should override with later values', () => {
    const result = mergeContexts({ a: 1 }, { a: 2 });
    expect(result).toEqual({ a: 2 });
  });
});

describe('safeStringify', () => {
  it('should stringify simple objects', () => {
    const result = safeStringify({ key: 'value' });
    expect(result).toBe('{"key":"value"}');
  });

  it('should handle BigInt', () => {
    const result = safeStringify({ big: BigInt(123) });
    expect(result).toBe('{"big":"123"}');
  });

  it('should handle functions', () => {
    const result = safeStringify({ fn: function test() {} });
    expect(result).toBe('{"fn":"[Function: test]"}');
  });

  it('should truncate long strings', () => {
    const longObj = { data: 'x'.repeat(2000) };
    const result = safeStringify(longObj, 100);

    expect(result.length).toBeLessThanOrEqual(120); // 100 + "... [truncated]"
    expect(result).toContain('[truncated]');
  });
});

describe('truncate', () => {
  it('should return short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('should truncate long strings', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });
});

describe('redactUrl', () => {
  it('should redact username and password', () => {
    const result = redactUrl('https://user:pass@example.com/path');
    expect(result).toBe('https://***:***@example.com/path');
  });

  it('should redact query string', () => {
    const result = redactUrl('https://example.com/path?token=secret');
    expect(result).toBe('https://example.com/path?[REDACTED]');
  });

  it('should handle invalid URLs', () => {
    const result = redactUrl('not-a-url');
    expect(result).toBe('not-a-url');
  });
});
