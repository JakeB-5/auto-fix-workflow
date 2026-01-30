/**
 * @module common/issue-parser/problem-parser
 * @description Parse Problem Description section from issue body
 */

import type { Root, Content } from 'mdast';
import type { Result } from '../types/index.js';
import { ok, err, isFailure, isSuccess } from '../types/index.js';
import { findSection, getSectionText, extractText, isHeading } from './ast.js';
import type { ParseError } from './types.js';
import { SECTION_NAMES } from './types.js';

/**
 * Parse the Problem Description section from an AST
 *
 * @param ast - The parsed markdown AST
 * @returns Result containing the problem description string
 */
export function parseProblemDescription(ast: Root): Result<string, ParseError> {
  // Try primary section name
  let sectionResult = findSection(ast, SECTION_NAMES.PROBLEM);

  if (isFailure(sectionResult)) {
    return err({
      code: 'AST_ERROR',
      message: sectionResult.error.message,
      section: SECTION_NAMES.PROBLEM,
      cause: sectionResult.error,
    });
  }

  let section = sectionResult.data;

  // Try alternative section name if primary not found
  if (section === null) {
    sectionResult = findSection(ast, SECTION_NAMES.PROBLEM_ALT);
    if (isSuccess(sectionResult)) {
      section = sectionResult.data;
    }
  }

  // If still not found, try to extract from document beginning
  if (section === null) {
    return ok(extractFallbackDescription(ast));
  }

  const description = getSectionText(section);

  if (description.length === 0) {
    return ok(extractFallbackDescription(ast));
  }

  return ok(description);
}

/**
 * Extract fallback description from document when no explicit section exists
 *
 * This extracts text content before the first major section heading
 */
function extractFallbackDescription(ast: Root): string {
  const content: string[] = [];
  const knownSectionNames = Object.values(SECTION_NAMES).map((s) => s.toLowerCase());

  for (const node of ast.children) {
    // Stop at first section heading
    if (isHeading(node)) {
      const headingText = extractText(node).toLowerCase().trim();
      if (knownSectionNames.some((name) => headingText.includes(name.toLowerCase()))) {
        break;
      }
    }

    const text = extractText(node).trim();
    if (text) {
      content.push(text);
    }
  }

  return content.join('\n\n').trim();
}

/**
 * Parse problem description from raw text (without AST)
 *
 * @param text - Raw text content
 * @returns Extracted problem description
 */
export function parseProblemFromText(text: string): string {
  // Try to find section markers
  const problemPatterns = [
    /## Problem Description\s*\n([\s\S]*?)(?=\n## |$)/i,
    /## Description\s*\n([\s\S]*?)(?=\n## |$)/i,
    /### Problem\s*\n([\s\S]*?)(?=\n### |$)/i,
  ];

  for (const pattern of problemPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  // Fallback: return first paragraph or up to first heading
  const firstHeading = text.indexOf('\n##');
  if (firstHeading > 0) {
    return text.slice(0, firstHeading).trim();
  }

  // Return first 500 characters as fallback
  return text.slice(0, 500).trim();
}

/**
 * Extract a summary from a longer problem description
 *
 * @param description - Full problem description
 * @param maxLength - Maximum length of summary (default 200)
 * @returns Shortened summary
 */
export function summarizeProblem(description: string, maxLength = 200): string {
  if (description.length <= maxLength) {
    return description;
  }

  // Try to cut at sentence boundary
  const truncated = description.slice(0, maxLength);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');

  const cutPoint = Math.max(lastPeriod, lastNewline);
  if (cutPoint > maxLength * 0.5) {
    return truncated.slice(0, cutPoint + 1).trim();
  }

  // Cut at word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Extract keywords from problem description for search/tagging
 *
 * @param description - Problem description
 * @returns Array of keywords
 */
export function extractProblemKeywords(description: string): string[] {
  const keywords: string[] = [];
  const lowerDesc = description.toLowerCase();

  // Technical keywords
  const technicalTerms = [
    'error', 'exception', 'crash', 'fail', 'bug', 'broken',
    'null', 'undefined', 'nan', 'timeout', 'memory', 'leak',
    'performance', 'slow', 'hang', 'freeze', 'deadlock',
    'race condition', 'concurrency', 'async', 'sync',
    'database', 'query', 'api', 'endpoint', 'request', 'response',
    'authentication', 'authorization', 'permission', 'access',
    'validation', 'parse', 'format', 'encoding', 'unicode',
    'file', 'path', 'directory', 'socket', 'network', 'connection',
  ];

  for (const term of technicalTerms) {
    if (lowerDesc.includes(term)) {
      keywords.push(term);
    }
  }

  // Extract quoted strings
  const quotedStrings = description.match(/[`'"]([\w.-]+)[`'"]/g);
  if (quotedStrings) {
    for (const qs of quotedStrings) {
      const clean = qs.slice(1, -1);
      if (clean.length > 2 && !keywords.includes(clean.toLowerCase())) {
        keywords.push(clean);
      }
    }
  }

  return keywords;
}
