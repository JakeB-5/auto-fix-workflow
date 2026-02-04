/**
 * @module commands/triage/cli-entry
 * @description Standalone CLI entry point for triage command
 */

import { parseArgs, HelpRequestedError, VersionRequestedError, getHelpMessage } from './cli.js';
import { loadConfig as loadTriageConfig } from './config.js';
import { createToolset, isDirectModeAvailable } from './toolset-factory.js';
import { loadConfig as loadGlobalConfig } from '../../common/config-loader/index.js';
import { isFailure, isSuccess } from '../../common/types/index.js';
import type { Result } from '../../common/types/index.js';
import type {
  TriageOptions,
  TriageResult,
  TriageConfig,
  AsanaTask,
  CreatedIssueInfo,
  TriageFailure,
} from './types.js';
import type { TriageToolset } from './toolset.types.js';
import { DryRunSimulator, formatDryRunResult, toTriageResult } from './dry-run.js';

/**
 * Process tasks using the TriageToolset
 */
async function processTasks(
  toolset: TriageToolset,
  tasks: AsanaTask[],
  triageConfig: TriageConfig,
  options: TriageOptions,
  projectGid: string,
  owner: string,
  repo: string
): Promise<Result<TriageResult, Error>> {
  // Handle dry run mode
  if (options.dryRun) {
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
    return { success: true, data: toTriageResult(dryRunResult) };
  }

  const startTime = Date.now();
  const createdIssues: CreatedIssueInfo[] = [];
  const failures: TriageFailure[] = [];
  let skipped = 0;

  // Get processed section GID
  const processedSectionResult = await toolset.asana.findSectionByName(
    projectGid,
    triageConfig.processedSectionName
  );
  const processedSectionGid = isSuccess(processedSectionResult)
    ? processedSectionResult.data
    : null;

  for (const task of tasks) {
    try {
      // Check if already synced
      const alreadySynced = task.tags?.some(
        (t) => t.name.toLowerCase() === triageConfig.syncedTagName.toLowerCase()
      );

      if (alreadySynced) {
        if (options.verbose) {
          console.log(`  Skipped: ${task.name} (already synced)`);
        }
        skipped++;
        continue;
      }

      // Analyze task
      if (options.verbose) {
        console.log(`  Analyzing: ${task.name}`);
      }
      const analysisResult = await toolset.analyzer.analyzeTask(task);
      if (isFailure(analysisResult)) {
        failures.push({
          asanaTaskGid: task.gid,
          title: task.name,
          error: analysisResult.error.message,
          retryable: true,
        });
        continue;
      }

      const analysis = analysisResult.data;

      // Build issue title and body from analysis
      const issueTitle = `[${analysis.issueType}] ${task.name}`;
      const issueBody = `## Summary\n\n${analysis.summary}\n\n` +
        `## Source\n\nAsana task: ${task.permalinkUrl}\n\n` +
        (analysis.acceptanceCriteria.length > 0
          ? `## Acceptance Criteria\n\n${analysis.acceptanceCriteria.map(c => `- ${c}`).join('\n')}\n\n`
          : '') +
        (analysis.relatedFiles.length > 0
          ? `## Related Files\n\n${analysis.relatedFiles.map(f => `- \`${f}\``).join('\n')}\n`
          : '');

      // Create GitHub issue
      if (options.verbose) {
        console.log(`  Creating issue: ${issueTitle}`);
      }
      const issueResult = await toolset.github.createIssue({
        title: issueTitle,
        body: issueBody,
        labels: [...analysis.labels],
        owner,
        repo,
      });

      if (isFailure(issueResult)) {
        failures.push({
          asanaTaskGid: task.gid,
          title: task.name,
          error: issueResult.error.message,
          retryable: true,
        });
        continue;
      }

      const issue = issueResult.data;
      const issueInfo: CreatedIssueInfo = {
        asanaTaskGid: task.gid,
        githubIssueNumber: issue.number,
        githubIssueUrl: issue.url,
        title: task.name,
      };
      createdIssues.push(issueInfo);

      // Update Asana task (best effort)
      if (processedSectionGid) {
        await toolset.asana.updateTask({
          taskGid: task.gid,
          sectionGid: processedSectionGid,
          appendNotes: `GitHub issue created: ${issue.url}`,
        });
      }

    } catch (error) {
      failures.push({
        asanaTaskGid: task.gid,
        title: task.name,
        error: error instanceof Error ? error.message : String(error),
        retryable: false,
      });
    }
  }

  return {
    success: true,
    data: {
      processed: tasks.length,
      created: createdIssues.length,
      skipped,
      failed: failures.length,
      createdIssues,
      failures,
      durationMs: Date.now() - startTime,
    },
  };
}

/**
 * Main CLI entry point for triage command
 */
/* eslint-disable no-console */
export async function main(argv: string[] = []): Promise<void> {
  try {
    // Parse CLI arguments
    const argsResult = parseArgs(argv);

    // Handle help/version errors
    if (isFailure(argsResult)) {
      const error = argsResult.error;
      if (error instanceof HelpRequestedError) {
        console.log(getHelpMessage());
        process.exit(0);
      }
      if (error instanceof VersionRequestedError) {
        console.log(error.version);
        process.exit(0);
      }
      // Other parsing errors
      console.error('Error:', error.message);
      process.exit(1);
    }

    const options = argsResult.data;

    // Check if direct mode is available
    if (!isDirectModeAvailable()) {
      console.error('Error: Triage standalone mode is not yet implemented.');
      console.error('Use triage via MCP client (Claude Code) with asana_analyze_task tool.');
      process.exit(1);
    }

    // Load global config
    const configResult = await loadGlobalConfig();
    if (isFailure(configResult)) {
      console.error('Error loading configuration:', configResult.error.message);
      console.error('\nMake sure you have configured:');
      console.error('  - ASANA_TOKEN environment variable');
      console.error('  - GITHUB_TOKEN environment variable');
      console.error('  - .auto-fix.yaml config file (optional)');
      process.exit(2);
    }

    const globalConfig = configResult.data;

    // Validate required config
    if (!globalConfig.asana) {
      console.error('Error: Asana configuration is required.');
      console.error('Set ASANA_TOKEN environment variable or configure in .auto-fix.yaml');
      process.exit(2);
    }

    if (!globalConfig.github) {
      console.error('Error: GitHub configuration is required.');
      console.error('Set GITHUB_TOKEN environment variable or configure in .auto-fix.yaml');
      process.exit(2);
    }

    // Extract GitHub owner and repo
    const owner = globalConfig.github.owner || process.env['GITHUB_OWNER'];
    const repo = globalConfig.github.repo || process.env['GITHUB_REPO'];

    if (!owner || !repo) {
      console.error('Error: GitHub owner and repo are required.');
      console.error('Set GITHUB_OWNER and GITHUB_REPO environment variables or configure in .auto-fix.yaml');
      process.exit(2);
    }

    // Load triage-specific config
    const triageConfigResult = await loadTriageConfig();
    if (isFailure(triageConfigResult)) {
      console.error('Error loading triage configuration:', triageConfigResult.error.message);
      process.exit(2);
    }

    const triageConfig = triageConfigResult.data;

    // Determine project GID
    const projectGid =
      options.projectId ||
      triageConfig.defaultProjectGid ||
      (globalConfig.asana.projectGids && globalConfig.asana.projectGids.length > 0
        ? globalConfig.asana.projectGids[0]
        : undefined);

    if (!projectGid) {
      console.error('Error: Project GID is required.');
      console.error('Use --project <gid> or set defaultProjectGid in config.');
      process.exit(2);
    }

    // Create toolset in direct mode
    const toolset = await createToolset('direct', { config: globalConfig });

    // Verbose output
    if (options.verbose) {
      console.log('Starting triage...');
      console.log(`  Mode: ${options.mode}`);
      console.log(`  Dry run: ${options.dryRun}`);
      console.log(`  Project: ${projectGid}`);
      if (options.sectionId) {
        console.log(`  Section: ${options.sectionId}`);
      }
      if (options.priority) {
        console.log(`  Priority filter: ${options.priority}`);
      }
      if (options.limit) {
        console.log(`  Limit: ${options.limit}`);
      }
    }

    // Find triage section
    const sectionGid = options.sectionId || triageConfig.triageSectionName;
    const sectionResult = await toolset.asana.findSectionByName(projectGid, sectionGid || 'Triage');

    if (isFailure(sectionResult)) {
      console.error(`Error finding section: ${sectionResult.error.message}`);
      process.exit(2);
    }

    const triageSectionGid = sectionResult.data;
    if (!triageSectionGid && !options.sectionId) {
      console.error(`Error: Triage section "${triageConfig.triageSectionName || 'Triage'}" not found.`);
      console.error('Use --section <gid> to specify a section, or configure triageSectionName in config.');
      process.exit(2);
    }

    // Fetch tasks from section
    if (options.verbose) {
      console.log(`Fetching tasks from section...`);
    }
    const tasksResult = await toolset.asana.listTasks({
      projectGid,
      sectionGid: triageSectionGid || options.sectionId,
      limit: options.limit,
    });

    if (isFailure(tasksResult)) {
      console.error(`Error fetching tasks: ${tasksResult.error.message}`);
      process.exit(2);
    }

    let tasks = tasksResult.data;

    // Filter by priority if specified
    if (options.priority) {
      tasks = tasks.filter((task) => {
        const priorityField = task.customFields?.find(
          (f) => f.name.toLowerCase() === (triageConfig.priorityFieldName || 'priority').toLowerCase()
        );
        return priorityField?.displayValue?.toLowerCase() === options.priority?.toLowerCase();
      });
    }

    if (tasks.length === 0) {
      console.log('No tasks found to process.');
      process.exit(0);
    }

    console.log(`Found ${tasks.length} task(s) to process.`);

    // Process tasks
    const result = await processTasks(toolset, tasks, triageConfig, options, projectGid, owner, repo);

    if (isFailure(result)) {
      console.error('Triage failed:', result.error.message);
      process.exit(1);
    }

    const triageResult = result.data;

    // Print summary
    console.log('\n=== Triage Complete ===');
    console.log(`  Processed: ${triageResult.processed}`);
    console.log(`  Created:   ${triageResult.created}`);
    console.log(`  Skipped:   ${triageResult.skipped}`);
    console.log(`  Failed:    ${triageResult.failed}`);

    if (triageResult.createdIssues && triageResult.createdIssues.length > 0) {
      console.log('\nCreated Issues:');
      for (const issue of triageResult.createdIssues) {
        console.log(`  - #${issue.githubIssueNumber}: ${issue.title}`);
        console.log(`    ${issue.githubIssueUrl}`);
      }
    }

    if (triageResult.failures && triageResult.failures.length > 0) {
      console.log('\nFailures:');
      for (const failure of triageResult.failures) {
        console.log(`  - ${failure.title}: ${failure.error}`);
      }
    }

    // Exit with error code if there were failures
    if (triageResult.failed > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('Unexpected error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Note: Direct execution is handled by the bin script in package.json
// This module exports the main() function for programmatic use
