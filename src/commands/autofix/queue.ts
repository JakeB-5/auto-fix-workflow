/**
 * @module commands/autofix/queue
 * @description Parallel processing queue manager
 */

import type { IssueGroup } from '../../common/types/index.js';
import type { QueueItem, QueueItemStatus, GroupResult } from './types.js';

/**
 * Queue event types
 */
export type QueueEventType =
  | 'item_queued'
  | 'item_started'
  | 'item_completed'
  | 'item_failed'
  | 'item_retrying'
  | 'queue_empty'
  | 'queue_completed';

/**
 * Queue event
 */
export interface QueueEvent {
  readonly type: QueueEventType;
  readonly item?: QueueItem;
  readonly result?: GroupResult;
  readonly timestamp: Date;
}

/**
 * Queue event listener
 */
export type QueueEventListener = (event: QueueEvent) => void;

/**
 * Processing function type
 */
export type ProcessFunction = (group: IssueGroup, attempt: number) => Promise<GroupResult>;

/**
 * Processing Queue
 *
 * Manages parallel processing of issue groups with concurrency control
 */
export class ProcessingQueue {
  private readonly maxConcurrency: number;
  private readonly maxRetries: number;
  private readonly items: Map<string, QueueItem> = new Map();
  private readonly pending: string[] = [];
  private readonly processing: Set<string> = new Set();
  private readonly completed: Map<string, GroupResult> = new Map();
  private readonly listeners: QueueEventListener[] = [];
  private processFunction?: ProcessFunction;
  private isRunning = false;
  private isPaused = false;

  constructor(maxConcurrency: number = 3, maxRetries: number = 3) {
    this.maxConcurrency = maxConcurrency;
    this.maxRetries = maxRetries;
  }

  /**
   * Add groups to the queue
   */
  enqueue(groups: readonly IssueGroup[]): void {
    for (const group of groups) {
      const item: QueueItem = {
        id: group.id,
        group,
        status: 'queued',
        attempt: 0,
      };

      this.items.set(item.id, item);
      this.pending.push(item.id);
      this.emit({ type: 'item_queued', item, timestamp: new Date() });
    }
  }

  /**
   * Set the processing function
   */
  setProcessor(fn: ProcessFunction): void {
    this.processFunction = fn;
  }

  /**
   * Add event listener
   */
  on(listener: QueueEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Start processing the queue
   */
  async start(): Promise<GroupResult[]> {
    if (!this.processFunction) {
      throw new Error('No processor function set');
    }

    this.isRunning = true;
    this.isPaused = false;

    // Process until all items complete
    while (this.isRunning && (this.pending.length > 0 || this.processing.size > 0)) {
      // Wait if paused
      while (this.isPaused && this.isRunning) {
        await this.delay(100);
      }

      // Start new items up to concurrency limit
      while (
        this.pending.length > 0 &&
        this.processing.size < this.maxConcurrency &&
        !this.isPaused
      ) {
        const itemId = this.pending.shift();
        if (itemId) {
          this.processItem(itemId);
        }
      }

      // Wait for some processing to complete
      if (this.processing.size > 0) {
        await this.delay(100);
      }
    }

    this.isRunning = false;
    this.emit({ type: 'queue_completed', timestamp: new Date() });

    return [...this.completed.values()];
  }

  /**
   * Pause processing (current items continue, no new items start)
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume processing
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * Stop processing (graceful - waits for current items)
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    // Wait for current processing to complete
    while (this.processing.size > 0) {
      await this.delay(100);
    }
  }

  /**
   * Force stop (immediate - may leave items incomplete)
   */
  forceStop(): void {
    this.isRunning = false;
    this.isPaused = false;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const statuses = new Map<QueueItemStatus, number>();

    for (const item of this.items.values()) {
      const count = statuses.get(item.status) ?? 0;
      statuses.set(item.status, count + 1);
    }

    return {
      total: this.items.size,
      pending: this.pending.length,
      processing: this.processing.size,
      completed: this.completed.size,
      failed: [...this.items.values()].filter(i => i.status === 'failed').length,
      byStatus: Object.fromEntries(statuses),
    };
  }

  /**
   * Get all results
   */
  getResults(): readonly GroupResult[] {
    return [...this.completed.values()];
  }

  /**
   * Get item by ID
   */
  getItem(id: string): QueueItem | undefined {
    return this.items.get(id);
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.pending.length === 0 && this.processing.size === 0;
  }

  /**
   * Check if queue is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Process a single item
   */
  private async processItem(itemId: string): Promise<void> {
    const item = this.items.get(itemId);
    if (!item || !this.processFunction) return;

    this.processing.add(itemId);
    item.status = 'processing';
    item.attempt += 1;
    item.startedAt = new Date();

    this.emit({ type: 'item_started', item, timestamp: new Date() });

    try {
      const result = await this.processFunction(item.group, item.attempt);

      if (result.status === 'completed') {
        item.status = 'completed';
        this.completed.set(itemId, result);
        this.emit({ type: 'item_completed', item, result, timestamp: new Date() });
      } else if (result.status === 'failed') {
        this.handleFailure(item, result);
      }
    } catch (error) {
      const errorResult: GroupResult = {
        group: item.group,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        attempts: item.attempt,
        durationMs: Date.now() - (item.startedAt?.getTime() ?? Date.now()),
        startedAt: item.startedAt ?? new Date(),
        completedAt: new Date(),
      };

      this.handleFailure(item, errorResult);
    } finally {
      this.processing.delete(itemId);
    }
  }

  /**
   * Handle item failure
   */
  private handleFailure(item: QueueItem, result: GroupResult): void {
    if (item.attempt < this.maxRetries) {
      // Retry
      item.status = 'retrying';
      if (result.error !== undefined) {
        item.error = result.error;
      }
      this.pending.push(item.id);
      this.emit({ type: 'item_retrying', item, result, timestamp: new Date() });
    } else {
      // Max retries exceeded
      item.status = 'failed';
      if (result.error !== undefined) {
        item.error = result.error;
      }
      this.completed.set(item.id, result);
      this.emit({ type: 'item_failed', item, result, timestamp: new Date() });
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: QueueEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }

    // Emit queue_empty only once (avoid recursion)
    if (event.type !== 'queue_empty' && this.pending.length === 0 && this.processing.size === 0) {
      this.emit({ type: 'queue_empty', timestamp: new Date() });
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Queue statistics
 */
export interface QueueStats {
  readonly total: number;
  readonly pending: number;
  readonly processing: number;
  readonly completed: number;
  readonly failed: number;
  readonly byStatus: Record<string, number>;
}

/**
 * Create a processing queue
 */
export function createQueue(
  maxConcurrency: number = 3,
  maxRetries: number = 3
): ProcessingQueue {
  return new ProcessingQueue(maxConcurrency, maxRetries);
}
