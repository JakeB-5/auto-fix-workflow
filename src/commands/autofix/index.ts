/**
 * @module commands/autofix
 * @description Main entry point for the autofix command
 */

import type { Config } from '../../common/types/index.js';
import type { Result } from '../../common/types/result.js';
import { ok, err, isSuccess } from '../../common/types/result.js';
import { loadConfig } from '../../common/config-loader/index.js';
import type { AutofixOptions, AutofixResult, GroupResult } from './types.js';
import {
  parseArgs,
  loadEnvConfig,
  mergeConfigs,
  validateConfig,
  DEFAULT_CONFIG,
  generateHelpText,
} from './config.js';
import { createFetcher } from './fetcher.js';
import { createQueue } from './queue.js';
import { createPipeline } from './pipeline.js';
import { createProgressReporter, type ProgressConfig } from './progress.js';
import { createInterruptHandler, withCleanup, removeSignalHandlers } from './interrupt.js';
import { createWorktreeManager } from './worktree-manager.js';
import { createAutofixResult, printReport, generateSummaryLine } from './report.js';
import { executeDryRun, checkConflicts } from './dry-run.js';
import { AutofixError } from '../../common/error-handler/index.js';
import { ErrorAggregator } from './error-utils.js';

// Re-export types
export type { AutofixOptions, AutofixResult, GroupResult } from './types.js';
export { AutofixError } from '../../common/error-handler/index.js';
export { ErrorAggregator } from './error-utils.js';

/**
 * Run autofix error
 */
export interface RunAutofixError {
  readonly code: string;
  readonly message: string;
  readonly cause?: Error;
}

/**
 * Main autofix command
 */
