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

        // Create GitHub issue
        const issueResult = await withRetry(
          async () => {
            const result = await githubTool.createIssueFromTask(task, analysis);
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
        };

        createdIssues.push(issueInfo);

        // Update Asana task (best effort, don't fail the whole process)
        await this.updateAsanaTask(
          asanaUpdateTool,
          task,
          issueInfo,
          processedSectionGid
        );

        reporter.onTaskCreated(issueInfo);
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
    });
  }

  // Process the tasks
  return processTasks(client, tasks, options, config);
}
