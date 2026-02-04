/**
 * @module commands/autofix/ai-integration
 * @description Claude AI analysis and fix integration via Claude CLI
 */

import { spawn } from 'child_process';
import type { Issue, IssueGroup } from '../../common/types/index.js';
import type { Result } from '../../common/types/result.js';
import { ok, err, isFailure } from '../../common/types/result.js';
import type { AIAnalysisResult, AIFixResult } from './types.js';
import { buildAnalysisPrompt, buildFixPrompt } from './prompts.js';
import { createBudgetTrackerFromAI, type BudgetTracker } from './budget.js';
import type { AsanaTask, TaskAnalysis } from '../triage/types.js';

/**
 * AI integration error
 */
export interface AIError {
  readonly code: AIErrorCode;
  readonly message: string;
  readonly cause?: Error;
}

export type AIErrorCode =
  | 'ANALYSIS_FAILED'
  | 'FIX_FAILED'
  | 'CONTEXT_TOO_LARGE'
  | 'API_ERROR'
  | 'CLI_NOT_FOUND'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'BUDGET_EXCEEDED'
  | 'PARSE_ERROR'
  | 'NOT_IMPLEMENTED';

/**
 * AI integration configuration
 */
export interface AIConfig {
  readonly apiKey?: string;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly maxBudgetPerIssue?: number;
  readonly maxBudgetPerSession?: number;
  readonly preferredModel?: 'opus' | 'sonnet' | 'haiku';
  readonly fallbackModel?: 'opus' | 'sonnet' | 'haiku';
}

/**
 * Claude CLI invocation options
 */
export interface ClaudeOptions {
  /** Prompt to send to Claude */
  prompt: string;
  /** Model to use */
  model?: 'opus' | 'sonnet' | 'haiku';
  /** Allowed tools */
  allowedTools?: string[];
  /** Maximum budget in USD */
  maxBudget?: number;
  /** Working directory */
  workingDir?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Stream output to stderr in real-time (default: true) */
  streamOutput?: boolean;
}

/**
 * Claude CLI result
 */
export interface ClaudeResult {
  /** Success flag */
  success: boolean;
  /** stdout output */
  output: string;
  /** Exit code */
  exitCode: number;
  /** Usage information if available */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };
  /** stderr output */
  error?: string;
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Invoke Claude CLI as subprocess
 */
