/**
 * @module commands/autofix/claude-cli
 * @description Claude CLI integration - barrel file
 */

// Export types
export type {
  ClaudeOptions,
  ClaudeResult,
  AIError,
  AIErrorCode,
  AIConfig,
} from './types.js';

// Export client functions
export { invokeClaudeCLI, safeInvokeClaude } from './client.js';

// Export parser functions
export {
  parseStreamJsonChunk,
  parseUsageInfo,
  extractJsonWithKey,
  extractResultFromWrapper,
  parseAnalysisResult,
  parseFixResult,
  parseTaskAnalysisResult,
} from './parser.js';
