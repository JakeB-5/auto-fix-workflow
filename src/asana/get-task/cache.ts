/**
 * @module asana/get-task/cache
 * @description Cache layer for Asana task retrieval
 */

import type { AsanaConfig } from '../../common/types/index.js';
import { getTaskFromApi, type RawTaskData } from './api.js';

/** Cache entry with TTL */
interface CacheEntry<T> {
  readonly data: T;
  readonly expiresAt: number;
  readonly fetchedAt: number;
}

/** Default cache TTL (2 minutes for task details) */
const DEFAULT_TTL_MS = 2 * 60 * 1000;

/** Maximum cache size */
const MAX_CACHE_SIZE = 100;

/** In-memory task cache keyed by task GID */
const taskCache = new Map<string, CacheEntry<RawTaskData>>();

/** LRU order tracking */
const accessOrder: string[] = [];

/**
 * Get task with caching
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @param ttlMs - Cache TTL in milliseconds
 * @returns Raw task data
 */
export async function getTaskWithCache(
  config: AsanaConfig,
  taskGid: string,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<RawTaskData> {
  const cached = taskCache.get(taskGid);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    // Update access order for LRU
    updateAccessOrder(taskGid);
    return cached.data;
  }

  // Fetch fresh data
  const task = await getTaskFromApi(config, taskGid);

  // Cache the result
  taskCache.set(taskGid, {
    data: task,
    expiresAt: now + ttlMs,
    fetchedAt: now,
  });

  // Update LRU order
  updateAccessOrder(taskGid);

  // Evict if over max size
  evictIfNeeded();

  return task;
}

/**
 * Get task bypassing cache
 *
 * @param config - Asana configuration
 * @param taskGid - Task GID
 * @returns Raw task data
 */
export async function getTaskFresh(
  config: AsanaConfig,
  taskGid: string
): Promise<RawTaskData> {
  const task = await getTaskFromApi(config, taskGid);

  // Still update cache for future use
  const now = Date.now();
  taskCache.set(taskGid, {
    data: task,
    expiresAt: now + DEFAULT_TTL_MS,
    fetchedAt: now,
  });

  updateAccessOrder(taskGid);
  evictIfNeeded();

  return task;
}

/**
 * Check if task is cached and valid
 *
 * @param taskGid - Task GID
 * @returns True if cached and not expired
 */
export function isTaskCached(taskGid: string): boolean {
  const cached = taskCache.get(taskGid);
  return !!cached && cached.expiresAt > Date.now();
}

/**
 * Get cached task without fetching
 *
 * @param taskGid - Task GID
 * @returns Cached task or null
 */
export function getCachedTask(taskGid: string): RawTaskData | null {
  const cached = taskCache.get(taskGid);
  if (cached && cached.expiresAt > Date.now()) {
    updateAccessOrder(taskGid);
    return cached.data;
  }
  return null;
}

/**
 * Invalidate cache for a task
 *
 * @param taskGid - Task GID to invalidate
 */
export function invalidateTaskCache(taskGid: string): void {
  taskCache.delete(taskGid);
  const index = accessOrder.indexOf(taskGid);
  if (index > -1) {
    accessOrder.splice(index, 1);
  }
}

/**
 * Clear entire task cache
 */
export function clearTaskCache(): void {
  taskCache.clear();
  accessOrder.length = 0;
}

/**
 * Get cache statistics
 *
 * @returns Cache stats
 */
export function getTaskCacheStats(): {
  size: number;
  maxSize: number;
  hitRate: number;
} {
  return {
    size: taskCache.size,
    maxSize: MAX_CACHE_SIZE,
    hitRate: calculateHitRate(),
  };
}

/** Hit/miss counters for hit rate calculation */
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Calculate cache hit rate
 */
function calculateHitRate(): number {
  const total = cacheHits + cacheMisses;
  if (total === 0) return 0;
  return cacheHits / total;
}

/**
 * Update LRU access order
 */
function updateAccessOrder(taskGid: string): void {
  const index = accessOrder.indexOf(taskGid);
  if (index > -1) {
    accessOrder.splice(index, 1);
    cacheHits++;
  } else {
    cacheMisses++;
  }
  accessOrder.push(taskGid);
}

/**
 * Evict oldest entries if over max size
 */
function evictIfNeeded(): void {
  while (taskCache.size > MAX_CACHE_SIZE && accessOrder.length > 0) {
    const oldest = accessOrder.shift();
    if (oldest) {
      taskCache.delete(oldest);
    }
  }
}

/**
 * Prefetch multiple tasks into cache
 *
 * @param config - Asana configuration
 * @param taskGids - Task GIDs to prefetch
 * @returns Number of tasks fetched
 */
export async function prefetchTasks(
  config: AsanaConfig,
  taskGids: readonly string[]
): Promise<number> {
  const uncached = taskGids.filter((gid) => !isTaskCached(gid));

  // Fetch in parallel with concurrency limit
  const CONCURRENCY = 5;
  let fetched = 0;

  for (let i = 0; i < uncached.length; i += CONCURRENCY) {
    const batch = uncached.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (gid) => {
        try {
          await getTaskWithCache(config, gid);
          fetched++;
        } catch {
          // Ignore errors during prefetch
        }
      })
    );
  }

  return fetched;
}

/**
 * Get cache age for a task
 *
 * @param taskGid - Task GID
 * @returns Age in milliseconds or null if not cached
 */
export function getTaskCacheAge(taskGid: string): number | null {
  const cached = taskCache.get(taskGid);
  if (!cached) return null;
  return Date.now() - cached.fetchedAt;
}
