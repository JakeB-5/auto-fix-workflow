/**
 * @module commands/autofix/__tests__/budget.test
 * @description Tests for budget management functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BudgetTracker,
  createBudgetConfigFromAI,
  createBudgetTrackerFromAI,
  DEFAULT_BUDGET_CONFIG,
  type BudgetConfig,
} from '../budget.js';
import type { AIConfig } from '../claude-cli/index.js';

describe('BudgetTracker', () => {
  describe('construction', () => {
    it('should create tracker with default config (Infinity limits)', () => {
      const tracker = new BudgetTracker();
      const usage = tracker.getUsage();

      expect(usage.currentIssue).toBe(0);
      expect(usage.currentSession).toBe(0);
      expect(usage.remainingIssue).toBe(Infinity);
      expect(usage.remainingSession).toBe(Infinity);
    });

    it('should create tracker with custom config', () => {
      const config: Partial<BudgetConfig> = {
        maxPerIssue: 10,
        maxPerSession: 50,
        preferredModel: 'sonnet',
        fallbackModel: 'haiku',
      };

      const tracker = new BudgetTracker(config);
      const usage = tracker.getUsage();

      expect(usage.remainingIssue).toBe(10);
      expect(usage.remainingSession).toBe(50);
    });

    it('should merge partial config with defaults', () => {
      const config: Partial<BudgetConfig> = {
        maxPerIssue: 15,
      };

      const tracker = new BudgetTracker(config);

      expect(tracker.getCurrentModel()).toBe(DEFAULT_BUDGET_CONFIG.preferredModel);
    });
  });

  describe('addCost', () => {
    let tracker: BudgetTracker;

    beforeEach(() => {
      tracker = new BudgetTracker({
        maxPerIssue: 10,
        maxPerSession: 50,
      });
    });

    it('should add cost to an issue', () => {
      tracker.addCost('issue-1', 2.5);

      const usage = tracker.getUsage();
      expect(usage.currentIssue).toBe(2.5);
      expect(usage.currentSession).toBe(2.5);
    });

    it('should accumulate costs across multiple adds', () => {
      tracker.addCost('issue-1', 1.0);
      tracker.addCost('issue-1', 1.5);
      tracker.addCost('issue-1', 2.0);

      const usage = tracker.getUsage();
      expect(usage.currentIssue).toBe(4.5);
      expect(usage.currentSession).toBe(4.5);
    });

    it('should auto-switch issues when issueId changes', () => {
      tracker.addCost('issue-1', 3.0);
      tracker.addCost('issue-2', 2.0);

      const usage = tracker.getUsage();
      expect(usage.currentIssue).toBe(2.0); // Reset for new issue
      expect(usage.currentSession).toBe(5.0); // Total persists
    });

    it('should handle switching back to a previous issue', () => {
      tracker.addCost('issue-1', 3.0);
      tracker.addCost('issue-2', 2.0);
      tracker.addCost('issue-1', 1.0); // Switch back to issue-1

      const usage = tracker.getUsage();
      expect(usage.currentIssue).toBe(1.0); // Reset when switching back
      expect(usage.currentSession).toBe(6.0); // Total persists
    });
  });

  describe('getUsage', () => {
    let tracker: BudgetTracker;

    beforeEach(() => {
      tracker = new BudgetTracker({
        maxPerIssue: 10,
        maxPerSession: 50,
      });
    });

    it('should return accurate usage information', () => {
      tracker.addCost('issue-1', 3.5);

      const usage = tracker.getUsage();
      expect(usage.currentIssue).toBe(3.5);
      expect(usage.currentSession).toBe(3.5);
      expect(usage.remainingIssue).toBe(6.5);
      expect(usage.remainingSession).toBe(46.5);
    });

    it('should track multiple issues correctly', () => {
      tracker.addCost('issue-1', 4.0);
      tracker.addCost('issue-2', 3.0);
      tracker.addCost('issue-3', 2.0);

      const usage = tracker.getUsage();
      expect(usage.currentIssue).toBe(2.0); // Last issue
      expect(usage.currentSession).toBe(9.0); // Total
      expect(usage.remainingIssue).toBe(8.0);
      expect(usage.remainingSession).toBe(41.0);
    });

    it('should not show negative remaining values', () => {
      tracker.addCost('issue-1', 15.0); // Over maxPerIssue

      const usage = tracker.getUsage();
      expect(usage.remainingIssue).toBe(0);
    });
  });

  describe('canSpend', () => {
    let tracker: BudgetTracker;

    beforeEach(() => {
      tracker = new BudgetTracker({
        maxPerIssue: 10,
        maxPerSession: 50,
      });
    });

    it('should return true when within budget', () => {
      tracker.addCost('issue-1', 5.0);

      expect(tracker.canSpend('issue-1', 3.0)).toBe(true);
    });

    it('should return false when over per-issue limit', () => {
      tracker.addCost('issue-1', 8.0);

      expect(tracker.canSpend('issue-1', 3.0)).toBe(false);
    });

    it('should return false when over session limit', () => {
      tracker.addCost('issue-1', 5.0);
      tracker.addCost('issue-2', 5.0);
      tracker.addCost('issue-3', 38.0);

      expect(tracker.canSpend('issue-4', 5.0)).toBe(false);
    });

    it('should handle checking new issue without switching', () => {
      tracker.addCost('issue-1', 5.0);

      // Check if we can spend on a new issue
      expect(tracker.canSpend('issue-2', 8.0)).toBe(true);

      // Should not have switched issues
      const usage = tracker.getUsage();
      expect(usage.currentIssue).toBe(5.0);
    });

    it('should handle Infinity limits correctly', () => {
      const unlimitedTracker = new BudgetTracker();

      unlimitedTracker.addCost('issue-1', 1000000);

      expect(unlimitedTracker.canSpend('issue-1', 1000000)).toBe(true);
    });

    it('should return true when amount is 0', () => {
      tracker.addCost('issue-1', 10.0);

      expect(tracker.canSpend('issue-1', 0)).toBe(true);
    });

    it('should default amount to 0', () => {
      tracker.addCost('issue-1', 5.0);

      expect(tracker.canSpend('issue-1')).toBe(true);
    });
  });

  describe('getCurrentModel', () => {
    it('should return preferred model when <80% usage', () => {
      const tracker = new BudgetTracker({
        maxPerIssue: 10,
        maxPerSession: 50,
        preferredModel: 'opus',
        fallbackModel: 'sonnet',
      });

      tracker.addCost('issue-1', 5.0); // 50% of issue, 10% of session

      expect(tracker.getCurrentModel()).toBe('opus');
    });

    it('should return fallback model when 80-90% usage', () => {
      const tracker = new BudgetTracker({
        maxPerIssue: 10,
        maxPerSession: 50,
        preferredModel: 'opus',
        fallbackModel: 'sonnet',
      });

      tracker.addCost('issue-1', 8.5); // 85% of issue

      expect(tracker.getCurrentModel()).toBe('sonnet');
    });

    it('should return haiku when >90% usage', () => {
      const tracker = new BudgetTracker({
        maxPerIssue: 10,
        maxPerSession: 50,
        preferredModel: 'opus',
        fallbackModel: 'sonnet',
      });

      tracker.addCost('issue-1', 9.5); // 95% of issue

      expect(tracker.getCurrentModel()).toBe('haiku');
    });

    it('should use higher utilization percentage between issue and session', () => {
      const tracker = new BudgetTracker({
        maxPerIssue: 100,
        maxPerSession: 10,
        preferredModel: 'opus',
        fallbackModel: 'sonnet',
      });

      tracker.addCost('issue-1', 9.1); // 9.1% of issue, 91% of session (>90%)

      expect(tracker.getCurrentModel()).toBe('haiku');
    });

    it('should always return preferred model with Infinity budget', () => {
      const tracker = new BudgetTracker({
        preferredModel: 'opus',
      });

      tracker.addCost('issue-1', 1000000);

      expect(tracker.getCurrentModel()).toBe('opus');
    });

    it('should handle exactly 80% utilization', () => {
      const tracker = new BudgetTracker({
        maxPerIssue: 10,
        maxPerSession: 50,
        preferredModel: 'opus',
        fallbackModel: 'sonnet',
      });

      tracker.addCost('issue-1', 8.0); // Exactly 80%

      expect(tracker.getCurrentModel()).toBe('sonnet');
    });

    it('should handle exactly 90% utilization', () => {
      const tracker = new BudgetTracker({
        maxPerIssue: 10,
        maxPerSession: 50,
        preferredModel: 'opus',
        fallbackModel: 'sonnet',
      });

      tracker.addCost('issue-1', 9.0); // Exactly 90%

      expect(tracker.getCurrentModel()).toBe('sonnet');
    });

    it('should handle different model configurations', () => {
      const tracker = new BudgetTracker({
        maxPerIssue: 10,
        maxPerSession: 50,
        preferredModel: 'sonnet',
        fallbackModel: 'haiku',
      });

      tracker.addCost('issue-1', 8.5); // 85%

      expect(tracker.getCurrentModel()).toBe('haiku');
    });
  });

  describe('resetIssue', () => {
    let tracker: BudgetTracker;

    beforeEach(() => {
      tracker = new BudgetTracker({
        maxPerIssue: 10,
        maxPerSession: 50,
      });
    });

    it('should reset specific issue cost to 0', () => {
      tracker.addCost('issue-1', 5.0);
      tracker.resetIssue('issue-1');

      const usage = tracker.getUsage();
      expect(usage.currentIssue).toBe(0);
    });

    it('should not affect session total', () => {
      tracker.addCost('issue-1', 5.0);
      tracker.resetIssue('issue-1');

      const usage = tracker.getUsage();
      expect(usage.currentSession).toBe(5.0);
    });

    it('should not reset if issueId does not match current issue', () => {
      tracker.addCost('issue-1', 5.0);
      tracker.resetIssue('issue-2'); // Different issue

      const usage = tracker.getUsage();
      expect(usage.currentIssue).toBe(5.0);
    });

    it('should handle resetting same issue multiple times', () => {
      tracker.addCost('issue-1', 5.0);
      tracker.resetIssue('issue-1');
      tracker.resetIssue('issue-1');

      const usage = tracker.getUsage();
      expect(usage.currentIssue).toBe(0);
      expect(usage.currentSession).toBe(5.0);
    });
  });

  describe('reset', () => {
    let tracker: BudgetTracker;

    beforeEach(() => {
      tracker = new BudgetTracker({
        maxPerIssue: 10,
        maxPerSession: 50,
      });
    });

    it('should reset all costs to 0', () => {
      tracker.addCost('issue-1', 5.0);
      tracker.addCost('issue-2', 3.0);
      tracker.reset();

      const usage = tracker.getUsage();
      expect(usage.currentIssue).toBe(0);
      expect(usage.currentSession).toBe(0);
    });

    it('should clear current issue tracking', () => {
      tracker.addCost('issue-1', 5.0);
      tracker.reset();
      tracker.addCost('issue-1', 3.0); // Should start fresh

      const usage = tracker.getUsage();
      expect(usage.currentIssue).toBe(3.0);
      expect(usage.currentSession).toBe(3.0);
    });
  });
});

describe('createBudgetConfigFromAI', () => {
  it('should return empty config when aiConfig is undefined', () => {
    const config = createBudgetConfigFromAI(undefined);

    expect(config).toEqual({});
  });

  it('should create config from AIConfig with all fields', () => {
    const aiConfig = {
      apiKey: 'test-key',
      maxBudgetPerIssue: 20,
      maxBudgetPerSession: 100,
      preferredModel: 'sonnet' as const,
      fallbackModel: 'haiku' as const,
    };

    const config = createBudgetConfigFromAI(aiConfig);

    expect(config).toEqual({
      maxPerIssue: 20,
      maxPerSession: 100,
      preferredModel: 'sonnet',
      fallbackModel: 'haiku',
    });
  });

  it('should use defaults for missing fields', () => {
    const aiConfig = {
      apiKey: 'test-key',
      maxBudgetPerIssue: 15,
    };

    const config = createBudgetConfigFromAI(aiConfig);

    expect(config).toEqual({
      maxPerIssue: 15,
    });
  });

  it('should handle partial AIConfig with only maxBudgetPerSession', () => {
    const aiConfig = {
      apiKey: 'test-key',
      maxBudgetPerSession: 75,
    };

    const config = createBudgetConfigFromAI(aiConfig);

    expect(config).toEqual({
      maxPerSession: 75,
    });
  });

  it('should handle AIConfig with only model preferences', () => {
    const aiConfig = {
      apiKey: 'test-key',
      preferredModel: 'haiku' as const,
      fallbackModel: 'sonnet' as const,
    };

    const config = createBudgetConfigFromAI(aiConfig);

    expect(config).toEqual({
      preferredModel: 'haiku',
      fallbackModel: 'sonnet',
    });
  });
});

describe('createBudgetTrackerFromAI', () => {
  it('should create tracker with correct config from AIConfig', () => {
    const aiConfig = {
      apiKey: 'test-key',
      maxBudgetPerIssue: 25,
      maxBudgetPerSession: 125,
      preferredModel: 'sonnet' as const,
    };

    const tracker = createBudgetTrackerFromAI(aiConfig);
    const usage = tracker.getUsage();

    expect(usage.remainingIssue).toBe(25);
    expect(usage.remainingSession).toBe(125);
    expect(tracker.getCurrentModel()).toBe('sonnet');
  });

  it('should create tracker with default config when aiConfig is undefined', () => {
    const tracker = createBudgetTrackerFromAI(undefined);
    const usage = tracker.getUsage();

    expect(usage.remainingIssue).toBe(Infinity);
    expect(usage.remainingSession).toBe(Infinity);
    expect(tracker.getCurrentModel()).toBe(DEFAULT_BUDGET_CONFIG.preferredModel);
  });

  it('should create tracker that works correctly', () => {
    const aiConfig = {
      apiKey: 'test-key',
      maxBudgetPerIssue: 10,
      preferredModel: 'opus' as const,
    };

    const tracker = createBudgetTrackerFromAI(aiConfig);

    tracker.addCost('issue-1', 5.0);

    expect(tracker.canSpend('issue-1', 4.0)).toBe(true);
    expect(tracker.canSpend('issue-1', 6.0)).toBe(false);
  });
});
