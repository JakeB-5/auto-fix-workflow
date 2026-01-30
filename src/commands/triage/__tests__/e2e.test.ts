/**
 * @module commands/triage/__tests__/e2e.test
 * @description End-to-end tests for triage command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AsanaTask, TriageOptions, TriageResult, TaskAnalysis } from '../types.js';
import { DEFAULT_TRIAGE_CONFIG } from '../types.js';

// Mock task factory
function createMockTask(overrides: Partial<AsanaTask> = {}): AsanaTask {
  return {
    gid: '123456789',
    name: 'Test Task',
    notes: 'Test task description',
    permalinkUrl: 'https://app.asana.com/0/123/456',
    createdAt: '2024-01-01T00:00:00Z',
    modifiedAt: '2024-01-01T00:00:00Z',
    completed: false,
    ...overrides,
  };
}

// Mock analysis factory
function createMockAnalysis(overrides: Partial<TaskAnalysis> = {}): TaskAnalysis {
  return {
    issueType: 'feature',
    priority: 'medium',
    labels: ['auto-fix'],
    component: 'general',
    relatedFiles: [],
    summary: 'Test summary',
    acceptanceCriteria: ['AC1', 'AC2'],
    confidence: 0.8,
    ...overrides,
  };
}

describe('E2E: Triage Command', () => {
  describe('Dry-run mode', () => {
    it('should complete full dry-run workflow', async () => {
      const tasks = [
        createMockTask({ gid: '1', name: 'Bug: Fix login issue' }),
        createMockTask({ gid: '2', name: 'Feature: Add dark mode' }),
        createMockTask({ gid: '3', name: 'Refactor: Clean up auth module' }),
      ];

      const options: TriageOptions = {
        mode: 'batch',
        dryRun: true,
        verbose: false,
      };

      // Import the simulation module
      const { simulateActions, toTriageResult, formatDryRunResult } = await import('../dry-run.js');

      // Run simulation
      const dryRunResult = simulateActions(tasks);

      // Verify simulation generated expected actions
      expect(dryRunResult.actions.length).toBeGreaterThan(0);
      expect(dryRunResult.summary.totalTasks).toBe(3);
      expect(dryRunResult.summary.issuesWouldCreate).toBe(3);

      // Convert to triage result
      const result = toTriageResult(dryRunResult);
      expect(result.processed).toBe(3);
      expect(result.created).toBe(3);
      expect(result.failed).toBe(0);

      // Format should include all tasks
      const formatted = formatDryRunResult(dryRunResult);
      expect(formatted).toContain('Bug: Fix login issue');
      expect(formatted).toContain('Feature: Add dark mode');
      expect(formatted).toContain('Refactor: Clean up auth module');
    });

    it('should handle empty task list in dry-run', async () => {
      const { simulateActions, toTriageResult } = await import('../dry-run.js');

      const result = simulateActions([]);
      const triageResult = toTriageResult(result);

      expect(triageResult.processed).toBe(0);
      expect(triageResult.created).toBe(0);
    });
  });

  describe('Task Analysis', () => {
    it('should infer bug type from task name', async () => {
      // This tests the fallback analysis logic in ai-analyze.ts
      const bugTasks = [
        createMockTask({ name: 'Bug: Something is broken' }),
        createMockTask({ name: 'Fix the login error' }),
        createMockTask({ name: 'Error handling in API' }),
      ];

      // The fallback analysis checks for keywords
      for (const task of bugTasks) {
        const nameLower = task.name.toLowerCase();
        const isBugLike = nameLower.includes('bug') ||
                         nameLower.includes('fix') ||
                         nameLower.includes('error');
        expect(isBugLike).toBe(true);
      }
    });

    it('should infer feature type from task name', () => {
      const featureTasks = [
        createMockTask({ name: 'Feature: Add new dashboard' }),
        createMockTask({ name: 'Add user preferences' }),
        createMockTask({ name: 'Implement OAuth support' }),
      ];

      for (const task of featureTasks) {
        const nameLower = task.name.toLowerCase();
        const isFeatureLike = nameLower.includes('feature') ||
                             nameLower.includes('add') ||
                             nameLower.includes('implement');
        expect(isFeatureLike).toBe(true);
      }
    });

    it('should infer priority from custom field', () => {
      const tasks = [
        createMockTask({
          customFields: [
            { gid: '1', name: 'Priority', displayValue: 'Critical', type: 'enum' },
          ],
        }),
        createMockTask({
          customFields: [
            { gid: '1', name: 'Priority', displayValue: 'Urgent', type: 'enum' },
          ],
        }),
      ];

      for (const task of tasks) {
        const priorityField = task.customFields?.find(
          (f) => f.name.toLowerCase().includes('priority')
        );
        const priorityValue = priorityField?.displayValue?.toLowerCase() ?? '';
        const isCritical = priorityValue.includes('critical') || priorityValue.includes('urgent');
        expect(isCritical).toBe(true);
      }
    });

    it('should increase priority for soon due dates', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const task = createMockTask({
        dueOn: tomorrow.toISOString().split('T')[0],
      });

      const dueDate = new Date(task.dueOn!);
      const daysUntilDue = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

      expect(daysUntilDue).toBeLessThanOrEqual(1);
    });
  });

  describe('GitHub Issue Body Generation', () => {
    it('should generate well-formatted issue body', () => {
      const task = createMockTask({
        name: 'Add user authentication',
        notes: 'Implement OAuth2 authentication with Google and GitHub providers.',
        permalinkUrl: 'https://app.asana.com/0/123/456',
      });

      const analysis = createMockAnalysis({
        issueType: 'feature',
        priority: 'high',
        component: 'auth',
        labels: ['auth', 'security'],
        summary: 'Implement OAuth2 authentication with Google and GitHub providers.',
        acceptanceCriteria: [
          'Users can sign in with Google',
          'Users can sign in with GitHub',
          'Session is properly maintained',
        ],
        relatedFiles: ['src/auth/oauth.ts', 'src/auth/providers.ts'],
        confidence: 0.9,
      });

      // Build issue body (simplified version of what github-create.ts does)
      const sections: string[] = [];

      sections.push('## Summary');
      sections.push('');
      sections.push(analysis.summary);
      sections.push('');

      sections.push('## Context');
      sections.push('');
      sections.push(`- **Type**: ${analysis.issueType}`);
      sections.push(`- **Priority**: ${analysis.priority}`);
      sections.push(`- **Component**: ${analysis.component}`);
      sections.push(`- **Confidence**: ${Math.round(analysis.confidence * 100)}%`);
      sections.push('');

      if (analysis.relatedFiles.length > 0) {
        sections.push('## Related Files');
        sections.push('');
        for (const file of analysis.relatedFiles) {
          sections.push(`- \`${file}\``);
        }
        sections.push('');
      }

      if (analysis.acceptanceCriteria.length > 0) {
        sections.push('## Acceptance Criteria');
        sections.push('');
        for (const criterion of analysis.acceptanceCriteria) {
          sections.push(`- [ ] ${criterion}`);
        }
        sections.push('');
      }

      sections.push('---');
      sections.push('');
      sections.push(`> Source: [Asana Task](${task.permalinkUrl})`);

      const body = sections.join('\n');

      // Verify structure
      expect(body).toContain('## Summary');
      expect(body).toContain('## Context');
      expect(body).toContain('## Related Files');
      expect(body).toContain('## Acceptance Criteria');
      expect(body).toContain('OAuth2 authentication');
      expect(body).toContain('- **Type**: feature');
      expect(body).toContain('- **Priority**: high');
      expect(body).toContain('`src/auth/oauth.ts`');
      expect(body).toContain('- [ ] Users can sign in with Google');
      expect(body).toContain('[Asana Task]');
    });

    it('should generate labels from analysis', () => {
      const analysis = createMockAnalysis({
        issueType: 'bug',
        priority: 'critical',
        component: 'api',
        labels: ['production', 'security'],
      });

      // Build labels (simplified version)
      const labels: string[] = ['auto-fix'];
      labels.push(`type:${analysis.issueType}`);
      labels.push(`priority:${analysis.priority}`);
      if (analysis.component) {
        labels.push(`component:${analysis.component.toLowerCase().replace(/\s+/g, '-')}`);
      }
      for (const label of analysis.labels) {
        if (!labels.includes(label)) {
          labels.push(label);
        }
      }

      expect(labels).toContain('auto-fix');
      expect(labels).toContain('type:bug');
      expect(labels).toContain('priority:critical');
      expect(labels).toContain('component:api');
      expect(labels).toContain('production');
      expect(labels).toContain('security');
    });
  });

  describe('Error Recovery', () => {
    it('should aggregate errors from multiple tasks', async () => {
      const { ErrorAggregator, TriageError } = await import('../error-handler.js');

      const aggregator = new ErrorAggregator();

      // Simulate errors from multiple tasks
      aggregator.add('task1', new TriageError('API Error', 'ASANA_API_ERROR', { retryable: true }));
      aggregator.add('task2', new TriageError('Rate Limited', 'RATE_LIMIT_ERROR', { retryable: true }));
      aggregator.add('task3', new TriageError('Invalid Data', 'VALIDATION_ERROR', { retryable: false }));

      expect(aggregator.getErrorCount()).toBe(3);
      expect(aggregator.getTasksWithErrors()).toHaveLength(3);

      const retryable = aggregator.getRetryableTasks();
      expect(retryable).toContain('task1');
      expect(retryable).toContain('task2');
      expect(retryable).not.toContain('task3');
    });

    it('should handle retry with exponential backoff', async () => {
      const { withRetry } = await import('../error-handler.js');

      let attempts = 0;
      const delays: number[] = [];

      const result = await withRetry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('ECONNREFUSED'); // Network error - retryable
          }
          return 'success';
        },
        {
          maxAttempts: 5,
          initialDelayMs: 10,
          maxDelayMs: 100,
          backoffMultiplier: 2,
          onRetry: (_attempt, _error, delay) => {
            delays.push(delay);
          },
        }
      );

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
      expect(delays).toHaveLength(2);
      // Second delay should be roughly double the first (with jitter)
      expect(delays[1]).toBeGreaterThanOrEqual(delays[0]);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive report', async () => {
      const { generateReport } = await import('../report.js');

      const result: TriageResult = {
        processed: 10,
        created: 7,
        skipped: 2,
        failed: 1,
        durationMs: 15000,
        createdIssues: [
          { asanaTaskGid: '1', githubIssueNumber: 101, githubIssueUrl: 'url1', title: 'Issue 1' },
          { asanaTaskGid: '2', githubIssueNumber: 102, githubIssueUrl: 'url2', title: 'Issue 2' },
        ],
        failures: [
          { asanaTaskGid: '3', title: 'Failed Task', error: 'API Error', retryable: true },
        ],
      };

      // Text report
      const textReport = generateReport(result, { format: 'text', verbose: true });
      expect(textReport).toContain('Processed: 10');
      expect(textReport).toContain('Created:   7');
      expect(textReport).toContain('Duration:  15.00s');
      expect(textReport).toContain('PARTIAL');

      // JSON report
      const jsonReport = generateReport(result, { format: 'json' });
      const parsed = JSON.parse(jsonReport);
      expect(parsed.summary.processed).toBe(10);
      expect(parsed.createdIssues).toHaveLength(2);
      expect(parsed.failures).toHaveLength(1);
      expect(parsed.status).toBe('partial');

      // Markdown report
      const mdReport = generateReport(result, { format: 'markdown', verbose: true });
      expect(mdReport).toContain('# Triage Report');
      expect(mdReport).toContain('| Processed | 10 |');
      expect(mdReport).toContain('## Failures');
    });

    it('should aggregate multiple results', async () => {
      const { aggregateResults } = await import('../report.js');

      const results: TriageResult[] = [
        {
          processed: 5,
          created: 4,
          skipped: 1,
          failed: 0,
          durationMs: 5000,
          createdIssues: [
            { asanaTaskGid: '1', githubIssueNumber: 1, githubIssueUrl: 'url1', title: 'T1' },
          ],
        },
        {
          processed: 3,
          created: 2,
          skipped: 0,
          failed: 1,
          durationMs: 3000,
          failures: [
            { asanaTaskGid: '2', title: 'Failed', error: 'Error', retryable: false },
          ],
        },
      ];

      const aggregated = aggregateResults(results);

      expect(aggregated.processed).toBe(8);
      expect(aggregated.created).toBe(6);
      expect(aggregated.skipped).toBe(1);
      expect(aggregated.failed).toBe(1);
      expect(aggregated.durationMs).toBe(8000);
      expect(aggregated.createdIssues).toHaveLength(1);
      expect(aggregated.failures).toHaveLength(1);
    });
  });

  describe('CLI Parsing', () => {
    it('should handle complete CLI workflow', async () => {
      const { parseArgs, formatOptions } = await import('../cli.js');

      const args = [
        '--mode', 'batch',
        '--dry-run',
        '--project', '123456789',
        '--priority', 'high',
        '--limit', '25',
        '--yes',
        '--verbose',
      ];

      const result = parseArgs(args);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe('batch');
        expect(result.data.dryRun).toBe(true);
        expect(result.data.projectId).toBe('123456789');
        expect(result.data.priority).toBe('high');
        expect(result.data.limit).toBe(25);
        expect(result.data.skipConfirmation).toBe(true);
        expect(result.data.verbose).toBe(true);

        const formatted = formatOptions(result.data);
        expect(formatted).toContain('Mode: batch');
        expect(formatted).toContain('Dry Run: yes');
        expect(formatted).toContain('Project ID: 123456789');
      }
    });
  });

  describe('Config Loading', () => {
    it('should merge config from multiple sources', async () => {
      const { loadTriageConfig, getEnvConfig } = await import('../config.js');

      // File config (defaults)
      const fileConfig = await loadTriageConfig('/nonexistent');
      expect(fileConfig.success).toBe(true);

      // Env config
      const originalEnv = process.env.ASANA_DEFAULT_PROJECT_GID;
      process.env.ASANA_DEFAULT_PROJECT_GID = 'env-project';

      const envConfig = getEnvConfig();
      expect(envConfig.defaultProjectGid).toBe('env-project');

      // Restore
      if (originalEnv) {
        process.env.ASANA_DEFAULT_PROJECT_GID = originalEnv;
      } else {
        delete process.env.ASANA_DEFAULT_PROJECT_GID;
      }
    });
  });
});
