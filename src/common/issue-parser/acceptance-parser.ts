/**
 * @module common/issue-parser/acceptance-parser
 * @description Parse Acceptance Criteria section from issue body
 */

import type { Root, Content } from 'mdast';
import type { Result } from '../types/index.js';
import { ok, err, isFailure, isSuccess } from '../types/index.js';
import {
  findSection,
  getSectionText,
  extractListItems,
  extractText,
  isList,
} from './ast.js';
import type {
  ParseError,
  ExtendedAcceptanceCriteria,
  GivenWhenThenScenario,
} from './types.js';
import { SECTION_NAMES } from './types.js';

/**
 * GIVEN-WHEN-THEN pattern for BDD-style criteria
 * Note: Using multiline approach instead of 's' flag for ES2017 compatibility
 */
const GWT_PATTERN = /(?:GIVEN|Given)\s+([\s\S]+?)\s+(?:WHEN|When)\s+([\s\S]+?)\s+(?:THEN|Then)\s+([\s\S]+)/i;

/**
 * Alternative patterns for acceptance criteria
 */
const CRITERIA_PATTERNS = {
  // - [ ] Checkbox format
  checkbox: /^\s*[-*]\s*\[([ xX])\]\s*(.+)$/gm,
  // - Bullet format
  bullet: /^\s*[-*]\s+(.+)$/gm,
  // 1. Numbered format
  numbered: /^\s*\d+\.\s+(.+)$/gm,
  // GIVEN/WHEN/THEN anywhere in text
  gwt: /(?:GIVEN|Given)\s+(.+?)(?:\s+(?:WHEN|When)\s+(.+?))?(?:\s+(?:THEN|Then)\s+(.+))?/gi,
};

/**
 * Parse GIVEN-WHEN-THEN from a single string
 */
function parseGivenWhenThen(text: string): GivenWhenThenScenario | undefined {
  const match = text.match(GWT_PATTERN);
  if (!match) {
    return undefined;
  }

  return {
    given: match[1]?.trim() ?? '',
    when: match[2]?.trim() ?? '',
    then: match[3]?.trim() ?? '',
  };
}

/**
 * Parse individual lines looking for GIVEN/WHEN/THEN structure
 */
function parseGwtFromLines(lines: string[]): GivenWhenThenScenario | undefined {
  let given = '';
  let when = '';
  let then = '';

  for (const line of lines) {
    const trimmed = line.trim();
    const givenMatch = trimmed.match(/^(?:GIVEN|Given)[:\s]+(.+)/i);
    const whenMatch = trimmed.match(/^(?:WHEN|When)[:\s]+(.+)/i);
    const thenMatch = trimmed.match(/^(?:THEN|Then)[:\s]+(.+)/i);

    if (givenMatch?.[1]) given = givenMatch[1];
    else if (whenMatch?.[1]) when = whenMatch[1];
    else if (thenMatch?.[1]) then = thenMatch[1];
  }

  if (given || when || then) {
    return { given, when, then };
  }

  return undefined;
}

/**
 * Parse a single acceptance criterion
 */
function parseCriterion(text: string): ExtendedAcceptanceCriteria {
  // Check if it's a checkbox item
  const checkboxMatch = text.match(/^\s*\[([ xX])\]\s*(.+)$/);
  if (checkboxMatch) {
    const completed = checkboxMatch[1]?.toLowerCase() === 'x';
    const description = checkboxMatch[2]?.trim() ?? '';

    return {
      description,
      completed,
      scenario: parseGivenWhenThen(description),
    };
  }

  // Check for GIVEN-WHEN-THEN in the text
  const scenario = parseGivenWhenThen(text);

  return {
    description: text.trim(),
    completed: false,
    scenario,
  };
}

/**
 * Extract criteria from list content
 */
function extractCriteriaFromList(content: readonly Content[]): ExtendedAcceptanceCriteria[] {
  const criteria: ExtendedAcceptanceCriteria[] = [];

  for (const node of content) {
    if (isList(node)) {
      const items = extractListItems([node]);
      for (const item of items) {
        if (item.trim()) {
          criteria.push(parseCriterion(item));
        }
      }
    }
  }

  return criteria;
}

/**
 * Helper to iterate over regex matches
 */
function execAll(pattern: RegExp, text: string): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  // Create a new regex to avoid mutating the original
  const regex = new RegExp(pattern.source, pattern.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    results.push(match);
    // Prevent infinite loop for zero-width matches
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }
  }
  return results;
}

/**
 * Extract criteria from raw text
 */
