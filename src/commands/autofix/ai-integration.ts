/**
 * @module commands/autofix/ai-integration
 * @description Claude AI analysis and fix integration via Claude CLI
 */

import type { Issue, IssueGroup } from '../../common/types/index.js';
import type { Result } from '../../common/types/result.js';
import { ok, err, isFailure } from '../../common/types/result.js';
import type { AIAnalysisResult, AIFixResult } from './types.js';
import { buildAnalysisPrompt, buildFixPrompt } from './prompts.js';
import { createBudgetTrackerFromAI, type BudgetTracker } from './budget.js';
import type { AsanaTask, TaskAnalysis } from '../triage/types.js';

// Re-export types and functions from claude-cli for backward compatibility
export type {
  AIError,
  AIErrorCode,
  AIConfig,
  ClaudeOptions,
  ClaudeResult,
} from './claude-cli/index.js';

export {
  invokeClaudeCLI,
  safeInvokeClaude,
} from './claude-cli/index.js';

// Import for internal use
import type { AIConfig, AIError } from './claude-cli/index.js';
import {
  safeInvokeClaude,
  parseAnalysisResult,
  parseFixResult,
  parseTaskAnalysisResult,
} from './claude-cli/index.js';

/**
 * AI Integration Service
 *
 * Implements Claude CLI integration for issue analysis and fix generation.
 */
export class AIIntegration {
  private readonly config: AIConfig;
  private readonly budgetTracker: BudgetTracker;

  constructor(config: AIConfig = {}) {
    this.config = config;
    this.budgetTracker = createBudgetTrackerFromAI(config);
  }

  /**
   * Analyze a group of issues
   *
   * Uses Claude CLI to analyze issues and determine fix strategy.
   * Limited to read-only tools: Read, Glob, Grep
   */
  async analyzeGroup(
    group: IssueGroup,
    worktreePath: string
  ): Promise<Result<AIAnalysisResult, AIError>> {
    const groupId = group.id;

    // Check budget
    if (!this.budgetTracker.canSpend(groupId)) {
      return err({
        code: 'BUDGET_EXCEEDED',
        message: `Budget exceeded for group ${groupId}`,
      });
    }

    // Build analysis prompt
    const prompt = buildAnalysisPrompt(group);

    // Get model based on budget utilization
    const model = this.budgetTracker.getCurrentModel();

    // Invoke Claude CLI with analysis tools only
    const result = await safeInvokeClaude({
      prompt,
      model,
      allowedTools: ['Read', 'Glob', 'Grep'],
      workingDir: worktreePath,
      timeout: 300000, // 5 minutes for analysis
    });

    if (isFailure(result)) {
      return err(result.error);
    }

    const claudeResult = result.data;

    // Track cost
    if (claudeResult.usage) {
      this.budgetTracker.addCost(groupId, claudeResult.usage.cost);
    }

    // Parse JSON response
    const parsed = parseAnalysisResult(claudeResult.output);
    if (!parsed) {
      return err({
        code: 'PARSE_ERROR',
        message: 'Could not find JSON in Claude output',
      });
    }

    return ok({
      issues: group.issues,
      filesToModify: parsed.affectedFiles,
      rootCause: parsed.rootCause,
      suggestedFix: parsed.suggestedFix,
      confidence: parsed.confidence,
      complexity: parsed.complexity,
    });
  }

  /**
   * Generate and apply fixes for analyzed issues
   *
   * Uses Claude CLI to implement code changes based on analysis.
   * Allows editing tools: Read, Edit, Glob, Grep, Bash
   */
  async applyFix(
    group: IssueGroup,
    analysis: AIAnalysisResult,
    worktreePath: string
  ): Promise<Result<AIFixResult, AIError>> {
    const groupId = group.id;

    // Check budget
    if (!this.budgetTracker.canSpend(groupId)) {
      return err({
        code: 'BUDGET_EXCEEDED',
        message: `Budget exceeded for group ${groupId}`,
      });
    }

    // Build fix prompt
    const prompt = buildFixPrompt(group, analysis);

    // Get model based on budget utilization
    const model = this.budgetTracker.getCurrentModel();

    // Invoke Claude CLI with edit tools
    const result = await safeInvokeClaude({
      prompt,
      model,
      allowedTools: ['Read', 'Edit', 'Glob', 'Grep', 'Bash'],
      workingDir: worktreePath,
      timeout: 600000, // 10 minutes for fix
    });

    if (isFailure(result)) {
      return err(result.error);
    }

    const claudeResult = result.data;

    // Track cost
    if (claudeResult.usage) {
      this.budgetTracker.addCost(groupId, claudeResult.usage.cost);
    }

    // Parse JSON response
    const parsed = parseFixResult(claudeResult.output);
    if (!parsed) {
      return err({
        code: 'PARSE_ERROR',
        message: 'Could not find JSON in Claude output',
      });
    }

    return ok({
      filesModified: parsed.filesChanged,
      summary: parsed.summary,
      success: parsed.success,
      commitMessage: this.generateCommitMessage(group),
    });
  }

