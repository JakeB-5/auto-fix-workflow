/**
 * @module common/issue-parser/code-analysis-parser
 * @description Parse Code Analysis section from issue body
 */

import type { Root, Code, Content } from 'mdast';
import type { Result } from '../types/index.js';
import { ok, err, isFailure, isSuccess } from '../types/index.js';
import {
  findSection,
  getSectionText,
  extractCodeBlocks,
  extractText,
  isCode,
} from './ast.js';
import type { ParseError, ExtendedCodeAnalysis, StackFrame } from './types.js';
import { SECTION_NAMES } from './types.js';

/**
 * Stack trace line patterns for various languages
 */
const STACK_TRACE_PATTERNS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly extract: (match: RegExpMatchArray) => StackFrame;
}> = [
  // JavaScript/TypeScript: at functionName (file:line:col)
  {
    pattern: /at\s+(?:([^\s(]+)\s+)?\(?([^:]+):(\d+):(\d+)\)?/,
    extract: (match) => ({
      function: match[1],
      file: match[2] ?? '',
      line: parseInt(match[3] ?? '0', 10),
      column: parseInt(match[4] ?? '0', 10),
    }),
  },
  // JavaScript/TypeScript: at file:line:col
  {
    pattern: /at\s+([^:]+):(\d+):(\d+)/,
    extract: (match) => ({
      file: match[1] ?? '',
      line: parseInt(match[2] ?? '0', 10),
      column: parseInt(match[3] ?? '0', 10),
    }),
  },
  // Python: File "path", line N, in function
  {
    pattern: /File\s+"([^"]+)",\s+line\s+(\d+)(?:,\s+in\s+(\S+))?/,
    extract: (match) => ({
      file: match[1] ?? '',
      line: parseInt(match[2] ?? '0', 10),
      function: match[3],
    }),
  },
  // Java/Kotlin: at package.Class.method(File.java:line)
  {
    pattern: /at\s+([^\s(]+)\(([^:]+):(\d+)\)/,
    extract: (match) => ({
      function: match[1],
      file: match[2] ?? '',
      line: parseInt(match[3] ?? '0', 10),
    }),
  },
  // Go: file.go:line
  {
    pattern: /^\s*([^\s:]+\.go):(\d+)/,
    extract: (match) => ({
      file: match[1] ?? '',
      line: parseInt(match[2] ?? '0', 10),
    }),
  },
  // Rust: at file:line:col
  {
    pattern: /at\s+([^:]+):(\d+):(\d+)/,
    extract: (match) => ({
      file: match[1] ?? '',
      line: parseInt(match[2] ?? '0', 10),
      column: parseInt(match[3] ?? '0', 10),
    }),
  },
  // Generic: path/to/file:line
  {
    pattern: /([^\s:]+\.\w+):(\d+)(?::(\d+))?/,
    extract: (match) => ({
      file: match[1] ?? '',
      line: parseInt(match[2] ?? '0', 10),
      column: match[3] !== undefined ? parseInt(match[3], 10) : undefined,
    }),
  },
];

/**
 * Error message patterns
 */
const ERROR_PATTERNS = [
  // JavaScript errors
  /(?:Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError):\s*(.+)/,
  // Python errors
  /(?:Exception|Error|ValueError|TypeError|KeyError|AttributeError|IndexError):\s*(.+)/,
  // Java errors
  /(?:Exception|Error|NullPointerException|IllegalArgumentException):\s*(.+)/,
  // Generic error patterns
  /(?:error|failed|failure)[:\s]+(.+)/i,
  /(?:cannot|could not|unable to)[:\s]+(.+)/i,
];

/**
 * Parse stack trace from text
 */
function parseStackTrace(text: string): StackFrame[] {
  const frames: StackFrame[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    for (const { pattern, extract } of STACK_TRACE_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const frame = extract(match);
        if (frame.file) {
          frames.push(frame);
        }
        break;
      }
    }
  }

  return frames;
}

/**
 * Extract error message from text
 */
function extractErrorMessage(text: string): string | undefined {
  for (const pattern of ERROR_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  // Try to find the first line that looks like an error
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.toLowerCase().includes('error') ||
      trimmed.toLowerCase().includes('exception') ||
      trimmed.toLowerCase().includes('failed')
    ) {
      return trimmed;
    }
  }

  return undefined;
}

/**
 * Extract error type from text
 */
function extractErrorType(text: string): string | undefined {
  // JavaScript/TypeScript errors
  const jsMatch = text.match(/(TypeError|ReferenceError|SyntaxError|RangeError|URIError|Error)\s*:/);
  if (jsMatch?.[1]) return jsMatch[1];

  // Python errors
  const pyMatch = text.match(/(ValueError|TypeError|KeyError|AttributeError|IndexError|Exception|Error)\s*:/);
  if (pyMatch?.[1]) return pyMatch[1];

  // Java errors
  const javaMatch = text.match(/(NullPointerException|IllegalArgumentException|RuntimeException|Exception|Error)\s*:/);
  if (javaMatch?.[1]) return javaMatch[1];

  return undefined;
}

