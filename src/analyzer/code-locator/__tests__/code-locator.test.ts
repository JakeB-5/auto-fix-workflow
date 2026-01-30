/**
 * @module analyzer/code-locator/__tests__/code-locator
 * @description Unit tests for code locator module
 */

import { describe, it, expect } from 'vitest';
import { parseStackTrace } from '../stacktrace-parser.js';
import { identifyComponent, inferLabels } from '../component-identifier.js';
import { LocatorErrorCode } from '../types.js';

describe('stacktrace-parser', () => {
  describe('parseStackTrace', () => {
    it('should parse Node.js stack trace', () => {
      const stackTrace = `
Error: Something went wrong
    at processUser (/app/src/user/processor.ts:42:15)
    at validateInput (/app/src/validation/validator.ts:120:10)
    at main (/app/src/index.ts:5:3)
      `.trim();

      const frames = parseStackTrace(stackTrace);

      expect(frames).toHaveLength(3);
      expect(frames[0]).toMatchObject({
        functionName: 'processUser',
        filePath: '/app/src/user/processor.ts',
        lineNumber: 42,
        columnNumber: 15,
      });
      expect(frames[1]).toMatchObject({
        functionName: 'validateInput',
        filePath: '/app/src/validation/validator.ts',
        lineNumber: 120,
      });
    });

    it('should parse Python stack trace', () => {
      const stackTrace = `
Traceback (most recent call last):
  File "app/main.py", line 10, in <module>
    process_data()
  File "app/processor.py", line 25, in process_data
    validate()
      `.trim();

      const frames = parseStackTrace(stackTrace);

      expect(frames.length).toBeGreaterThan(0);
      expect(frames[0]).toMatchObject({
        filePath: 'app/main.py',
        lineNumber: 10,
      });
    });

    it('should parse Java stack trace', () => {
      const stackTrace = `
java.lang.NullPointerException
    at com.example.UserService.getUser(UserService.java:42)
    at com.example.Controller.handleRequest(Controller.java:15)
      `.trim();

      const frames = parseStackTrace(stackTrace);

      expect(frames.length).toBeGreaterThan(0);
      expect(frames[0]).toMatchObject({
        filePath: 'UserService.java',
        lineNumber: 42,
        functionName: 'getUser',
      });
    });

    it('should handle empty stack trace', () => {
      const frames = parseStackTrace('');
      expect(frames).toEqual([]);
    });

    it('should handle malformed stack trace', () => {
      const frames = parseStackTrace('This is not a stack trace');
      expect(frames).toEqual([]);
    });
  });
});

describe('component-identifier', () => {
  describe('identifyComponent', () => {
    it('should identify component from path with src', () => {
      const component = identifyComponent('/project/src/user/service.ts');
      expect(component).toBe('user');
    });

    it('should identify component from path with lib', () => {
      const component = identifyComponent('/project/lib/auth/validator.ts');
      expect(component).toBe('auth');
    });

    it('should handle path without src/lib', () => {
      const component = identifyComponent('/project/components/Button.tsx');
      expect(component).toBe('components');
    });

    it('should handle single-level path', () => {
      const component = identifyComponent('file.ts');
      expect(component).toBe('unknown');
    });
  });

  describe('inferLabels', () => {
    it('should infer labels from UI components', () => {
      const labels = inferLabels(['ui', 'components']);
      expect(labels).toContain('frontend');
      expect(labels).toContain('ui');
    });

    it('should infer labels from API components', () => {
      const labels = inferLabels(['api', 'controllers']);
      expect(labels).toContain('backend');
      expect(labels).toContain('api');
    });

    it('should infer labels from database components', () => {
      const labels = inferLabels(['database', 'models']);
      expect(labels).toContain('database');
      expect(labels).toContain('backend');
    });

    it('should handle unknown components', () => {
      const labels = inferLabels(['custom-module']);
      expect(labels).toContain('custom-module');
    });

    it('should deduplicate labels', () => {
      const labels = inferLabels(['api', 'controllers', 'routes']);
      const uniqueLabels = new Set(labels);
      expect(labels.length).toBe(uniqueLabels.size);
    });
  });
});

describe('LocatorErrorCode', () => {
  it('should have all error codes defined', () => {
    expect(LocatorErrorCode.INVALID_HINT).toBe('INVALID_HINT');
    expect(LocatorErrorCode.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
    expect(LocatorErrorCode.PARSE_ERROR).toBe('PARSE_ERROR');
    expect(LocatorErrorCode.SEARCH_FAILED).toBe('SEARCH_FAILED');
    expect(LocatorErrorCode.NO_RESULTS).toBe('NO_RESULTS');
  });
});
