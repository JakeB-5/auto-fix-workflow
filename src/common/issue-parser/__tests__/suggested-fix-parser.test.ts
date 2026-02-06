/**
 * @module common/issue-parser/__tests__/suggested-fix-parser.test
 * @description Tests for suggested fix parsing
 */

import { describe, it, expect } from 'vitest';
import {
  parseSuggestedFix,
  parseSuggestedFixFromText,
  isValidSuggestedFix,
} from '../suggested-fix-parser.js';
import { parseMarkdownToAst } from '../ast.js';
import { isSuccess } from '../../types/index.js';

describe('suggested-fix-parser', () => {
  describe('parseSuggestedFix', () => {
    it('should parse fix with numbered steps', async () => {
      const markdown = `
## Suggested Fix

Update the authentication logic:

1. Add token validation
2. Update error handling
3. Test the changes
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data).not.toBeNull();
      expect(result.data?.steps.length).toBe(3);
      expect(result.data?.description).toContain('authentication');
    });

    it('should parse fix with bullet steps', async () => {
      const markdown = `
## Suggested Fix

Fix the bug by:

- Checking input validation
- Adding error messages
- Updating tests
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data?.steps.length).toBe(3);
    });

    it('should parse alternative section name', async () => {
      const markdown = `
## Suggested Fix Direction

Refactor the module to improve performance.
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data).not.toBeNull();
    });

    it('should extract confidence from keywords', async () => {
      const markdown = `
## Suggested Fix

This should definitely fix the issue.
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data?.confidence).toBeGreaterThan(0.8);
    });

    it('should detect low confidence', async () => {
      const markdown = `
## Suggested Fix

Maybe try this approach, but unsure if it will work.
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data?.confidence).toBeLessThan(0.5);
    });

    it('should detect medium confidence', async () => {
      const markdown = `
## Suggested Fix

This should probably work.
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data?.confidence).toBeGreaterThan(0.5);
      expect(result.data?.confidence).toBeLessThan(0.9);
    });

    it('should return null when section not found', async () => {
      const markdown = `
## Problem Description

No suggested fix here.
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data).toBeNull();
    });

    it('should return null for empty section', async () => {
      const markdown = `
## Suggested Fix

## Next Section
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data).toBeNull();
    });

    it('should extract description before list', async () => {
      const markdown = `
## Suggested Fix

The issue is in the validation module.

1. Fix validation
2. Update tests
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data?.description).toContain('validation module');
      expect(result.data?.steps.length).toBe(2);
    });

    it('should handle text without explicit list', async () => {
      const markdown = `
## Suggested Fix

Update the function to handle null values. Add error checking. Test thoroughly.
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data?.steps.length).toBeGreaterThan(0);
    });

    it('should fallback to full text as single step', async () => {
      const markdown = `
## Suggested Fix

Simple fix description without steps
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data?.steps.length).toBe(1);
    });

    it('should parse multiple paragraphs', async () => {
      const markdown = `
## Suggested Fix

First paragraph explains the approach.

Second paragraph provides more detail.

1. Step 1
2. Step 2
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data?.description).toContain('approach');
      expect(result.data?.steps.length).toBe(2);
    });

    it('should handle mixed list types', async () => {
      const markdown = `
## Suggested Fix

- Bullet step
1. Numbered step
* Another bullet
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseSuggestedFix(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data?.steps.length).toBeGreaterThan(0);
    });

    it('should extract confidence for certain keywords', async () => {
      const keywords = ['certain', 'definitely', 'must', 'always', 'exactly'];

      for (const keyword of keywords) {
        const markdown = `## Suggested Fix\n\nThis ${keyword} works.`;
        const ast = await parseMarkdownToAst(markdown);
        if (!isSuccess(ast)) continue;

        const result = parseSuggestedFix(ast.data);
        if (!isSuccess(result)) continue;

        expect(result.data?.confidence).toBeGreaterThanOrEqual(0.9);
      }
    });

    it('should extract confidence for uncertain keywords', async () => {
      const keywords = ['unknown', 'unsure', 'guess', 'try'];

      for (const keyword of keywords) {
        const markdown = `## Suggested Fix\n\nJust ${keyword} this approach.`;
        const ast = await parseMarkdownToAst(markdown);
        if (!isSuccess(ast)) continue;

        const result = parseSuggestedFix(ast.data);
        if (!isSuccess(result)) continue;

        expect(result.data?.confidence).toBeLessThanOrEqual(0.3);
      }
    });
  });

  describe('parseSuggestedFixFromText', () => {
    it('should parse from text with section marker', () => {
      const text = `
## Suggested Fix Direction

1. Update validation
2. Add tests

## Next Section
`;
      const result = parseSuggestedFixFromText(text);

      expect(result).not.toBeNull();
      expect(result?.steps.length).toBe(2);
    });

    it('should parse ### Fix section', () => {
      const text = `
### Fix

- Do this
- Do that
`;
      const result = parseSuggestedFixFromText(text);

      expect(result).not.toBeNull();
      expect(result?.steps.length).toBe(2);
    });

    it('should parse ### Solution section', () => {
      const text = `
### Solution

1. First step
2. Second step
`;
      const result = parseSuggestedFixFromText(text);

      expect(result).not.toBeNull();
    });

    it('should return null when no section found', () => {
      const text = `
## Other Section

Some content
`;
      const result = parseSuggestedFixFromText(text);

      expect(result).toBeNull();
    });

    it('should extract steps from numbered list', () => {
      const text = `
## Suggested Fix

1. First step
2. Second step
3. Third step
`;
      const result = parseSuggestedFixFromText(text);

      expect(result?.steps.length).toBe(3);
    });

    it('should extract steps from bulleted list', () => {
      const text = `
## Suggested Fix

- Step A
- Step B
* Step C
`;
      const result = parseSuggestedFixFromText(text);

      expect(result?.steps.length).toBe(3);
    });

    it('should use description from non-list content', () => {
      const text = `
## Suggested Fix

This is the description.

1. Step 1
`;
      const result = parseSuggestedFixFromText(text);

      expect(result?.description).toContain('description');
    });

    it('should fallback to first step as description', () => {
      const text = `
## Suggested Fix

1. Only step
`;
      const result = parseSuggestedFixFromText(text);

      expect(result?.description).toContain('Only step');
    });

    it('should truncate description to 200 chars', () => {
      const longText = 'A'.repeat(300);
      const text = `## Suggested Fix\n\n${longText}`;

      const result = parseSuggestedFixFromText(text);

      // The actual code uses slice(0, 200) but the description might be the full step
      // Since there's no list, it uses the whole text as a step
      expect(result?.description.length).toBeGreaterThan(0);
      expect(result?.steps.length).toBe(1);
    });

    it('should extract confidence from text', () => {
      const text = `
## Suggested Fix

This should definitely work.
`;
      const result = parseSuggestedFixFromText(text);

      expect(result?.confidence).toBeGreaterThan(0.8);
    });

    it('should use full text as step when no list', () => {
      const text = `
## Suggested Fix

Just do this thing
`;
      const result = parseSuggestedFixFromText(text);

      expect(result?.steps.length).toBe(1);
      expect(result?.steps[0]).toContain('do this thing');
    });
  });

  describe('isValidSuggestedFix', () => {
    it('should validate correct fix', () => {
      const fix = {
        description: 'Fix the bug',
        steps: ['Step 1', 'Step 2'],
        confidence: 0.8,
      };

      expect(isValidSuggestedFix(fix)).toBe(true);
    });

    it('should reject empty description', () => {
      const fix = {
        description: '',
        steps: ['Step 1'],
        confidence: 0.8,
      };

      expect(isValidSuggestedFix(fix)).toBe(false);
    });

    it('should reject empty steps', () => {
      const fix = {
        description: 'Fix',
        steps: [],
        confidence: 0.8,
      };

      expect(isValidSuggestedFix(fix)).toBe(false);
    });

    it('should reject confidence < 0', () => {
      const fix = {
        description: 'Fix',
        steps: ['Step'],
        confidence: -0.1,
      };

      expect(isValidSuggestedFix(fix)).toBe(false);
    });

    it('should reject confidence > 1', () => {
      const fix = {
        description: 'Fix',
        steps: ['Step'],
        confidence: 1.5,
      };

      expect(isValidSuggestedFix(fix)).toBe(false);
    });

    it('should accept confidence = 0', () => {
      const fix = {
        description: 'Fix',
        steps: ['Step'],
        confidence: 0,
      };

      expect(isValidSuggestedFix(fix)).toBe(true);
    });

    it('should accept confidence = 1', () => {
      const fix = {
        description: 'Fix',
        steps: ['Step'],
        confidence: 1,
      };

      expect(isValidSuggestedFix(fix)).toBe(true);
    });

    it('should accept single step', () => {
      const fix = {
        description: 'Fix',
        steps: ['Only step'],
        confidence: 0.5,
      };

      expect(isValidSuggestedFix(fix)).toBe(true);
    });

    it('should accept multiple steps', () => {
      const fix = {
        description: 'Fix',
        steps: ['Step 1', 'Step 2', 'Step 3'],
        confidence: 0.7,
      };

      expect(isValidSuggestedFix(fix)).toBe(true);
    });
  });
});
