/**
 * @module analyzer/code-locator/text-search
 * @description Text-based code search with confidence scoring
 */

import { promises as fs } from 'node:fs';
import type { SearchResult } from './types.js';

/**
 * Search for text/pattern in codebase
 *
 * @param query - Search query or pattern
 * @param cwd - Working directory
 * @param files - Optional array of files to search (if not provided, searches all)
 * @returns Promise resolving to array of search results
 */
export async function searchCode(
  query: string,
  cwd: string,
  files?: string[]
): Promise<SearchResult[]> {
  if (!files || files.length === 0) {
    return [];
  }

  const results: SearchResult[] = [];

  await Promise.all(
    files.map(async (filePath) => {
      const fileResults = await searchInFile(query, filePath);
      results.push(...fileResults);
    })
  );

  // Sort by confidence (highest first)
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Search in a single file
 *
 * @param query - Search query
 * @param filePath - File path to search
 * @returns Array of search results
 */
async function searchInFile(
  query: string,
  filePath: string
): Promise<SearchResult[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const results: SearchResult[] = [];

    const queryLower = query.toLowerCase();
    const queryPattern = createSearchPattern(query);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const lineLower = line.toLowerCase();

      // Check for match
      if (lineLower.includes(queryLower) || queryPattern.test(line)) {
        const confidence = calculateConfidence(query, line);

        results.push({
          filePath,
          lineNumber: i + 1,
          content: line.trim(),
          confidence,
        });
      }
    }

    return results;
  } catch (error) {
    // File read error, skip
    return [];
  }
}

/**
 * Create regex pattern from search query
 *
 * @param query - Search query
 * @returns RegExp pattern
 */
function createSearchPattern(query: string): RegExp {
  // Escape special regex characters
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Allow word boundaries
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

/**
 * Calculate confidence score for a match
 *
 * @param query - Search query
 * @param line - Matched line
 * @returns Confidence score (0-1)
 */
function calculateConfidence(query: string, line: string): number {
  const queryLower = query.toLowerCase();
  const lineLower = line.toLowerCase();

  let confidence = 0.5; // Base confidence

  // Exact match
  if (line.includes(query)) {
    confidence += 0.3;
  }

  // Case-insensitive match
  if (lineLower.includes(queryLower)) {
    confidence += 0.1;
  }

  // Word boundary match
  const wordPattern = new RegExp(`\\b${escapeRegex(query)}\\b`, 'i');
  if (wordPattern.test(line)) {
    confidence += 0.2;
  }

  // Check if it's a definition (function, class, const, let, var)
  const definitionPatterns = [
    /function\s+/,
    /class\s+/,
    /const\s+/,
    /let\s+/,
    /var\s+/,
    /def\s+/,
    /interface\s+/,
    /type\s+/,
  ];

  for (const pattern of definitionPatterns) {
    if (pattern.test(line)) {
      confidence += 0.15;
      break;
    }
  }

  // Penalize comments (less likely to be the actual code)
  if (/^\s*(\/\/|\/\*|\*|#)/.test(line)) {
    confidence -= 0.2;
  }

  // Ensure confidence is in [0, 1] range
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Escape special regex characters
 *
 * @param str - String to escape
 * @returns Escaped string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Search for multiple queries
 *
 * @param queries - Array of search queries
 * @param cwd - Working directory
 * @param files - Files to search
 * @returns Promise resolving to map of query to results
 */
export async function searchMultiple(
  queries: string[],
  cwd: string,
  files: string[]
): Promise<Map<string, SearchResult[]>> {
  const results = new Map<string, SearchResult[]>();

  await Promise.all(
    queries.map(async (query) => {
      const queryResults = await searchCode(query, cwd, files);
      results.set(query, queryResults);
    })
  );

  return results;
}

/**
 * Search for error messages or patterns
 *
 * @param errorMessage - Error message to search
 * @param files - Files to search
 * @returns Promise resolving to search results
 */
export async function searchError(
  errorMessage: string,
  files: string[]
): Promise<SearchResult[]> {
  // Extract key parts of error message
  const keywords = extractKeywords(errorMessage);

  const allResults: SearchResult[] = [];

  for (const keyword of keywords) {
    const results = await searchCode(keyword, process.cwd(), files);
    allResults.push(...results);
  }

  // Deduplicate and sort by confidence
  const uniqueResults = deduplicateResults(allResults);
  return uniqueResults.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Extract keywords from error message
 *
 * @param errorMessage - Error message
 * @returns Array of keywords
 */
function extractKeywords(errorMessage: string): string[] {
  const keywords: string[] = [];

  // Remove common error prefixes
  let cleaned = errorMessage
    .replace(/^(Error:|TypeError:|ReferenceError:|SyntaxError:)/i, '')
    .trim();

  // Extract quoted strings
  const quotedMatches = cleaned.match(/'([^']+)'|"([^"]+)"/g);
  if (quotedMatches) {
    keywords.push(
      ...quotedMatches.map(m => m.replace(/['"]/g, ''))
    );
  }

  // Extract identifiers (camelCase, snake_case, PascalCase)
  const identifierMatches = cleaned.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g);
  if (identifierMatches) {
    // Filter out common words
    const commonWords = new Set(['is', 'not', 'the', 'a', 'an', 'to', 'of', 'in', 'for']);
    keywords.push(
      ...identifierMatches.filter(id => !commonWords.has(id.toLowerCase()))
    );
  }

  // Remove duplicates
  return Array.from(new Set(keywords));
}

/**
 * Deduplicate search results
 *
 * @param results - Array of search results
 * @returns Deduplicated results
 */
function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const unique: SearchResult[] = [];

  for (const result of results) {
    const key = `${result.filePath}:${result.lineNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(result);
    }
  }

  return unique;
}
