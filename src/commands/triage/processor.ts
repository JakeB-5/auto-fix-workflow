/**
 * @module commands/triage/processor
 * @description Task processing main loop
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Result } from '../../common/types/index.js';
import { ok, err, isSuccess, isFailure } from '../../common/types/index.js';
import type {
  AsanaTask,
  TaskAnalysis,
  TriageOptions,
  TriageResult,
  TriageConfig,
  CreatedIssueInfo,
  TriageFailure,
} from './types.js';
import { DEFAULT_TRIAGE_CONFIG } from './types.js';
import { createAsanaListTool, createAsanaUpdateTool, createGitHubCreateTool, createAIAnalyzeTool } from './mcp-tools/index.js';
import { withRetry, handleTriageError, ErrorAggregator, TriageError } from './error-handler.js';
import { DryRunSimulator, formatDryRunResult, toTriageResult } from './dry-run.js';
import { ProgressReporter } from './report.js';
import { generateNeedsInfoComment } from '../../github/update-issue/comment-generator.js';
import type { NeedsInfoAnalysisResult } from '../../github/update-issue/comment-generator.js';

/**
 * Task processor for triage operations
 */
export class TaskProcessor {
  private readonly client: Client;
  private readonly config: TriageConfig;
  private readonly owner: string;
  private readonly repo: string;

  constructor(
    client: Client,
    owner: string,
    repo: string,
    config: Partial<TriageConfig> = {}
  ) {
    this.client = client;
    this.owner = owner;
    this.repo = repo;
    this.config = { ...DEFAULT_TRIAGE_CONFIG, ...config };
  }

