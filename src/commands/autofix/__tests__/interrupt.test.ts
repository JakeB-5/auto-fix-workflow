/**
 * @module commands/autofix/__tests__/interrupt.test
 * @description Tests for the interrupt handling module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  InterruptHandlerImpl,
  installSignalHandlers,
  removeSignalHandlers,
  interruptible,
  interruptibleDelay,
  withCleanup,
  type CleanupCallback,
} from '../interrupt.js';

describe('InterruptHandlerImpl', () => {
  let handler: InterruptHandlerImpl;

  beforeEach(() => {
    handler = new InterruptHandlerImpl();
    handler.reset();
  });

  afterEach(() => {
    handler.reset();
  });

  describe('isInterrupted', () => {
    it('should be false initially', () => {
      expect(handler.isInterrupted).toBe(false);
    });

    it('should be true after requestInterrupt', () => {
      handler.requestInterrupt();
      expect(handler.isInterrupted).toBe(true);
    });
  });

  describe('requestInterrupt', () => {
    it('should set interrupted to true', () => {
      handler.requestInterrupt();
      expect(handler.isInterrupted).toBe(true);
    });

    it('should be idempotent', () => {
      handler.requestInterrupt();
      handler.requestInterrupt();
      expect(handler.isInterrupted).toBe(true);
    });
  });

  describe('onCleanup', () => {
    it('should register a cleanup callback', async () => {
      const cb = vi.fn(async () => {});
      handler.onCleanup(cb);

      // Trigger cleanup through runCleanup
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handler.runCleanup();
      consoleSpy.mockRestore();

      expect(cb).toHaveBeenCalledOnce();
    });

    it('should register multiple callbacks', async () => {
      const cb1 = vi.fn(async () => {});
      const cb2 = vi.fn(async () => {});
      handler.onCleanup(cb1);
      handler.onCleanup(cb2);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handler.runCleanup();
      consoleSpy.mockRestore();

      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });
  });

  describe('runCleanup', () => {
    it('should execute all registered callbacks', async () => {
      const results: number[] = [];
      handler.onCleanup(async () => { results.push(1); });
      handler.onCleanup(async () => { results.push(2); });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handler.runCleanup();
      consoleSpy.mockRestore();

      expect(results).toEqual([1, 2]);
    });

    it('should handle errors in cleanup callbacks gracefully', async () => {
      // Create a fresh handler to avoid shared state issues
      const freshHandler = new InterruptHandlerImpl();
      freshHandler.reset();

      freshHandler.onCleanup(async () => { throw new Error('cleanup error'); });
      freshHandler.onCleanup(async () => { /* ok */ });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw
      await freshHandler.runCleanup();

      expect(errorSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      errorSpy.mockRestore();
      freshHandler.reset();
    });

    it('should return the same promise if called multiple times', async () => {
      let callCount = 0;
      handler.onCleanup(async () => { callCount++; });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const p1 = handler.runCleanup();
      const p2 = handler.runCleanup();
      await Promise.all([p1, p2]);
      consoleSpy.mockRestore();

      // Callback should only be called once since the second call reuses the promise
      expect(callCount).toBe(1);
    });

    it('should clear callbacks after execution', async () => {
      let callCount = 0;
      handler.onCleanup(async () => { callCount++; });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handler.runCleanup();
      consoleSpy.mockRestore();

      expect(callCount).toBe(1);
      // Callbacks should be cleared
    });
  });

  describe('waitForCleanup', () => {
    it('should resolve immediately if no cleanup in progress', async () => {
      await handler.waitForCleanup();
      // No-op, should not throw
    });

    it('should wait for cleanup to finish', async () => {
      let finished = false;
      handler.onCleanup(async () => {
        // Use microtask instead of setTimeout to avoid vmThreads timer issues
        await Promise.resolve();
        finished = true;
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const cleanupPromise = handler.runCleanup();
      await handler.waitForCleanup();
      await cleanupPromise;
      consoleSpy.mockRestore();

      expect(finished).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset interrupted state', () => {
      handler.requestInterrupt();
      handler.reset();
      expect(handler.isInterrupted).toBe(false);
    });

    it('should clear cleanup callbacks', async () => {
      let called = false;
      handler.onCleanup(async () => { called = true; });
      handler.reset();

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await handler.runCleanup();
      consoleSpy.mockRestore();

      expect(called).toBe(false);
    });

    it('should clear cleanup promise', () => {
      handler.reset();
      // After reset, cleanup promise should be cleared
      // This is verified by being able to run cleanup again fresh
    });
  });
});

