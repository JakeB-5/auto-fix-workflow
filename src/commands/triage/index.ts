/**
 * @module commands/triage
 * @description Triage command - Process Asana tasks and create GitHub issues
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Result, Failure } from '../../common/types/index.js';
import { ok, err, isSuccess, isFailure } from '../../common/types/index.js';
import type { TriageOptions, TriageResult, TriageConfig, AsanaTask } from './types.js';
import { DEFAULT_TRIAGE_CONFIG } from './types.js';
import { parseArgs, HelpRequestedError, VersionRequestedError, formatOptions } from './cli.js';
import { loadConfig } from './config.js';
import { selectTasks } from './interactive.js';
import { TaskProcessor, fetchAndProcessTasks } from './processor.js';
import { createAsanaListTool, createAIAnalyzeTool } from './mcp-tools/index.js';
import { confirmBatchWork, confirmSingleTask, displayCancelled, displayStarting } from './confirmation.js';
import { printReport, generateReport } from './report.js';
import { TriageError, handleTriageError } from './error-handler.js';

/**
 * Triage command context
 */
export interface TriageContext {
  /** MCP client */
  readonly client: Client;
  /** GitHub owner */
  readonly owner: string;
  /** GitHub repo */
  readonly repo: string;
  /** Triage configuration */
  readonly config?: Partial<TriageConfig>;
}

/**
 * Main triage command entry point
 */
export async function triageCommand(
  args: readonly string[],
  context: TriageContext
): Promise<Result<TriageResult, Error>> {
  // Parse CLI arguments
  const optionsResult = parseArgs(args);

  if (isFailure(optionsResult)) {
    const error = optionsResult.error;

    // Handle help request
    if (error instanceof HelpRequestedError) {
      console.log(error.helpText);
      return ok({ processed: 0, created: 0, skipped: 0, failed: 0 });
    }

    // Handle version request
    if (error instanceof VersionRequestedError) {
      console.log(error.version);
      return ok({ processed: 0, created: 0, skipped: 0, failed: 0 });
    }

    return err(error);
  }

  const options = optionsResult.data;

  // Load configuration
  const configResult = await loadConfig();
  if (isFailure(configResult)) {
    return err(configResult.error);
  }

  const config: TriageConfig = {
    ...configResult.data,
    ...context.config,
  };

  // Show options in verbose mode
  if (options.verbose) {
    console.log(formatOptions(options));
    console.log('');
  }

  // Execute based on mode
  switch (options.mode) {
    case 'interactive':
      return runInteractiveMode(context.client, options, config, context);

    case 'batch':
      return runBatchMode(context.client, options, config, context);

    case 'single':
      return runSingleMode(context.client, options, config, context);

    default:
      return err(new Error(`Unknown mode: ${options.mode}`));
  }
}

/**
 * Run interactive mode
 */
async function runInteractiveMode(
  client: Client,
  options: TriageOptions,
  config: TriageConfig,
  context: TriageContext
): Promise<Result<TriageResult, Error>> {
  const projectGid = options.projectId ?? config.defaultProjectGid;

  if (!projectGid) {
    return err(
      new TriageError('Project ID required. Use --project or set default in config.', 'CONFIGURATION_ERROR')
    );
  }

  // Fetch tasks
  const asanaListTool = createAsanaListTool(client);
  const sectionResult = await asanaListTool.findSectionByName(projectGid, config.triageSectionName);

  if (isFailure(sectionResult)) {
    return err(sectionResult.error);
  }

  const sectionGid = sectionResult.data?.gid ?? options.sectionId;

  if (!sectionGid) {
    return err(
      new TriageError(`Triage section "${config.triageSectionName}" not found`, 'NOT_FOUND_ERROR')
    );
  }

  const tasksResult = await asanaListTool.listTasksInSection(projectGid, sectionGid, config.maxBatchSize);

  if (isFailure(tasksResult)) {
    return err(tasksResult.error);
  }

  const tasks = tasksResult.data;

  if (tasks.length === 0) {
    console.log('No tasks found in triage section.');
    return ok({ processed: 0, created: 0, skipped: 0, failed: 0 });
  }

  // Analyze tasks for selection UI
  const aiTool = createAIAnalyzeTool(client);
  const analysesResult = await aiTool.analyzeTasks(tasks);
  const analyses = analysesResult.success ? analysesResult.data : undefined;

  // Interactive selection
  let selectedTasks: readonly AsanaTask[];
  try {
    selectedTasks = await selectTasks(tasks, analyses);
  } catch (error) {
    displayCancelled();
    return ok({ processed: 0, created: 0, skipped: tasks.length, failed: 0 });
  }

  if (selectedTasks.length === 0) {
    console.log('No tasks selected.');
    return ok({ processed: 0, created: 0, skipped: tasks.length, failed: 0 });
  }

  // Process selected tasks
  displayStarting(selectedTasks.length);

  const processor = new TaskProcessor(client, context.owner, context.repo, config);
  const result = await processor.processTasks(selectedTasks, options);

  if (result.success) {
    printReport(result.data, { verbose: options.verbose });
  }

  return result;
}

