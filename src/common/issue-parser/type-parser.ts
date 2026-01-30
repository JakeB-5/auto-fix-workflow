/**
 * @module common/issue-parser/type-parser
 * @description Parse Type section from issue body
 */

import type { Root } from 'mdast';
import type { IssueType, Result } from '../types/index.js';
import { ok, err, isFailure } from '../types/index.js';
import { findSection, getSectionText, extractText } from './ast.js';
import type { ParseError } from './types.js';
import { SECTION_NAMES, DEFAULT_VALUES } from './types.js';

/**
 * Type detection patterns with priority ordering
 */
const TYPE_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly type: IssueType;
}> = [
  // Exact matches (highest priority)
  { pattern: /^bug$/i, type: 'bug' },
  { pattern: /^feature$/i, type: 'feature' },
  { pattern: /^refactor$/i, type: 'refactor' },
  { pattern: /^docs?$/i, type: 'docs' },
  { pattern: /^documentation$/i, type: 'docs' },
  { pattern: /^test$/i, type: 'test' },
  { pattern: /^tests?$/i, type: 'test' },
  { pattern: /^chore$/i, type: 'chore' },

  // Label-style matches
  { pattern: /type:\s*bug/i, type: 'bug' },
  { pattern: /type:\s*feature/i, type: 'feature' },
  { pattern: /type:\s*refactor/i, type: 'refactor' },
  { pattern: /type:\s*docs?/i, type: 'docs' },
  { pattern: /type:\s*test/i, type: 'test' },
  { pattern: /type:\s*chore/i, type: 'chore' },

  // Bracketed labels
  { pattern: /\[bug\]/i, type: 'bug' },
  { pattern: /\[feature\]/i, type: 'feature' },
  { pattern: /\[refactor\]/i, type: 'refactor' },
  { pattern: /\[docs?\]/i, type: 'docs' },
  { pattern: /\[test\]/i, type: 'test' },
  { pattern: /\[chore\]/i, type: 'chore' },

  // Contextual detection
  { pattern: /\berror\b|\bcrash\b|\bfail/i, type: 'bug' },
  { pattern: /\bexception\b|\bbroken\b|\bnot working\b/i, type: 'bug' },
  { pattern: /\bnew feature\b|\badd\s+support\b|\bimplement\b/i, type: 'feature' },
  { pattern: /\brefactoring\b|\bcleanup\b|\brestructure\b/i, type: 'refactor' },
  { pattern: /\bdocument\b|\breadme\b|\bcomment/i, type: 'docs' },
  { pattern: /\btest case\b|\bunit test\b|\bintegration test\b/i, type: 'test' },
  { pattern: /\bdependenc/i, type: 'chore' },
  { pattern: /\bupgrade\b|\bupdate\b.*\bversion\b/i, type: 'chore' },
];

/**
 * Keywords indicating specific issue types
 */
const TYPE_KEYWORDS: Record<IssueType, readonly string[]> = {
  bug: ['bug', 'error', 'crash', 'fail', 'broken', 'fix', 'issue', 'problem', 'exception'],
  feature: ['feature', 'new', 'add', 'implement', 'enhance', 'request', 'support'],
  refactor: ['refactor', 'cleanup', 'restructure', 'reorganize', 'improve', 'optimize'],
  docs: ['docs', 'documentation', 'readme', 'comment', 'jsdoc', 'guide', 'tutorial'],
  test: ['test', 'spec', 'coverage', 'assertion', 'mock', 'stub'],
  chore: ['chore', 'dependency', 'upgrade', 'maintenance', 'ci', 'build', 'config'],
};

/**
 * Detect type from text using pattern matching
 */
function detectType(text: string): IssueType {
  const trimmedText = text.trim();

  // Try exact pattern matches first
  for (const { pattern, type } of TYPE_PATTERNS) {
    if (pattern.test(trimmedText)) {
      return type;
    }
  }

  // Count keyword occurrences for each type
  const lowerText = trimmedText.toLowerCase();
  const scores: Record<IssueType, number> = {
    bug: 0,
    feature: 0,
    refactor: 0,
    docs: 0,
    test: 0,
    chore: 0,
  };

  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        scores[type as IssueType] += matches.length;
      }
    }
  }

  // Find type with highest score
  let maxScore = 0;
  let detectedType: IssueType = DEFAULT_VALUES.type;

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedType = type as IssueType;
    }
  }

  return detectedType;
}

/**
 * Parse the Type section from an AST
 *
 * @param ast - The parsed markdown AST
 * @returns Result containing parsed issue type
 */
export function parseType(ast: Root): Result<IssueType, ParseError> {
  const sectionResult = findSection(ast, SECTION_NAMES.TYPE);

  if (isFailure(sectionResult)) {
    return err({
      code: 'AST_ERROR',
      message: sectionResult.error.message,
      section: SECTION_NAMES.TYPE,
      cause: sectionResult.error,
    });
  }

  const section = sectionResult.data;

  // If no Type section found, try to detect from entire document
  if (section === null) {
    let fullText = '';
    for (const child of ast.children) {
      fullText += extractText(child) + '\n';
    }

    return ok(detectType(fullText));
  }

  const sectionText = getSectionText(section);

  if (sectionText.length === 0) {
    return ok(DEFAULT_VALUES.type);
  }

  return ok(detectType(sectionText));
}

/**
 * Parse type from raw text (without AST)
 *
 * @param text - Raw text content
 * @returns Detected issue type
 */
export function parseTypeFromText(text: string): IssueType {
  return detectType(text);
}

/**
 * Check if a type string is a valid IssueType
 */
export function isValidIssueType(type: string): type is IssueType {
  return ['bug', 'feature', 'refactor', 'docs', 'test', 'chore'].includes(type.toLowerCase());
}