  /**
   * Process tasks based on options
   */
  async processTasks(
    tasks: readonly AsanaTask[],
    options: TriageOptions
  ): Promise<Result<TriageResult, Error>> {
    // Handle dry run
    if (options.dryRun) {
      return this.processDryRun(tasks);
    }

    // Filter tasks by priority if specified
    const filteredTasks = options.priority
      ? await this.filterByPriority(tasks, options.priority)
      : tasks;

    // Apply limit
    const limitedTasks = options.limit
      ? filteredTasks.slice(0, options.limit)
      : filteredTasks;

    if (limitedTasks.length === 0) {
      return ok({
        processed: 0,
        created: 0,
        skipped: tasks.length,
        failed: 0,
        needsInfo: 0,
      });
    }

    // Process tasks
    const startTime = Date.now();
    const reporter = new ProgressReporter(limitedTasks.length, options.verbose);
    const errorAggregator = new ErrorAggregator();
    const createdIssues: CreatedIssueInfo[] = [];
    const failures: TriageFailure[] = [];

    // Initialize tools
    const aiTool = createAIAnalyzeTool(this.client);
    const githubTool = createGitHubCreateTool(this.client, this.owner, this.repo);
    const asanaUpdateTool = createAsanaUpdateTool(this.client);
    const asanaListTool = createAsanaListTool(this.client);

    // Get processed section GID
    const firstTask = limitedTasks[0];
    const processedSectionResult = firstTask !== undefined
      ? await this.getProcessedSectionGid(asanaListTool, firstTask)
      : { success: false as const, data: undefined };
    const processedSectionGid = processedSectionResult.success ? processedSectionResult.data : undefined;

    for (const task of limitedTasks) {
      reporter.onTaskStart(task.name);

      try {
        // Check if already synced
        const alreadySynced = task.tags?.some(
          (t) => t.name.toLowerCase() === this.config.syncedTagName.toLowerCase()
        );

        if (alreadySynced) {
          reporter.onTaskSkipped(task.name, 'Already synced');
          continue;
        }

        // Analyze task
        const analysisResult = await withRetry(
          async () => {
            const result = await aiTool.analyzeTask(task);
            if (isFailure(result)) throw result.error;
            return result.data;
          },
          this.config.retry
        );

        if (isFailure(analysisResult)) {
          const triageError = handleTriageError(analysisResult.error, `Analysis failed for ${task.name}`);
          errorAggregator.add(task.gid, triageError);
          reporter.onTaskFailed(task.name, triageError.message);
          failures.push({
            asanaTaskGid: task.gid,
            title: task.name,
            error: triageError.message,
            retryable: triageError.retryable,
          });
          continue;
        }

        const analysis = analysisResult.data;
        const isNeedsInfo = analysis.confidence < this.config.confidenceThreshold;

        // Create GitHub issue (for both normal and needs-info tasks)
        const issueResult = await withRetry(
          async () => {
            const result = isNeedsInfo
              ? await githubTool.createIssueForNeedsInfo(task, analysis, this.config.needsInfoLabels)
              : await githubTool.createIssueFromTask(task, analysis);
            if (isFailure(result)) throw result.error;
            return result.data;
          },
          this.config.retry
        );

        if (isFailure(issueResult)) {
          const triageError = handleTriageError(issueResult.error, `GitHub issue creation failed for ${task.name}`);
          errorAggregator.add(task.gid, triageError);
          reporter.onTaskFailed(task.name, triageError.message);
          failures.push({
            asanaTaskGid: task.gid,
            title: task.name,
            error: triageError.message,
            retryable: triageError.retryable,
          });
          continue;
        }

        const issueInfo: CreatedIssueInfo = {
          asanaTaskGid: task.gid,
          githubIssueNumber: issueResult.data.number,
          githubIssueUrl: issueResult.data.url,
          title: task.name,
          ...(isNeedsInfo && { needsInfo: true, analysisResult: 'needs-more-info' }),
        };

        createdIssues.push(issueInfo);

        if (isNeedsInfo) {
          // Add needs-info comment to the GitHub issue
          const needsInfoComment = generateNeedsInfoComment({
            analysisResult: this.determineNeedsInfoResult(analysis),
            suggestions: this.buildSuggestions(analysis),
            confidenceLevel: this.getConfidenceLevel(analysis.confidence),
            confidenceScore: Math.round(analysis.confidence * 100),
            breakdown: this.estimateBreakdown(analysis),
          });

          const commentResult = await githubTool.addComment(issueResult.data.number, needsInfoComment);
          if (isFailure(commentResult) && options.verbose) {
            reporter.onTaskFailed(task.name, `Warning: needs-info comment failed: ${commentResult.error.message}`);
          }

          // Update Asana task for needs-info (comment only, no section move)
          await this.updateAsanaTaskForNeedsInfo(
            asanaUpdateTool,
            task,
            issueInfo
          );

          reporter.onTaskNeedsInfo(task.name, issueInfo.githubIssueUrl);
        } else {
          // Update Asana task (best effort, don't fail the whole process)
          await this.updateAsanaTask(
            asanaUpdateTool,
            task,
            issueInfo,
            processedSectionGid
          );

          reporter.onTaskCreated(issueInfo);
        }
      } catch (error) {
        const triageError = handleTriageError(error, `Unexpected error processing ${task.name}`);
        errorAggregator.add(task.gid, triageError);
        reporter.onTaskFailed(task.name, triageError.message);
        failures.push({
          asanaTaskGid: task.gid,
          title: task.name,
          error: triageError.message,
          retryable: triageError.retryable,
        });
      }
    }

    const result = reporter.getResult();

    return ok({
      ...result,
      createdIssues,
      failures,
      durationMs: Date.now() - startTime,
    });
  }

  /**
   * Process a single task
   */
  async processSingleTask(
    task: AsanaTask,
    options: TriageOptions
  ): Promise<Result<TriageResult, Error>> {
    return this.processTasks([task], options);
  }

