/**
 * @module common/error-handler/parse-error
 * @description Parse error class for syntax and format errors
 */

import { AutofixError } from './base.js';
import type { ParseErrorCode } from './codes.js';

/**
 * Context for parse errors
 */
export interface ParseErrorContext {
  /** Source file or input identifier */
  readonly source?: string | undefined;
  /** Line number (1-indexed) */
  readonly line?: number | undefined;
  /** Column number (1-indexed) */
  readonly column?: number | undefined;
  /** The problematic input (possibly truncated) */
  readonly input?: string | undefined;
  /** Expected token or format */
  readonly expected?: string | undefined;
  /** Actual token or value found */
  readonly found?: string | undefined;
  /** Parser or format type */
  readonly parser?: string | undefined;
  /** Encoding that was attempted */
  readonly encoding?: string | undefined;
}

/**
 * Error class for parse errors
 *
 * @example
 * ```typescript
 * throw new ParseError(
 *   'PARSE_SYNTAX_ERROR',
 *   'Unexpected token at line 5',
 *   { source: 'config.json', line: 5, column: 12 }
 * );
 * ```
 */
export class ParseError extends AutofixError {
  readonly code: ParseErrorCode;
  readonly context: Readonly<ParseErrorContext>;

  constructor(
    code: ParseErrorCode,
    message: string,
    context: ParseErrorContext = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.code = code;
    this.context = Object.freeze({ ...context });
    Object.freeze(this);
  }

  /**
   * Create a ParseError for syntax errors
   */
  static syntaxError(
    message: string,
    source?: string,
    line?: number,
    column?: number
  ): ParseError {
    const location = line !== undefined
      ? column !== undefined
        ? ` at ${source ?? 'input'}:${line}:${column}`
        : ` at ${source ?? 'input'}:${line}`
      : source
        ? ` in ${source}`
        : '';

    return new ParseError(
      'PARSE_SYNTAX_ERROR',
      `Syntax error${location}: ${message}`,
      { source, line, column }
    );
  }

  /**
   * Create a ParseError for unexpected tokens
   */
  static unexpectedToken(
    expected: string,
    found: string,
    source?: string,
    line?: number,
    column?: number
  ): ParseError {
    const location = line !== undefined
      ? ` at line ${line}${column !== undefined ? `, column ${column}` : ''}`
      : '';

    return new ParseError(
      'PARSE_UNEXPECTED_TOKEN',
      `Unexpected token${location}: expected ${expected}, found '${found}'`,
      { source, line, column, expected, found }
    );
  }

  /**
   * Create a ParseError for invalid JSON
   */
  static invalidJson(
    message: string,
    source?: string,
    cause?: unknown
  ): ParseError {
    return new ParseError(
      'PARSE_INVALID_JSON',
      `Invalid JSON${source ? ` in ${source}` : ''}: ${message}`,
      { source, parser: 'json' },
      cause ? { cause } : undefined
    );
  }

  /**
   * Create a ParseError for invalid YAML
   */
  static invalidYaml(
    message: string,
    source?: string,
    line?: number,
    cause?: unknown
  ): ParseError {
    return new ParseError(
      'PARSE_INVALID_YAML',
      `Invalid YAML${source ? ` in ${source}` : ''}${line ? ` at line ${line}` : ''}: ${message}`,
      { source, line, parser: 'yaml' },
      cause ? { cause } : undefined
    );
  }

  /**
   * Create a ParseError for invalid format
   */
  static invalidFormat(
    expected: string,
    actual: string,
    source?: string,
    input?: string
  ): ParseError {
    // Truncate input if too long
    const truncatedInput = input && input.length > 100
      ? `${input.substring(0, 100)}...`
      : input;

    return new ParseError(
      'PARSE_INVALID_FORMAT',
      `Invalid format${source ? ` in ${source}` : ''}: expected ${expected}, got ${actual}`,
      { source, expected, found: actual, input: truncatedInput }
    );
  }

  /**
   * Create a ParseError for encoding errors
   */
  static encodingError(
    encoding: string,
    source?: string,
    cause?: unknown
  ): ParseError {
    return new ParseError(
      'PARSE_ENCODING_ERROR',
      `Encoding error${source ? ` in ${source}` : ''}: cannot decode as ${encoding}`,
      { source, encoding },
      cause ? { cause } : undefined
    );
  }

  /**
   * Get a formatted location string
   */
  get location(): string {
    const { source, line, column } = this.context;

    if (line !== undefined) {
      if (column !== undefined) {
        return `${source ?? '<input>'}:${line}:${column}`;
      }
      return `${source ?? '<input>'}:${line}`;
    }

    return source ?? '<input>';
  }

  /**
   * Check if position information is available
   */
  get hasPosition(): boolean {
    return this.context.line !== undefined;
  }
}
