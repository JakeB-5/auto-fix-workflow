/**
 * @module commands/autofix/pipeline/stages/analysis-stage
 * @description AI analysis stage for issue groups
 */

import type { IssueGroup } from '../../../../common/types/index.js';
import type { Result } from '../../../../common/types/result.js';
import { err } from '../../../../common/types/result.js';
import type { PipelineContext, PipelineStage, AIAnalysisResult } from '../../types.js';
import { AIIntegration, type AIError, type AIConfig } from '../../ai-integration.js';

/**
 * Analysis stage configuration
 */
export interface AnalysisStageConfig {
  readonly aiConfig?: AIConfig;
}

/**
 * Analysis Stage
 *
 * Handles AI-powered analysis of issue groups to determine fix strategy
 */
export class AnalysisStage {
  readonly stageName: PipelineStage = 'ai_analysis';
  private readonly aiIntegration: AIIntegration;

  constructor(config: AnalysisStageConfig = {}) {
    this.aiIntegration = new AIIntegration(config.aiConfig);
  }

  /**
   * Analyze the group with AI
   */
  async execute(context: PipelineContext): Promise<Result<AIAnalysisResult, AIError>> {
    if (!context.worktree) {
      return err({ code: 'ANALYSIS_FAILED', message: 'No worktree available for analysis' });
    }

    return this.aiIntegration.analyzeGroup(context.group, context.worktree.path);
  }

  /**
   * Check if AI can handle this group
   */
  canHandle(group: IssueGroup): boolean {
    return this.aiIntegration.canHandle(group);
  }

  /**
   * Estimate complexity of a group
   */
  estimateComplexity(group: IssueGroup): 'low' | 'medium' | 'high' {
    return this.aiIntegration.estimateComplexity(group);
  }

  /**
   * Get suggested approach for a group
   */
  getSuggestedApproach(group: IssueGroup): string {
    return this.aiIntegration.getSuggestedApproach(group);
  }
}

/**
 * Create analysis stage
 */
export function createAnalysisStage(config?: AnalysisStageConfig): AnalysisStage {
  return new AnalysisStage(config);
}