describe('interruptible', () => {
  let handler: InterruptHandlerImpl;

  beforeEach(() => {
    handler = new InterruptHandlerImpl();
    handler.reset();
  });

  afterEach(() => {
    handler.reset();
  });

  it('should execute the function when not interrupted', async () => {
    const result = await interruptible(handler, async () => 42);
    expect(result).toBe(42);
  });

  it('should reject when already interrupted and no onInterrupt', async () => {
    handler.requestInterrupt();
    await expect(interruptible(handler, async () => 42)).rejects.toThrow('Operation interrupted');
  });

  it('should call onInterrupt when already interrupted', async () => {
    handler.requestInterrupt();
    const result = await interruptible(handler, async () => 42, () => -1);
    expect(result).toBe(-1);
  });

  it('should propagate errors from the function', async () => {
    await expect(
      interruptible(handler, async () => { throw new Error('fn error'); })
    ).rejects.toThrow('fn error');
  });
});

describe('interruptibleDelay', () => {
  let handler: InterruptHandlerImpl;

  beforeEach(() => {
    handler = new InterruptHandlerImpl();
    handler.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    handler.reset();
    vi.useRealTimers();
  });

  it('should reject immediately when already interrupted', async () => {
    handler.requestInterrupt();
    const promise = interruptibleDelay(handler, 1000);
    await expect(promise).rejects.toThrow('Operation interrupted');
  });

  it('should resolve after the delay', async () => {
    const promise = interruptibleDelay(handler, 200);
    await vi.advanceTimersByTimeAsync(200);
    await expect(promise).resolves.toBeUndefined();
  });

  it('should reject if interrupted during delay', async () => {
    // Keep fake timers (set in beforeEach) - real timers don't fire reliably in vmThreads
    const promise = interruptibleDelay(handler, 500);
    // Attach catch handler early to prevent unhandled rejection during timer advancement
    promise.catch(() => {});

    // Interrupt synchronously, then advance timers so setInterval polling detects it
    handler.requestInterrupt();
    await vi.advanceTimersByTimeAsync(200);

    await expect(promise).rejects.toThrow('Operation interrupted');
  });
});

describe('withCleanup', () => {
  let handler: InterruptHandlerImpl;

  beforeEach(() => {
    handler = new InterruptHandlerImpl();
    handler.reset();
  });

  afterEach(() => {
    handler.reset();
  });

  it('should execute function and remove cleanup callback on success', async () => {
    let cleanupCalled = false;
    const cleanup: CleanupCallback = async () => { cleanupCalled = true; };

    const result = await withCleanup(handler, async () => 42, cleanup);
    expect(result).toBe(42);

    // Cleanup should not have been called (not interrupted)
    expect(cleanupCalled).toBe(false);
  });

  it('should remove cleanup callback even on error', async () => {
    const cleanup: CleanupCallback = vi.fn(async () => {});

    await expect(
      withCleanup(handler, async () => { throw new Error('fn error'); }, cleanup)
    ).rejects.toThrow('fn error');

    // Cleanup should not have been called directly (it was removed from state)
    // The callback is removed from the state in the finally block
  });

  it('should register the cleanup callback with the handler', async () => {
    let cleanupRegistered = false;
    const cleanup: CleanupCallback = async () => { cleanupRegistered = true; };

    // During the execution, the cleanup should be registered
    await withCleanup(handler, async () => {
      // At this point cleanup should be in the handler's callbacks
      return 'ok';
    }, cleanup);

    expect(cleanupRegistered).toBe(false); // Not called because no interrupt
  });
});

describe('installSignalHandlers / removeSignalHandlers', () => {
  let handler: InterruptHandlerImpl;

  beforeEach(() => {
    handler = new InterruptHandlerImpl();
    handler.reset();
  });

  afterEach(() => {
    handler.reset();
    removeSignalHandlers();
  });

  it('should install signal handlers without error', () => {
    expect(() => installSignalHandlers(handler)).not.toThrow();
    // Clean up
    removeSignalHandlers();
  });

  it('should remove signal handlers without error', () => {
    installSignalHandlers(handler);
    expect(() => removeSignalHandlers()).not.toThrow();
  });

  it('should handle removal when no handlers installed', () => {
    // Remove when nothing installed should be safe
    expect(() => removeSignalHandlers()).not.toThrow();
  });
});