/**
 * Extract file path from code block or text
 */
function extractFilePath(text: string, codeBlock?: Code): string {
  // Check code block meta for file path
  if (codeBlock?.meta) {
    const metaPath = codeBlock.meta.match(/(?:file|path)[=:]?\s*["']?([^\s"']+)/i);
    if (metaPath?.[1]) return metaPath[1];
  }

  // Look for file path patterns in text
  const pathPatterns = [
    /file[:\s]+`?([^\s`]+\.\w+)`?/i,
    /path[:\s]+`?([^\s`]+\.\w+)`?/i,
    /in\s+`?([^\s`]+\.\w+)`?/i,
  ];

  for (const pattern of pathPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }

  // Extract from stack trace if available
  const frames = parseStackTrace(text);
  if (frames.length > 0) {
    const firstFrame = frames[0];
    if (firstFrame !== undefined) {
      return firstFrame.file;
    }
  }

  return '';
}

/**
 * Extract line numbers from text
 */
function extractLineNumbers(text: string): { start?: number; end?: number } {
  // Line range: lines 10-20
  const rangeMatch = text.match(/lines?\s+(\d+)\s*[-–to]+\s*(\d+)/i);
  if (rangeMatch) {
    return {
      start: parseInt(rangeMatch[1] ?? '0', 10),
      end: parseInt(rangeMatch[2] ?? '0', 10),
    };
  }

  // Single line: line 10
  const singleMatch = text.match(/line\s+(\d+)/i);
  if (singleMatch?.[1]) {
    const lineNum = parseInt(singleMatch[1], 10);
    return { start: lineNum, end: lineNum };
  }

  // From stack trace
  const frames = parseStackTrace(text);
  if (frames.length > 0) {
    const firstFrame = frames[0];
    if (firstFrame?.line) {
      return { start: firstFrame.line, end: firstFrame.line };
    }
  }

  return {};
}

/**
 * Extract function name from text
 */
function extractFunctionName(text: string): string | undefined {
  // Look for function/method mentions
  const patterns = [
    /function\s+`?([a-zA-Z_$][a-zA-Z0-9_$]*)`?/i,
    /method\s+`?([a-zA-Z_$][a-zA-Z0-9_$]*)`?/i,
    /in\s+`?([a-zA-Z_$][a-zA-Z0-9_$]*)`?\s*\(/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }

  // From stack trace
  const frames = parseStackTrace(text);
  if (frames.length > 0) {
    const firstFrame = frames[0];
    if (firstFrame?.function) {
      return firstFrame.function;
    }
  }

  return undefined;
}

/**
 * Extract class name from text
 */
function extractClassName(text: string): string | undefined {
  const patterns = [
    /class\s+`?([A-Z][a-zA-Z0-9_$]*)`?/i,
    /in\s+`?([A-Z][a-zA-Z0-9_$]*)`?\s*\./i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }

  return undefined;
}

/**
 * Get code snippet from code blocks
 */
function extractCodeSnippet(content: readonly Content[]): string | undefined {
  const codeBlocks = extractCodeBlocks(content);
  if (codeBlocks.length > 0) {
    const firstBlock = codeBlocks[0];
    if (firstBlock !== undefined) {
      return firstBlock.value;
    }
  }
  return undefined;
}

/**
 * Parse the Code Analysis section from an AST
 *
 * @param ast - The parsed markdown AST
 * @returns Result containing parsed code analysis or null if not found
 */
export function parseCodeAnalysis(ast: Root): Result<ExtendedCodeAnalysis | null, ParseError> {
  // Try main Code Analysis section
  let sectionResult = findSection(ast, SECTION_NAMES.CODE_ANALYSIS);

  if (isFailure(sectionResult)) {
    return err({
      code: 'AST_ERROR',
      message: sectionResult.error.message,
      section: SECTION_NAMES.CODE_ANALYSIS,
      cause: sectionResult.error,
    });
  }

  let section = sectionResult.data;

  // If not found, try Stack Trace section
  if (section === null) {
    sectionResult = findSection(ast, SECTION_NAMES.STACK_TRACE);
    if (isSuccess(sectionResult)) {
      section = sectionResult.data;
    }
  }

  // If not found, try Error Message section
  if (section === null) {
    sectionResult = findSection(ast, SECTION_NAMES.ERROR_MESSAGE);
    if (isSuccess(sectionResult)) {
      section = sectionResult.data;
    }
  }

  if (section === null) {
    // Look for code blocks in the document
    const codeBlocks: Code[] = [];
    for (const child of ast.children) {
      if (isCode(child)) {
        codeBlocks.push(child);
      }
    }

    if (codeBlocks.length === 0) {
      return ok(null);
    }

    // Try to extract info from code blocks
    let fullText = '';
    for (const block of codeBlocks) {
      fullText += block.value + '\n';
    }

    const stackTrace = parseStackTrace(fullText);
    if (stackTrace.length === 0) {
      return ok(null);
    }

    const firstFrame = stackTrace[0];
    const result: ExtendedCodeAnalysis = {
      filePath: firstFrame?.file ?? '',
      stackTrace,
    };

    const startLine = firstFrame?.line;
    const functionName = firstFrame?.function;
    const errorMessage = extractErrorMessage(fullText);
    const errorType = extractErrorType(fullText);
    const snippet = codeBlocks[0]?.value;

    return ok({
      ...result,
      ...(startLine !== undefined && { startLine }),
      ...(functionName !== undefined && { functionName }),
      ...(errorMessage !== undefined && { errorMessage }),
      ...(errorType !== undefined && { errorType }),
      ...(snippet !== undefined && { snippet }),
    });
  }

  const sectionText = getSectionText(section);
  const lineNumbers = extractLineNumbers(sectionText);

  // Extract code snippet
  const snippet = extractCodeSnippet(section.content);

  // Parse stack trace from section
  const stackTraceSection = findSection(ast, SECTION_NAMES.STACK_TRACE);
  let stackTrace: StackFrame[] = [];

  if (isSuccess(stackTraceSection) && stackTraceSection.data !== null) {
    const stackText = getSectionText(stackTraceSection.data);
    stackTrace = parseStackTrace(stackText);
  } else {
    // Try to parse from code blocks
    stackTrace = parseStackTrace(sectionText + '\n' + (snippet ?? ''));
  }

  // Extract error message
  const errorSection = findSection(ast, SECTION_NAMES.ERROR_MESSAGE);
  let errorMessage: string | undefined;

  if (isSuccess(errorSection) && errorSection.data !== null) {
    errorMessage = getSectionText(errorSection.data);
  } else {
    errorMessage = extractErrorMessage(sectionText + '\n' + (snippet ?? ''));
  }

  const result: ExtendedCodeAnalysis = {
    filePath: extractFilePath(sectionText, section.content.find(isCode) as Code | undefined),
  };

  const startLine = lineNumbers.start;
  const endLine = lineNumbers.end;
  const functionName = extractFunctionName(sectionText);
  const className = extractClassName(sectionText);
  const stackTraceResult = stackTrace.length > 0 ? stackTrace : undefined;
  const errorType = extractErrorType(sectionText + '\n' + (snippet ?? ''));

  return ok({
    ...result,
    ...(startLine !== undefined && { startLine }),
    ...(endLine !== undefined && { endLine }),
    ...(functionName !== undefined && { functionName }),
    ...(className !== undefined && { className }),
    ...(snippet !== undefined && { snippet }),
    ...(stackTraceResult !== undefined && { stackTrace: stackTraceResult }),
    ...(errorMessage !== undefined && { errorMessage }),
    ...(errorType !== undefined && { errorType }),
  });
}

/**
 * Parse code analysis from raw text (without AST)
 *
 * @param text - Raw text content
 * @returns Parsed code analysis or null
 */
export function parseCodeAnalysisFromText(text: string): ExtendedCodeAnalysis | null {
  const stackTrace = parseStackTrace(text);
  const lineNumbers = extractLineNumbers(text);

  if (stackTrace.length === 0 && !lineNumbers.start) {
    return null;
  }

  const firstFrame = stackTrace[0];

  const result: ExtendedCodeAnalysis = {
    filePath: extractFilePath(text) || firstFrame?.file || '',
  };

  const startLine = lineNumbers.start ?? firstFrame?.line;
  const endLine = lineNumbers.end;
  const functionName = extractFunctionName(text) ?? firstFrame?.function;
  const className = extractClassName(text);
  const stackTraceResult = stackTrace.length > 0 ? stackTrace : undefined;
  const errorMessage = extractErrorMessage(text);
  const errorType = extractErrorType(text);

  return {
    ...result,
    ...(startLine !== undefined && { startLine }),
    ...(endLine !== undefined && { endLine }),
    ...(functionName !== undefined && { functionName }),
    ...(className !== undefined && { className }),
    ...(stackTraceResult !== undefined && { stackTrace: stackTraceResult }),
    ...(errorMessage !== undefined && { errorMessage }),
    ...(errorType !== undefined && { errorType }),
  };
}