export async function runAutofix(
  args: unknown,
  configOverrides?: Partial<Config>
): Promise<Result<AutofixResult, RunAutofixError>> {
  const startTime = new Date();

  // Parse arguments
  let options: AutofixOptions;
  try {
    options = parseArgs(args);
  } catch (error) {
    return err({
      code: 'INVALID_ARGS',
      message: `Invalid arguments: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Validate --all and --issues conflict (additional runtime check)
  if (options.all && options.issueNumbers && options.issueNumbers.length > 0) {
    return err({
      code: 'INVALID_ARGS',
      message: 'Cannot use --all and --issues together',
    });
  }

  // Load configuration from .auto-fix.yaml file
  const fileConfigResult = await loadConfig();
  const fileConfig = isSuccess(fileConfigResult) ? fileConfigResult.data : {};

  // Load and merge configuration (file config takes precedence over defaults, env over file)
  const envConfig = loadEnvConfig();
  const config = mergeConfigs(
    DEFAULT_CONFIG as Config,
    fileConfig as Config,
    envConfig as Config,
    configOverrides ?? {}
  );

  // Validate configuration
  const validation = validateConfig(config);
  if (!validation.valid) {
    return err({
      code: 'CONFIG_INVALID',
      message: validation.errors.join('\n'),
    });
  }

  // Get repository path
  const repoPath = process.cwd();

  // Initialize components
  const fetcher = createFetcher(config);
  const worktreeManager = createWorktreeManager(config, repoPath);
  const progressReporter = createProgressReporter(
    options.verbose ? { verbose: true } : {}
  );
  const interruptHandler = createInterruptHandler();

  try {
    // Fetch and group issues
    if (options.verbose) {
      console.log('Fetching issues...');
    }

    const fetchResult = await fetcher.fetchAndGroup(options);
    if (!isSuccess(fetchResult)) {
      return err({
        code: 'FETCH_FAILED',
        message: fetchResult.error.message,
      });
    }

    const { groups, issues, ungroupedIssues } = fetchResult.data;

    if (groups.length === 0) {
      return err({
        code: 'NO_GROUPS',
        message: 'No issue groups to process',
      });
    }

    if (options.verbose) {
      console.log(`Found ${issues.length} issues in ${groups.length} groups`);
      if (ungroupedIssues.length > 0) {
        console.log(`${ungroupedIssues.length} issues could not be grouped`);
      }
    }

    // Handle --all flag (skip confirmation if set)
    // When confirmation is implemented, this flag will bypass it
    // For now, --all acts as explicit intent to process all issues
    if (options.all) {
      if (options.verbose) {
        console.log('Processing all issues without confirmation (--all flag set)');
      }
    }

    // Check for conflicts
    const conflictCheck = await checkConflicts(groups, config);
    if (conflictCheck.hasConflicts) {
      return err({
        code: 'CONFLICTS_DETECTED',
        message: `Conflicts detected:\n${conflictCheck.conflicts.map(c => c.description).join('\n')}`,
      });
    }

    // Handle dry-run mode
    if (options.dryRun) {
      const { result, preview } = executeDryRun(groups, config, options);
      console.log(preview);

      // In dry-run mode, also perform actual AI analysis for first group
      if (groups.length > 0 && process.env['DEBUG']) {
        console.log('\n[DEBUG] Running actual AI analysis in dry-run mode...\n');
        const { AIIntegration } = await import('./ai-integration.js');
        const aiIntegration = new AIIntegration();
        const firstGroup = groups[0]!;

        try {
          const analysisResult = await aiIntegration.analyzeGroup(firstGroup, repoPath);
          if (isSuccess(analysisResult)) {
            console.log('[DEBUG] AI Analysis Result:');
            console.log(JSON.stringify(analysisResult.data, null, 2));
          } else {
            console.log('[DEBUG] AI Analysis failed:', analysisResult.error.message);
          }
        } catch (error) {
          console.log('[DEBUG] AI Analysis error:', error);
        }
      }

      return ok(result);
    }

    // Start processing
    progressReporter.start(groups);

    // Create processing queue
    const queue = createQueue(options.maxParallel, options.maxRetries);

    // Set up processor function
    queue.setProcessor(async (group, attempt) => {
      const pipeline = createPipeline({
        config,
        dryRun: options.dryRun,
        maxRetries: options.maxRetries,
        baseBranch: options.baseBranch ?? 'autofixing',
        repoPath,
      });

      // Set up progress reporting
      pipeline.onStageChange((stage, context) => {
        progressReporter.groupStage(group.id, stage);
      });

      return pipeline.processGroup(group);
    });

    // Listen to queue events
    queue.on((event) => {
      switch (event.type) {
        case 'item_started':
          if (event.item) {
            progressReporter.groupStart(event.item.group.id);
          }
          break;
        case 'item_completed':
          if (event.item && event.result) {
            progressReporter.groupComplete(event.item.group.id, event.result);
          }
          break;
        case 'item_failed':
          if (event.item) {
            progressReporter.groupFailed(event.item.group.id, event.item.error ?? 'Unknown error');
          }
          break;
        case 'item_retrying':
          if (event.item) {
            progressReporter.groupRetry(event.item.group.id, event.item.attempt);
          }
          break;
      }
    });

    // Enqueue groups
    queue.enqueue(groups);

    // Run with cleanup guarantee
    const results = await withCleanup(
      interruptHandler,
      async () => {
        // Start worktree auto-cleanup
        worktreeManager.startAutoCleanup();

        // Process queue
        return queue.start();
      },
      async () => {
        // Cleanup on interrupt
        worktreeManager.stopAutoCleanup();
        await worktreeManager.cleanupAll();
      }
    );

    // Stop worktree cleanup
    worktreeManager.stopAutoCleanup();

    // Generate final result
    const finalResult = createAutofixResult(results, options.dryRun, startTime);

    // Report completion
    const stats = queue.getStats();
    progressReporter.complete(stats, results);

    // Print report
    if (options.verbose) {
      printReport(finalResult, { verbose: true });
    } else {
      console.log(generateSummaryLine(finalResult));
    }

    return ok(finalResult);
  } catch (error) {
    if (interruptHandler.isInterrupted) {
      progressReporter.interrupted();
      return err({
        code: 'INTERRUPTED',
        message: 'Operation interrupted by user',
      });
    }

    // Convert error to RunAutofixError
    let code = 'PIPELINE_FAILED';
    let message = 'Unknown error';

    if (error instanceof AutofixError) {
      code = error.code;
      message = error.message;
    } else if (error instanceof Error) {
      message = error.message;
    } else {
      message = String(error);
    }

    const errorResult: RunAutofixError = {
      code,
      message,
    };
    if (error instanceof Error) {
      (errorResult as { cause?: Error }).cause = error;
    }
    return err(errorResult);
  } finally {
    removeSignalHandlers();
  }
}

/**
 * CLI entry point
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  // Check for help flag
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(generateHelpText());
    process.exit(0);
  }

  // Parse CLI arguments into object
  const args = parseCliArgs(argv);

  const result = await runAutofix(args);

  if (!isSuccess(result)) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }

  // Exit with non-zero if there were failures
  if (result.data.totalFailed > 0) {
    process.exit(1);
  }
}

/**
 * Parse CLI arguments
 */
function parseCliArgs(argv: string[]): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      const nextArg = argv[i + 1];

      if (nextArg && !nextArg.startsWith('--')) {
        // Boolean check
        if (nextArg === 'true') {
          args[key] = true;
        } else if (nextArg === 'false') {
          args[key] = false;
        } else if (!isNaN(Number(nextArg))) {
          args[key] = Number(nextArg);
        } else {
          args[key] = nextArg;
        }
        i++;
      } else {
        // Flag without value = true
        args[key] = true;
      }
    }
  }

  return args;
}

// Export submodules
export * from './types.js';
export * from './config.js';
export * from './fetcher.js';
export * from './queue.js';
export * from './pipeline.js';
export * from './progress.js';
export * from './interrupt.js';
export * from './worktree-manager.js';
export * from './report.js';
export * from './dry-run.js';
export * from './error-system.js';
export * from './ai-integration.js';

// Export MCP tools
export * from './mcp-tools/index.js';
