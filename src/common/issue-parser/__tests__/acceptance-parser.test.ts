/**
 * @module common/issue-parser/__tests__/acceptance-parser.test
 * @description Tests for acceptance criteria parsing
 */

import { describe, it, expect } from 'vitest';
import {
  parseAcceptanceCriteria,
  parseAcceptanceCriteriaFromText,
  areAllCriteriaCompleted,
  countCriteria,
  formatScenario,
} from '../acceptance-parser.js';
import { parseMarkdownToAst } from '../ast.js';
import { isSuccess } from '../../types/index.js';

describe('acceptance-parser', () => {
  describe('parseAcceptanceCriteria', () => {
    it('should parse checkbox format', async () => {
      const markdown = `
## Acceptance Criteria

- [ ] User can log in
- [x] Password validation works
- [ ] Error messages display
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data.length).toBe(3);
      expect(result.data[0]?.description).toContain('log in');
      expect(result.data[0]?.completed).toBe(false);
      expect(result.data[1]?.completed).toBe(true);
    });

    it('should parse alternative section name', async () => {
      const markdown = `
## Done Criteria

- [ ] Feature works
- [ ] Tests pass
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data.length).toBe(2);
    });

    it('should parse numbered list', async () => {
      const markdown = `
## Acceptance Criteria

1. User authentication works
2. Session is maintained
3. Logout clears session
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data.length).toBe(3);
      expect(result.data[0]?.description).toContain('authentication');
    });

    it('should parse bullet list', async () => {
      const markdown = `
## Acceptance Criteria

- Login button works
- Form validation is correct
- Error handling is present
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data.length).toBe(3);
    });

    it('should parse GIVEN-WHEN-THEN scenario', async () => {
      const markdown = `
## Acceptance Criteria

GIVEN user is logged in
WHEN they click logout
THEN they should be redirected to login page
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]?.scenario).toBeDefined();
      expect(result.data[0]?.scenario?.given).toContain('logged in');
      expect(result.data[0]?.scenario?.when).toContain('click logout');
      expect(result.data[0]?.scenario?.then).toContain('redirected');
    });

    it('should parse mixed case GIVEN-WHEN-THEN', async () => {
      const markdown = `
## Acceptance Criteria

Given the user has permissions
When they access the resource
Then they should see the content
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data[0]?.scenario).toBeDefined();
    });

    it('should parse GIVEN-WHEN-THEN in checkbox', async () => {
      const markdown = `
## Acceptance Criteria

- [ ] GIVEN user is on homepage WHEN they click search THEN results appear
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data[0]?.scenario).toBeDefined();
    });

    it('should return empty array when section not found', async () => {
      const markdown = `
## Problem Description

No acceptance criteria here.
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data).toEqual([]);
    });

    it('should return empty array for empty section', async () => {
      const markdown = `
## Acceptance Criteria

## Next Section
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data).toEqual([]);
    });

    it('should handle nested lists', async () => {
      const markdown = `
## Acceptance Criteria

- [ ] Main criterion
  - Sub item 1
  - Sub item 2
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should filter empty criteria', async () => {
      const markdown = `
## Acceptance Criteria

- [ ] Valid criterion

- [ ]
- [ ] Another valid criterion
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data.every(c => c.description.length > 0)).toBe(true);
    });

    it('should handle multiple GIVEN-WHEN-THEN blocks', async () => {
      const markdown = `
## Acceptance Criteria

GIVEN user A WHEN action1 THEN result1

GIVEN user B WHEN action2 THEN result2
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data.length).toBeGreaterThan(1);
    });

    it('should parse criteria with code blocks', async () => {
      const markdown = `
## Acceptance Criteria

- [ ] Function returns \`true\` when valid
- [ ] Error \`INVALID_INPUT\` is thrown
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseAcceptanceCriteria(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data.length).toBe(2);
    });
  });

  describe('parseAcceptanceCriteriaFromText', () => {
    it('should parse from text with section marker', () => {
      const text = `
## Acceptance Criteria

- [ ] Criterion 1
- [x] Criterion 2

## Next Section
`;
      const result = parseAcceptanceCriteriaFromText(text);

      expect(result.length).toBe(2);
      expect(result[0]?.completed).toBe(false);
      expect(result[1]?.completed).toBe(true);
    });

    it('should parse Done Criteria section', () => {
      const text = `
## Done Criteria

- [ ] Test passes
- [ ] Code reviewed
`;
      const result = parseAcceptanceCriteriaFromText(text);

      expect(result.length).toBe(2);
    });

    it('should parse without section marker', () => {
      const text = `
- [ ] Criterion A
- [ ] Criterion B
`;
      const result = parseAcceptanceCriteriaFromText(text);

      expect(result.length).toBe(2);
    });

    it('should parse numbered format', () => {
      const text = `
1. First criterion
2. Second criterion
3. Third criterion
`;
      const result = parseAcceptanceCriteriaFromText(text);

      expect(result.length).toBe(3);
    });

    it('should parse GIVEN-WHEN-THEN', () => {
      const text = `
GIVEN user has access
WHEN they perform action
THEN system responds
`;
      const result = parseAcceptanceCriteriaFromText(text);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.scenario).toBeDefined();
    });

    it('should fallback to line-based parsing', () => {
      const text = `
This is a long criterion that should be included.
Another long criterion with enough characters.
Short line.
Yet another criterion with sufficient length.
`;
      const result = parseAcceptanceCriteriaFromText(text);

      expect(result.length).toBeGreaterThan(0);
      // The fallback filters lines with length <= 10, but "Short line." has 11 chars
      // so it will be included. Let's check that long lines are included.
      expect(result.some(c => c.description.includes('long criterion'))).toBe(true);
    });

    it('should deduplicate criteria', () => {
      const text = `
- [ ] Same criterion
- [ ] Same criterion
- [ ] Different criterion
`;
      const result = parseAcceptanceCriteriaFromText(text);

      expect(result.length).toBe(2);
    });
  });

  describe('areAllCriteriaCompleted', () => {
    it('should return true when all completed', () => {
      const criteria = [
        { description: 'A', completed: true },
        { description: 'B', completed: true },
      ];

      expect(areAllCriteriaCompleted(criteria)).toBe(true);
    });

    it('should return false when some incomplete', () => {
      const criteria = [
        { description: 'A', completed: true },
        { description: 'B', completed: false },
      ];

      expect(areAllCriteriaCompleted(criteria)).toBe(false);
    });

    it('should return false when all incomplete', () => {
      const criteria = [
        { description: 'A', completed: false },
        { description: 'B', completed: false },
      ];

      expect(areAllCriteriaCompleted(criteria)).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(areAllCriteriaCompleted([])).toBe(false);
    });

    it('should handle single criterion', () => {
      expect(areAllCriteriaCompleted([{ description: 'A', completed: true }])).toBe(true);
      expect(areAllCriteriaCompleted([{ description: 'A', completed: false }])).toBe(false);
    });
  });

  describe('countCriteria', () => {
    it('should count completed and total', () => {
      const criteria = [
        { description: 'A', completed: true },
        { description: 'B', completed: false },
        { description: 'C', completed: true },
      ];

      const result = countCriteria(criteria);

      expect(result.completed).toBe(2);
      expect(result.total).toBe(3);
    });

    it('should handle all completed', () => {
      const criteria = [
        { description: 'A', completed: true },
        { description: 'B', completed: true },
      ];

      const result = countCriteria(criteria);

      expect(result.completed).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should handle none completed', () => {
      const criteria = [
        { description: 'A', completed: false },
        { description: 'B', completed: false },
      ];

      const result = countCriteria(criteria);

      expect(result.completed).toBe(0);
      expect(result.total).toBe(2);
    });

    it('should handle empty array', () => {
      const result = countCriteria([]);

      expect(result.completed).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe('formatScenario', () => {
    it('should format complete scenario', () => {
      const scenario = {
        given: 'user is logged in',
        when: 'they click button',
        then: 'action occurs',
      };

      const formatted = formatScenario(scenario);

      expect(formatted).toContain('GIVEN user is logged in');
      expect(formatted).toContain('WHEN they click button');
      expect(formatted).toContain('THEN action occurs');
    });

    it('should format partial scenario with only given', () => {
      const scenario = {
        given: 'initial state',
        when: '',
        then: '',
      };

      const formatted = formatScenario(scenario);

      expect(formatted).toContain('GIVEN initial state');
      expect(formatted).not.toContain('WHEN');
      expect(formatted).not.toContain('THEN');
    });

    it('should format partial scenario with given and when', () => {
      const scenario = {
        given: 'initial state',
        when: 'action happens',
        then: '',
      };

      const formatted = formatScenario(scenario);

      expect(formatted).toContain('GIVEN initial state');
      expect(formatted).toContain('WHEN action happens');
      expect(formatted).not.toContain('THEN');
    });

    it('should handle empty scenario', () => {
      const scenario = {
        given: '',
        when: '',
        then: '',
      };

      const formatted = formatScenario(scenario);

      expect(formatted).toBe('');
    });

    it('should separate parts with newlines', () => {
      const scenario = {
        given: 'A',
        when: 'B',
        then: 'C',
      };

      const formatted = formatScenario(scenario);

      expect(formatted.split('\n').length).toBe(3);
    });

    it('should handle scenario with only then', () => {
      const scenario = {
        given: '',
        when: '',
        then: 'expected result',
      };

      const formatted = formatScenario(scenario);

      expect(formatted).toContain('THEN expected result');
      expect(formatted).not.toContain('GIVEN');
      expect(formatted).not.toContain('WHEN');
    });
  });
});