  /**
   * Analyze a single issue
   */
  async analyzeSingleIssue(
    issue: Issue,
    worktreePath: string
  ): Promise<Result<AIAnalysisResult, AIError>> {
    const stubGroup: IssueGroup = {
      id: `single-${issue.number}`,
      name: `Issue #${issue.number}`,
      groupBy: 'component',
      key: issue.context.component,
      issues: [issue],
      branchName: `fix/issue-${issue.number}`,
      relatedFiles: [...issue.context.relatedFiles],
      components: [issue.context.component],
      priority: issue.context.priority,
    };

    return this.analyzeGroup(stubGroup, worktreePath);
  }

  /**
   * Analyze an Asana task for triage
   *
   * Used by triage command in standalone CLI mode.
   */
  async analyzeAsanaTask(task: AsanaTask): Promise<Result<TaskAnalysis, AIError>> {
    const prompt = this.buildTaskAnalysisPrompt(task);

    // Use configured model or default to opus (per spec REQ-AI-002)
    const model = this.config.preferredModel || 'opus';

    // Show progress indicator
    process.stderr.write(`[AI] Analyzing task with ${model}...`);

    const result = await safeInvokeClaude({
      prompt,
      model,
      timeout: 300000, // 5 minutes default (per spec REQ-AI-005)
      // Enable code analysis tools for actual codebase exploration
      allowedTools: ['Read', 'Glob', 'Grep'],
      // Use current working directory for code analysis
      workingDir: process.cwd(),
    });

    process.stderr.write(' done\n');

    if (isFailure(result)) {
      // Fallback to heuristic analysis
      if (process.env['DEBUG']) {
        process.stderr.write(
          `[DEBUG] Claude CLI failed: ${result.error.code} - ${result.error.message}\n`
        );
      }
      return ok(this.getFallbackTaskAnalysis(task));
    }

    const claudeResult = result.data;

    // Track cost if available
    if (claudeResult.usage) {
      this.budgetTracker.addCost(`triage-${task.gid}`, claudeResult.usage.cost);
    }

    // Debug: log raw output
    if (process.env['DEBUG']) {
      process.stderr.write(
        `[DEBUG] Claude raw output (first 500 chars):\n${claudeResult.output.slice(0, 500)}\n`
      );
    }

    // Parse response
    const parsed = parseTaskAnalysisResult(claudeResult.output);
    if (!parsed) {
      if (process.env['DEBUG']) {
        process.stderr.write(
          `[DEBUG] No JSON found in response. Output:\n${claudeResult.output.slice(0, 1000)}\n`
        );
      }
      return ok(this.getFallbackTaskAnalysis(task));
    }

    return ok(parsed as TaskAnalysis);
  }

  /**
   * Build prompt for task analysis
   */
  private buildTaskAnalysisPrompt(task: AsanaTask): string {
    return `You are analyzing an Asana task to create a GitHub issue.

IMPORTANT: You have access to tools (Read, Glob, Grep) to explore the codebase in the current working directory.
Use these tools to find relevant files and understand the code structure before responding.

## Task Information

Task Name: ${task.name}
Description: ${task.notes || '(no description)'}
Tags: ${task.tags?.map((t) => t.name).join(', ') || '(none)'}
Custom Fields: ${task.customFields?.map((f) => `${f.name}: ${f.displayValue || f.textValue || f.enumValue?.name || ''}`).join(', ') || '(none)'}

## Your Analysis Steps

1. **Explore the codebase**: Use Glob to find relevant files based on the task name/description
2. **Read relevant files**: Use Read to understand the code context
3. **Identify the component**: Determine which part of the codebase this task relates to
4. **Find related files**: List actual file paths that would need to be modified
5. **Assess complexity**: Evaluate how difficult this task would be to implement

## Required Output

After exploring the codebase, respond with ONLY this JSON (no additional text):
{
  "issueType": "bug" | "feature" | "refactor" | "docs" | "test" | "chore",
  "priority": "critical" | "high" | "medium" | "low",
  "labels": ["label1", "label2"],
  "component": "actual-component-name-from-codebase",
  "relatedFiles": ["actual/path/to/file.ts", "another/real/file.ts"],
  "summary": "Technical summary based on code analysis",
  "acceptanceCriteria": ["specific criterion based on code", "another criterion"],
  "confidence": 0.0-1.0
}

The confidence should be HIGH (0.7-1.0) if you found actual files, MEDIUM (0.4-0.7) if partial match, LOW (0.0-0.4) if guessing.`;
  }