/**
 * Run batch mode
 */
async function runBatchMode(
  client: Client,
  options: TriageOptions,
  config: TriageConfig,
  context: TriageContext
): Promise<Result<TriageResult, Error>> {
  const projectGid = options.projectId ?? config.defaultProjectGid;

  if (!projectGid) {
    return err(
      new TriageError('Project ID required. Use --project or set default in config.', 'CONFIGURATION_ERROR')
    );
  }

  // Fetch tasks
  const asanaListTool = createAsanaListTool(client);
  const sectionResult = await asanaListTool.findSectionByName(projectGid, config.triageSectionName);

  if (isFailure(sectionResult)) {
    return err(sectionResult.error);
  }

  const sectionGid = sectionResult.data?.gid ?? options.sectionId;

  if (!sectionGid) {
    return err(
      new TriageError(`Triage section "${config.triageSectionName}" not found`, 'NOT_FOUND_ERROR')
    );
  }

  const tasksResult = await asanaListTool.listTasksInSection(projectGid, sectionGid, config.maxBatchSize);

  if (isFailure(tasksResult)) {
    return err(tasksResult.error);
  }

  const tasks = tasksResult.data;

  if (tasks.length === 0) {
    console.log('No tasks found in triage section.');
    return ok({ processed: 0, created: 0, skipped: 0, failed: 0 });
  }

  // Confirm batch processing
  if (!options.skipConfirmation) {
    const confirmResult = await confirmBatchWork({
      tasks,
      options,
    });

    if (!confirmResult.confirmed) {
      displayCancelled();
      return ok({ processed: 0, created: 0, skipped: tasks.length, failed: 0 });
    }

    // Apply any modified options
    if (confirmResult.modifiedOptions) {
      Object.assign(options, confirmResult.modifiedOptions);
    }
  }

  // Process tasks
  displayStarting(tasks.length);

  const result = await fetchAndProcessTasks(client, projectGid, options, {
    owner: context.owner,
    repo: context.repo,
    triageConfig: config,
  });

  if (result.success) {
    printReport(result.data, { verbose: options.verbose });
  }

  return result;
}

/**
 * Run single task mode
 */
async function runSingleMode(
  client: Client,
  options: TriageOptions,
  config: TriageConfig,
  context: TriageContext
): Promise<Result<TriageResult, Error>> {
  // In single mode, projectId is actually the task GID
  const taskGid = options.projectId;

  if (!taskGid) {
    return err(
      new TriageError('Task GID required for single mode. Provide as positional argument.', 'VALIDATION_ERROR')
    );
  }

  // Fetch the specific task
  const asanaListTool = createAsanaListTool(client);

  // We need to find the task - this is a simplification
  // In a real implementation, we'd have a getTask method
  const projectGid = config.defaultProjectGid;
  if (!projectGid) {
    return err(
      new TriageError('Default project GID required in config for single task mode', 'CONFIGURATION_ERROR')
    );
  }

  const tasksResult = await asanaListTool.listTasks({ projectGid });

  if (isFailure(tasksResult)) {
    return err(tasksResult.error);
  }

  const task = tasksResult.data.find((t) => t.gid === taskGid);

  if (!task) {
    return err(
      new TriageError(`Task ${taskGid} not found`, 'NOT_FOUND_ERROR')
    );
  }

  // Analyze task
  const aiTool = createAIAnalyzeTool(client);
  const analysisResult = await aiTool.analyzeTask(task);
  const analysis = analysisResult.success ? analysisResult.data : undefined;

  // Confirm single task
  if (!options.skipConfirmation) {
    const confirmed = await confirmSingleTask(task, analysis);

    if (!confirmed) {
      displayCancelled();
      return ok({ processed: 0, created: 0, skipped: 1, failed: 0 });
    }
  }

  // Process the task
  const processor = new TaskProcessor(client, context.owner, context.repo, config);
  const result = await processor.processSingleTask(task, options);

  if (result.success) {
    printReport(result.data, { verbose: options.verbose });
  }

  return result;
}

// Re-export types and utilities
export type {
  TriageOptions,
  TriageResult,
  TriageConfig,
  AsanaTask,
  TaskAnalysis,
  CreatedIssueInfo,
  TriageFailure,
} from './types.js';

export { DEFAULT_TRIAGE_CONFIG } from './types.js';
export { parseArgs, getHelpMessage } from './cli.js';
export { loadConfig, loadTriageConfig, validateConfig } from './config.js';
export { selectTasks, confirm } from './interactive.js';
export { TaskProcessor, processTasks, fetchAndProcessTasks } from './processor.js';
export { generateReport, printReport, ProgressReporter } from './report.js';
export { simulateActions, formatDryRunResult, DryRunSimulator } from './dry-run.js';
export { withRetry, handleTriageError, TriageError, ErrorAggregator } from './error-handler.js';
export { confirmBatchWork, confirmSingleTask } from './confirmation.js';

// Export MCP tools
export * from './mcp-tools/index.js';
