/**
 * @module commands/autofix/pipeline
 * @description Single group processing pipeline
 */

import type { IssueGroup, Config, CheckResult, PullRequest, WorktreeInfo } from '../../common/types/index.js';
import type { Result } from '../../common/types/result.js';
import { ok, err, isSuccess } from '../../common/types/result.js';
import type {
  GroupResult,
  PipelineContext,
  PipelineStage,
  PipelineError,
  AIAnalysisResult,
  AIFixResult,
} from './types.js';
import {
  WorktreeStage,
  AnalysisStage,
  FixStage,
  CheckStage,
  CommitStage,
  PRStage,
  createWorktreeStage,
  createAnalysisStage,
  createFixStage,
  createCheckStage,
  createCommitStage,
  createPRStage,
} from './pipeline/stages/index.js';

/**
 * Pipeline error codes
 */
export type PipelineErrorCode =
  | 'WORKTREE_CREATE_FAILED'
  | 'ANALYSIS_FAILED'
  | 'FIX_FAILED'
  | 'CHECKS_FAILED'
  | 'COMMIT_FAILED'
  | 'PR_CREATE_FAILED'
  | 'ISSUE_UPDATE_FAILED'
  | 'CLEANUP_FAILED'
  | 'INTERRUPTED';

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  readonly config: Config;
  readonly dryRun: boolean;
  readonly maxRetries: number;
  readonly baseBranch: string;
  readonly repoPath: string;
}

/**
 * Pipeline event handler
 */
export type PipelineEventHandler = (
  stage: PipelineStage,
  context: PipelineContext
) => void;

/**
 * Pipeline stages container
 */
export interface PipelineStages {
  readonly worktree: WorktreeStage;
  readonly analysis: AnalysisStage;
  readonly fix: FixStage;
  readonly check: CheckStage;
  readonly commit: CommitStage;
  readonly pr: PRStage;
}

/**
 * Processing Pipeline
 *
 * Handles the full processing flow for a single issue group
 */
export class ProcessingPipeline {
  private readonly stages: PipelineStages;
  private readonly pipelineConfig: PipelineConfig;
  private eventHandler?: PipelineEventHandler;

  constructor(config: PipelineConfig, stages?: PipelineStages) {
    this.pipelineConfig = config;

    // Use provided stages or create default ones
    this.stages = stages ?? this.createDefaultStages(config);
  }

  /**
   * Create default stages from config
   */
  private createDefaultStages(config: PipelineConfig): PipelineStages {
    return {
      worktree: createWorktreeStage(config.config, config.repoPath, config.baseBranch),
      analysis: createAnalysisStage(),
      fix: createFixStage(),
      check: createCheckStage(config.config.checks ?? {}),
      commit: createCommitStage(),
      pr: createPRStage(config.config, config.baseBranch),
    };
  }

  /**
   * Set event handler for stage updates
   */
  onStageChange(handler: PipelineEventHandler): void {
    this.eventHandler = handler;
  }

