/**
 * @module commands/triage/interactive
 * @description Interactive task selection UI
 */

import * as readline from 'node:readline';
import type { AsanaTask, TaskAnalysis } from './types.js';

/**
 * Selection state for a task
 */
interface TaskSelection {
  readonly task: AsanaTask;
  readonly analysis?: TaskAnalysis | undefined;
  selected: boolean;
}

/**
 * Interactive selection result
 */
export interface SelectionResult {
  readonly selected: readonly AsanaTask[];
  readonly skipped: readonly AsanaTask[];
  readonly cancelled: boolean;
}

/**
 * Interactive task selector
 */
export class InteractiveSelector {
  private readonly rl: readline.Interface;
  private selections: TaskSelection[] = [];
  private currentIndex = 0;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Select tasks interactively
   */
  async selectTasks(
    tasks: readonly AsanaTask[],
    analyses?: Map<string, TaskAnalysis>
  ): Promise<SelectionResult> {
    if (tasks.length === 0) {
      return { selected: [], skipped: [], cancelled: false };
    }

    this.selections = tasks.map((task) => ({
      task,
      analysis: analyses?.get(task.gid),
      selected: false,
    }));

    this.printHeader(tasks.length);

    try {
      for (let i = 0; i < this.selections.length; i++) {
        this.currentIndex = i;
        const selection = this.selections[i];
        if (selection === undefined) continue;

        this.printTask(selection, i + 1, this.selections.length);

        const action = await this.promptAction();

        switch (action) {
          case 'select':
            selection.selected = true;
            break;
          case 'skip':
            selection.selected = false;
            break;
          case 'all':
            // Select all remaining
            for (let j = i; j < this.selections.length; j++) {
              const s = this.selections[j];
              if (s !== undefined) s.selected = true;
            }
            i = this.selections.length; // Exit loop
            break;
          case 'none':
            // Skip all remaining
            for (let j = i; j < this.selections.length; j++) {
              const s = this.selections[j];
              if (s !== undefined) s.selected = false;
            }
            i = this.selections.length; // Exit loop
            break;
          case 'quit':
            this.rl.close();
            return {
              selected: [],
              skipped: tasks,
              cancelled: true,
            };
        }
      }

      this.rl.close();

      const selected = this.selections.filter((s) => s.selected).map((s) => s.task);
      const skipped = this.selections.filter((s) => !s.selected).map((s) => s.task);

      this.printSummary(selected.length, skipped.length);

      return { selected, skipped, cancelled: false };
    } catch (error) {
      this.rl.close();
      throw error;
    }
  }

  /**
   * Print header
   */
  private printHeader(totalTasks: number): void {
    console.log('\n=== Triage Task Selection ===');
    console.log(`Found ${totalTasks} task(s) to review\n`);
    console.log('Actions: [y] Select  [n] Skip  [a] Select all  [s] Skip all  [q] Quit\n');
  }

  /**
   * Print task details
   */
  private printTask(selection: TaskSelection, current: number, total: number): void {
    const { task, analysis } = selection;

    console.log(`--- Task ${current}/${total} ---`);
    console.log(`Title: ${task.name}`);

    if (task.dueOn) {
      console.log(`Due: ${task.dueOn}`);
    }

    if (task.assignee) {
      console.log(`Assignee: ${task.assignee.name}`);
    }

    if (analysis) {
      console.log(`\nAI Analysis:`);
      console.log(`  Type: ${analysis.issueType}`);
      console.log(`  Priority: ${analysis.priority}`);
      console.log(`  Component: ${analysis.component}`);
      console.log(`  Confidence: ${Math.round(analysis.confidence * 100)}%`);

      if (analysis.relatedFiles.length > 0) {
        console.log(`  Related files: ${analysis.relatedFiles.slice(0, 3).join(', ')}`);
      }
    }

    if (task.notes) {
      const truncatedNotes = task.notes.length > 200
        ? task.notes.slice(0, 200) + '...'
        : task.notes;
      console.log(`\nDescription:\n  ${truncatedNotes.replace(/\n/g, '\n  ')}`);
    }

    console.log(`\nURL: ${task.permalinkUrl}`);
    console.log('');
  }

  /**
   * Prompt for action
   */
  private async promptAction(): Promise<'select' | 'skip' | 'all' | 'none' | 'quit'> {
    return new Promise((resolve) => {
      this.rl.question('Select this task? [y/n/a/s/q]: ', (answer) => {
        const normalized = answer.toLowerCase().trim();

        switch (normalized) {
          case 'y':
          case 'yes':
            resolve('select');
            break;
          case 'n':
          case 'no':
            resolve('skip');
            break;
          case 'a':
          case 'all':
            resolve('all');
            break;
          case 's':
          case 'skip':
            resolve('none');
            break;
          case 'q':
          case 'quit':
            resolve('quit');
            break;
          default:
            // Default to skip for invalid input
            console.log('Invalid input, skipping...');
            resolve('skip');
        }
      });
    });
  }

  /**
   * Print selection summary
   */
  private printSummary(selectedCount: number, skippedCount: number): void {
    console.log('\n=== Selection Summary ===');
    console.log(`Selected: ${selectedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log('');
  }
}

/**
 * Simple function interface for selecting tasks
 */
export async function selectTasks(
  tasks: readonly AsanaTask[],
  analyses?: Map<string, TaskAnalysis>
): Promise<readonly AsanaTask[]> {
  const selector = new InteractiveSelector();
  const result = await selector.selectTasks(tasks, analyses);

  if (result.cancelled) {
    throw new Error('Selection cancelled by user');
  }

  return result.selected;
}

/**
 * Prompt for confirmation (yes/no)
 */
export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const defaultHint = defaultValue ? '[Y/n]' : '[y/N]';

  return new Promise((resolve) => {
    rl.question(`${message} ${defaultHint}: `, (answer) => {
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
 * Prompt for input with default value
 */
export async function prompt(message: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const defaultHint = defaultValue ? ` [${defaultValue}]` : '';

  return new Promise((resolve) => {
    rl.question(`${message}${defaultHint}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/**
 * Display a spinner while waiting
 */
export class Spinner {
  private readonly frames = ['|', '/', '-', '\\'];
  private frameIndex = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly message: string;

  constructor(message: string) {
    this.message = message;
  }

  start(): void {
    this.intervalId = setInterval(() => {
      process.stdout.write(`\r${this.frames[this.frameIndex]} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 100);
  }

  stop(finalMessage?: string): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    process.stdout.write('\r' + ' '.repeat(this.message.length + 3) + '\r');
    if (finalMessage) {
      console.log(finalMessage);
    }
  }
}

/**
 * Display progress bar
 */
export function displayProgress(current: number, total: number, message?: string): void {
  const percent = Math.round((current / total) * 100);
  const barLength = 30;
  const filledLength = Math.round((current / total) * barLength);
  const bar = '='.repeat(filledLength) + '-'.repeat(barLength - filledLength);

  const progressLine = `\r[${bar}] ${percent}% (${current}/${total})`;
  const fullLine = message ? `${progressLine} - ${message}` : progressLine;

  process.stdout.write(fullLine);

  if (current === total) {
    console.log(''); // New line at completion
  }
}
