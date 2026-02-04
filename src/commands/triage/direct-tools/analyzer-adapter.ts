/**
 * @module commands/triage/direct-tools/analyzer-adapter
 * @description Direct AI analyzer adapter for standalone CLI mode
 */

import type { Result } from '../../../common/types/result.js';
import { ok, err, isSuccess, isFailure } from '../../../common/types/result.js';
import type { AnalyzerToolset } from '../toolset.types.js';
import type { AsanaTask, TaskAnalysis } from '../types.js';
import { AIIntegration, type AIConfig } from '../../autofix/ai-integration.js';

/**
 * Analyzer direct adapter
 *
 * Uses AIIntegration class for Claude CLI-based task analysis.
 * Falls back to heuristic analysis when Claude CLI is unavailable.
 */
export class AnalyzerDirectAdapter implements AnalyzerToolset {
  private readonly ai: AIIntegration;

  constructor(config?: AIConfig) {
    this.ai = new AIIntegration(config);
  }

  async analyzeTask(task: AsanaTask): Promise<Result<TaskAnalysis, Error>> {
    try {
      const result = await this.ai.analyzeAsanaTask(task);

      if (isSuccess(result)) {
        return ok(result.data);
      }

      if (isFailure(result)) {
        // Convert AIError to Error
        return err(new Error(`${result.error.code}: ${result.error.message}`));
      }

      // Shouldn't reach here, but TypeScript needs it
      return err(new Error('Unknown analysis error'));
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

/**
 * Create analyzer direct adapter
 */
export function createAnalyzerDirectAdapter(config?: AIConfig): AnalyzerDirectAdapter {
  return new AnalyzerDirectAdapter(config);
}