  /**
   * Process a single group through the pipeline
   */
  async processGroup(group: IssueGroup): Promise<GroupResult> {
    const startedAt = new Date();
    const context: PipelineContext = {
      stage: 'init',
      group,
      attempt: 1,
      maxRetries: this.pipelineConfig.maxRetries,
      dryRun: this.pipelineConfig.dryRun,
      startedAt,
      errors: [],
    };

    try {
      // Stage 1: Create worktree
      await this.runStage(context, 'worktree_create', async () => {
        const result = await this.stages.worktree.execute(context);
        if (!isSuccess(result)) {
          throw new Error(result.error.message);
        }
        context.worktree = result.data;
      });

      // Stage 2: AI Analysis
      await this.runStage(context, 'ai_analysis', async () => {
        const result = await this.stages.analysis.execute(context);
        if (!isSuccess(result)) {
          throw new Error(result.error.message);
        }
        context.analysisResult = result.data;
      });

      // Stage 3: AI Fix
      await this.runStage(context, 'ai_fix', async () => {
        const result = await this.stages.fix.execute(context, this.stages.worktree);
        if (!isSuccess(result)) {
          throw new Error(result.error.message);
        }
        context.fixResult = result.data;

        // Verify that files were actually modified
        const hasChanges = await this.stages.fix.verifyChanges(context, this.stages.worktree);
        if (!hasChanges) {
          throw new Error('AI reported success but no files were actually modified in the worktree');
        }
      });

      // Stage 4: Install dependencies (worktrees don't share node_modules)
      await this.runStage(context, 'install_deps', async () => {
        if (!context.worktree) {
          throw new Error('No worktree available for dependency installation');
        }
        const result = await this.stages.check.installDependencies(context.worktree.path);
        if (!isSuccess(result)) {
          throw new Error(result.error.message);
        }
      });

      // Stage 5: Run Checks
      await this.runStage(context, 'checks', async () => {
        const result = await this.stages.check.execute(context);
        if (!isSuccess(result)) {
          throw new Error(result.error.message);
        }
        context.checkResult = result.data;

        if (!result.data.passed) {
          const errorDetails = this.stages.check.formatCheckFailures(result.data);
          throw new Error(`Checks failed:\n${errorDetails}`);
        }
      });

      // Stage 6: Commit changes
      await this.runStage(context, 'commit', async () => {
        const result = await this.stages.commit.execute(context, this.stages.worktree);
        if (!isSuccess(result)) {
          throw new Error(result.error.message);
        }
      });

      // Stage 7: Create PR
      await this.runStage(context, 'pr_create', async () => {
        const result = await this.stages.pr.execute(context);
        if (!isSuccess(result)) {
          throw new Error(result.error.message);
        }
        context.pr = result.data;
      });

      // Stage 8: Update Issues
      await this.runStage(context, 'issue_update', async () => {
        await this.stages.pr.updateIssues(context);
      });

      // Stage 9: Cleanup
      await this.runStage(context, 'cleanup', async () => {
        await this.stages.worktree.cleanup(context, /* keepBranch */ true);
      });

      context.stage = 'done';
      this.emitStageChange(context);

      return this.createResult(context, 'completed');
    } catch (error) {
      // Add error to context
      context.errors.push({
        stage: context.stage,
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        recoverable: this.isRecoverable(context.stage),
      });

      // Attempt cleanup
      try {
        await this.stages.worktree.cleanup(context, /* keepBranch */ false);
      } catch {
        // Ignore cleanup errors
      }

      return this.createResult(
        context,
        'failed',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Run a pipeline stage
   */
  private async runStage(
    context: PipelineContext,
    stage: PipelineStage,
    fn: () => Promise<void>
  ): Promise<void> {
    context.stage = stage;
    this.emitStageChange(context);

    if (this.pipelineConfig.dryRun && this.shouldSkipInDryRun(stage)) {
      return;
    }

    await fn();
  }

  /**
   * Emit stage change event
   */
  private emitStageChange(context: PipelineContext): void {
    if (this.eventHandler) {
      this.eventHandler(context.stage, context);
    }
  }

  /**
   * Check if stage should skip in dry-run
   */
  private shouldSkipInDryRun(stage: PipelineStage): boolean {
    return ['ai_fix', 'commit', 'pr_create', 'issue_update'].includes(stage);
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(stage: PipelineStage): boolean {
    return ['checks', 'ai_fix'].includes(stage);
  }

  /**
   * Create result from context
   */
  private createResult(
    context: PipelineContext,
    status: 'completed' | 'failed',
    error?: string
  ): GroupResult {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - context.startedAt.getTime();

    const result: GroupResult = {
      group: context.group,
      status,
      attempts: context.attempt,
      durationMs,
      startedAt: context.startedAt,
      completedAt,
    };

    // Only set optional fields if they have values
    if (context.pr) {
      (result as { pr?: PullRequest }).pr = context.pr;
    }
    if (error) {
      (result as { error?: string }).error = error;
    }
    if (context.errors.length > 0) {
      (result as { errorDetails?: string }).errorDetails = context.errors.map(e => `[${e.stage}] ${e.message}`).join('\n');
    }
    if (context.worktree) {
      (result as { worktree?: WorktreeInfo }).worktree = context.worktree;
    }
    if (context.checkResult) {
      (result as { checkResult?: CheckResult }).checkResult = context.checkResult;
    }

    return result;
  }
}

/**
 * Create processing pipeline
 */
export function createPipeline(config: PipelineConfig, stages?: PipelineStages): ProcessingPipeline {
  return new ProcessingPipeline(config, stages);
}

/**
 * Process a single group (convenience function)
 */
export async function processGroup(
  group: IssueGroup,
  config: PipelineConfig
): Promise<GroupResult> {
  const pipeline = createPipeline(config);
  return pipeline.processGroup(group);
}
