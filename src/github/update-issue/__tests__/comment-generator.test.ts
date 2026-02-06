/**
 * @module github/update-issue/__tests__/comment-generator.test
 * @description Tests for comment generator functions
 */

import { describe, it, expect } from 'vitest';
import {
  generateProgressComment,
  generateNeedsInfoComment,
  type NeedsInfoCommentOptions,
  type NeedsInfoAnalysisResult,
} from '../comment-generator.js';

describe('generateProgressComment', () => {
  it('should include status and timestamp', () => {
    const comment = generateProgressComment('Analysis complete');

    expect(comment).toContain('Auto-Fix Workflow Update');
    expect(comment).toContain('Analysis complete');
    expect(comment).toContain('Time:');
  });

  it('should include details when provided', () => {
    const comment = generateProgressComment('Done', { filesAnalyzed: 5, issuesFound: 2 });

    expect(comment).toContain('Details');
    expect(comment).toContain('Files Analyzed');
    expect(comment).toContain('5');
  });

  it('should handle empty details', () => {
    const comment = generateProgressComment('Status', {});

    expect(comment).not.toContain('Details');
  });
});

describe('generateNeedsInfoComment', () => {
  const baseOptions: NeedsInfoCommentOptions = {
    analysisResult: 'needs-more-info',
    suggestions: ['Add more details', 'Include file paths'],
    confidenceLevel: 'low',
    confidenceScore: 35,
    breakdown: {
      clarity: 8,
      technicalDetail: 5,
      scopeDefinition: 12,
      acceptanceCriteria: 10,
    },
  };

  it('should include header', () => {
    const comment = generateNeedsInfoComment(baseOptions);

    expect(comment).toContain('Additional Information Needed');
  });

  it('should show analysis result label', () => {
    const comment = generateNeedsInfoComment(baseOptions);

    expect(comment).toContain('More information required');
  });

  it('should show confidence info', () => {
    const comment = generateNeedsInfoComment(baseOptions);

    expect(comment).toContain('low');
    expect(comment).toContain('35/100');
  });

  it('should include breakdown table', () => {
    const comment = generateNeedsInfoComment(baseOptions);

    expect(comment).toContain('Confidence Breakdown');
    expect(comment).toContain('Clarity');
    expect(comment).toContain('8/25');
    expect(comment).toContain('Technical Detail');
    expect(comment).toContain('5/25');
    expect(comment).toContain('Scope Definition');
    expect(comment).toContain('12/25');
    expect(comment).toContain('Acceptance Criteria');
    expect(comment).toContain('10/25');
  });

  it('should include suggestions as checklist', () => {
    const comment = generateNeedsInfoComment(baseOptions);

    expect(comment).toContain('Action Items');
    expect(comment).toContain('- [ ] Add more details');
    expect(comment).toContain('- [ ] Include file paths');
  });

  it('should include reprocessing instruction', () => {
    const comment = generateNeedsInfoComment(baseOptions);

    expect(comment).toContain('needs-info');
    expect(comment).toContain('reprocessing');
  });

  it('should handle empty suggestions', () => {
    const options: NeedsInfoCommentOptions = {
      ...baseOptions,
      suggestions: [],
    };

    const comment = generateNeedsInfoComment(options);

    expect(comment).not.toContain('Action Items');
  });

  it.each([
    ['needs-more-info', 'More information required'],
    ['cannot-reproduce', 'Cannot reproduce the issue'],
    ['unclear-requirement', 'Requirements are unclear'],
    ['needs-context', 'Additional context needed'],
  ] as const)('should show correct label for %s', (result, expectedLabel) => {
    const options: NeedsInfoCommentOptions = {
      ...baseOptions,
      analysisResult: result as NeedsInfoAnalysisResult,
    };

    const comment = generateNeedsInfoComment(options);
    expect(comment).toContain(expectedLabel);
  });

  it('should show status icons based on scores', () => {
    const highScoreOptions: NeedsInfoCommentOptions = {
      ...baseOptions,
      breakdown: {
        clarity: 20,
        technicalDetail: 18,
        scopeDefinition: 22,
        acceptanceCriteria: 20,
      },
    };

    const comment = generateNeedsInfoComment(highScoreOptions);

    expect(comment).toContain('OK');
  });

  it('should show insufficient for very low scores', () => {
    const lowScoreOptions: NeedsInfoCommentOptions = {
      ...baseOptions,
      breakdown: {
        clarity: 2,
        technicalDetail: 3,
        scopeDefinition: 1,
        acceptanceCriteria: 2,
      },
    };

    const comment = generateNeedsInfoComment(lowScoreOptions);

    expect(comment).toContain('Insufficient');
  });
});
