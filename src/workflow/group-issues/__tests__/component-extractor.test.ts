/**
 * @module workflow/group-issues/__tests__/component-extractor.test
 * @description Component extractor 테스트
 */

import { describe, it, expect } from 'vitest';
import { extractComponent } from '../component-extractor.js';
import type { Issue } from '../../../common/types/index.js';

describe('extractComponent', () => {
  const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
    number: 1,
    title: 'Test Issue',
    body: '',
    state: 'open',
    type: 'bug',
    labels: [],
    assignees: [],
    context: {
      component: '',
      priority: 'medium',
      relatedFiles: [],
      relatedSymbols: [],
      source: 'github',
    },
    acceptanceCriteria: [],
    relatedIssues: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    url: 'https://github.com/owner/repo/issues/1',
    ...overrides,
  });

  it('should extract component from context.component', () => {
    const issue = createMockIssue({
      context: {
        component: 'Button',
        priority: 'high',
        relatedFiles: [],
        relatedSymbols: [],
        source: 'github',
      },
    });

    expect(extractComponent(issue)).toBe('Button');
  });

  it('should extract component from labels (component: prefix)', () => {
    const issue = createMockIssue({
      labels: ['bug', 'component:button'],
    });

    expect(extractComponent(issue)).toBe('Button');
  });

  it('should extract component from labels (area: prefix)', () => {
    const issue = createMockIssue({
      labels: ['area:authentication'],
    });

    expect(extractComponent(issue)).toBe('Authentication');
  });

  it('should extract component from codeAnalysis.filePath', () => {
    const issue = createMockIssue({
      codeAnalysis: {
        filePath: 'src/components/Header/Header.tsx',
      },
    });

    expect(extractComponent(issue)).toBe('Header');
  });

  it('should extract component from relatedFiles', () => {
    const issue = createMockIssue({
      context: {
        component: '',
        priority: 'medium',
        relatedFiles: ['src/features/Auth/Login.tsx'],
        relatedSymbols: [],
        source: 'github',
      },
    });

    expect(extractComponent(issue)).toBe('Auth');
  });

  it('should extract "utils" from utils directory', () => {
    const issue = createMockIssue({
      codeAnalysis: {
        filePath: 'src/utils/validation.ts',
      },
    });

    expect(extractComponent(issue)).toBe('utils');
  });

  it('should extract component from body (Component: format)', () => {
    const issue = createMockIssue({
      body: 'Component: Sidebar\n\nSome description',
    });

    expect(extractComponent(issue)).toBe('Sidebar');
  });

  it('should extract component from body (## Component section)', () => {
    const issue = createMockIssue({
      body: '## Component\nNavigation\n\n## Description\nSome text',
    });

    expect(extractComponent(issue)).toBe('Navigation');
  });

  it('should return null when no component found', () => {
    const issue = createMockIssue({
      body: 'Just some text',
    });

    expect(extractComponent(issue)).toBeNull();
  });

  it('should prioritize context.component over labels', () => {
    const issue = createMockIssue({
      context: {
        component: 'ExplicitComponent',
        priority: 'high',
        relatedFiles: [],
        relatedSymbols: [],
        source: 'github',
      },
      labels: ['component:other'],
    });

    expect(extractComponent(issue)).toBe('ExplicitComponent');
  });

  it('should capitalize component name', () => {
    const issue = createMockIssue({
      labels: ['component:button'],
    });

    expect(extractComponent(issue)).toBe('Button');
  });
});
