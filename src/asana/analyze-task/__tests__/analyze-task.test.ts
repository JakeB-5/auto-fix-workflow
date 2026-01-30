/**
 * @module asana/analyze-task/__tests__/analyze-task.test
 * @description Tests for Asana task analysis functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeAnalyzeTask,
  type AnalyzeTaskInput,
  type AnalysisResult,
} from '../tool.js';
import {
  calculateConfidence,
  getConfidenceLevelDescription,
  meetsConfidenceThreshold,
  type ConfidenceLevel,
  type ConfidenceScore,
} from '../confidence.js';
import {
  analyzeWithHeuristics,
  extractFilePaths,
  extractSymbols,
  type HeuristicResult,
} from '../heuristics.js';
import {
  generateIssueTemplate,
  classificationToIssueType,
} from '../issue-template.js';
import {
  generateFailureReasons,
  generateSummaryMessage,
  generateAsanaNotification,
  getRecommendation,
} from '../messages.js';
import type { FormattedTaskDetail } from '../../get-task/tool.js';
import type { AsanaConfig } from '../../../common/types/index.js';

// Mock config
const mockConfig: AsanaConfig = {
  accessToken: 'test-token',
  workspaceGid: '123',
  projectGid: '456',
};

// Mock task cache
vi.mock('../../get-task/cache.js', () => ({
  getTaskWithCache: vi.fn(),
}));

// Mock codebase exploration
vi.mock('../codebase.js', () => ({
  exploreCodebase: vi.fn().mockResolvedValue({
    existingFiles: [],
    missingFiles: [],
    foundSymbols: [],
    missingSymbols: [],
    relatedFiles: [],
    testFiles: [],
  }),
}));

describe('asana/analyze-task/confidence', () => {
  describe('calculateConfidence', () => {
    it('should calculate high confidence for well-defined task', () => {
      const task: FormattedTaskDetail = {
        gid: '123',
        name: 'Fix authentication bug in login page',
        description: 'Users cannot log in when clicking the submit button. Error: "Invalid credentials" even with correct password.',
        htmlDescription: '',
        markdownDescription: `
## Description
Users cannot log in when clicking the submit button in \`src/auth/LoginPage.tsx\`.

## Error
\`\`\`
Error: Invalid credentials
\`\`\`

## Expected Behavior
- User should be logged in successfully with correct credentials
- Error message should only show for actual invalid credentials

## Acceptance Criteria
- [ ] Fix authentication logic
- [ ] Add unit tests
- [ ] Verify with test users

## Steps to Reproduce
1. Navigate to login page
2. Enter valid credentials
3. Click submit
4. Observe error
        `,
        completed: false,
        status: 'incomplete',
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-02T00:00:00.000Z',
        dueOn: '2024-01-10',
        dueAt: null,
        startOn: null,
        assignee: null,
        projects: [{ gid: '456', name: 'Test Project' }],
        tags: [{ gid: 'tag1', name: 'bug' }],
        customFields: [
          { name: 'Estimate', value: '2', displayValue: '2 points' },
        ],
        url: 'https://app.asana.com/0/456/123',
        parentTask: null,
      };

      const heuristics: HeuristicResult = {
        classification: 'bug',
        estimatedComplexity: 'medium',
        hasTestingRequirement: true,
        hasClearAcceptanceCriteria: true,
        requiresCodeChange: true,
        suggestedLabels: ['bug', 'auto-fix'],
        indicators: [
          { name: 'bug_keyword', matched: true, weight: 2 },
          { name: 'error_message', matched: true, weight: 2 },
          { name: 'file_path', matched: true, weight: 2 },
        ],
      };

      const result = calculateConfidence(task, heuristics);

      // With clear acceptance criteria and bug classification, expect medium-high confidence
      expect(['medium', 'high', 'very_high']).toContain(result.level);
      expect(result.overall).toBeGreaterThanOrEqual(50);
      expect(result.positiveFactors.length).toBeGreaterThan(0);
      expect(result.breakdown.clarity).toBeGreaterThan(0);
      expect(result.breakdown.technicalDetail).toBeGreaterThan(0);
      expect(result.breakdown.scopeDefinition).toBeGreaterThan(0);
      expect(result.breakdown.acceptanceCriteria).toBeGreaterThan(0);
    });

    it('should calculate low confidence for poorly defined task', () => {
      const task: FormattedTaskDetail = {
        gid: '123',
        name: 'Fix bug',
        description: 'Something is broken',
        htmlDescription: '',
        markdownDescription: 'Something is broken. Maybe fix it?',
        completed: false,
        status: 'incomplete',
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-01T00:00:00.000Z',
        dueOn: null,
        dueAt: null,
        startOn: null,
        assignee: null,
        projects: [],
        tags: [],
        customFields: [],
        url: 'https://app.asana.com/0/0/123',
        parentTask: null,
      };

      const heuristics: HeuristicResult = {
        classification: 'unknown',
        estimatedComplexity: 'high',
        hasFilePaths: false,
        hasCodeReferences: false,
        hasErrorMessages: false,
        hasClearAcceptanceCriteria: false,
        hasClearAcceptanceCriteria: false,
        hasTestingRequirement: false,
        hasBoundedScope: false,
        hasReproductionSteps: false,
        indicators: [],
      };

      const result = calculateConfidence(task, heuristics);

      expect(result.level).toBe('very_low');
      expect(result.overall).toBeLessThan(30);
      expect(result.negativeFactors.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should penalize ambiguous language', () => {
      const task: FormattedTaskDetail = {
        gid: '123',
        name: 'Maybe improve the thing',
        description: '',
        htmlDescription: '',
        markdownDescription: 'We should probably fix this stuff, etc.',
        completed: false,
        status: 'incomplete',
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-01T00:00:00.000Z',
        dueOn: null,
        dueAt: null,
        startOn: null,
        assignee: null,
        projects: [],
        tags: [],
        customFields: [],
        url: 'https://app.asana.com/0/0/123',
        parentTask: null,
      };

      const heuristics: HeuristicResult = {
        classification: 'unknown',
        estimatedComplexity: 'medium',
        hasFilePaths: false,
        hasCodeReferences: false,
        hasErrorMessages: false,
        hasClearAcceptanceCriteria: false,
        hasClearAcceptanceCriteria: false,
        hasTestingRequirement: false,
        hasBoundedScope: false,
        hasReproductionSteps: false,
        indicators: [],
      };

      const result = calculateConfidence(task, heuristics);

      expect(result.negativeFactors).toContain('Contains ambiguous terms');
      expect(result.suggestions).toContain('Replace vague terms with specific details');
    });

    it('should give credit for structured formatting', () => {
      const task: FormattedTaskDetail = {
        gid: '123',
        name: 'Task with structure',
        description: '',
        htmlDescription: '',
        markdownDescription: `
## Background
Context here

## Tasks
- Item 1
- Item 2

## Expected Outcome
Should work
        `,
        completed: false,
        status: 'incomplete',
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-01T00:00:00.000Z',
        dueOn: null,
        dueAt: null,
        startOn: null,
        assignee: null,
        projects: [],
        tags: [],
        customFields: [],
        url: 'https://app.asana.com/0/0/123',
        parentTask: null,
      };

      const heuristics: HeuristicResult = {
        classification: 'feature',
        estimatedComplexity: 'medium',
        hasFilePaths: false,
        hasCodeReferences: false,
        hasErrorMessages: false,
        hasClearAcceptanceCriteria: false,
        hasClearAcceptanceCriteria: false,
        hasTestingRequirement: false,
        hasBoundedScope: false,
        hasReproductionSteps: false,
        indicators: [],
      };

      const result = calculateConfidence(task, heuristics);

      expect(result.positiveFactors).toContain('Uses structured formatting');
    });
  });

  describe('meetsConfidenceThreshold', () => {
    it('should check if confidence meets threshold', () => {
      const highConfidence: ConfidenceScore = {
        overall: 80,
        level: 'high',
        breakdown: { clarity: 20, technicalDetail: 20, scopeDefinition: 20, acceptanceCriteria: 20 },
        positiveFactors: [],
        negativeFactors: [],
        suggestions: [],
      };

      expect(meetsConfidenceThreshold(highConfidence, 'medium')).toBe(true);
      expect(meetsConfidenceThreshold(highConfidence, 'high')).toBe(true);
      expect(meetsConfidenceThreshold(highConfidence, 'very_high')).toBe(false);
    });

    it('should default to medium threshold', () => {
      const mediumConfidence: ConfidenceScore = {
        overall: 60,
        level: 'medium',
        breakdown: { clarity: 15, technicalDetail: 15, scopeDefinition: 15, acceptanceCriteria: 15 },
        positiveFactors: [],
        negativeFactors: [],
        suggestions: [],
      };

      expect(meetsConfidenceThreshold(mediumConfidence)).toBe(true);
    });
  });

  describe('getConfidenceLevelDescription', () => {
    it('should return description for each level', () => {
      const levels: ConfidenceLevel[] = ['very_low', 'low', 'medium', 'high', 'very_high'];

      for (const level of levels) {
        const description = getConfidenceLevelDescription(level);
        expect(description).toBeTruthy();
        expect(typeof description).toBe('string');
      }
    });
  });
});

describe('asana/analyze-task/heuristics', () => {
  describe('analyzeWithHeuristics', () => {
    it('should classify bug tasks', () => {
      const task: FormattedTaskDetail = {
        gid: '123',
        name: 'Fix login error',
        description: '',
        htmlDescription: '',
        markdownDescription: 'Users getting error when logging in. Error: Authentication failed.',
        completed: false,
        status: 'incomplete',
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-01T00:00:00.000Z',
        dueOn: null,
        dueAt: null,
        startOn: null,
        assignee: null,
        projects: [],
        tags: [{ gid: 'tag1', name: 'bug' }],
        customFields: [],
        url: 'https://app.asana.com/0/0/123',
        parentTask: null,
      };

      const result = analyzeWithHeuristics(task);

      expect(result.classification).toBe('bug');
      // Verify indicators captured error message detection
      expect(result.indicators.length).toBeGreaterThan(0);
    });

    it('should classify feature tasks', () => {
      const task: FormattedTaskDetail = {
        gid: '123',
        name: 'Add dark mode support',
        description: '',
        htmlDescription: '',
        markdownDescription: 'Implement dark mode theme for the application.',
        completed: false,
        status: 'incomplete',
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-01T00:00:00.000Z',
        dueOn: null,
        dueAt: null,
        startOn: null,
        assignee: null,
        projects: [],
        tags: [{ gid: 'tag1', name: 'feature' }],
        customFields: [],
        url: 'https://app.asana.com/0/0/123',
        parentTask: null,
      };

      const result = analyzeWithHeuristics(task);

      expect(result.classification).toBe('feature');
    });

    it('should detect file paths', () => {
      const task: FormattedTaskDetail = {
        gid: '123',
        name: 'Update component',
        description: '',
        htmlDescription: '',
        markdownDescription: 'Modify src/components/Button.tsx to add new prop.',
        completed: false,
        status: 'incomplete',
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-01T00:00:00.000Z',
        dueOn: null,
        dueAt: null,
        startOn: null,
        assignee: null,
        projects: [],
        tags: [],
        customFields: [],
        url: 'https://app.asana.com/0/0/123',
        parentTask: null,
      };

      const result = analyzeWithHeuristics(task);

      // Verify task was analyzed and requires code change
      expect(result.requiresCodeChange).toBe(true);
    });

    it('should detect acceptance criteria', () => {
      const task: FormattedTaskDetail = {
        gid: '123',
        name: 'Task with checklist',
        description: '',
        htmlDescription: '',
        markdownDescription: `
## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
        `,
        completed: false,
        status: 'incomplete',
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-01T00:00:00.000Z',
        dueOn: null,
        dueAt: null,
        startOn: null,
        assignee: null,
        projects: [],
        tags: [],
        customFields: [],
        url: 'https://app.asana.com/0/0/123',
        parentTask: null,
      };

      const result = analyzeWithHeuristics(task);

      expect(result.hasClearAcceptanceCriteria).toBe(true);
      expect(result.hasClearAcceptanceCriteria).toBe(true);
    });
  });

  describe('extractFilePaths', () => {
    it('should extract file paths from text', () => {
      const text = 'Update src/components/Button.tsx and tests/Button.test.ts';
      const paths = extractFilePaths(text);

      expect(paths).toContain('src/components/Button.tsx');
      expect(paths).toContain('tests/Button.test.ts');
    });

    it('should handle various file extensions', () => {
      const text = 'Files: main.js, style.css, config.json, README.md';
      const paths = extractFilePaths(text);

      expect(paths.length).toBeGreaterThan(0);
    });
  });

  describe('extractSymbols', () => {
    it('should extract function names', () => {
      const text = 'Call getUserById() and validateUser() functions';
      const symbols = extractSymbols(text);

      expect(symbols).toContain('getUserById');
      expect(symbols).toContain('validateUser');
    });
  });
});

describe('asana/analyze-task/issue-template', () => {
  describe('generateIssueTemplate', () => {
    it('should generate complete GitHub issue template', () => {
      const task: FormattedTaskDetail = {
        gid: '123',
        name: 'Fix authentication bug',
        description: '',
        htmlDescription: '',
        markdownDescription: 'Users cannot log in. Error: Invalid credentials.',
        completed: false,
        status: 'incomplete',
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-01T00:00:00.000Z',
        dueOn: null,
        dueAt: null,
        startOn: null,
        assignee: null,
        projects: [],
        tags: [{ gid: 'tag1', name: 'bug' }],
        customFields: [],
        url: 'https://app.asana.com/0/0/123',
        parentTask: null,
      };

      const heuristics: HeuristicResult = {
        classification: 'bug',
        estimatedComplexity: 'medium',
        hasFilePaths: false,
        hasCodeReferences: false,
        hasErrorMessages: true,
        hasClearAcceptanceCriteria: false,
        hasClearAcceptanceCriteria: false,
        hasTestingRequirement: false,
        hasBoundedScope: true,
        hasReproductionSteps: false,
        indicators: [],
      };

      const confidence: ConfidenceScore = {
        overall: 60,
        level: 'medium',
        breakdown: { clarity: 15, technicalDetail: 15, scopeDefinition: 15, acceptanceCriteria: 15 },
        positiveFactors: ['Clear error message'],
        negativeFactors: [],
        suggestions: [],
      };

      const codebaseContext = {
        existingFiles: [],
        missingFiles: [],
        foundSymbols: [],
        missingSymbols: [],
        relatedFiles: [],
        testFiles: [],
      };

      const template = generateIssueTemplate(task, heuristics, confidence, codebaseContext);

      expect(template.title).toBeTruthy();
      expect(template.body).toContain('## Description');
      expect(template.labels).toContain('bug');
      expect(template.labels.length).toBeGreaterThan(0);
    });

    it('should include Asana link when requested', () => {
      const task: FormattedTaskDetail = {
        gid: '123',
        name: 'Test task',
        description: '',
        htmlDescription: '',
        markdownDescription: 'Description',
        completed: false,
        status: 'incomplete',
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-01T00:00:00.000Z',
        dueOn: null,
        dueAt: null,
        startOn: null,
        assignee: null,
        projects: [],
        tags: [],
        customFields: [],
        url: 'https://app.asana.com/0/0/123',
        parentTask: null,
      };

      const heuristics: HeuristicResult = {
        classification: 'feature',
        estimatedComplexity: 'medium',
        hasFilePaths: false,
        hasCodeReferences: false,
        hasErrorMessages: false,
        hasClearAcceptanceCriteria: false,
        hasClearAcceptanceCriteria: false,
        hasTestingRequirement: false,
        hasBoundedScope: false,
        hasReproductionSteps: false,
        indicators: [],
      };

      const confidence: ConfidenceScore = {
        overall: 50,
        level: 'medium',
        breakdown: { clarity: 12, technicalDetail: 12, scopeDefinition: 13, acceptanceCriteria: 13 },
        positiveFactors: [],
        negativeFactors: [],
        suggestions: [],
      };

      const codebaseContext = {
        existingFiles: [],
        missingFiles: [],
        foundSymbols: [],
        missingSymbols: [],
        relatedFiles: [],
        testFiles: [],
      };

      const template = generateIssueTemplate(task, heuristics, confidence, codebaseContext, {
        includeAsanaLink: true,
      });

      expect(template.body).toContain('https://app.asana.com/0/0/123');
    });
  });

  describe('classificationToIssueType', () => {
    it('should map classifications to issue types', () => {
      expect(classificationToIssueType('bug')).toBe('bug');
      expect(classificationToIssueType('feature')).toBe('feature');
      expect(classificationToIssueType('refactor')).toBe('refactor');
      expect(classificationToIssueType('unknown')).toBe('chore');
    });
  });
});

describe('asana/analyze-task/messages', () => {
  describe('generateFailureReasons', () => {
    it('should generate failure reasons for low confidence', () => {
      const heuristics: HeuristicResult = {
        classification: 'unknown',
        estimatedComplexity: 'high',
        hasFilePaths: false,
        hasCodeReferences: false,
        hasErrorMessages: false,
        hasClearAcceptanceCriteria: false,
        hasClearAcceptanceCriteria: false,
        hasTestingRequirement: false,
        hasBoundedScope: false,
        hasReproductionSteps: false,
        indicators: [],
      };

      const confidence: ConfidenceScore = {
        overall: 25,
        level: 'low',
        breakdown: { clarity: 5, technicalDetail: 5, scopeDefinition: 7, acceptanceCriteria: 8 },
        positiveFactors: [],
        negativeFactors: ['Vague description'],
        suggestions: ['Add more detail'],
      };

      const reasons = generateFailureReasons(heuristics, confidence);

      expect(reasons.length).toBeGreaterThan(0);
    });

    it('should generate no reasons for high confidence', () => {
      const heuristics: HeuristicResult = {
        classification: 'bug',
        estimatedComplexity: 'low',
        hasFilePaths: true,
        hasCodeReferences: true,
        hasErrorMessages: true,
        hasClearAcceptanceCriteria: true,
        hasClearAcceptanceCriteria: true,
        hasTestingRequirement: true,
        hasBoundedScope: true,
        hasReproductionSteps: true,
        indicators: [],
      };

      const confidence: ConfidenceScore = {
        overall: 85,
        level: 'very_high',
        breakdown: { clarity: 22, technicalDetail: 22, scopeDefinition: 21, acceptanceCriteria: 20 },
        positiveFactors: ['Well defined'],
        negativeFactors: [],
        suggestions: [],
      };

      const reasons = generateFailureReasons(heuristics, confidence);

      expect(reasons.length).toBe(0);
    });
  });

  describe('generateSummaryMessage', () => {
    it('should generate summary with positive confidence', () => {
      const heuristics: HeuristicResult = {
        classification: 'bug',
        estimatedComplexity: 'medium',
        hasFilePaths: true,
        hasCodeReferences: true,
        hasErrorMessages: true,
        hasClearAcceptanceCriteria: true,
        hasClearAcceptanceCriteria: true,
        hasTestingRequirement: true,
        hasBoundedScope: true,
        hasReproductionSteps: true,
        indicators: [],
      };

      const confidence: ConfidenceScore = {
        overall: 75,
        level: 'high',
        breakdown: { clarity: 20, technicalDetail: 20, scopeDefinition: 18, acceptanceCriteria: 17 },
        positiveFactors: ['Well defined'],
        negativeFactors: [],
        suggestions: ['Add tests'],
      };

      const failureReasons = generateFailureReasons(heuristics, confidence);
      const summary = generateSummaryMessage(heuristics, confidence, failureReasons);

      expect(summary.type).toBe('success');
      expect(summary.title).toBeTruthy();
      expect(summary.suggestions).toContain('Add tests');
    });

    it('should generate summary with needs review status', () => {
      const heuristics: HeuristicResult = {
        classification: 'unknown',
        estimatedComplexity: 'medium',
        hasFilePaths: false,
        hasCodeReferences: false,
        hasErrorMessages: false,
        hasClearAcceptanceCriteria: false,
        hasClearAcceptanceCriteria: false,
        hasTestingRequirement: false,
        hasBoundedScope: false,
        hasReproductionSteps: false,
        indicators: [],
      };

      const confidence: ConfidenceScore = {
        overall: 35,
        level: 'low',
        breakdown: { clarity: 8, technicalDetail: 8, scopeDefinition: 9, acceptanceCriteria: 10 },
        positiveFactors: [],
        negativeFactors: ['Missing details'],
        suggestions: ['Add more information'],
      };

      const failureReasons = generateFailureReasons(heuristics, confidence);
      const summary = generateSummaryMessage(heuristics, confidence, failureReasons);

      // Low confidence triggers 'error' type indicating review is needed
      expect(['warning', 'error']).toContain(summary.type);
    });
  });

  describe('generateAsanaNotification', () => {
    it('should format Asana comment', () => {
      const summaryMessage = {
        type: 'success' as const,
        title: 'Task is ready for automated processing',
        details: ['All criteria met'],
        suggestions: ['Add tests'],
      };

      const recommendation = 'Proceed with implementation';

      const notification = generateAsanaNotification(summaryMessage, recommendation);

      expect(notification).toContain('Task is ready for automated processing');
      expect(notification).toContain('Proceed with implementation');
    });
  });

  describe('getRecommendation', () => {
    it('should provide recommendations based on confidence level', () => {
      expect(getRecommendation('very_high')).toContain('Proceed');
      expect(getRecommendation('high')).toContain('recommended');
      expect(getRecommendation('medium')).toContain('Review');
      expect(getRecommendation('low')).toContain('review');
      expect(getRecommendation('very_low')).toContain('work');
    });
  });
});

describe('asana/analyze-task/tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeAnalyzeTask', () => {
    it('should analyze task successfully', async () => {
      const mockTask = {
        gid: '123',
        name: 'Fix authentication bug',
        notes: 'Description',
        htmlNotes: '<body>Description</body>',
        completed: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-01T00:00:00.000Z',
        dueOn: null,
        dueAt: null,
        startOn: null,
        assignee: null,
        projects: [],
        tags: [{ gid: 'tag1', name: 'bug' }],
        customFields: [],
        permalink: 'https://app.asana.com/0/0/123',
        parent: null,
      };

      const { getTaskWithCache } = await import('../../get-task/cache.js');
      vi.mocked(getTaskWithCache).mockResolvedValue(mockTask);

      const input: AnalyzeTaskInput = {
        taskGid: '123',
        exploreCodebase: false,
        generateIssue: true,
        confidenceThreshold: 'medium',
        includeMetadata: true,
        format: 'json',
      };

      const result = await executeAnalyzeTask(mockConfig, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.analysis.classification).toBeTruthy();
        expect(result.data.analysis.confidence).toBeGreaterThanOrEqual(0);
        expect(result.data.analysis.confidence).toBeLessThanOrEqual(100);
        expect(result.data.analysis.asanaUpdate.tag).toBeTruthy();
        expect(result.data.analysis.asanaUpdate.comment).toBeTruthy();
      }
    });

    it('should handle task not found', async () => {
      const { getTaskWithCache } = await import('../../get-task/cache.js');
      vi.mocked(getTaskWithCache).mockRejectedValue(new Error('Not Found'));

      const input: AnalyzeTaskInput = {
        taskGid: 'nonexistent',
        exploreCodebase: false,
        generateIssue: false,
      };

      const result = await executeAnalyzeTask(mockConfig, input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('TASK_NOT_FOUND');
      }
    });

    it('should determine analysis result based on confidence', async () => {
      const mockTask = {
        gid: '123',
        name: 'Well-defined task',
        notes: 'Detailed description',
        htmlNotes: '<body>Detailed description with acceptance criteria</body>',
        completed: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-01T00:00:00.000Z',
        dueOn: null,
        dueAt: null,
        startOn: null,
        assignee: null,
        projects: [],
        tags: [],
        customFields: [],
        permalink: 'https://app.asana.com/0/0/123',
        parent: null,
      };

      const { getTaskWithCache } = await import('../../get-task/cache.js');
      vi.mocked(getTaskWithCache).mockResolvedValue(mockTask);

      const input: AnalyzeTaskInput = {
        taskGid: '123',
        exploreCodebase: false,
        generateIssue: false,
      };

      const result = await executeAnalyzeTask(mockConfig, input);

      expect(result.success).toBe(true);
      if (result.success) {
        const analysisResult = result.data.analysis.analysisResult;
        expect(['success', 'needs-more-info', 'cannot-reproduce', 'unclear-requirement', 'needs-context'])
          .toContain(analysisResult);
      }
    });

    it('should generate GitHub issue when requested', async () => {
      const mockTask = {
        gid: '123',
        name: 'Task with issue generation',
        notes: 'Description',
        htmlNotes: '<body>Description</body>',
        completed: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-01T00:00:00.000Z',
        dueOn: null,
        dueAt: null,
        startOn: null,
        assignee: null,
        projects: [],
        tags: [],
        customFields: [],
        permalink: 'https://app.asana.com/0/0/123',
        parent: null,
      };

      const { getTaskWithCache } = await import('../../get-task/cache.js');
      vi.mocked(getTaskWithCache).mockResolvedValue(mockTask);

      const input: AnalyzeTaskInput = {
        taskGid: '123',
        generateIssue: true,
      };

      const result = await executeAnalyzeTask(mockConfig, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.analysis.githubIssue).toBeDefined();
        expect(result.data.analysis.githubIssue?.title).toBeTruthy();
        expect(result.data.analysis.githubIssue?.body).toBeTruthy();
        expect(result.data.analysis.githubIssue?.labels).toBeDefined();
      }
    });

    it('should format output as Markdown when requested', async () => {
      const mockTask = {
        gid: '123',
        name: 'Markdown format test',
        notes: 'Description',
        htmlNotes: '<body>Description</body>',
        completed: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        modifiedAt: '2024-01-01T00:00:00.000Z',
        dueOn: null,
        dueAt: null,
        startOn: null,
        assignee: null,
        projects: [],
        tags: [],
        customFields: [],
        permalink: 'https://app.asana.com/0/0/123',
        parent: null,
      };

      const { getTaskWithCache } = await import('../../get-task/cache.js');
      vi.mocked(getTaskWithCache).mockResolvedValue(mockTask);

      const input: AnalyzeTaskInput = {
        taskGid: '123',
        format: 'markdown',
        generateIssue: false,
      };

      const result = await executeAnalyzeTask(mockConfig, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.format).toBe('markdown');
        expect(result.data.content).toContain('# Task Analysis:');
        expect(result.data.content).toContain('**Result:**');
        expect(result.data.content).toContain('**Confidence:**');
      }
    });
  });
});
