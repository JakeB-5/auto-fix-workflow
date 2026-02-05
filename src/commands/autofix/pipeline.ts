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
import { WorktreeTool } from './mcp-tools/worktree.js';
import { RunChecksTool } from './mcp-tools/run-checks.js';
import { CreatePRTool, type CreatePRConfig } from './mcp-tools/create-pr.js';
import { UpdateIssueTool, type UpdateIssueConfig } from './mcp-tools/update-issue.js';
import { AIIntegration } from './ai-integration.js';

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
 * Processing Pipeline
 *
 * Handles the full processing flow for a single issue group
 */
export class ProcessingPipeline {
  private readonly worktreeTool: WorktreeTool;
  private readonly checksTool: RunChecksTool;
  private readonly prTool: CreatePRTool;
  private readonly issueTool: UpdateIssueTool;
  private readonly aiIntegration: AIIntegration;
  private readonly pipelineConfig: PipelineConfig;
  private eventHandler?: PipelineEventHandler;

  constructor(config: PipelineConfig) {
    this.pipelineConfig = config;

    this.worktreeTool = new WorktreeTool({
      baseDir: config.config.worktree.baseDir,
      prefix: config.config.worktree.prefix ?? 'autofix-',
      repoPath: config.repoPath,
    });

    this.checksTool = new RunChecksTool(config.config.checks);

    const prConfig: CreatePRConfig = {
      token: config.config.github.token,
      owner: config.config.github.owner,
      repo: config.config.github.repo,
    };
    if (config.config.github.apiBaseUrl) {
      (prConfig as { apiBaseUrl?: string }).apiBaseUrl = config.config.github.apiBaseUrl;
    }
    this.prTool = new CreatePRTool(prConfig);

    const issueConfig: UpdateIssueConfig = {
      token: config.config.github.token,
      owner: config.config.github.owner,
      repo: config.config.github.repo,
    };
    if (config.config.github.apiBaseUrl) {
      (issueConfig as { apiBaseUrl?: string }).apiBaseUrl = config.config.github.apiBaseUrl;
    }
    this.issueTool = new UpdateIssueTool(issueConfig);

    this.aiIntegration = new AIIntegration();
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
        const result = await this.createWorktree(context);
        if (!isSuccess(result)) {
          throw new Error(result.error.message);
        }
        context.worktree = result.data;
      });

      // Stage 2: AI Analysis
      await this.runStage(context, 'ai_analysis', async () => {
        const result = await this.analyzeGroup(context);
        if (!isSuccess(result)) {
          throw new Error(result.error.message);
        }
        context.analysisResult = result.data;
      });

      // Stage 3: AI Fix
      await this.runStage(context, 'ai_fix', async () => {
        const result = await this.applyFix(context);
        if (!isSuccess(result)) {
          throw new Error(result.error.message);
        }
        context.fixResult = result.data;

        // Verify that files were actually modified
        if (context.worktree) {
          const hasChanges = await this.hasUncommittedChanges(context.worktree.path);
          if (!hasChanges) {
            throw new Error('AI reported success but no files were actually modified in the worktree');
          }
        }
      });

      // Stage 4: Run Checks
      await this.runStage(context, 'checks', async () => {
        const result = await this.runChecks(context);
        if (!isSuccess(result)) {
          throw new Error(result.error.message);
        }
        context.checkResult = result.data;

        if (!result.data.passed) {
          throw new Error('Checks failed');
        }
      });

      // Stage 5: Commit changes
      await this.runStage(context, 'commit', async () => {
        await this.commitChanges(context);
      });

      // Stage 6: Create PR
      await this.runStage(context, 'pr_create', async () => {
        const result = await this.createPR(context);
        if (!isSuccess(result)) {
          throw new Error(result.error.message);
        }
        context.pr = result.data;
      });

      // Stage 7: Update Issues
      await this.runStage(context, 'issue_update', async () => {
        await this.updateIssues(context);
      });

      // Stage 8: Cleanup
      await this.runStage(context, 'cleanup', async () => {
        await this.cleanup(context);
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
        await this.cleanup(context);
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
   * Create worktree for the group
   */
  private async createWorktree(context: PipelineContext) {
    return this.worktreeTool.create({
      branchName: context.group.branchName,
      baseBranch: this.pipelineConfig.baseBranch,
      issueNumbers: context.group.issues.map(i => i.number),
    });
  }

  /**
   * Analyze the group with AI
   */
  private async analyzeGroup(context: PipelineContext) {
    if (!context.worktree) {
      return err({ code: 'ANALYSIS_FAILED', message: 'No worktree available' });
    }

    return this.aiIntegration.analyzeGroup(context.group, context.worktree.path);
  }

  /**
   * Apply fix with AI
   */
  private async applyFix(context: PipelineContext) {
    if (!context.worktree || !context.analysisResult) {
      return err({ code: 'FIX_FAILED', message: 'Missing prerequisites' });
    }

    return this.aiIntegration.applyFix(
      context.group,
      context.analysisResult,
      context.worktree.path
    );
  }

  /**
   * Run checks in worktree
   */
  private async runChecks(context: PipelineContext) {
    if (!context.worktree) {
      return err({ code: 'CHECKS_FAILED', message: 'No worktree available' });
    }

    return this.checksTool.runChecks({
      worktreePath: context.worktree.path,
      checks: ['lint', 'typecheck', 'test'],
      failFast: true,
    });
  }

  /**
   * Commit changes in worktree
   */
  private async commitChanges(context: PipelineContext): Promise<void> {
    if (!context.worktree || !context.fixResult) {
      throw new Error('Missing prerequisites for commit');
    }

    const result = await this.worktreeTool.execInWorktree(
      context.worktree.path,
      `commit -am "${context.fixResult.commitMessage.replace(/"/g, '\\"')}"`
    );

    if (!isSuccess(result)) {
      throw new Error(`Commit failed: ${result.error.message}`);
    }
  }

  /**
   * Create PR for the group
   */
  private async createPR(context: PipelineContext) {
    return this.prTool.createPRFromIssues(
      context.group.issues,
      context.group.branchName,
      this.pipelineConfig.baseBranch
    );
  }

  /**
   * Update linked issues
   */
  private async updateIssues(context: PipelineContext): Promise<void> {
    if (!context.pr) {
      return;
    }

    for (const issue of context.group.issues) {
      await this.issueTool.markFixed(
        issue.number,
        context.pr.number,
        context.pr.url
      );
    }
  }

  /**
   * Check for uncommitted changes in worktree
   */
  private async hasUncommittedChanges(worktreePath: string): Promise<boolean> {
    const result = await this.worktreeTool.execInWorktree(worktreePath, 'status --porcelain');
    if (!isSuccess(result)) {
      return false;
    }
    return result.data.stdout.trim().length > 0;
  }

  /**
   * Cleanup worktree
   */
  private async cleanup(context: PipelineContext): Promise<void> {
    if (!context.worktree) {
      return;
    }

    await this.worktreeTool.remove({
      path: context.worktree.path,
      force: true,
      deleteBranch: context.stage !== 'done', // Keep branch if successful
    });
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
export function createPipeline(config: PipelineConfig): ProcessingPipeline {
  return new ProcessingPipeline(config);
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
