/**
 * @module commands/autofix/pipeline/stages/fix-stage
 * @description AI fix application stage
 */

import type { Result } from '../../../../common/types/result.js';
import { err } from '../../../../common/types/result.js';
import type { PipelineContext, PipelineStage, AIFixResult, AIAnalysisResult } from '../../types.js';
import { AIIntegration, type AIError, type AIConfig } from '../../ai-integration.js';
import type { WorktreeStage } from './worktree-stage.js';

/**
 * Fix stage configuration
 */
export interface FixStageConfig {
  readonly aiConfig?: AIConfig;
}

/**
 * Fix Stage
 *
 * Handles AI-powered code fix application
 */
export class FixStage {
  readonly stageName: PipelineStage = 'ai_fix';
  private readonly aiIntegration: AIIntegration;

  constructor(config: FixStageConfig = {}) {
    this.aiIntegration = new AIIntegration(config.aiConfig);
  }

  /**
   * Apply fix with AI
   */
  async execute(
    context: PipelineContext,
    worktreeStage: WorktreeStage
  ): Promise<Result<AIFixResult, AIError>> {
    if (!context.worktree || !context.analysisResult) {
      return err({ code: 'FIX_FAILED', message: 'Missing prerequisites for fix' });
    }

    const result = await this.aiIntegration.applyFix(
      context.group,
      context.analysisResult,
      context.worktree.path
    );

    return result;
  }

  /**
   * Verify that files were actually modified after fix
   */
  async verifyChanges(
    context: PipelineContext,
    worktreeStage: WorktreeStage
  ): Promise<boolean> {
    if (!context.worktree) {
      return false;
    }

    return worktreeStage.hasUncommittedChanges(context.worktree.path);
  }
}

/**
 * Create fix stage
 */
export function createFixStage(config?: FixStageConfig): FixStage {
  return new FixStage(config);
}
