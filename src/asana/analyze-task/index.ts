/**
 * @module asana/analyze-task
 * @description Task analysis barrel file - exports all analysis modules
 */

// Heuristics exports
export type { TaskClassification, HeuristicResult, HeuristicIndicator } from './heuristics.js';
export { analyzeWithHeuristics, extractFilePaths, extractSymbols } from './heuristics.js';

// Confidence exports
export type {
  ConfidenceLevel,
  ConfidenceScore,
  ConfidenceBreakdown,
} from './confidence.js';
export {
  calculateConfidence,
  getConfidenceLevelDescription,
  meetsConfidenceThreshold,
} from './confidence.js';

// LLM analysis exports
export type {
  LLMAnalysisResult,
  LLMAnalysisOptions,
} from './llm-analysis.js';
export {
  analyzeWithLLM,
  generateAnalysisPrompt,
  shouldUseLLM,
  parseLLMResponse,
  createLLMResult,
} from './llm-analysis.js';

// Codebase exports
export type {
  CodebaseContext,
  FileInfo,
  SymbolInfo,
  FileType,
  ExploreOptions,
} from './codebase.js';
export {
  exploreCodebase,
  classifyFileType,
  findRelatedFiles,
  getFilePatterns,
} from './codebase.js';

// Issue template exports
export type {
  IssueTemplate,
  IssueTemplateOptions,
} from './issue-template.js';
export {
  generateIssueTemplate,
  generateIssueContext,
  classificationToIssueType,
} from './issue-template.js';

// Messages exports
export type {
  FailureReason,
  AnalysisMessage,
} from './messages.js';
export {
  generateFailureReasons,
  generateSummaryMessage,
  formatMessageAsMarkdown,
  getRecommendation,
  generateAsanaNotification,
  generateDetailedReport,
} from './messages.js';

// Tool exports
export type {
  AnalyzeTaskInput,
  AnalysisResult,
  AnalyzeTaskOutput,
  AnalyzeTaskError,
} from './tool.js';
export {
  AnalyzeTaskInputSchema,
  executeAnalyzeTask,
  getToolDefinition,
} from './tool.js';
