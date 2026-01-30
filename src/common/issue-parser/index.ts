/**
 * @module common/issue-parser
 * @description Issue body parser for GitHub issues
 *
 * Parses markdown issue bodies into structured data including:
 * - Source information (Sentry, Asana, manual, GitHub)
 * - Issue type (bug, feature, refactor, docs, test, chore)
 * - Context (component, service, environment, priority)
 * - Code analysis (file paths, line numbers, stack traces)
 * - Suggested fix direction
 * - Acceptance criteria with GIVEN-WHEN-THEN scenarios
 *
 * @example
 * ```typescript
 * import { parseIssueBody } from './common/issue-parser/index.js';
 *
 * const result = await parseIssueBody(issueBody);
 * if (result.success) {
 *   console.log(result.data.issue.type);
 *   console.log(result.data.issue.problemDescription);
 * }
 * ```
 */

// Main parser API
export {
  parseIssueBody,
  parse,
  quickParse,
  strictParse,
  type ParserOptions,
  type ParseResult,
} from './parser.js';

// Types
export type {
  ParseError,
  ParseErrorCode,
  ParsedIssue,
  ExtendedCodeAnalysis,
  ExtendedAcceptanceCriteria,
  GivenWhenThenScenario,
  StackFrame,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types.js';

export {
  SECTION_NAMES,
  DEFAULT_VALUES,
} from './types.js';

// AST utilities
export {
  parseMarkdownToAst,
  parseMarkdownToAstSync,
  findSection,
  findSectionsByPattern,
  extractText,
  extractCodeBlocks,
  extractListItems,
  getSectionText,
  isHeading,
  isText,
  isCode,
  isInlineCode,
  isList,
  isListItem,
  type MdastNode,
  type SectionResult,
  type AstParseError,
} from './ast.js';

// Individual parsers (for advanced use)
export {
  parseSource,
  parseSourceFromText,
  type ParsedSource,
} from './source-parser.js';

export {
  parseType,
  parseTypeFromText,
  isValidIssueType,
} from './type-parser.js';

export {
  parseContext,
  parseContextFromText,
  type ParsedContext,
} from './context-parser.js';

export {
  parseCodeAnalysis,
  parseCodeAnalysisFromText,
} from './code-analysis-parser.js';

export {
  parseProblemDescription,
  parseProblemFromText,
  summarizeProblem,
  extractProblemKeywords,
} from './problem-parser.js';

export {
  parseSuggestedFix,
  parseSuggestedFixFromText,
  isValidSuggestedFix,
} from './suggested-fix-parser.js';

export {
  parseAcceptanceCriteria,
  parseAcceptanceCriteriaFromText,
  areAllCriteriaCompleted,
  countCriteria,
  formatScenario,
} from './acceptance-parser.js';

// Validation
export {
  validateParsedIssue,
  hasCriticalErrors,
  getValidationSummary,
  mergeValidationResults,
  createValidationError,
  createValidationWarning,
} from './validation.js';

// Fallback and error handling
export {
  createFallbackIssue,
  attemptRecovery,
  createRecoveryContext,
  recordFallback,
  recordError,
  formatRecoveryLog,
  DEFAULT_FALLBACK_CONFIG,
  type FallbackConfig,
  type RecoveryContext,
} from './fallback.js';
