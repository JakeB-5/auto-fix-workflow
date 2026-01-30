/**
 * @module analyzer/task-analyzer/analyzer
 * @description Main TaskAnalyzer class
 */

import { Result, ok, err, isFailure } from '../../common/types/index.js';
import { AsanaClient, type AsanaClientConfig } from './asana-client.js';
import { analyzeReproducibility } from './reproducibility.js';
import { evaluateSufficiency } from './sufficiency.js';
import { extractCodeHints } from './code-hints.js';
import { generateActions } from './actions.js';
import type { TaskAnalysis, AnalyzerError } from './types.js';

/**
 * TaskAnalyzer configuration
 */
export interface TaskAnalyzerConfig extends AsanaClientConfig {
  readonly autoExecuteActions?: boolean;
}

/**
 * Main TaskAnalyzer class
 */
export class TaskAnalyzer {
  private readonly client: AsanaClient;
  private readonly autoExecuteActions: boolean;

  constructor(config: TaskAnalyzerConfig) {
    this.client = new AsanaClient(config);
    this.autoExecuteActions = config.autoExecuteActions ?? false;
  }

  /**
   * Analyze a task by ID
   */
  async analyzeTask(taskId: string): Promise<Result<TaskAnalysis, AnalyzerError>> {
    // Fetch task from Asana
    const taskResult = await this.client.getTask(taskId);
    if (isFailure(taskResult)) {
      return taskResult;
    }

    const task = taskResult.data;

    // Validate task
    if (!task.name || task.name.trim().length === 0) {
      return err({
        code: 'INVALID_TASK',
        message: 'Task must have a name',
      });
    }

    try {
      // Analyze reproducibility
      const reproducibilityResult = analyzeReproducibility(task);

      // Evaluate information sufficiency
      const informationSufficiency = evaluateSufficiency(task);

      // Extract code hints
      const codeHints = extractCodeHints(task);

      // Create analysis result
      const analysis: TaskAnalysis = {
        taskId: task.gid,
        isReproducible: reproducibilityResult.isReproducible,
        confidence: reproducibilityResult.confidence,
        codeHints,
        suggestedActions: [],
        informationSufficiency,
      };

      // Generate suggested actions
      const taskInfo = {
        name: task.name,
        ...(task.notes && { notes: task.notes }),
      };
      const suggestedActions = generateActions(analysis, taskInfo);

      const finalAnalysis: TaskAnalysis = {
        ...analysis,
        suggestedActions,
      };

      // Auto-execute actions if enabled
      if (this.autoExecuteActions) {
        await this.executeActions(taskId, suggestedActions);
      }

      return ok(finalAnalysis);
    } catch (error) {
      return err({
        code: 'ANALYSIS_FAILED',
        message: `Analysis failed: ${(error as Error).message}`,
        cause: error,
      });
    }
  }

  /**
   * Execute suggested actions
   */
  private async executeActions(
    taskId: string,
    actions: readonly { type: string; payload: Record<string, unknown> }[]
  ): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'add_comment':
            await this.client.addComment(taskId, action.payload['text'] as string);
            break;

          case 'add_tag':
            // Note: Requires tag ID lookup, simplified here
            // In production, would need to fetch/create tag by name
            break;

          case 'update_description':
            // Note: Would append to notes field
            break;

          case 'request_information':
            // Could add a comment requesting information
            const missing = action.payload['missingElements'] as string[];
            const comment = `Please provide the following information:\n${missing.map((m) => `- ${m}`).join('\n')}`;
            await this.client.addComment(taskId, comment);
            break;

          case 'mark_blocked':
            // Could add a tag or update custom field
            break;
        }
      } catch (error) {
        // Log error but continue with other actions
        console.error(`Failed to execute action ${action.type}:`, error);
      }
    }
  }

  /**
   * Get Asana client (for advanced usage)
   */
  getClient(): AsanaClient {
    return this.client;
  }
}
