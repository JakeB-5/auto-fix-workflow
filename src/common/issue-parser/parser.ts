/**
 * @module common/issue-parser/parser
 * @description Main parser integration for issue body parsing
 */

import type { Root } from 'mdast';
import type { Result } from '../types/index.js';
import { ok, err, isSuccess } from '../types/index.js';
import { parseMarkdownToAst } from './ast.js';
import { parseSource } from './source-parser.js';
import { parseType } from './type-parser.js';
import { parseContext } from './context-parser.js';
import { parseCodeAnalysis } from './code-analysis-parser.js';
import { parseProblemDescription } from './problem-parser.js';
import { parseSuggestedFix } from './suggested-fix-parser.js';
import { parseAcceptanceCriteria } from './acceptance-parser.js';
import { validateParsedIssue } from './validation.js';
import {
  createFallbackIssue,
  attemptRecovery,
  createRecoveryContext,
  recordError,
  DEFAULT_FALLBACK_CONFIG,
  type FallbackConfig,
} from './fallback.js';
import type {
  ParsedIssue,
  ParseError,
  ValidationResult,
} from './types.js';
import { DEFAULT_VALUES } from './types.js';

/**
 * Parser options
 */
export interface ParserOptions {
  /** Enable strict mode (fail on warnings) */
  readonly strict?: boolean;
  /** Enable fallback parsing on errors */
  readonly enableFallback?: boolean;
  /** Fallback configuration */
  readonly fallbackConfig?: FallbackConfig;
  /** Skip validation */
  readonly skipValidation?: boolean;
}

/**
 * Default parser options
 */
const DEFAULT_OPTIONS: ParserOptions = {
  strict: false,
  enableFallback: true,
  fallbackConfig: DEFAULT_FALLBACK_CONFIG,
  skipValidation: false,
};

/**
 * Parse result with validation
 */
export interface ParseResult {
  readonly issue: ParsedIssue;
  readonly validation: ValidationResult;
  readonly usedFallback: boolean;
}

/**
 * Parse an issue body into structured data
 *
 * @param body - Raw markdown issue body
 * @param options - Parser options
 * @returns Result containing parsed issue or error
 */
export async function parseIssueBody(
  body: string,
  options: ParserOptions = DEFAULT_OPTIONS
): Promise<Result<ParseResult, ParseError>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Handle empty body
  if (!body || body.trim().length === 0) {
    if (opts.enableFallback) {
      const fallbackIssue = createFallbackIssue('', opts.fallbackConfig);
      const validation = opts.skipValidation
        ? { valid: true, errors: [], warnings: [] }
        : validateParsedIssue(fallbackIssue);

      return ok({
        issue: fallbackIssue,
        validation,
        usedFallback: true,
      });
    }

    return err({
      code: 'INVALID_FORMAT',
      message: 'Issue body is empty',
    });
  }

  // Parse markdown to AST
  const astResult = await parseMarkdownToAst(body);

  if (!isSuccess(astResult)) {
    if (opts.enableFallback) {
      const recoveryContext = createRecoveryContext();
      const parseError: ParseError = {
        code: 'AST_ERROR',
        message: astResult.error.message,
        cause: astResult.error,
      };
      const recovered = attemptRecovery(
        parseError,
        body,
        recordError(recoveryContext, parseError),
        opts.fallbackConfig
      );

      if (recovered) {
        const validation = opts.skipValidation
          ? { valid: true, errors: [], warnings: [] }
          : validateParsedIssue(recovered);

        return ok({
          issue: recovered,
          validation,
          usedFallback: true,
        });
      }
    }

    return err({
      code: 'AST_ERROR',
      message: `Failed to parse markdown: ${astResult.error.message}`,
      cause: astResult.error,
    });
  }

  const ast = astResult.data;

  // Parse all sections
  const parseResult = await parseAllSections(ast, body, opts);

  if (!isSuccess(parseResult)) {
    if (opts.enableFallback) {
      const recoveryContext = createRecoveryContext();
      const recovered = attemptRecovery(
        parseResult.error,
        body,
        recordError(recoveryContext, parseResult.error),
        opts.fallbackConfig
      );

      if (recovered) {
        const validation = opts.skipValidation
          ? { valid: true, errors: [], warnings: [] }
          : validateParsedIssue(recovered);

        return ok({
          issue: recovered,
          validation,
          usedFallback: true,
        });
      }
    }

    return parseResult;
  }

  const issue = parseResult.data;
  const validation = opts.skipValidation
    ? { valid: true, errors: [], warnings: [] }
    : validateParsedIssue(issue);

  // In strict mode, treat warnings as errors
  if (opts.strict && validation.warnings.length > 0) {
    return err({
      code: 'VALIDATION_ERROR',
      message: `Strict mode: ${validation.warnings.length} warning(s) found`,
    });
  }

  // Check if validation failed
  if (!validation.valid && !opts.enableFallback) {
    return err({
      code: 'VALIDATION_ERROR',
      message: `Validation failed: ${validation.errors.map((e) => e.message).join('; ')}`,
    });
  }

  return ok({
    issue,
    validation,
    usedFallback: false,
  });
}

