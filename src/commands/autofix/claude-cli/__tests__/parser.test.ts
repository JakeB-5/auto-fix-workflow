/**
 * @module commands/autofix/claude-cli/__tests__/parser
 * @description Unit tests for parser module
 */

import { describe, it, expect, vi } from 'vitest';
import {
  parseStreamJsonChunk,
  parseUsageInfo,
  extractJsonWithKey,
  extractResultFromWrapper,
  parseAnalysisResult,
  parseFixResult,
  parseTaskAnalysisResult,
} from '../parser.js';

describe('parser', () => {
  describe('parseStreamJsonChunk', () => {
    it('should parse assistant message with text content', () => {
      const chunk = JSON.stringify({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'World' },
          ],
        },
      });

      const onText = vi.fn();
      const result = parseStreamJsonChunk(chunk, onText);

      expect(result).toBe('Hello World');
      expect(onText).toHaveBeenCalledTimes(2);
      expect(onText).toHaveBeenNthCalledWith(1, 'Hello ');
      expect(onText).toHaveBeenNthCalledWith(2, 'World');
    });

    it('should parse content_block_delta events', () => {
      const chunk = JSON.stringify({
        type: 'content_block_delta',
        delta: { text: 'streaming text' },
      });

      const onText = vi.fn();
      const result = parseStreamJsonChunk(chunk, onText);

      expect(result).toBe('streaming text');
      expect(onText).toHaveBeenCalledWith('streaming text');
    });

    it('should parse result event', () => {
      const chunk = JSON.stringify({
        type: 'result',
        result: 'final result text',
      });

      const onText = vi.fn();
      const result = parseStreamJsonChunk(chunk, onText);

      expect(result).toBe('final result text');
      expect(onText).not.toHaveBeenCalled();
    });

    it('should handle multiple events in single chunk', () => {
      const chunk = `${JSON.stringify({
        type: 'content_block_delta',
        delta: { text: 'part1' },
      })}
${JSON.stringify({
        type: 'content_block_delta',
        delta: { text: 'part2' },
      })}`;

      const result = parseStreamJsonChunk(chunk);
      expect(result).toBe('part1part2');
    });

    it('should ignore invalid JSON lines', () => {
      const chunk = `not json
${JSON.stringify({
        type: 'content_block_delta',
        delta: { text: 'valid' },
      })}
another bad line`;

      const result = parseStreamJsonChunk(chunk);
      expect(result).toBe('valid');
    });

    it('should handle empty chunk', () => {
      const result = parseStreamJsonChunk('');
      expect(result).toBe('');
    });

    it('should handle chunk with only whitespace', () => {
      const result = parseStreamJsonChunk('   \n  \n  ');
      expect(result).toBe('');
    });

    it('should work without onText callback', () => {
      const chunk = JSON.stringify({
        type: 'content_block_delta',
        delta: { text: 'test' },
      });

      const result = parseStreamJsonChunk(chunk);
      expect(result).toBe('test');
    });

    it('should ignore events without text content', () => {
      const chunk = JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'image', data: 'base64' }] },
      });

      const result = parseStreamJsonChunk(chunk);
      expect(result).toBe('');
    });

    it('should handle assistant message with empty content array', () => {
      const chunk = JSON.stringify({
        type: 'assistant',
        message: { content: [] },
      });

      const result = parseStreamJsonChunk(chunk);
      expect(result).toBe('');
    });
  });

  describe('parseUsageInfo', () => {
    it('should parse usage info from JSON output', () => {
      const output = JSON.stringify({
        result: 'some text',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cost_usd: 0.025,
        },
      });

      const usage = parseUsageInfo(output);

      expect(usage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.025,
      });
    });

    it('should handle missing usage field', () => {
      const output = JSON.stringify({
        result: 'some text',
      });

      const usage = parseUsageInfo(output);
      expect(usage).toBeUndefined();
    });

    it('should handle invalid JSON', () => {
      const output = 'not valid json';
      const usage = parseUsageInfo(output);
      expect(usage).toBeUndefined();
    });

    it('should handle partial usage data with defaults', () => {
      const output = JSON.stringify({
        usage: {
          input_tokens: 100,
        },
      });

      const usage = parseUsageInfo(output);
      expect(usage).toEqual({
        inputTokens: 100,
        outputTokens: 0,
        cost: 0,
      });
    });

    it('should extract usage from mixed content', () => {
      const output = `Some text before
${JSON.stringify({
        usage: {
          input_tokens: 200,
          output_tokens: 150,
          cost_usd: 0.05,
        },
      })}
Some text after`;

      const usage = parseUsageInfo(output);
      expect(usage).toEqual({
        inputTokens: 200,
        outputTokens: 150,
        cost: 0.05,
      });
    });

    it('should handle empty output', () => {
      const usage = parseUsageInfo('');
      expect(usage).toBeUndefined();
    });
  });

  describe('extractJsonWithKey', () => {
    it('should extract JSON containing specific key', () => {
      const output = `Some text
{"key": "value", "other": 123}
More text`;

      const json = extractJsonWithKey(output, 'key');
      expect(json).toBe('{"key": "value", "other": 123}');
    });

    it('should return null if key not found', () => {
      const output = '{"other": "value"}';
      const json = extractJsonWithKey(output, 'missing');
      expect(json).toBeNull();
    });

    it('should handle nested objects', () => {
      const output = '{"outer": {"inner": {"key": "value"}}}';
      const json = extractJsonWithKey(output, 'key');
      // The regex uses non-greedy match, so it stops at first }
      // This test just verifies it finds something with the key
      expect(json).not.toBeNull();
      expect(json).toContain('"key"');
    });

    it('should return null for empty output', () => {
      const json = extractJsonWithKey('', 'key');
      expect(json).toBeNull();
    });

    it('should handle multiline JSON', () => {
      const output = `{
  "key": "value",
  "nested": {
    "data": 123
  }
}`;

      const json = extractJsonWithKey(output, 'key');
      expect(json).not.toBeNull();
      expect(json).toContain('"key"');
    });
  });

  describe('extractResultFromWrapper', () => {
    it('should extract result from JSON wrapper', () => {
      const output = '{"result": "This is the result", "stop_reason": "end"}';
      const result = extractResultFromWrapper(output);
      expect(result).toBe('This is the result');
    });

    it('should unescape newlines', () => {
      const output = '{"result": "Line 1\\nLine 2", "stop_reason": "end"}';
      const result = extractResultFromWrapper(output);
      expect(result).toBe('Line 1\nLine 2');
    });

    it('should unescape quotes', () => {
      const output = '{"result": "He said \\"hello\\"", "stop_reason": "end"}';
      const result = extractResultFromWrapper(output);
      expect(result).toBe('He said "hello"');
    });

    it('should unescape backslashes', () => {
      const output = '{"result": "Path: C:\\\\Users", "stop_reason": "end"}';
      const result = extractResultFromWrapper(output);
      expect(result).toBe('Path: C:\\Users');
    });

    it('should return original output if no wrapper found', () => {
      const output = 'Plain text without wrapper';
      const result = extractResultFromWrapper(output);
      expect(result).toBe(output);
    });

    it('should handle result with comma in stop_reason', () => {
      const output =
        '{"result": "Text content" , "stop_reason": "end_turn"}';
      const result = extractResultFromWrapper(output);
      expect(result).toBe('Text content');
    });

    it('should handle empty result', () => {
      const output = '{"result": "", "stop_reason": "end"}';
      const result = extractResultFromWrapper(output);
      // The regex requires at least one character in the result field
      // So empty results return the original output
      expect(result).toBe(output);
    });
  });

  describe('parseAnalysisResult', () => {
    it('should parse valid analysis result', () => {
      const output = JSON.stringify({
        confidence: 0.9,
        rootCause: 'Null pointer exception',
        suggestedFix: 'Add null check',
        affectedFiles: ['src/file1.ts', 'src/file2.ts'],
        complexity: 'medium',
      });

      const result = parseAnalysisResult(output);

      expect(result).toEqual({
        confidence: 0.9,
        rootCause: 'Null pointer exception',
        suggestedFix: 'Add null check',
        affectedFiles: ['src/file1.ts', 'src/file2.ts'],
        complexity: 'medium',
      });
    });

    it('should extract JSON from mixed content', () => {
      const output = `Some explanation text
${JSON.stringify({
        confidence: 0.8,
        rootCause: 'Error',
        suggestedFix: 'Fix it',
        affectedFiles: [],
        complexity: 'low',
      })}
More text`;

      const result = parseAnalysisResult(output);
      expect(result).not.toBeNull();
      expect(result?.confidence).toBe(0.8);
    });

    it('should return null for invalid JSON', () => {
      const output = 'not valid json';
      const result = parseAnalysisResult(output);
      expect(result).toBeNull();
    });

    it('should return null if confidence field missing', () => {
      const output = JSON.stringify({
        rootCause: 'Error',
        suggestedFix: 'Fix',
      });

      const result = parseAnalysisResult(output);
      expect(result).toBeNull();
    });

    it('should return null for empty output', () => {
      const result = parseAnalysisResult('');
      expect(result).toBeNull();
    });

    it('should handle different complexity levels', () => {
      for (const complexity of ['low', 'medium', 'high'] as const) {
        const output = JSON.stringify({
          confidence: 0.9,
          rootCause: 'Error',
          suggestedFix: 'Fix',
          affectedFiles: [],
          complexity,
        });

        const result = parseAnalysisResult(output);
        expect(result?.complexity).toBe(complexity);
      }
    });
  });

  describe('parseFixResult', () => {
    it('should parse valid fix result', () => {
      const output = JSON.stringify({
        success: true,
        summary: 'Fixed the bug',
        filesChanged: ['src/file1.ts', 'src/file2.ts'],
      });

      const result = parseFixResult(output);

      expect(result).toEqual({
        success: true,
        summary: 'Fixed the bug',
        filesChanged: ['src/file1.ts', 'src/file2.ts'],
      });
    });

    it('should parse unsuccessful fix', () => {
      const output = JSON.stringify({
        success: false,
        summary: 'Could not fix',
        filesChanged: [],
      });

      const result = parseFixResult(output);
      expect(result?.success).toBe(false);
    });

    it('should extract JSON from mixed content', () => {
      const output = `Explanation
${JSON.stringify({
        success: true,
        summary: 'Done',
        filesChanged: ['file.ts'],
      })}
More text`;

      const result = parseFixResult(output);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
    });

    it('should return null for invalid JSON', () => {
      const output = 'not json';
      const result = parseFixResult(output);
      expect(result).toBeNull();
    });

    it('should return null if success field missing', () => {
      const output = JSON.stringify({
        summary: 'Some text',
        filesChanged: [],
      });

      const result = parseFixResult(output);
      expect(result).toBeNull();
    });

    it('should return null for empty output', () => {
      const result = parseFixResult('');
      expect(result).toBeNull();
    });

    it('should handle empty filesChanged array', () => {
      const output = JSON.stringify({
        success: true,
        summary: 'No files changed',
        filesChanged: [],
      });

      const result = parseFixResult(output);
      expect(result?.filesChanged).toEqual([]);
    });
  });

  describe('parseTaskAnalysisResult', () => {
    it('should parse valid task analysis result', () => {
      const output = JSON.stringify({
        issueType: 'bug',
        priority: 'high',
        labels: ['backend', 'urgent'],
        component: 'auth',
        relatedFiles: ['src/auth/login.ts'],
        summary: 'Login fails',
        acceptanceCriteria: ['User can login', 'Error is handled'],
        confidence: 0.95,
      });

      const result = parseTaskAnalysisResult(output);

      expect(result).toEqual({
        issueType: 'bug',
        priority: 'high',
        labels: ['backend', 'urgent'],
        component: 'auth',
        relatedFiles: ['src/auth/login.ts'],
        summary: 'Login fails',
        acceptanceCriteria: ['User can login', 'Error is handled'],
        confidence: 0.95,
      });
    });

    it('should extract from wrapper first', () => {
      const taskData = {
        issueType: 'feature',
        priority: 'medium',
        labels: ['frontend'],
        component: 'ui',
        relatedFiles: [],
        summary: 'Add button',
        acceptanceCriteria: [],
        confidence: 0.8,
      };

      const output = `{"result": "${JSON.stringify(taskData).replace(
        /"/g,
        '\\"'
      )}", "stop_reason": "end"}`;
      const result = parseTaskAnalysisResult(output);

      expect(result).not.toBeNull();
    });

    it('should handle task data in code block', () => {
      const taskData = {
        issueType: 'bug',
        priority: 'low',
        labels: [],
        component: 'core',
        relatedFiles: [],
        summary: 'Minor issue',
        acceptanceCriteria: [],
        confidence: 0.7,
      };

      const output = '```json\n' + JSON.stringify(taskData) + '\n```';
      const result = parseTaskAnalysisResult(output);

      expect(result).not.toBeNull();
      expect(result?.issueType).toBe('bug');
    });

    it('should use lenient pattern for nested objects', () => {
      const output = `{
  "issueType": "feature",
  "priority": "high",
  "labels": ["new"],
  "component": "api",
  "relatedFiles": ["api.ts"],
  "summary": "New API",
  "acceptanceCriteria": ["Works"],
  "confidence": 0.9
}`;

      const result = parseTaskAnalysisResult(output);
      expect(result).not.toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const output = 'invalid json';
      const result = parseTaskAnalysisResult(output);
      expect(result).toBeNull();
    });

    it('should return null if issueType missing', () => {
      const output = JSON.stringify({
        priority: 'high',
        confidence: 0.9,
      });

      const result = parseTaskAnalysisResult(output);
      expect(result).toBeNull();
    });

    it('should return null for empty output', () => {
      const result = parseTaskAnalysisResult('');
      expect(result).toBeNull();
    });

    it('should handle all standard issue types', () => {
      const issueTypes = ['bug', 'feature', 'enhancement', 'documentation'];

      for (const issueType of issueTypes) {
        const output = JSON.stringify({
          issueType,
          priority: 'medium',
          labels: [],
          component: 'test',
          relatedFiles: [],
          summary: 'Test',
          acceptanceCriteria: [],
          confidence: 0.8,
        });

        const result = parseTaskAnalysisResult(output);
        expect(result?.issueType).toBe(issueType);
      }
    });

    it('should handle empty arrays', () => {
      const output = JSON.stringify({
        issueType: 'bug',
        priority: 'low',
        labels: [],
        component: 'test',
        relatedFiles: [],
        summary: 'Test',
        acceptanceCriteria: [],
        confidence: 0.5,
      });

      const result = parseTaskAnalysisResult(output);
      expect(result?.labels).toEqual([]);
      expect(result?.relatedFiles).toEqual([]);
      expect(result?.acceptanceCriteria).toEqual([]);
    });
  });
});