  /**
   * Process dry run
   */
  private processDryRun(tasks: readonly AsanaTask[]): Result<TriageResult, Error> {
    const simulator = new DryRunSimulator();

    for (const task of tasks) {
      const analysis = simulator.simulateAnalysis(task);
      const issueInfo = simulator.simulateCreateIssue(task, analysis);
      simulator.simulateUpdateTask(task, {
        sectionGid: 'mock-processed-section',
        tagGids: ['mock-synced-tag'],
        comment: `GitHub issue created: ${issueInfo.githubIssueUrl}`,
      });
    }

    const dryRunResult = simulator.getResult();
    console.log(formatDryRunResult(dryRunResult));

    return ok(toTriageResult(dryRunResult));
  }

  /**
   * Filter tasks by priority
   */
  private async filterByPriority(
    tasks: readonly AsanaTask[],
    priority: string
  ): Promise<readonly AsanaTask[]> {
    return tasks.filter((task) => {
      const priorityField = task.customFields?.find(
        (f) => f.name.toLowerCase() === this.config.priorityFieldName.toLowerCase()
      );

      if (!priorityField?.displayValue) {
        return false;
      }

      return priorityField.displayValue.toLowerCase() === priority.toLowerCase();
    });
  }

  /**
   * Get the processed section GID
   */
  private async getProcessedSectionGid(
    asanaListTool: ReturnType<typeof createAsanaListTool>,
    sampleTask: AsanaTask
  ): Promise<Result<string | undefined, Error>> {
    const projectGid = sampleTask.memberships?.[0]?.project?.gid;
    if (!projectGid) {
      return ok(undefined);
    }

    const sectionResult = await asanaListTool.findSectionByName(
      projectGid,
      this.config.processedSectionName
    );

    if (!sectionResult.success) {
      return ok(undefined);
    }

    return ok(sectionResult.data ?? undefined);
  }

  /**
   * Update Asana task after GitHub issue creation
   */
  private async updateAsanaTask(
    asanaUpdateTool: ReturnType<typeof createAsanaUpdateTool>,
    task: AsanaTask,
    issueInfo: CreatedIssueInfo,
    processedSectionGid?: string
  ): Promise<void> {
    // Add comment with GitHub issue link
    await asanaUpdateTool.addComment(
      task.gid,
      `GitHub issue created: ${issueInfo.githubIssueUrl}\n\nIssue #${issueInfo.githubIssueNumber}`
    );

    // Move to processed section
    if (processedSectionGid) {
      await asanaUpdateTool.moveTaskToSection(task.gid, processedSectionGid);
    }

    // Note: Adding tags requires the tag GID, which would need to be looked up
    // This is simplified for the initial implementation
  }

  /**
   * Update Asana task for needs-info issues
   */
  private async updateAsanaTaskForNeedsInfo(
    asanaUpdateTool: ReturnType<typeof createAsanaUpdateTool>,
    task: AsanaTask,
    issueInfo: CreatedIssueInfo
  ): Promise<void> {
    // Add comment with GitHub issue link and needs-info note (no section move)
    await asanaUpdateTool.addComment(
      task.gid,
      `GitHub issue created (needs more info): ${issueInfo.githubIssueUrl}\n\nIssue #${issueInfo.githubIssueNumber}\n\nAdditional information has been requested via GitHub comment.`
    );
  }

  /**
   * Determine the specific needs-info analysis result type
   */
  private determineNeedsInfoResult(analysis: TaskAnalysis): NeedsInfoAnalysisResult {
    if (analysis.confidence < 0.2) return 'unclear-requirement';
    if (analysis.acceptanceCriteria.length === 0) return 'needs-more-info';
    if (analysis.relatedFiles.length === 0) return 'needs-context';
    return 'needs-more-info';
  }

