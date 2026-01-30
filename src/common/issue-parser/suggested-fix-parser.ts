/**
 * @module common/issue-parser/suggested-fix-parser
 * @description Parse Suggested Fix Direction section from issue body
 */

import type { Root, Content } from 'mdast';
import type { SuggestedFix, Result } from '../types/index.js';
import { ok, err, isFailure, isSuccess } from '../types/index.js';
import {
  findSection,
  getSectionText,
  extractListItems,
  isList,
  extractText,
} from './ast.js';
import type { ParseError } from './types.js';
import { SECTION_NAMES } from './types.js';

/**
 * Confidence level keywords
 */
const CONFIDENCE_KEYWORDS: ReadonlyArray<{
  readonly keywords: readonly string[];
  readonly confidence: number;
}> = [
  { keywords: ['certain', 'definitely', 'must', 'always', 'exactly'], confidence: 0.95 },
  { keywords: ['should', 'likely', 'probably', 'recommend'], confidence: 0.8 },
  { keywords: ['might', 'could', 'possibly', 'consider'], confidence: 0.6 },
  { keywords: ['maybe', 'perhaps', 'unclear', 'investigate'], confidence: 0.4 },
  { keywords: ['unknown', 'unsure', 'guess', 'try'], confidence: 0.2 },
];

/**
 * Default confidence when none can be determined
 */
const DEFAULT_CONFIDENCE = 0.5;

/**
 * Extract confidence from text based on keywords
 */
function extractConfidence(text: string): number {
  const lowerText = text.toLowerCase();

  for (const { keywords, confidence } of CONFIDENCE_KEYWORDS) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return confidence;
      }
    }
  }

  return DEFAULT_CONFIDENCE;
}

/**
 * Extract steps from list items or numbered points
 */
function extractSteps(text: string, content: readonly Content[]): string[] {
  // First try to extract from list nodes
  const listItems = extractListItems(content);
  if (listItems.length > 0) {
    return listItems.filter((item) => item.length > 0);
  }

  // Try to parse numbered steps from text
  const numberedSteps = text.match(/(?:^|\n)\s*(\d+)\.\s*(.+)/gm);
  if (numberedSteps && numberedSteps.length > 0) {
    return numberedSteps.map((step) => {
      const match = step.match(/\d+\.\s*(.+)/);
      return match?.[1]?.trim() ?? step.trim();
    });
  }

  // Try bullet points
  const bulletSteps = text.match(/(?:^|\n)\s*[-*]\s*(.+)/gm);
  if (bulletSteps && bulletSteps.length > 0) {
    return bulletSteps.map((step) => {
      const match = step.match(/[-*]\s*(.+)/);
      return match?.[1]?.trim() ?? step.trim();
    });
  }

  // Split by sentences as fallback
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  if (sentences.length > 1) {
    return sentences.map((s) => s.trim());
  }

  // Return entire text as single step
  return text.trim().length > 0 ? [text.trim()] : [];
}

/**
 * Check if content contains a list
 */
function hasListContent(content: readonly Content[]): boolean {
  return content.some(isList);
}

/**
 * Clean and normalize description text
 */
function cleanDescription(text: string): string {
  // Remove leading/trailing whitespace
  let cleaned = text.trim();

  // Remove numbered/bullet prefixes if entire text is a single item
  cleaned = cleaned.replace(/^(?:\d+\.|[-*])\s*/, '');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');

  return cleaned;
}

/**
 * Extract description from section content
 * Takes text before any list as the description
 */
function extractDescription(text: string, content: readonly Content[]): string {
  // If there's a list, description is text before the list
  if (hasListContent(content)) {
    const descriptions: string[] = [];

    for (const node of content) {
      if (isList(node)) {
        break;
      }
      const nodeText = extractText(node).trim();
      if (nodeText) {
        descriptions.push(nodeText);
      }
    }

    if (descriptions.length > 0) {
      return cleanDescription(descriptions.join(' '));
    }
  }

  // Otherwise, first paragraph or sentence is description
  const paragraphs = text.split(/\n\n+/);
  const firstPara = paragraphs[0];
  if (firstPara) {
    // If first paragraph contains a list, take first sentence only
    if (/^[\d*-]/.test(firstPara.trim())) {
      const firstSentence = text.match(/^[^.\n]+\./);
      return cleanDescription(firstSentence?.[0] ?? firstPara);
    }
    return cleanDescription(firstPara);
  }

  return cleanDescription(text);
}

/**
 * Parse the Suggested Fix section from an AST
 *
 * @param ast - The parsed markdown AST
 * @returns Result containing parsed suggested fix or null if not found
 */
export function parseSuggestedFix(ast: Root): Result<SuggestedFix | null, ParseError> {
  // Try primary section name
  let sectionResult = findSection(ast, SECTION_NAMES.SUGGESTED_FIX);

  if (isFailure(sectionResult)) {
    return err({
      code: 'AST_ERROR',
      message: sectionResult.error.message,
      section: SECTION_NAMES.SUGGESTED_FIX,
      cause: sectionResult.error,
    });
  }

  let section = sectionResult.data;

  // Try alternative section name
  if (section === null) {
    sectionResult = findSection(ast, SECTION_NAMES.SUGGESTED_FIX_ALT);
    if (isSuccess(sectionResult)) {
      section = sectionResult.data;
    }
  }

  if (section === null) {
    return ok(null);
  }

  const sectionText = getSectionText(section);

  if (sectionText.length === 0) {
    return ok(null);
  }

  const description = extractDescription(sectionText, section.content);
  const steps = extractSteps(sectionText, section.content);
  const confidence = extractConfidence(sectionText);

  return ok({
    description,
    steps,
    confidence,
  });
}

/**
 * Parse suggested fix from raw text (without AST)
 *
 * @param text - Raw text content
 * @returns Parsed suggested fix or null
 */
export function parseSuggestedFixFromText(text: string): SuggestedFix | null {
  // Try to find section markers
  const fixPatterns = [
    /## Suggested Fix(?:\s+Direction)?\s*\n([\s\S]*?)(?=\n## |$)/i,
    /### Fix\s*\n([\s\S]*?)(?=\n### |$)/i,
    /### Solution\s*\n([\s\S]*?)(?=\n### |$)/i,
  ];

  let sectionText = '';

  for (const pattern of fixPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      sectionText = match[1].trim();
      break;
    }
  }

  if (sectionText.length === 0) {
    return null;
  }

  // Extract steps from numbered/bulleted list
  const steps: string[] = [];
  const lines = sectionText.split('\n');
  const descriptionLines: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^(?:\d+\.|[-*])\s+/)) {
      inList = true;
      const stepText = trimmed.replace(/^(?:\d+\.|[-*])\s+/, '');
      if (stepText) steps.push(stepText);
    } else if (!inList && trimmed) {
      descriptionLines.push(trimmed);
    }
  }

  const description = descriptionLines.join(' ').trim() || steps[0] || sectionText.slice(0, 200);

  return {
    description,
    steps: steps.length > 0 ? steps : [sectionText.trim()],
    confidence: extractConfidence(sectionText),
  };
}

/**
 * Validate a suggested fix object
 *
 * @param fix - Suggested fix to validate
 * @returns Whether the fix is valid
 */
export function isValidSuggestedFix(fix: SuggestedFix): boolean {
  return (
    fix.description.length > 0 &&
    fix.steps.length > 0 &&
    fix.confidence >= 0 &&
    fix.confidence <= 1
  );
}