export async function invokeClaudeCLI(options: ClaudeOptions): Promise<Result<ClaudeResult, AIError>> {
  const {
    prompt,
    model = 'opus',
    allowedTools = [],
    maxBudget,
    workingDir,
    timeout = 120000, // 2 minutes default
    streamOutput = true, // Default to streaming
  } = options;

  // Build command string with all arguments
  // Use stream-json for real-time output visibility
  const cmdParts: string[] = [
    'claude',
    '--dangerously-skip-permissions',
    '--print',
    '--output-format', streamOutput ? 'stream-json' : 'json',
  ];

  if (model) {
    cmdParts.push('--model', model);
  }

  if (allowedTools.length > 0) {
    cmdParts.push('--allowedTools', ...allowedTools);
  }

  if (maxBudget !== undefined) {
    cmdParts.push('--max-budget-usd', maxBudget.toString());
  }

  // Build complete command string (prompt will be piped via stdin)
  const commandStr = cmdParts.join(' ');

  return new Promise((resolve) => {
    // Use shell: true with command as string (no args array) to avoid DEP0190 warning
    // The prompt is piped through stdin to avoid EINVAL errors with special characters
    const claude = spawn(commandStr, [], {
      cwd: workingDir || process.cwd(),
      env: { ...process.env },
      shell: true,
      // On Windows, hide the console window
      windowsHide: true,
    });

    // Write prompt to stdin and close it
    // This avoids command-line argument issues with special characters (Korean, etc.)
    if (claude.stdin) {
      claude.stdin.write(prompt);
      claude.stdin.end();
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let finalResult = ''; // Accumulate the final result text

    // Setup timeout
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      claude.kill('SIGTERM');
    }, timeout);

    claude.stdout?.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;

      // Parse stream-json format and display in real-time
      if (streamOutput) {
        // Each line in stream-json is a JSON object
        const lines = chunk.split('\n').filter((line: string) => line.trim());
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            // Handle different event types from Claude CLI stream-json
            if (event.type === 'assistant' && event.message?.content) {
              // Assistant message with content blocks
              for (const block of event.message.content) {
                if (block.type === 'text' && block.text) {
                  process.stderr.write(block.text);
                  finalResult += block.text;
                }
              }
            } else if (event.type === 'content_block_delta' && event.delta?.text) {
              // Streaming text delta
              process.stderr.write(event.delta.text);
              finalResult += event.delta.text;
            } else if (event.type === 'result' && event.result) {
              // Final result
              finalResult = event.result;
            }
          } catch {
            // Not valid JSON, ignore (might be partial line)
          }
        }
      }
    });

    claude.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('close', (code) => {
      clearTimeout(timeoutHandle);

      // Add newline after streaming output
      if (streamOutput && finalResult) {
        process.stderr.write('\n');
      }

      if (timedOut) {
        resolve(err({
          code: 'TIMEOUT',
          message: `Claude CLI timed out after ${timeout}ms`,
        }));
        return;
      }

      const exitCode = code ?? 1;
      // Use finalResult for stream mode, raw stdout for json mode
      const outputText = streamOutput ? finalResult : stdout;
      const result: ClaudeResult = {
        success: exitCode === 0,
        output: outputText || stdout,
        exitCode,
        error: stderr || undefined,
      };

      // Try to parse usage information from JSON output
      try {
        const jsonMatch = stdout.match(/\{[\s\S]*"usage"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.usage) {
            result.usage = {
              inputTokens: parsed.usage.input_tokens ?? 0,
              outputTokens: parsed.usage.output_tokens ?? 0,
              cost: parsed.usage.cost_usd ?? 0,
            };
          }
        }
      } catch {
        // Ignore parse errors for usage info
      }

      resolve(ok(result));
    });

    claude.on('error', (error) => {
      clearTimeout(timeoutHandle);

      // Check if command not found
      if ('code' in error && error.code === 'ENOENT') {
        resolve(err({
          code: 'CLI_NOT_FOUND',
          message: 'Claude CLI not found. Please install it first.',
          cause: error,
        }));
        return;
      }

      resolve(err({
        code: 'API_ERROR',
        message: `Failed to spawn Claude CLI: ${error.message}`,
        cause: error,
      }));
    });
  });
}

/**
 * Invoke Claude with retry logic
 */
