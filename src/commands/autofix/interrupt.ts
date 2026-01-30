/**
 * @module commands/autofix/interrupt
 * @description Interrupt handling (Ctrl+C) and cleanup
 */

import type { InterruptHandler } from './types.js';

/**
 * Cleanup callback type
 */
export type CleanupCallback = () => Promise<void>;

/**
 * Interrupt state
 */
interface InterruptState {
  interrupted: boolean;
  cleanupCallbacks: CleanupCallback[];
  cleanupPromise?: Promise<void> | undefined;
  originalHandlers: {
    SIGINT?: NodeJS.SignalsListener | undefined;
    SIGTERM?: NodeJS.SignalsListener | undefined;
  };
}

/**
 * Global interrupt state
 */
const state: InterruptState = {
  interrupted: false,
  cleanupCallbacks: [],
  originalHandlers: {},
};

/**
 * Interrupt Handler Implementation
 *
 * Manages graceful shutdown on Ctrl+C or SIGTERM
 */
export class InterruptHandlerImpl implements InterruptHandler {
  private readonly state: InterruptState;

  constructor() {
    this.state = state;
  }

  /**
   * Check if interrupt requested
   */
  get isInterrupted(): boolean {
    return this.state.interrupted;
  }

  /**
   * Request interrupt
   */
  requestInterrupt(): void {
    this.state.interrupted = true;
  }

  /**
   * Register cleanup callback
   */
  onCleanup(callback: CleanupCallback): void {
    this.state.cleanupCallbacks.push(callback);
  }

  /**
   * Wait for cleanup to complete
   */
  async waitForCleanup(): Promise<void> {
    if (this.state.cleanupPromise) {
      await this.state.cleanupPromise;
    }
  }

  /**
   * Run cleanup callbacks
   */
  async runCleanup(): Promise<void> {
    if (this.state.cleanupPromise) {
      return this.state.cleanupPromise;
    }

    this.state.cleanupPromise = this.executeCleanup();
    await this.state.cleanupPromise;
  }

  /**
   * Execute all cleanup callbacks
   */
  private async executeCleanup(): Promise<void> {
    const callbacks = [...this.state.cleanupCallbacks];
    this.state.cleanupCallbacks = [];

    console.log('\nRunning cleanup...');

    for (const callback of callbacks) {
      try {
        await callback();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }

    console.log('Cleanup complete.');
  }

  /**
   * Reset state
   */
  reset(): void {
    this.state.interrupted = false;
    this.state.cleanupCallbacks = [];
    this.state.cleanupPromise = undefined;
  }
}

/**
 * Install signal handlers
 */
export function installSignalHandlers(handler: InterruptHandlerImpl): void {
  const signalHandler = async (signal: string) => {
    console.log(`\nReceived ${signal}. Initiating graceful shutdown...`);

    handler.requestInterrupt();
    await handler.runCleanup();

    // Restore original handlers
    if (state.originalHandlers.SIGINT) {
      process.removeListener('SIGINT', signalHandler as NodeJS.SignalsListener);
    }
    if (state.originalHandlers.SIGTERM) {
      process.removeListener('SIGTERM', signalHandler as NodeJS.SignalsListener);
    }

    // Exit after cleanup
    process.exit(130); // 128 + SIGINT (2)
  };

  // Save and replace handlers
  const existingSigint = process.listeners('SIGINT')[0] as NodeJS.SignalsListener | undefined;
  const existingSigterm = process.listeners('SIGTERM')[0] as NodeJS.SignalsListener | undefined;

  if (existingSigint) {
    state.originalHandlers.SIGINT = existingSigint;
    process.removeListener('SIGINT', existingSigint);
  }
  if (existingSigterm) {
    state.originalHandlers.SIGTERM = existingSigterm;
    process.removeListener('SIGTERM', existingSigterm);
  }

  process.on('SIGINT', signalHandler as NodeJS.SignalsListener);
  process.on('SIGTERM', signalHandler as NodeJS.SignalsListener);
}

/**
 * Remove signal handlers
 */
export function removeSignalHandlers(): void {
  // Remove our handlers
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');

  // Restore original handlers
  if (state.originalHandlers.SIGINT) {
    process.on('SIGINT', state.originalHandlers.SIGINT);
  }
  if (state.originalHandlers.SIGTERM) {
    process.on('SIGTERM', state.originalHandlers.SIGTERM);
  }

  state.originalHandlers = {};
}

/**
 * Create interrupt handler
 */
export function createInterruptHandler(): InterruptHandlerImpl {
  const handler = new InterruptHandlerImpl();
  installSignalHandlers(handler);
  return handler;
}

/**
 * Wrap async function with interrupt checking
 */
export function interruptible<T>(
  handler: InterruptHandler,
  fn: () => Promise<T>,
  onInterrupt?: () => T
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (handler.isInterrupted) {
      if (onInterrupt) {
        resolve(onInterrupt());
      } else {
        reject(new Error('Operation interrupted'));
      }
      return;
    }

    fn()
      .then(resolve)
      .catch(reject);
  });
}

/**
 * Create interruptible delay
 */
export function interruptibleDelay(
  handler: InterruptHandler,
  ms: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (handler.isInterrupted) {
      reject(new Error('Operation interrupted'));
      return;
    }

    const checkInterval = Math.min(ms, 100);
    let elapsed = 0;

    const intervalId = setInterval(() => {
      elapsed += checkInterval;

      if (handler.isInterrupted) {
        clearInterval(intervalId);
        reject(new Error('Operation interrupted'));
        return;
      }

      if (elapsed >= ms) {
        clearInterval(intervalId);
        resolve();
      }
    }, checkInterval);
  });
}

/**
 * Run with cleanup guarantee
 */
export async function withCleanup<T>(
  handler: InterruptHandlerImpl,
  fn: () => Promise<T>,
  cleanup: CleanupCallback
): Promise<T> {
  handler.onCleanup(cleanup);

  try {
    return await fn();
  } finally {
    // Remove the cleanup callback if it wasn't triggered by interrupt
    const index = state.cleanupCallbacks.indexOf(cleanup);
    if (index !== -1) {
      state.cleanupCallbacks.splice(index, 1);
    }
  }
}
