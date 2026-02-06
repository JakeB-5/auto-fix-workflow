/**
 * @module commands/autofix/pipeline/stages/pr-stage
 * @description PR creation and issue update stage
 */

import type { PullRequest, Issue, Config } from '../../../../common/types/index.js';
import type { Result } from '../../../../common/types/result.js';
import { err } from '../../../../common/types/result.js';
import type { PipelineContext, PipelineStage } from '../../types.js';
import { CreatePRTool, type CreatePRError, type CreatePRConfig } from '../../mcp-tools/create-pr.js';
import { UpdateIssueTool, type UpdateIssueConfig } from '../../mcp-tools/update-issue.js';

/**
 * PR stage configuration
 */
export interface PRStageConfig {
  readonly prConfig: CreatePRConfig;
  readonly issueConfig: UpdateIssueConfig;
  readonly baseBranch: string;
}

/**
 * PR Stage
 *
 * Handles PR creation and updating linked issues
 */
export class PRStage {
  readonly stageName: PipelineStage = 'pr_create';
  private readonly prTool: CreatePRTool;
  private readonly issueTool: UpdateIssueTool;
  private readonly baseBranch: string;

  constructor(config: PRStageConfig) {
    this.prTool = new CreatePRTool(config.prConfig);
    this.issueTool = new UpdateIssueTool(config.issueConfig);
    this.baseBranch = config.baseBranch;
  }

  /**
   * Create PR for the group
   */
  async execute(context: PipelineContext): Promise<Result<PullRequest, CreatePRError>> {
    return this.prTool.createPRFromIssues(
      context.group.issues,
      context.group.branchName,
      this.baseBranch
    );
  }

  /**
   * Update linked issues with PR information
   */
  async updateIssues(context: PipelineContext): Promise<void> {
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
   * Mark issue as failed
   */
  async markIssueFailed(issueNumber: number, reason: string): Promise<void> {
    await this.issueTool.markFailed(issueNumber, reason);
  }

  /**
   * Mark issue as in-progress
   */
  async markIssueInProgress(issueNumber: number): Promise<void> {
    await this.issueTool.markInProgress(issueNumber);
  }
}

/**
 * Create PR stage from config
 */
export function createPRStage(config: Config, baseBranch: string): PRStage {
  const prConfig: CreatePRConfig = {
    token: config.github.token,
    owner: config.github.owner,
    repo: config.github.repo,
  };
  if (config.github.apiBaseUrl) {
    (prConfig as { apiBaseUrl?: string }).apiBaseUrl = config.github.apiBaseUrl;
  }

  const issueConfig: UpdateIssueConfig = {
    token: config.github.token,
    owner: config.github.owner,
    repo: config.github.repo,
  };
  if (config.github.apiBaseUrl) {
    (issueConfig as { apiBaseUrl?: string }).apiBaseUrl = config.github.apiBaseUrl;
  }

  return new PRStage({
    prConfig,
    issueConfig,
    baseBranch,
  });
}
