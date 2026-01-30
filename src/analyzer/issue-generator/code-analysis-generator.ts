/**
 * @module analyzer/issue-generator/code-analysis-generator
 * @description Generate Code Analysis section with snippets
 */

import type { CodeLocation } from '../code-locator/types.js';

/**
 * Code analysis data
 */
export interface CodeAnalysisData {
  readonly location?: CodeLocation | undefined;
  readonly snippet?: string | undefined;
  readonly errorMessage?: string | undefined;
  readonly stackTrace?: string | undefined;
}

/**
 * Format code snippet with line numbers
 *
 * @param snippet - Code snippet
 * @param startLine - Starting line number
 * @returns Formatted code with line numbers
 */
export function formatCodeSnippet(
  snippet: string,
  startLine: number | undefined
): string {
  if (startLine === undefined) {
    return snippet;
  }

  const lines = snippet.split('\n');
  return lines
    .map((line, index) => {
      const lineNum = startLine + index;
      return `${String(lineNum).padStart(4, ' ')} | ${line}`;
    })
    .join('\n');
}

/**
 * Extract context window from code
 *
 * @param fullCode - Full source code
 * @param targetLine - Target line number (1-based)
 * @param windowSize - Lines before and after (default: 5)
 * @returns Code snippet and start line
 */
export function extractContextWindow(
  fullCode: string,
  targetLine: number,
  windowSize: number = 5
): { snippet: string; startLine: number } {
  const lines = fullCode.split('\n');
  const startLine = Math.max(1, targetLine - windowSize);
  const endLine = Math.min(lines.length, targetLine + windowSize);

  const snippet = lines
    .slice(startLine - 1, endLine)
    .join('\n');

  return { snippet, startLine };
}

/**
 * Generate code analysis section
 *
 * @param data - Code analysis data
 * @returns Markdown section lines
 */
export function generateCodeAnalysisSection(
  data: CodeAnalysisData
): string[] {
  const lines: string[] = [];

  // Code snippet
  if (data.snippet) {
    lines.push('### Code Analysis');
    lines.push('');

    const language = inferLanguage(data.location?.filePath);
    lines.push('```' + language);

    if (data.location?.lineNumber !== undefined) {
      lines.push(formatCodeSnippet(data.snippet, data.location.lineNumber));
    } else {
      lines.push(data.snippet);
    }

    lines.push('```');
  }

  // Error message
  if (data.errorMessage) {
    if (lines.length > 0) {
      lines.push('');
    }
    lines.push('**에러 메시지:**');
    lines.push('```');
    lines.push(data.errorMessage);
    lines.push('```');
  }

  // Stack trace
  if (data.stackTrace) {
    if (lines.length > 0) {
      lines.push('');
    }
    lines.push('**스택 트레이스:**');
    lines.push('```');
    lines.push(data.stackTrace);
    lines.push('```');
  }

  return lines;
}

/**
 * Infer programming language from file path
 *
 * @param filePath - File path
 * @returns Language identifier for code fence
 */
function inferLanguage(filePath: string | undefined): string {
  if (!filePath) {
    return 'text';
  }

  const ext = filePath.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    yaml: 'yaml',
    yml: 'yaml',
    json: 'json',
    md: 'markdown',
    sh: 'bash',
  };

  return languageMap[ext || ''] || 'text';
}
