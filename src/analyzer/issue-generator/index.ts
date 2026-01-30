/**
 * @module analyzer/issue-generator
 * @description Public API exports for issue generator
 */

// Main generator
export { IssueGenerator } from './generator.js';
export type {
  AsanaTask,
  TaskAnalysis,
  IssueGenerationInput,
} from './generator.js';

// Types
export type { GeneratedIssue, GeneratorError } from './types.js';
export { GeneratorErrorCode } from './types.js';

// GitHub client
export { GitHubClient } from './github-client.js';
export type { CreateIssueParams, CreatedIssue } from './github-client.js';

// Template system
export {
  generateIssueBody,
  renderTypeSection,
  renderSourceSection,
  renderContextSection,
  renderCodeAnalysisSection,
  renderSuggestedFixSection,
  renderAcceptanceCriteriaSection,
} from './template.js';
export type { TemplateData } from './template.js';

// Type detector
export { detectIssueType } from './type-detector.js';
export type { TaskData } from './type-detector.js';

// Context generator
export {
  generateContextSection,
  extractComponent,
} from './context-generator.js';
export type { ContextInfo } from './context-generator.js';

// Code analysis generator
export {
  generateCodeAnalysisSection,
  formatCodeSnippet,
  extractContextWindow,
} from './code-analysis-generator.js';
export type { CodeAnalysisData } from './code-analysis-generator.js';

// Suggested fix generator
export {
  generateFixSuggestions,
  addReferenceHints,
  generateSuggestedFixSection,
} from './suggested-fix-generator.js';

// Acceptance criteria generator
export {
  generateAcceptanceCriteria,
  generateAcceptanceCriteriaSection,
} from './acceptance-generator.js';
export type { AcceptanceCriteriaData } from './acceptance-generator.js';

// Title generator
export { generateTitle } from './title-generator.js';
export type { TitleData } from './title-generator.js';

// Labels system
export {
  inferLabels,
  normalizeComponentLabel,
  getPriorityLabel,
  getSourceLabel,
  getTypeLabel,
  validateLabel,
  sanitizeLabel,
} from './labels-system.js';
