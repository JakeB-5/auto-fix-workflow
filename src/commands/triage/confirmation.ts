/**
 * @module commands/triage/confirmation
 * @description Batch work confirmation prompts
 */

import * as readline from 'node:readline';
import type { AsanaTask, TaskAnalysis, TriageOptions } from './types.js';

/**
 * Confirmation context
 */
export interface ConfirmationContext {
  readonly tasks: readonly AsanaTask[];
  readonly analyses?: Map<string, TaskAnalysis>;
  readonly options: TriageOptions;
}

/**
 * Confirmation result
 */
export interface ConfirmationResult {
  readonly confirmed: boolean;
  readonly modifiedOptions?: Partial<TriageOptions>;
}

/**
 * Display batch summary and ask for confirmation
 */
export async function confirmBatchWork(context: ConfirmationContext): Promise<ConfirmationResult> {
  const { tasks, analyses, options } = context;

  // Display summary
  console.log('\n=== Batch Processing Confirmation ===\n');

  console.log(`Mode: ${options.mode}`);
  console.log(`Dry Run: ${options.dryRun ? 'Yes (no changes will be made)' : 'No'}`);
  console.log(`Tasks to process: ${tasks.length}`);

  if (options.priority) {
    console.log(`Priority filter: ${options.priority}`);
  }

  if (options.limit) {
    console.log(`Limit: ${options.limit}`);
  }

  console.log('');

  // Show task summary
  if (tasks.length > 0) {
    console.log('Tasks:');
    const displayCount = Math.min(tasks.length, 5);

    for (let i = 0; i < displayCount; i++) {
      const task = tasks[i];
      if (task === undefined) continue;
      const analysis = analyses?.get(task.gid);
      const priority = analysis?.priority ?? 'unknown';
      const type = analysis?.issueType ?? 'unknown';

      console.log(`  ${i + 1}. [${priority}] [${type}] ${task.name}`);
    }

    if (tasks.length > displayCount) {
      console.log(`  ... and ${tasks.length - displayCount} more`);
    }

    console.log('');
  }

  // Show what will happen
  console.log('Actions to be performed:');
  console.log('  1. Analyze each task with AI');
  console.log('  2. Create GitHub issue for each task');
  console.log('  3. Update Asana task with GitHub link');
  console.log('  4. Move task to processed section');
  console.log('  5. Add sync tag to task');
  console.log('');

  // Skip confirmation if requested
  if (options.skipConfirmation) {
    console.log('Confirmation skipped (--yes flag provided)');
    return { confirmed: true };
  }

  // Ask for confirmation
  const confirmed = await askConfirmation('Proceed with batch processing?');

  return { confirmed };
}

/**
 * Confirm single task processing
 */
export async function confirmSingleTask(
  task: AsanaTask,
  analysis?: TaskAnalysis
): Promise<boolean> {
  console.log('\n=== Task Details ===\n');

  console.log(`Title: ${task.name}`);
  console.log(`GID: ${task.gid}`);

  if (task.dueOn) {
    console.log(`Due: ${task.dueOn}`);
  }

  if (task.assignee) {
    console.log(`Assignee: ${task.assignee.name}`);
  }

  console.log(`URL: ${task.permalinkUrl}`);

  if (analysis) {
    console.log('\nAI Analysis:');
    console.log(`  Type: ${analysis.issueType}`);
    console.log(`  Priority: ${analysis.priority}`);
    console.log(`  Component: ${analysis.component}`);
    console.log(`  Confidence: ${Math.round(analysis.confidence * 100)}%`);

    if (analysis.labels.length > 0) {
      console.log(`  Labels: ${analysis.labels.join(', ')}`);
    }

    if (analysis.relatedFiles.length > 0) {
      console.log(`  Files: ${analysis.relatedFiles.slice(0, 3).join(', ')}`);
    }
  }

  if (task.notes) {
    console.log('\nDescription:');
    const truncated = task.notes.length > 300 ? task.notes.slice(0, 300) + '...' : task.notes;
    console.log(`  ${truncated.replace(/\n/g, '\n  ')}`);
  }

  console.log('');

  return askConfirmation('Create GitHub issue for this task?');
}

/**
 * Confirm dangerous operation
 */
export async function confirmDangerousOperation(message: string): Promise<boolean> {
  console.log('\n!!! WARNING !!!\n');
  console.log(message);
  console.log('');

  return askConfirmation('Are you absolutely sure?', false);
}

/**
 * Ask for yes/no confirmation
 */
async function askConfirmation(message: string, defaultValue = true): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const hint = defaultValue ? '[Y/n]' : '[y/N]';

  return new Promise((resolve) => {
    rl.question(`${message} ${hint}: `, (answer) => {
      rl.close();

      const normalized = answer.toLowerCase().trim();

      if (normalized === '') {
        resolve(defaultValue);
      } else if (normalized === 'y' || normalized === 'yes') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * Display operation cancelled message
 */
export function displayCancelled(): void {
  console.log('\nOperation cancelled by user.');
}

/**
 * Display starting message
 */
export function displayStarting(taskCount: number): void {
  console.log(`\nStarting to process ${taskCount} task(s)...`);
  console.log('');
}

/**
 * Display task processing progress
 */
export function displayTaskProgress(
  current: number,
  total: number,
  taskName: string,
  status: 'processing' | 'success' | 'failed' | 'skipped'
): void {
  const statusIcon = {
    processing: '[...]',
    success: '[OK]',
    failed: '[FAIL]',
    skipped: '[SKIP]',
  }[status];

  const truncatedName = taskName.length > 50 ? taskName.slice(0, 47) + '...' : taskName;

  if (status === 'processing') {
    process.stdout.write(`\r(${current}/${total}) ${statusIcon} ${truncatedName}`);
  } else {
    console.log(`(${current}/${total}) ${statusIcon} ${truncatedName}`);
  }
}

/**
 * Request limit confirmation for large batches
 */
export async function confirmLargeBatch(taskCount: number, threshold = 20): Promise<ConfirmationResult> {
  if (taskCount <= threshold) {
    return { confirmed: true };
  }

  console.log(`\n!!! Large Batch Warning !!!\n`);
  console.log(`You are about to process ${taskCount} tasks.`);
  console.log(`This may take several minutes and consume API rate limits.`);
  console.log('');

  const options = [
    `1. Continue with all ${taskCount} tasks`,
    `2. Process first ${threshold} tasks only`,
    '3. Cancel',
  ];

  for (const option of options) {
    console.log(option);
  }

  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Select option [1/2/3]: ', (answer) => {
      rl.close();

      const choice = parseInt(answer.trim(), 10);

      switch (choice) {
        case 1:
          resolve({ confirmed: true });
          break;
        case 2:
          resolve({
            confirmed: true,
            modifiedOptions: { limit: threshold },
          });
          break;
        default:
          resolve({ confirmed: false });
      }
    });
  });
}