async function safeInvokeClaude(
  options: ClaudeOptions,
  maxRetries = 3
): Promise<Result<ClaudeResult, AIError>> {
  let lastError: AIError | undefined;

  for (let i = 0; i < maxRetries; i++) {
    const result = await invokeClaudeCLI(options);

    if (result.success) {
      if (result.data.success) {
        return result;
      }

      // Check for rate limit or overload
      const errorMsg = result.data.error?.toLowerCase() || '';
      if (errorMsg.includes('overloaded') || errorMsg.includes('rate') || errorMsg.includes('limit')) {
        // Exponential backoff: 1s, 2s, 4s
        await sleep(Math.pow(2, i) * 1000);
        continue;
      }

      // Other failure, return immediately
      return err({
        code: 'API_ERROR',
        message: result.data.error || 'Claude CLI failed',
      });
    } else if (isFailure(result)) {
      // If we reach here, result.success is false
      // Handle known error codes
      if (result.error.code === 'CLI_NOT_FOUND') {
        return result; // Don't retry if CLI not found
      }

      if (result.error.code === 'TIMEOUT') {
        return result; // Don't retry on timeout
      }

      lastError = result.error;
      await sleep(1000); // Brief pause before retry
    }
  }

  return err(
    lastError || {
      code: 'API_ERROR',
      message: 'Max retries exceeded',
    }
  );
}

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
    try {
      // Extract JSON from output
      const jsonMatch = claudeResult.output.match(/\{[\s\S]*?"confidence"[\s\S]*?\}/);
      if (!jsonMatch) {
        return err({
          code: 'PARSE_ERROR',
          message: 'Could not find JSON in Claude output',
        });
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        confidence: number;
        rootCause: string;
        suggestedFix: string;
        affectedFiles: string[];
        complexity: 'low' | 'medium' | 'high';
      };

      return ok({
        issues: group.issues,
        filesToModify: parsed.affectedFiles,
        rootCause: parsed.rootCause,
        suggestedFix: parsed.suggestedFix,
        confidence: parsed.confidence,
        complexity: parsed.complexity,
      });
    } catch (error) {
      return err({
        code: 'PARSE_ERROR',
        message: `Failed to parse analysis result: ${error instanceof Error ? error.message : String(error)}`,
        cause: error instanceof Error ? error : undefined,
      });
    }
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
    try {
      // Extract JSON from output
      const jsonMatch = claudeResult.output.match(/\{[\s\S]*?"success"[\s\S]*?\}/);
      if (!jsonMatch) {
        return err({
          code: 'PARSE_ERROR',
          message: 'Could not find JSON in Claude output',
        });
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        success: boolean;
        summary: string;
        filesChanged: string[];
      };

      // If successful, stage files
      if (parsed.success && parsed.filesChanged.length > 0) {
        // Files should already be staged by Claude using Bash tool
        // But we can verify or re-stage if needed
      }

      return ok({
        filesModified: parsed.filesChanged,
        summary: parsed.summary,
        success: parsed.success,
        commitMessage: this.generateCommitMessage(group),
      });
    } catch (error) {
      return err({
        code: 'PARSE_ERROR',
        message: `Failed to parse fix result: ${error instanceof Error ? error.message : String(error)}`,
        cause: error instanceof Error ? error : undefined,
      });
    }
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
    });

    process.stderr.write(' done\n');

    if (isFailure(result)) {
      // Fallback to heuristic analysis
      return ok(this.getFallbackTaskAnalysis(task));
    }

    const claudeResult = result.data;

    // Track cost if available
    if (claudeResult.usage) {
      this.budgetTracker.addCost(`triage-${task.gid}`, claudeResult.usage.cost);
    }

    // Parse response
    try {
      // When using --output-format json, the output is wrapped in a JSON object
      // with the actual response in the "result" field
      let textToSearch = claudeResult.output;

      // Try to extract the "result" field from JSON wrapper
      const wrapperMatch = claudeResult.output.match(/"result"\s*:\s*"([\s\S]*?)(?:","stop_reason|"\s*,\s*"stop_reason)/);
      if (wrapperMatch) {
        // Unescape the JSON string
        textToSearch = wrapperMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }

      // Find the issueType JSON within the text (may be in a code block)
      const jsonMatch = textToSearch.match(/\{[^{}]*"issueType"[^{}]*\}/s);
      if (!jsonMatch) {
        // Try a more lenient pattern for nested objects
        const lenientMatch = textToSearch.match(/\{\s*"issueType"\s*:\s*"[^"]+?"[\s\S]*?"confidence"\s*:\s*[\d.]+\s*\}/);
        if (!lenientMatch) {
          return ok(this.getFallbackTaskAnalysis(task));
        }
        const parsed = JSON.parse(lenientMatch[0]) as TaskAnalysis;
        return ok(parsed);
      }

      const parsed = JSON.parse(jsonMatch[0]) as TaskAnalysis;
      return ok(parsed);
    } catch {
      return ok(this.getFallbackTaskAnalysis(task));
    }
  }

  /**
   * Build prompt for task analysis
   */
  private buildTaskAnalysisPrompt(task: AsanaTask): string {
    return `Analyze this Asana task and classify it for GitHub issue creation.

Task Name: ${task.name}
Description: ${task.notes || '(no description)'}
Tags: ${task.tags?.map(t => t.name).join(', ') || '(none)'}
Custom Fields: ${task.customFields?.map(f => `${f.name}: ${f.displayValue || f.textValue || f.enumValue?.name || ''}`).join(', ') || '(none)'}

Respond in JSON format:
{
  "issueType": "bug" | "feature" | "refactor" | "docs" | "test" | "chore",
  "priority": "critical" | "high" | "medium" | "low",
  "labels": ["label1", "label2"],
  "component": "component-name",
  "relatedFiles": ["path/to/file.ts"],
  "summary": "Brief summary for GitHub issue body",
  "acceptanceCriteria": ["criterion 1", "criterion 2"],
  "confidence": 0.0-1.0
}`;
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
    const priorityField = task.customFields?.find(f =>
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
    const componentField = task.customFields?.find(f =>
      f.name.toLowerCase().includes('component')
    );
    const component = componentField?.enumValue?.name ||
                      componentField?.textValue ||
                      'general';

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
    const issueNumbers = group.issues.map(i => `#${i.number}`).join(', ');

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
