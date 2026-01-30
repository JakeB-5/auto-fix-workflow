/**
 * @module analyzer/task-analyzer
 * @description Task analyzer public API
 */

// Main analyzer
export { TaskAnalyzer } from './analyzer.js';
export type { TaskAnalyzerConfig } from './analyzer.js';

// Asana client
export { AsanaClient } from './asana-client.js';
export type { AsanaClientConfig } from './asana-client.js';

// Core analysis functions
export { analyzeReproducibility } from './reproducibility.js';
export { evaluateSufficiency, getMissingElements } from './sufficiency.js';
export { extractCodeHints } from './code-hints.js';
export { generateActions } from './actions.js';

// Types
export type {
  TaskAnalysis,
  CodeHint,
  InformationSufficiency,
  ReproducibilityResult,
  AsanaAction,
  AsanaActionType,
  AsanaTask,
  AsanaCustomField,
  AnalyzerError,
  AnalyzerErrorCode,
} from './types.js';