function extractCriteriaFromText(text: string): ExtendedAcceptanceCriteria[] {
  const criteria: ExtendedAcceptanceCriteria[] = [];
  const seen = new Set<string>();

  // Try checkbox format first
  const checkboxes = execAll(CRITERIA_PATTERNS.checkbox, text);
  for (const match of checkboxes) {
    const completed = match[1]?.toLowerCase() === 'x';
    const description = match[2]?.trim() ?? '';

    if (description && !seen.has(description)) {
      seen.add(description);
      criteria.push({
        description,
        completed,
        scenario: parseGivenWhenThen(description),
      });
    }
  }

  if (criteria.length > 0) {
    return criteria;
  }

  // Try numbered format
  const numbered = execAll(CRITERIA_PATTERNS.numbered, text);
  for (const match of numbered) {
    const description = match[1]?.trim() ?? '';
    if (description && !seen.has(description)) {
      seen.add(description);
      criteria.push({
        description,
        completed: false,
        scenario: parseGivenWhenThen(description),
      });
    }
  }

  if (criteria.length > 0) {
    return criteria;
  }

  // Try bullet format
  const bullets = execAll(CRITERIA_PATTERNS.bullet, text);
  for (const match of bullets) {
    const description = match[1]?.trim() ?? '';
    if (description && !seen.has(description)) {
      seen.add(description);
      criteria.push({
        description,
        completed: false,
        scenario: parseGivenWhenThen(description),
      });
    }
  }

  if (criteria.length > 0) {
    return criteria;
  }

  // Try to extract GIVEN-WHEN-THEN blocks
  const gwtBlocks = text.split(/(?=GIVEN|Given)/i).filter((block) => block.trim());
  for (const block of gwtBlocks) {
    const scenario = parseGivenWhenThen(block);
    if (scenario && (scenario.given || scenario.when || scenario.then)) {
      const description = block.trim();
      if (!seen.has(description)) {
        seen.add(description);
        criteria.push({
          description,
          completed: false,
          scenario,
        });
      }
    }
  }

  if (criteria.length > 0) {
    return criteria;
  }

  // Fallback: split by lines and treat non-empty lines as criteria
  const lines = text.split('\n').filter((line) => line.trim() && line.trim().length > 10);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      criteria.push({
        description: trimmed,
        completed: false,
        scenario: parseGivenWhenThen(trimmed),
      });
    }
  }

  return criteria;
}

/**
 * Parse the Acceptance Criteria section from an AST
 *
 * @param ast - The parsed markdown AST
 * @returns Result containing parsed acceptance criteria
 */
export function parseAcceptanceCriteria(
  ast: Root
): Result<ExtendedAcceptanceCriteria[], ParseError> {
  // Try primary section name
  let sectionResult = findSection(ast, SECTION_NAMES.ACCEPTANCE_CRITERIA);

  if (isFailure(sectionResult)) {
    return err({
      code: 'AST_ERROR',
      message: sectionResult.error.message,
      section: SECTION_NAMES.ACCEPTANCE_CRITERIA,
      cause: sectionResult.error,
    });
  }

  let section = sectionResult.data;

  // Try alternative section name
  if (section === null) {
    sectionResult = findSection(ast, SECTION_NAMES.ACCEPTANCE_CRITERIA_ALT);
    if (isSuccess(sectionResult)) {
      section = sectionResult.data;
    }
  }

  if (section === null) {
    return ok([]);
  }

  const sectionText = getSectionText(section);

  if (sectionText.length === 0) {
    return ok([]);
  }

  // Try to extract from list nodes first
  const listCriteria = extractCriteriaFromList(section.content);
  if (listCriteria.length > 0) {
    return ok(listCriteria);
  }

  // Fall back to text extraction
  const textCriteria = extractCriteriaFromText(sectionText);
  return ok(textCriteria);
}

/**
 * Parse acceptance criteria from raw text (without AST)
 *
 * @param text - Raw text content
 * @returns Parsed acceptance criteria
 */
export function parseAcceptanceCriteriaFromText(text: string): ExtendedAcceptanceCriteria[] {
  // Try to find section markers
  const criteriaPatterns = [
    /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## |$)/i,
    /## Done Criteria\s*\n([\s\S]*?)(?=\n## |$)/i,
    /### Criteria\s*\n([\s\S]*?)(?=\n### |$)/i,
  ];

  for (const pattern of criteriaPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return extractCriteriaFromText(match[1]);
    }
  }

  return extractCriteriaFromText(text);
}

/**
 * Check if all acceptance criteria are completed
 *
 * @param criteria - List of acceptance criteria
 * @returns Whether all criteria are completed
 */
export function areAllCriteriaCompleted(
  criteria: readonly ExtendedAcceptanceCriteria[]
): boolean {
  return criteria.length > 0 && criteria.every((c) => c.completed);
}

/**
 * Count completed vs total criteria
 *
 * @param criteria - List of acceptance criteria
 * @returns Object with completed and total counts
 */
export function countCriteria(
  criteria: readonly ExtendedAcceptanceCriteria[]
): { completed: number; total: number } {
  return {
    completed: criteria.filter((c) => c.completed).length,
    total: criteria.length,
  };
}

/**
 * Format GIVEN-WHEN-THEN scenario as text
 *
 * @param scenario - The scenario to format
 * @returns Formatted string
 */
export function formatScenario(scenario: GivenWhenThenScenario): string {
  const parts: string[] = [];

  if (scenario.given) {
    parts.push(`GIVEN ${scenario.given}`);
  }
  if (scenario.when) {
    parts.push(`WHEN ${scenario.when}`);
  }
  if (scenario.then) {
    parts.push(`THEN ${scenario.then}`);
  }

  return parts.join('\n');
}