  /**
   * Fallback heuristic analysis when Claude CLI is unavailable
   */
  private getFallbackTaskAnalysis(task: AsanaTask): TaskAnalysis {
    const name = task.name.toLowerCase();

    // Simple heuristic classification
    let issueType: TaskAnalysis['issueType'] = 'chore';
    if (name.includes('bug') || name.includes('fix') || name.includes('error')) {
      issueType = 'bug';
    } else if (name.includes('feat') || name.includes('add') || name.includes('implement')) {
      issueType = 'feature';
    } else if (name.includes('refactor') || name.includes('clean')) {
      issueType = 'refactor';
    } else if (name.includes('doc') || name.includes('readme')) {
      issueType = 'docs';
    } else if (name.includes('test')) {
      issueType = 'test';
    }

    // Extract priority from custom fields if available
    const priorityField = task.customFields?.find((f) =>
      f.name.toLowerCase().includes('priority')
    );
    let priority: TaskAnalysis['priority'] = 'medium';
    if (priorityField?.enumValue?.name) {
      const pName = priorityField.enumValue.name.toLowerCase();
      if (pName.includes('critical') || pName.includes('urgent')) priority = 'critical';
      else if (pName.includes('high')) priority = 'high';
      else if (pName.includes('low')) priority = 'low';
    }

    // Extract component from custom fields
    const componentField = task.customFields?.find((f) =>
      f.name.toLowerCase().includes('component')
    );
    const component = componentField?.enumValue?.name || componentField?.textValue || 'general';

    return {
      issueType,
      priority,
      labels: [issueType, `priority:${priority}`],
      component,
      relatedFiles: [],
      summary: task.notes?.slice(0, 500) || task.name,
      acceptanceCriteria: [],
      confidence: 0.3, // Low confidence for heuristic
    };
  }

  /**
   * Generate a commit message for the group
   */
  generateCommitMessage(group: IssueGroup): string {
    const issueNumbers = group.issues.map((i) => `#${i.number}`).join(', ');

    if (group.issues.length === 1) {
      const issue = group.issues[0]!;
      return `fix(${issue.context.component}): ${issue.title}\n\nFixes ${issueNumbers}`;
    }

    return `fix(${group.components[0] ?? 'general'}): address ${group.issues.length} issues\n\nFixes ${issueNumbers}`;
  }

  /**
   * Estimate complexity of a group
   */
  estimateComplexity(group: IssueGroup): 'low' | 'medium' | 'high' {
    // Simple heuristic based on number of issues and files
    const issueCount = group.issues.length;
    const fileCount = group.relatedFiles.length;

    if (issueCount === 1 && fileCount <= 2) {
      return 'low';
    }

    if (issueCount > 3 || fileCount > 5) {
      return 'high';
    }

    return 'medium';
  }

  /**
   * Validate that the AI can handle this group
   *
   * Checks:
   * - Group has at least one issue
   * - Budget is available for processing
   * - Group complexity is not too high
   */
  canHandle(group: IssueGroup): boolean {
    // Must have at least one issue
    if (group.issues.length === 0) {
      return false;
    }

    // Check if budget allows processing
    const groupId = group.id;
    if (!this.budgetTracker.canSpend(groupId, 0.01)) {
      // Minimal cost check
      return false;
    }

    // For high complexity groups with many files, require more scrutiny
    const complexity = this.estimateComplexity(group);
    if (complexity === 'high' && group.relatedFiles.length > 10) {
      // Too many files for automated fix
      return false;
    }

    return true;
  }

  /**
   * Get suggested approach for a group
   */
  getSuggestedApproach(group: IssueGroup): string {
    const complexity = this.estimateComplexity(group);

    switch (complexity) {
      case 'low':
        return `Simple fix for ${group.issues.length} issue(s). Expected to be straightforward.`;
      case 'medium':
        return `Moderate complexity. May require careful testing.`;
      case 'high':
        return `Complex change affecting multiple areas. Manual review strongly recommended.`;
    }
  }
}

/**
 * Create AI integration instance
 */
export function createAIIntegration(config?: AIConfig): AIIntegration {
  return new AIIntegration(config);
}

/**
 * Get budget tracker for inspection
 */
export function getBudgetTracker(integration: AIIntegration): BudgetTracker {
  return (integration as any).budgetTracker;
}
