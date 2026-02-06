/**
 * @module asana/update-task/tag-cache
 * @description Tag creation and caching
 */

import type { AsanaConfig } from '../../common/types/index.js';
import { getAsanaClient } from '../list-tasks/client.js';
import { type TagInfo, getWorkspaceTags } from './tags.js';

/** Cache entry with TTL */
interface CacheEntry<T> {
  readonly data: T;
  readonly expiresAt: number;
}

/** Default cache TTL (10 minutes) */
const DEFAULT_TTL_MS = 10 * 60 * 1000;

/** In-memory tag cache keyed by workspace GID */
const tagCache = new Map<string, CacheEntry<Map<string, TagInfo>>>();

/** Name to GID lookup cache */
const tagNameCache = new Map<string, CacheEntry<Map<string, string>>>();

/**
 * Get tags with caching
 *
 * @param config - Asana configuration
 * @param ttlMs - Cache TTL
 * @returns Map of tag GID to TagInfo
 */
export async function getTagsWithCache(
  config: AsanaConfig,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<Map<string, TagInfo>> {
  const cached = tagCache.get(config.workspaceGid);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const tags = await getWorkspaceTags(config);
  const tagMap = new Map<string, TagInfo>();
  const nameMap = new Map<string, string>();

  for (const tag of tags) {
    tagMap.set(tag.gid, tag);
    nameMap.set(tag.name.toLowerCase(), tag.gid);
  }

  tagCache.set(config.workspaceGid, {
    data: tagMap,
    expiresAt: now + ttlMs,
  });

  tagNameCache.set(config.workspaceGid, {
    data: nameMap,
    expiresAt: now + ttlMs,
  });

  return tagMap;
}

/**
 * Get tag GID by name (with caching)
 *
 * @param config - Asana configuration
 * @param name - Tag name
 * @returns Tag GID or null
 */
export async function getTagGidByName(
  config: AsanaConfig,
  name: string
): Promise<string | null> {
  // Check name cache first
  const cached = tagNameCache.get(config.workspaceGid);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.data.get(name.toLowerCase()) ?? null;
  }

  // Refresh cache
  await getTagsWithCache(config);

  const refreshed = tagNameCache.get(config.workspaceGid);
  return refreshed?.data.get(name.toLowerCase()) ?? null;
}

/**
 * Create a new tag
 *
 * @param config - Asana configuration
 * @param name - Tag name
 * @param color - Optional tag color
 * @returns Created tag info
 */
export async function createTag(
  config: AsanaConfig,
  name: string,
  color?: string
): Promise<TagInfo> {
  const client = getAsanaClient(config);

  const tagData: Record<string, unknown> = {
    name,
    workspace: config.workspaceGid,
  };

  if (color) {
    tagData['color'] = color;
  }

  const response = await client.tags.createTag({ data: tagData });
  const t = response.data as Record<string, unknown>;

  const tag: TagInfo = {
    gid: t['gid'] as string,
    name: t['name'] as string,
    color: (t['color'] as string) ?? null,
  };

  // Update cache
  invalidateTagCache(config.workspaceGid);

  return tag;
}

/**
 * Get or create a tag by name
 *
 * @param config - Asana configuration
 * @param name - Tag name
 * @param color - Optional color if creating
 * @returns Tag info
 */
export async function getOrCreateTag(
  config: AsanaConfig,
  name: string,
  color?: string
): Promise<TagInfo> {
  const existingGid = await getTagGidByName(config, name);

  if (existingGid) {
    const tagMap = await getTagsWithCache(config);
    const tag = tagMap.get(existingGid);
    if (tag) return tag;
  }

  return createTag(config, name, color);
}

/**
 * Get or create multiple tags
 *
 * @param config - Asana configuration
 * @param names - Tag names
 * @returns Map of name to TagInfo
 */
export async function getOrCreateTags(
  config: AsanaConfig,
  names: readonly string[]
): Promise<Map<string, TagInfo>> {
  const result = new Map<string, TagInfo>();

  for (const name of names) {
    const tag = await getOrCreateTag(config, name);
    result.set(name, tag);
  }

  return result;
}

/**
 * Invalidate tag cache for a workspace
 *
 * @param workspaceGid - Workspace GID
 */
export function invalidateTagCache(workspaceGid: string): void {
  tagCache.delete(workspaceGid);
  tagNameCache.delete(workspaceGid);
}

/**
 * Clear all tag caches
 */
export function clearTagCache(): void {
  tagCache.clear();
  tagNameCache.clear();
}

/**
 * Get cache statistics
 */
export function getTagCacheStats(): {
  workspacesCached: number;
  totalTags: number;
} {
  let totalTags = 0;
  for (const entry of tagCache.values()) {
    totalTags += entry.data.size;
  }

  return {
    workspacesCached: tagCache.size,
    totalTags,
  };
}

/** Asana tag colors */
export const TAG_COLORS = [
  'dark-pink',
  'dark-green',
  'dark-blue',
  'dark-red',
  'dark-teal',
  'dark-brown',
  'dark-orange',
  'dark-purple',
  'dark-warm-gray',
  'light-pink',
  'light-green',
  'light-blue',
  'light-red',
  'light-teal',
  'light-brown',
  'light-orange',
  'light-purple',
  'light-warm-gray',
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

/**
 * Check if a color is valid for Asana tags
 *
 * @param color - Color to check
 * @returns True if valid
 */
export function isValidTagColor(color: string): color is TagColor {
  return TAG_COLORS.includes(color as TagColor);
}
