/**
 * @module common/issue-parser/source-parser
 * @description Parse Source section from issue body
 */

import type { Root } from 'mdast';
import type { IssueSource, Result } from '../types/index.js';
import { ok, err, isFailure } from '../types/index.js';
import { findSection, getSectionText, extractText } from './ast.js';
import type { ParseError } from './types.js';
import { SECTION_NAMES, DEFAULT_VALUES } from './types.js';

/**
 * Parsed source information
 */
export interface ParsedSource {
  readonly source: IssueSource;
  readonly sourceId?: string;
  readonly sourceUrl?: string;
}

/**
 * Source patterns for detection
 */
const SOURCE_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly source: IssueSource;
  readonly extractId?: (match: RegExpMatchArray) => string | undefined;
  readonly extractUrl?: (match: RegExpMatchArray) => string | undefined;
}> = [
  {
    pattern: /sentry[:\s]+(?:issue[:\s]+)?([A-Z0-9-]+)?/i,
    source: 'sentry',
    extractId: (match) => match[1],
  },
  {
    pattern: /https?:\/\/[^/]*sentry\.io\/[^\s]+\/issues\/(\d+)/i,
    source: 'sentry',
    extractId: (match) => match[1],
    extractUrl: (match) => match[0],
  },
  {
    pattern: /asana[:\s]+(?:task[:\s]+)?(\d+)?/i,
    source: 'asana',
    extractId: (match) => match[1],
  },
  {
    pattern: /https?:\/\/app\.asana\.com\/\d+\/\d+\/(\d+)/i,
    source: 'asana',
    extractId: (match) => match[1],
    extractUrl: (match) => match[0],
  },
  {
    pattern: /github[:\s]+(?:issue[:\s]+)?#?(\d+)?/i,
    source: 'github',
    extractId: (match) => match[1],
  },
  {
    pattern: /https?:\/\/github\.com\/[^/]+\/[^/]+\/issues\/(\d+)/i,
    source: 'github',
    extractId: (match) => match[1],
    extractUrl: (match) => match[0],
  },
  {
    pattern: /manual(?:ly)?(?:\s+created)?/i,
    source: 'manual',
  },
];

/**
 * Detect source from text content
 */
function detectSource(text: string): ParsedSource {
  const normalizedText = text.toLowerCase();

  for (const { pattern, source, extractId, extractUrl } of SOURCE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        source,
        sourceId: extractId?.(match),
        sourceUrl: extractUrl?.(match),
      };
    }
  }

  // Check for explicit source mentions
  if (normalizedText.includes('sentry')) {
    return { source: 'sentry' };
  }
  if (normalizedText.includes('asana')) {
    return { source: 'asana' };
  }
  if (normalizedText.includes('github')) {
    return { source: 'github' };
  }

  return { source: DEFAULT_VALUES.source };
}

/**
 * Extract URLs from text
 */
function extractUrls(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s<>)\]]+/gi;
  const matches = text.match(urlPattern);
  return matches ?? [];
}

/**
 * Parse the Source section from an AST
 *
 * @param ast - The parsed markdown AST
 * @returns Result containing parsed source information
 */
export function parseSource(ast: Root): Result<ParsedSource, ParseError> {
  const sectionResult = findSection(ast, SECTION_NAMES.SOURCE);

  if (isFailure(sectionResult)) {
    return err({
      code: 'AST_ERROR',
      message: sectionResult.error.message,
      section: SECTION_NAMES.SOURCE,
      cause: sectionResult.error,
    });
  }

  const section = sectionResult.data;

  // If no Source section found, try to detect from entire document
  if (section === null) {
    // Look through all nodes for source indicators
    let fullText = '';
    for (const child of ast.children) {
      fullText += extractText(child) + '\n';
    }

    const detected = detectSource(fullText);
    return ok(detected);
  }

  const sectionText = getSectionText(section);

  if (sectionText.length === 0) {
    return ok({ source: DEFAULT_VALUES.source });
  }

  // Parse the section content
  const detected = detectSource(sectionText);

  // If no URL found yet, try to extract from section
  if (detected.sourceUrl === undefined) {
    const urls = extractUrls(sectionText);
    const relevantUrl = urls.find((url) => {
      const lowerUrl = url.toLowerCase();
      return (
        lowerUrl.includes('sentry') ||
        lowerUrl.includes('asana') ||
        lowerUrl.includes('github')
      );
    });

    if (relevantUrl !== undefined) {
      return ok({
        ...detected,
        sourceUrl: relevantUrl,
      });
    }
  }

  return ok(detected);
}

/**
 * Parse source from raw text (without AST)
 *
 * @param text - Raw text content
 * @returns Parsed source information
 */
export function parseSourceFromText(text: string): ParsedSource {
  return detectSource(text);
}
