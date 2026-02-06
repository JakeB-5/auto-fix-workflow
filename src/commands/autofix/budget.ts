/**
 * @module commands/autofix/budget
 * @description Budget management for AI API cost tracking and limits
 */

import type { AIConfig } from './claude-cli/index.js';

/**
 * Budget configuration for AI API costs
 */
export interface BudgetConfig {
  /** Maximum cost per issue in USD (Infinity for unlimited) */
  maxPerIssue: number;
  /** Maximum cost per session in USD (Infinity for unlimited) */
  maxPerSession: number;
  /** Preferred AI model to use */
  preferredModel: 'opus' | 'sonnet' | 'haiku';
  /** Fallback model when budget is constrained */
  fallbackModel: 'opus' | 'sonnet' | 'haiku';
}

/**
 * Current budget usage information
 */
export interface BudgetUsage {
  /** Current issue cost in USD */
  currentIssue: number;
  /** Total session cost in USD */
  currentSession: number;
  /** Remaining budget for current issue */
  remainingIssue: number;
  /** Remaining budget for session */
  remainingSession: number;
}

/**
 * Default budget configuration (unlimited)
 */
export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  maxPerIssue: Infinity,
  maxPerSession: Infinity,
  preferredModel: 'opus',
  fallbackModel: 'sonnet',
};

/**
 * Budget tracker for AI API costs
 *
 * Tracks costs per issue and per session, with automatic model fallback
 * based on budget utilization thresholds.
 */
export class BudgetTracker {
  private readonly config: BudgetConfig;
  private issueUsage: number = 0;
  private sessionUsage: number = 0;
  private currentIssueId: string | null = null;

  /**
   * Create a new budget tracker
   *
   * @param config - Budget configuration (defaults to unlimited)
   */
  constructor(config: Partial<BudgetConfig> = {}) {
    this.config = { ...DEFAULT_BUDGET_CONFIG, ...config };
  }

  /**
   * Add cost for an API call
   *
   * @param issueId - Issue identifier
   * @param cost - Cost in USD
   */
  addCost(issueId: string, cost: number): void {
    // Reset issue usage if switching to a new issue
    if (this.currentIssueId !== issueId) {
      this.currentIssueId = issueId;
      this.issueUsage = 0;
    }

    this.issueUsage += cost;
    this.sessionUsage += cost;
  }

  /**
   * Get current budget usage
   *
   * @returns Budget usage statistics
   */
  getUsage(): BudgetUsage {
    return {
      currentIssue: this.issueUsage,
      currentSession: this.sessionUsage,
      remainingIssue: Math.max(0, this.config.maxPerIssue - this.issueUsage),
      remainingSession: Math.max(0, this.config.maxPerSession - this.sessionUsage),
    };
  }

  /**
   * Check if we can spend a given amount
   *
   * @param issueId - Issue identifier
   * @param amount - Estimated cost in USD
   * @returns True if spending is within budget
   */
  canSpend(issueId: string, amount: number = 0): boolean {
    // Switch to new issue if needed (but don't reset yet)
    const effectiveIssueUsage = this.currentIssueId === issueId ? this.issueUsage : 0;

    const issueOk = effectiveIssueUsage + amount <= this.config.maxPerIssue;
    const sessionOk = this.sessionUsage + amount <= this.config.maxPerSession;

    return issueOk && sessionOk;
  }

  /**
   * Get the current model to use based on budget utilization
   *
   * Model selection logic:
   * - <80% budget used: preferredModel
   * - 80-90% budget used: fallbackModel
   * - >90% budget used: haiku
   * - 100% budget used: cannot spend (check with canSpend first)
   *
   * @returns Model name to use for next API call
   */
  getCurrentModel(): 'opus' | 'sonnet' | 'haiku' {
    const usage = this.getUsage();

    // Calculate utilization percentages for both issue and session
    const issueUtilization =
      this.config.maxPerIssue === Infinity
        ? 0
        : usage.currentIssue / this.config.maxPerIssue;

    const sessionUtilization =
      this.config.maxPerSession === Infinity
        ? 0
        : usage.currentSession / this.config.maxPerSession;

    // Use the higher utilization percentage
    const maxUtilization = Math.max(issueUtilization, sessionUtilization);

    // >90% used: haiku only
    if (maxUtilization > 0.9) {
      return 'haiku';
    }

    // 80-90% used: fallback model
    if (maxUtilization >= 0.8) {
      return this.config.fallbackModel;
    }

    // <80% used: preferred model
    return this.config.preferredModel;
  }

  /**
   * Reset usage for a specific issue
   *
   * @param issueId - Issue identifier
   */
  resetIssue(issueId: string): void {
    if (this.currentIssueId === issueId) {
      this.issueUsage = 0;
    }
  }

  /**
   * Reset all usage (issue and session)
   */
  reset(): void {
    this.issueUsage = 0;
    this.sessionUsage = 0;
    this.currentIssueId = null;
  }
}

/**
 * Create budget configuration from AI config
 *
 * Maps AIConfig fields to BudgetConfig format. Falls back to defaults
 * for missing fields.
 *
 * @param aiConfig - AI configuration from .auto-fix.yaml
 * @returns Budget configuration
 */
export function createBudgetConfigFromAI(aiConfig?: AIConfig): Partial<BudgetConfig> {
  if (!aiConfig) {
    return {};
  }

  const config: Partial<BudgetConfig> = {};

  // Map budget limits (add type guard for expected fields)
  const aiConfigExtended = aiConfig as AIConfig & {
    maxBudgetPerIssue?: number;
    maxBudgetPerSession?: number;
    preferredModel?: 'opus' | 'sonnet' | 'haiku';
    fallbackModel?: 'opus' | 'sonnet' | 'haiku';
  };

  if (aiConfigExtended.maxBudgetPerIssue !== undefined) {
    config.maxPerIssue = aiConfigExtended.maxBudgetPerIssue;
  }

  if (aiConfigExtended.maxBudgetPerSession !== undefined) {
    config.maxPerSession = aiConfigExtended.maxBudgetPerSession;
  }

  if (aiConfigExtended.preferredModel !== undefined) {
    config.preferredModel = aiConfigExtended.preferredModel;
  }

  if (aiConfigExtended.fallbackModel !== undefined) {
    config.fallbackModel = aiConfigExtended.fallbackModel;
  }

  return config;
}

/**
 * Create budget tracker from AI config
 *
 * Convenience function to create a BudgetTracker instance from AIConfig.
 *
 * @param aiConfig - AI configuration from .auto-fix.yaml
 * @returns Budget tracker instance
 */
export function createBudgetTrackerFromAI(aiConfig?: AIConfig): BudgetTracker {
  return new BudgetTracker(createBudgetConfigFromAI(aiConfig));
}
