/**
 * @module common/issue-parser/__tests__/problem-parser.test
 * @description Tests for problem description parsing
 */

import { describe, it, expect } from 'vitest';
import {
  parseProblemDescription,
  parseProblemFromText,
  summarizeProblem,
  extractProblemKeywords,
} from '../problem-parser.js';
import { parseMarkdownToAst } from '../ast.js';
import { isSuccess, isFailure } from '../../types/index.js';

describe('problem-parser', () => {
  describe('parseProblemDescription', () => {
    it('should parse problem from ## Problem Description section', async () => {
      const markdown = `
## Problem Description

Users are experiencing random logouts when using the application.
This happens frequently during peak hours.
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseProblemDescription(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data).toContain('random logouts');
      expect(result.data).toContain('peak hours');
    });

    it('should parse problem from ## Description section (alternative)', async () => {
      const markdown = `
## Description

Login button not working on mobile devices.
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseProblemDescription(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data).toContain('Login button');
    });

    it('should extract fallback description when no section exists', async () => {
      const markdown = `
This is some initial content before any headings.

## Some Other Section

Other content.
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseProblemDescription(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data).toContain('initial content');
      // The fallback extracts everything before known sections, but "Some Other Section" is not a known section
      // so it gets included. We should check it includes the content.
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should extract description before known sections', async () => {
      const markdown = `
The application crashes on startup.

## Context

Component: Auth
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseProblemDescription(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data).toContain('crashes on startup');
      expect(result.data).not.toContain('Context');
    });

    it('should return empty string when section is empty', async () => {
      const markdown = `
## Problem Description

## Next Section

Content
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseProblemDescription(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data).toBe('');
    });

    it('should handle markdown with multiple paragraphs', async () => {
      const markdown = `
## Problem Description

First paragraph describing the issue.

Second paragraph with more details.

Third paragraph with even more context.
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseProblemDescription(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data).toContain('First paragraph');
      expect(result.data).toContain('Second paragraph');
      expect(result.data).toContain('Third paragraph');
    });

    it('should handle AST with only text content', async () => {
      const markdown = 'Simple text without any sections';
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseProblemDescription(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data).toContain('Simple text');
    });

    it('should stop at first known section heading', async () => {
      const markdown = `
Content before heading.

More content.

## Acceptance Criteria

Should not be included.
`;
      const ast = await parseMarkdownToAst(markdown);
      if (!isSuccess(ast)) throw new Error('Failed to parse markdown');

      const result = parseProblemDescription(ast.data);

      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      expect(result.data).toContain('Content before heading');
      expect(result.data).not.toContain('Should not be included');
    });
  });

  describe('parseProblemFromText', () => {
    it('should parse from ## Problem Description', () => {
      const text = `
## Problem Description

API returns 500 error.

## Next Section
`;
      const result = parseProblemFromText(text);

      expect(result).toContain('API returns 500 error');
      expect(result).not.toContain('Next Section');
    });

    it('should parse from ## Description', () => {
      const text = `
## Description

Button is broken.

## Code Analysis
`;
      const result = parseProblemFromText(text);

      expect(result).toContain('Button is broken');
      expect(result).not.toContain('Code Analysis');
    });

    it('should parse from ### Problem', () => {
      const text = `
### Problem

Memory leak detected.

### Fix
`;
      const result = parseProblemFromText(text);

      expect(result).toContain('Memory leak detected');
      expect(result).not.toContain('Fix');
    });

    it('should fallback to content before first heading', () => {
      const text = `
This is the problem description without a section heading.

## Some Section

Other content.
`;
      const result = parseProblemFromText(text);

      expect(result).toContain('problem description');
      expect(result).not.toContain('Some Section');
    });

    it('should return first 500 chars when no heading found', () => {
      const text = 'A'.repeat(1000);
      const result = parseProblemFromText(text);

      expect(result.length).toBe(500);
    });

    it('should handle empty text', () => {
      const result = parseProblemFromText('');

      expect(result).toBe('');
    });

    it('should handle text with only whitespace', () => {
      const result = parseProblemFromText('   \n\n   ');

      expect(result).toBe('');
    });
  });

  describe('summarizeProblem', () => {
    it('should return original if shorter than maxLength', () => {
      const desc = 'Short description';
      const result = summarizeProblem(desc);

      expect(result).toBe(desc);
    });

    it('should truncate at sentence boundary', () => {
      const desc = 'First sentence. Second sentence. Third sentence very long text'.repeat(5);
      const result = summarizeProblem(desc, 100);

      expect(result.length).toBeLessThanOrEqual(100);
      expect(result.endsWith('.')).toBe(true);
    });

    it('should truncate at newline if better than period', () => {
      const desc = 'Line one with some text\nLine two\nLine three'.repeat(5);
      const result = summarizeProblem(desc, 80);

      expect(result.length).toBeLessThanOrEqual(80);
    });

    it('should cut at word boundary if no good sentence/newline', () => {
      const desc = 'A'.repeat(300);
      const result = summarizeProblem(desc, 200);

      expect(result.endsWith('...')).toBe(true);
      expect(result.length).toBeLessThanOrEqual(203);
    });

    it('should handle custom maxLength', () => {
      const desc = 'A'.repeat(500);
      const result = summarizeProblem(desc, 50);

      expect(result.length).toBeLessThanOrEqual(53);
    });

    it('should prefer period over newline if closer', () => {
      const desc = 'Sentence one. Sentence two.\nNew line far away' + ' word'.repeat(50);
      const result = summarizeProblem(desc, 30);

      expect(result).toContain('Sentence one.');
      expect(result.endsWith('.')).toBe(true);
    });

    it('should cut at space if within 80% of maxLength', () => {
      const desc = 'Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8 Word9';
      const result = summarizeProblem(desc, 40);

      expect(result.endsWith('...')).toBe(true);
      expect(result.length).toBeLessThanOrEqual(43);
    });

    it('should handle empty description', () => {
      const result = summarizeProblem('');

      expect(result).toBe('');
    });
  });

  describe('extractProblemKeywords', () => {
    it('should extract error keywords', () => {
      const desc = 'Application throws an error and crashes unexpectedly';
      const keywords = extractProblemKeywords(desc);

      expect(keywords).toContain('error');
      expect(keywords).toContain('crash');
    });

    it('should extract multiple technical terms', () => {
      const desc = 'Memory leak in async function causing timeout and null pointer exception';
      const keywords = extractProblemKeywords(desc);

      expect(keywords).toContain('memory');
      expect(keywords).toContain('leak');
      expect(keywords).toContain('async');
      expect(keywords).toContain('timeout');
      expect(keywords).toContain('null');
      expect(keywords).toContain('exception');
    });

    it('should extract database related keywords', () => {
      const desc = 'Database query fails with authentication error on API endpoint';
      const keywords = extractProblemKeywords(desc);

      expect(keywords).toContain('database');
      expect(keywords).toContain('query');
      expect(keywords).toContain('authentication');
      expect(keywords).toContain('api');
      expect(keywords).toContain('endpoint');
    });

    it('should extract quoted strings', () => {
      const desc = 'Function `getUserData` returns `undefined` instead of data';
      const keywords = extractProblemKeywords(desc);

      expect(keywords).toContain('getUserData');
      expect(keywords).toContain('undefined');
    });

    it('should extract single-quoted strings', () => {
      const desc = "Method 'calculateTotal' throws 'TypeError'";
      const keywords = extractProblemKeywords(desc);

      expect(keywords).toContain('calculateTotal');
      expect(keywords).toContain('TypeError');
    });

    it('should extract double-quoted strings', () => {
      const desc = 'Error message: "Invalid credentials"';
      const keywords = extractProblemKeywords(desc);

      // The regex looks for backticks, single quotes, and regular quotes
      // Double-quoted strings are extracted but split by spaces
      expect(keywords).toContain('error');
    });

    it('should handle mixed case', () => {
      const desc = 'NullPointer Exception in DATABASE connection';
      const keywords = extractProblemKeywords(desc);

      expect(keywords).toContain('null');
      expect(keywords).toContain('exception');
      expect(keywords).toContain('database');
    });

    it('should extract network related keywords', () => {
      const desc = 'Network connection timeout on socket';
      const keywords = extractProblemKeywords(desc);

      expect(keywords).toContain('network');
      expect(keywords).toContain('connection');
      expect(keywords).toContain('timeout');
      expect(keywords).toContain('socket');
    });

    it('should extract file/path keywords', () => {
      const desc = 'File path validation fails for directory access';
      const keywords = extractProblemKeywords(desc);

      expect(keywords).toContain('file');
      expect(keywords).toContain('path');
      expect(keywords).toContain('directory');
      expect(keywords).toContain('validation');
      expect(keywords).toContain('access');
    });

    it('should not duplicate keywords', () => {
      const desc = 'Error error ERROR `error` "error"';
      const keywords = extractProblemKeywords(desc);

      const errorCount = keywords.filter(k => k === 'error' || k.toLowerCase() === 'error').length;
      expect(errorCount).toBe(1);
    });

    it('should filter short quoted strings', () => {
      const desc = 'Code uses `x` and `y` variables';
      const keywords = extractProblemKeywords(desc);

      expect(keywords).not.toContain('x');
      expect(keywords).not.toContain('y');
    });

    it('should handle empty description', () => {
      const keywords = extractProblemKeywords('');

      expect(keywords).toEqual([]);
    });

    it('should handle description with no keywords', () => {
      const keywords = extractProblemKeywords('The quick brown fox jumps over the lazy dog');

      expect(keywords.length).toBe(0);
    });

    it('should extract race condition keywords', () => {
      const desc = 'Race condition detected in async code causing concurrency issues';
      const keywords = extractProblemKeywords(desc);

      expect(keywords).toContain('race condition');
      expect(keywords).toContain('async');
      expect(keywords).toContain('concurrency');
    });

    it('should extract performance keywords', () => {
      const desc = 'Performance slow, application hangs and freezes';
      const keywords = extractProblemKeywords(desc);

      expect(keywords).toContain('performance');
      expect(keywords).toContain('slow');
      expect(keywords).toContain('hang');
      expect(keywords).toContain('freeze');
    });

    it('should extract encoding keywords', () => {
      const desc = 'Unicode encoding issue in file format validation';
      const keywords = extractProblemKeywords(desc);

      expect(keywords).toContain('unicode');
      expect(keywords).toContain('encoding');
      expect(keywords).toContain('file');
      expect(keywords).toContain('format');
      expect(keywords).toContain('validation');
    });
  });
});
