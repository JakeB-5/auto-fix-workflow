/**
 * @module asana/list-tasks/cache
 * @description Section cache implementation for Asana projects
 */

import type Asana from 'asana';

/** Section info with GID and name */
export interface SectionInfo {
  readonly gid: string;
  readonly name: string;
}

/** Cache entry with TTL */
interface CacheEntry<T> {
  readonly data: T;
  readonly expiresAt: number;
}

/** Default cache TTL (5 minutes) */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** In-memory section cache keyed by project GID */
const sectionCache = new Map<string, CacheEntry<SectionInfo[]>>();

/**
 * Get sections for a project, using cache if available
 *
 * @param client - Asana client
 * @param projectGid - Project GID
 * @param ttlMs - Cache TTL in milliseconds
 * @returns Array of section info
 */
export async function getSectionsWithCache(
  client: Asana.Client,
  projectGid: string,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<SectionInfo[]> {
  const cached = sectionCache.get(projectGid);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const sections = await fetchSections(client, projectGid);
  sectionCache.set(projectGid, {
    data: sections,
    expiresAt: now + ttlMs,
  });

  return sections;
}

/**
 * Fetch sections from Asana API
 *
 * @param client - Asana client
 * @param projectGid - Project GID
 * @returns Array of section info
 */
async function fetchSections(
  client: Asana.Client,
  projectGid: string
): Promise<SectionInfo[]> {
  const response = await client.sections.getSectionsForProject(projectGid, {
    opt_fields: 'gid,name',
  });

  const sections: SectionInfo[] = [];
  // Handle both array and iterator response types
  if (Array.isArray(response.data)) {
    for (const section of response.data) {
      sections.push({
        gid: section.gid as string,
        name: section.name as string,
      });
    }
  }

  return sections;
}

/**
 * Get section GID by name
 *
 * @param client - Asana client
 * @param projectGid - Project GID
 * @param sectionName - Section name to find
 * @returns Section GID or null if not found
 */
export async function getSectionGidByName(
  client: Asana.Client,
  projectGid: string,
  sectionName: string
): Promise<string | null> {
  const sections = await getSectionsWithCache(client, projectGid);
  const section = sections.find(
    (s) => s.name.toLowerCase() === sectionName.toLowerCase()
  );
  return section?.gid ?? null;
}

/**
 * Invalidate cache for a project
 *
 * @param projectGid - Project GID to invalidate
 */
export function invalidateSectionCache(projectGid: string): void {
  sectionCache.delete(projectGid);
}

/**
 * Clear entire section cache
 */
export function clearSectionCache(): void {
  sectionCache.clear();
}

/**
 * Get cache size (for monitoring)
 *
 * @returns Number of cached projects
 */
export function getSectionCacheSize(): number {
  return sectionCache.size;
}