/**
 * Parse all sections from the AST
 */
async function parseAllSections(
  ast: Root,
  body: string,
  _options: ParserOptions
): Promise<Result<ParsedIssue, ParseError>> {
  // Parse source
  const sourceResult = parseSource(ast);
  if (!isSuccess(sourceResult)) {
    return sourceResult;
  }
  const source = sourceResult.data;

  // Parse type
  const typeResult = parseType(ast);
  if (!isSuccess(typeResult)) {
    return typeResult;
  }
  const type = typeResult.data;

  // Parse context
  const contextResult = parseContext(ast);
  if (!isSuccess(contextResult)) {
    return contextResult;
  }
  const context = contextResult.data;

  // Parse problem description
  const problemResult = parseProblemDescription(ast);
  if (!isSuccess(problemResult)) {
    return problemResult;
  }
  const problemDescription = problemResult.data;

  // Parse code analysis (optional)
  const codeAnalysisResult = parseCodeAnalysis(ast);
  const codeAnalysis = isSuccess(codeAnalysisResult) ? codeAnalysisResult.data : undefined;

  // Parse suggested fix (optional)
  const suggestedFixResult = parseSuggestedFix(ast);
  const suggestedFix = isSuccess(suggestedFixResult) ? suggestedFixResult.data : undefined;

  // Parse acceptance criteria
  const acceptanceResult = parseAcceptanceCriteria(ast);
  const acceptanceCriteria = isSuccess(acceptanceResult) ? acceptanceResult.data : [];

  // Build raw sections map
  const rawSections: Record<string, string> = {
    body,
  };

  // Build context object conditionally
  const contextObj: ParsedIssue['context'] = {
    priority: context.priority ?? DEFAULT_VALUES.priority,
    relatedFiles: context.relatedFiles,
    relatedSymbols: context.relatedSymbols,
    ...(context.component !== undefined && { component: context.component }),
    ...(context.service !== undefined && { service: context.service }),
    ...(context.environment !== undefined && { environment: context.environment }),
  };

  // Construct parsed issue
  const parsedIssue: ParsedIssue = {
    source: source.source,
    type,
    problemDescription,
    context: contextObj,
    acceptanceCriteria,
    rawSections,
    ...(source.sourceId !== undefined && { sourceId: source.sourceId }),
    ...(source.sourceUrl !== undefined && { sourceUrl: source.sourceUrl }),
    ...(codeAnalysis !== undefined && codeAnalysis !== null && { codeAnalysis }),
    ...(suggestedFix !== undefined && suggestedFix !== null && { suggestedFix }),
  };

  return ok(parsedIssue);
}

/**
 * Synchronous parse (returns Promise but uses cached remark if available)
 * Alias for parseIssueBody for API consistency
 */
export const parse = parseIssueBody;

/**
 * Quick parse without validation (for performance)
 */
export async function quickParse(body: string): Promise<Result<ParsedIssue, ParseError>> {
  const result = await parseIssueBody(body, {
    skipValidation: true,
    enableFallback: true,
    strict: false,
  });

  if (isSuccess(result)) {
    return ok(result.data.issue);
  }

  return result;
}

/**
 * Strict parse with full validation (for production)
 */
export async function strictParse(body: string): Promise<Result<ParseResult, ParseError>> {
  return parseIssueBody(body, {
    strict: true,
    enableFallback: false,
    skipValidation: false,
  });
}