  /**
   * Build suggestions based on what the analysis is missing
   */
  private buildSuggestions(analysis: TaskAnalysis): string[] {
    const suggestions: string[] = [];

    if (analysis.relatedFiles.length === 0) {
      suggestions.push('Include file paths, function names, or code snippets related to this issue');
    }

    if (analysis.acceptanceCriteria.length === 0) {
      suggestions.push('Define clear acceptance criteria as a checklist of testable conditions');
    }

    if (!analysis.summary || analysis.summary.length < 50) {
      suggestions.push('Provide a more detailed description of the expected behavior and current behavior');
    }

    if (analysis.component === 'general' || !analysis.component) {
      suggestions.push('Identify the specific component or module this issue affects');
    }

    if (analysis.issueType === 'bug') {
      suggestions.push('Provide step-by-step reproduction instructions');
    }

    return suggestions;
  }

  /**
   * Map confidence score to level string
   */
  private getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.85) return 'very_high';
    if (confidence >= 0.70) return 'high';
    if (confidence >= 0.50) return 'medium';
    if (confidence >= 0.30) return 'low';
    return 'very_low';
  }

  /**
   * Estimate confidence breakdown from the analysis
   */
  private estimateBreakdown(analysis: TaskAnalysis): {
    clarity: number;
    technicalDetail: number;
    scopeDefinition: number;
    acceptanceCriteria: number;
  } {
    const total = Math.round(analysis.confidence * 100);

    // Estimate breakdown based on available data
    const hasSummary = analysis.summary && analysis.summary.length > 30;
    const hasFiles = analysis.relatedFiles.length > 0;
    const hasComponent = analysis.component && analysis.component !== 'general';
    const hasCriteria = analysis.acceptanceCriteria.length > 0;

    return {
      clarity: hasSummary ? Math.min(25, Math.round(total * 0.3)) : Math.round(total * 0.15),
      technicalDetail: hasFiles && hasComponent
        ? Math.min(25, Math.round(total * 0.3))
        : Math.round(total * 0.1),
      scopeDefinition: hasComponent ? Math.min(25, Math.round(total * 0.25)) : Math.round(total * 0.15),
      acceptanceCriteria: hasCriteria ? Math.min(25, Math.round(total * 0.3)) : Math.round(total * 0.1),
    };
  }
}

/**
 * Process tasks (convenience function)
 */
export async function processTasks(
  client: Client,
  tasks: readonly AsanaTask[],
  options: TriageOptions,
  config: {
    owner: string;
    repo: string;
    triageConfig?: Partial<TriageConfig>;
  }
): Promise<Result<TriageResult, Error>> {
  const processor = new TaskProcessor(client, config.owner, config.repo, config.triageConfig);
  return processor.processTasks(tasks, options);
}

/**
 * Fetch and process tasks from a project
 */
export async function fetchAndProcessTasks(
  client: Client,
  projectGid: string,
  options: TriageOptions,
  config: {
    owner: string;
    repo: string;
    triageConfig?: Partial<TriageConfig>;
  }
): Promise<Result<TriageResult, Error>> {
  const triageConfig = { ...DEFAULT_TRIAGE_CONFIG, ...config.triageConfig };
  const asanaListTool = createAsanaListTool(client);

  // Find the triage section
  const sectionResult = await asanaListTool.findSectionByName(
    projectGid,
    triageConfig.triageSectionName
  );

  if (isFailure(sectionResult)) {
    return err(sectionResult.error);
  }

  const sectionGid = sectionResult.data ?? options.sectionId;

  if (!sectionGid) {
    return err(
      new TriageError(
        `Triage section "${triageConfig.triageSectionName}" not found in project`,
        'NOT_FOUND_ERROR'
      )
    );
  }

  // Fetch tasks from the section
  const tasksResult = await asanaListTool.listTasksInSection(
    projectGid,
    sectionGid,
    options.limit ?? triageConfig.maxBatchSize
  );

  if (isFailure(tasksResult)) {
    return err(tasksResult.error);
  }

  const tasks = tasksResult.data;

  if (tasks.length === 0) {
    return ok({
      processed: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      needsInfo: 0,
    });
  }

  // Process the tasks
  return processTasks(client, tasks, options, config);
}
