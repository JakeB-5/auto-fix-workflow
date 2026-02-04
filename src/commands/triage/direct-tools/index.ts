/**
 * @module commands/triage/direct-tools
 * @description Direct API toolset for standalone CLI mode
 */

import type { Config } from '../../../common/types/index.js';
import type { TriageToolset } from '../toolset.types.js';
import { AsanaDirectAdapter, createAsanaDirectAdapter } from './asana-adapter.js';
import { GitHubDirectAdapter, createGitHubDirectAdapter } from './github-adapter.js';
import { AnalyzerDirectAdapter, createAnalyzerDirectAdapter } from './analyzer-adapter.js';

// Re-export individual adapters
export { AsanaDirectAdapter, createAsanaDirectAdapter } from './asana-adapter.js';
export { GitHubDirectAdapter, createGitHubDirectAdapter } from './github-adapter.js';
export { AnalyzerDirectAdapter, createAnalyzerDirectAdapter } from './analyzer-adapter.js';

/**
 * Direct API toolset for standalone CLI mode
 *
 * Implements TriageToolset interface using direct API calls
 * instead of MCP Client.
 */
export class DirectAPIToolset implements TriageToolset {
  readonly mode = 'direct' as const;
  readonly asana: AsanaDirectAdapter;
  readonly github: GitHubDirectAdapter;
  readonly analyzer: AnalyzerDirectAdapter;

  constructor(config: Config) {
    if (!config.asana) {
      throw new Error('Asana configuration is required for direct mode');
    }
    if (!config.github) {
      throw new Error('GitHub configuration is required for direct mode');
    }

    this.asana = createAsanaDirectAdapter(config.asana);
    this.github = createGitHubDirectAdapter(config.github);
    this.analyzer = createAnalyzerDirectAdapter();
  }
}

/**
 * Create direct API toolset
 */
export function createDirectAPIToolset(config: Config): DirectAPIToolset {
  return new DirectAPIToolset(config);
}

/**
 * Check if direct mode can be initialized with given config
 */
export function canCreateDirectToolset(config: Config): boolean {
  return !!(config.asana && config.github);
}
