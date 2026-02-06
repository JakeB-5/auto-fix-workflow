/**
 * @module __tests__/helpers/assertions
 * @description Custom assertion helpers for common test patterns
 */

import { expect } from 'vitest';
import type { Issue, WorktreeInfo, PullRequest } from '../../common/types/index.js';

/**
 * Asserts that an issue has the expected structure
 */
export function assertValidIssue(issue: any) {
  expect(issue).toHaveProperty('number');
  expect(issue).toHaveProperty('title');
  expect(issue).toHaveProperty('state');
  expect(issue).toHaveProperty('labels');
  expect(typeof issue.number).toBe('number');
  expect(typeof issue.title).toBe('string');
}

/**
 * Asserts that a worktree has the expected structure
 */
export function assertValidWorktree(worktree: any) {
  expect(worktree).toHaveProperty('path');
  expect(worktree).toHaveProperty('branch');
  expect(worktree).toHaveProperty('status');
  expect(typeof worktree.path).toBe('string');
  expect(typeof worktree.branch).toBe('string');
  expect(['ready', 'busy', 'error']).toContain(worktree.status);
}

/**
 * Asserts that a pull request has the expected structure
 */
export function assertValidPullRequest(pr: any) {
  expect(pr).toHaveProperty('number');
  expect(pr).toHaveProperty('title');
  expect(pr).toHaveProperty('headBranch');
  expect(pr).toHaveProperty('baseBranch');
  expect(typeof pr.number).toBe('number');
  expect(Array.isArray(pr.linkedIssues)).toBe(true);
}

/**
 * Asserts that a Result type is successful
 */
export function assertSuccess<T>(result: any): asserts result is { success: true; data: T } {
  expect(result).toHaveProperty('success', true);
  expect(result).toHaveProperty('data');
}

/**
 * Asserts that a Result type is a failure
 */
export function assertFailure(result: any): asserts result is { success: false; error: any } {
  expect(result).toHaveProperty('success', false);
  expect(result).toHaveProperty('error');
}

/**
 * Asserts that an error matches expected structure
 */
export function assertErrorWithCode(error: any, expectedCode: string) {
  expect(error).toHaveProperty('code', expectedCode);
  expect(error).toHaveProperty('message');
}

/**
 * Asserts that labels contain expected values
 */
export function assertLabelsContain(labels: string[], expected: string[]) {
  expected.forEach((label) => {
    expect(labels).toContain(label);
  });
}

/**
 * Asserts that an API mock was called with expected parameters
 */
export function assertMockCalledWithParams(
  mockFn: any,
  expectedParams: any,
  callIndex = 0
) {
  expect(mockFn).toHaveBeenCalled();
  const call = mockFn.mock.calls[callIndex];
  expect(call).toBeDefined();

  if (typeof expectedParams === 'object' && !Array.isArray(expectedParams)) {
    Object.entries(expectedParams).forEach(([key, value]) => {
      expect(call).toEqual(expect.arrayContaining([
        expect.objectContaining({ [key]: value })
      ]));
    });
  }
}
