/**
 * @module github/create-issue/duplicate-check
 * @description Duplicate issue checking utilities
 */

import type { Octokit } from '@octokit/rest';
import type { Issue } from '../../common/types/index.js';
import type { CreateIssueParams } from './types.js';

/**
 * Options for duplicate detection
 */
export interface DuplicateCheckOptions {
  /** Minimum similarity threshold (0-1) for considering issues as duplicates */
  readonly similarityThreshold?: number;
  /** Maximum number of recent issues to check */
  readonly maxIssuesToCheck?: number;
  /** Whether to check closed issues */
  readonly includeClosedIssues?: boolean;
}

/**
 * Find potential duplicate issues
 *
 * @param octokit - Octokit instance
 * @param params - Issue creation parameters
 * @param options - Duplicate detection options
 * @returns Array of potential duplicate issues
 */
export async function findDuplicates(
  octokit: Octokit,
  params: CreateIssueParams,
  options: DuplicateCheckOptions = {}
): Promise<Issue[]> {
  const {
    similarityThreshold = 0.7,
    maxIssuesToCheck = 50,
    includeClosedIssues = false,
  } = options;

  // Search for issues with similar titles
  const searchQuery = buildSearchQuery(params, includeClosedIssues);

  try {
    const { data: searchResults } = await octokit.rest.search.issuesAndPullRequests({
      q: searchQuery,
      per_page: maxIssuesToCheck,
      sort: 'created',
      order: 'desc',
    });

    // Filter out pull requests
    const issues = searchResults.items.filter(item => !('pull_request' in item));

    // Calculate similarity and filter by threshold
    const duplicates: Issue[] = [];

    for (const issue of issues) {
      const similarity = calculateSimilarity(params.title, issue.title);

      if (similarity >= similarityThreshold) {
        duplicates.push(convertToIssue(issue));
      }
    }

    return duplicates;
  } catch (error) {
    // If search fails, return empty array (non-blocking)
    console.warn('Duplicate check failed:', error);
    return [];
  }
}

/**
 * Build GitHub search query
 */
function buildSearchQuery(params: CreateIssueParams, includeClosedIssues: boolean): string {
  const parts: string[] = [];

  // Repository
  parts.push(`repo:${params.owner}/${params.repo}`);

  // Only issues (not PRs)
  parts.push('is:issue');

  // State filter
  if (!includeClosedIssues) {
    parts.push('is:open');
  }

  // Extract keywords from title for search
  const keywords = extractKeywords(params.title);
  if (keywords.length > 0) {
    // Use the first few keywords to narrow the search
    parts.push(...keywords.slice(0, 3).map(keyword => `"${keyword}"`));
  }

  return parts.join(' ');
}

/**
 * Extract meaningful keywords from title
 */
function extractKeywords(title: string): string[] {
  // Remove common prefixes
  const cleanTitle = title
    .replace(/^\[.*?\]\s*/, '') // Remove [TYPE] prefix
    .toLowerCase();

  // Split into words and filter
  const words = cleanTitle.split(/\s+/);

  // Filter out common words
  const stopWords = new Set([
    'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been',
    'fix', 'issue', 'error', 'bug', 'problem',
  ]);

  return words.filter(word => {
    return (
      word.length > 2 &&
      !stopWords.has(word) &&
      !/^\d+$/.test(word) // Exclude pure numbers
    );
  });
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score (0-1)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) {
    return 1.0;
  }

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  if (maxLength === 0) {
    return 1.0;
  }

  return 1 - distance / maxLength;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a 2D array for dynamic programming
  const matrix: number[][] = Array.from({ length: len1 + 1 }, () =>
    Array(len2 + 1).fill(0)
  );

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i]![0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0]![j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1, // deletion
        matrix[i]![j - 1]! + 1, // insertion
        matrix[i - 1]![j - 1]! + cost // substitution
      );
    }
  }

  return matrix[len1]![len2]!;
}

/**
 * Convert Octokit issue to our Issue type
 */
function convertToIssue(octokitIssue: any): Issue {
  return {
    number: octokitIssue.number,
    title: octokitIssue.title,
    body: octokitIssue.body ?? '',
    state: octokitIssue.state === 'open' ? 'open' : 'closed',
    type: 'bug', // Default type
    labels: octokitIssue.labels?.map((l: any) => l.name) ?? [],
    assignees: octokitIssue.assignees?.map((a: any) => a.login) ?? [],
    context: {
      component: 'unknown',
      priority: 'medium',
      relatedFiles: [],
      relatedSymbols: [],
      source: 'github',
    },
    acceptanceCriteria: [],
    relatedIssues: [],
    createdAt: new Date(octokitIssue.created_at),
    updatedAt: new Date(octokitIssue.updated_at),
    url: octokitIssue.html_url,
  };
}

/**
 * Check if a stack trace appears in issue body
 */
export function containsStackTrace(body: string, stackTrace: string): boolean {
  if (!stackTrace || stackTrace.trim().length === 0) {
    return false;
  }

  const normalizedBody = body.toLowerCase();
  const normalizedStack = stackTrace.toLowerCase();

  // Check for common stack trace patterns
  const stackLines = normalizedStack.split('\n').filter(line => line.trim().length > 0);

  if (stackLines.length === 0) {
    return false;
  }

  // Check if at least 50% of stack trace lines appear in the body
  const matchingLines = stackLines.filter(line => normalizedBody.includes(line.trim()));

  return matchingLines.length / stackLines.length >= 0.5;
}
