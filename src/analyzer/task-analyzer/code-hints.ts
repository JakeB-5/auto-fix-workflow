/**
 * @module analyzer/task-analyzer/code-hints
 * @description Code location hint extraction
 */

import type { AsanaTask, CodeHint } from './types.js';

/**
 * Extract file paths from text
 */
function extractFilePaths(text: string | undefined): string[] {
  if (!text) return [];

  const paths: string[] = [];

  // Match file paths with extensions (including paths with directory separators)
  const filePattern = /([a-zA-Z0-9_\-]+(?:[/\\][a-zA-Z0-9_\-]+)*\.[a-zA-Z0-9]+)/g;
  let match;
  while ((match = filePattern.exec(text)) !== null) {
    const path = match[1];
    if (path) paths.push(path);
  }

  // Match paths in backticks
  const backtickPattern = /`([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)`/g;
  while ((match = backtickPattern.exec(text)) !== null) {
    const path = match[1];
    if (path) paths.push(path);
  }

  return Array.from(new Set(paths)); // Deduplicate
}

/**
 * Extract function names from text
 */
function extractFunctionNames(text: string | undefined): string[] {
  if (!text) return [];

  const functions: string[] = [];
  const commonWords = new Set(['if', 'for', 'while', 'switch', 'return', 'in', 'at', 'the', 'and', 'or', 'not']);

  // Match "in functionName function" pattern first (higher priority)
  const inFunctionWordPattern = /\bin\s+([a-zA-Z_$][a-zA-Z0-9_$]+)\s+function/gi;
  let match;
  while ((match = inFunctionWordPattern.exec(text)) !== null) {
    const funcName = match[1];
    if (funcName && funcName.length > 2 && !commonWords.has(funcName.toLowerCase())) {
      functions.push(funcName);
    }
  }

  // Match "function X" pattern
  const functionPattern = /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gi;
  while ((match = functionPattern.exec(text)) !== null) {
    const funcName = match[1];
    if (funcName && funcName.length > 2) {
      functions.push(funcName);
    }
  }

  // Match function calls: functionName()
  const callPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  while ((match = callPattern.exec(text)) !== null) {
    const name = match[1];
    if (name && name.length > 2 && !commonWords.has(name.toLowerCase())) {
      functions.push(name);
    }
  }

  // Match method calls: object.method()
  const methodPattern = /\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
  while ((match = methodPattern.exec(text)) !== null) {
    const methodName = match[1];
    if (methodName && methodName.length > 2) {
      functions.push(methodName);
    }
  }

  return Array.from(new Set(functions)); // Deduplicate
}

/**
 * Extract line numbers from text
 */
function extractLineNumbers(text: string | undefined): number[] {
  if (!text) return [];

  const lines: number[] = [];

  // Match "line X" or "line: X" or "at line X"
  const linePattern = /(?:line|at\s+line)[:\s]+(\d+)/gi;
  let match;
  while ((match = linePattern.exec(text)) !== null) {
    const lineNum = match[1];
    if (lineNum) {
      lines.push(parseInt(lineNum, 10));
    }
  }

  // Match stack trace line numbers (filename.ext:123)
  const stackPattern = /[a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+:(\d+)/g;
  while ((match = stackPattern.exec(text)) !== null) {
    const lineNum = match[1];
    if (lineNum) {
      lines.push(parseInt(lineNum, 10));
    }
  }

  return Array.from(new Set(lines)); // Deduplicate
}

/**
 * Calculate confidence based on context
 */
function calculateConfidence(
  hasFile: boolean,
  hasFunction: boolean,
  hasLine: boolean,
  contextQuality: number
): number {
  let confidence = 0.3; // Base confidence

  if (hasFile) confidence += 0.3;
  if (hasFunction) confidence += 0.2;
  if (hasLine) confidence += 0.2;

  // Context quality bonus
  confidence += contextQuality * 0.3;

  return Math.min(confidence, 1.0);
}

/**
 * Assess context quality
 */
function assessContextQuality(text: string | undefined): number {
  if (!text) return 0;

  let quality = 0;

  // Has error message
  if (/error|exception|failure/i.test(text)) {
    quality += 0.3;
  }

  // Has stack trace
  if (/stack trace|traceback|at\s+\w+/i.test(text)) {
    quality += 0.4;
  }

  // Has code snippet
  if (/```|`\w+`/.test(text)) {
    quality += 0.3;
  }

  return Math.min(quality, 1.0);
}

/**
 * Extract code hints from task
 */
export function extractCodeHints(task: AsanaTask): CodeHint[] {
  const text = `${task.name}\n${task.notes || ''}`;
  const hints: CodeHint[] = [];

  const files = extractFilePaths(text);
  const functions = extractFunctionNames(text);
  const lines = extractLineNumbers(text);
  const contextQuality = assessContextQuality(text);

  // Create hints from files
  for (const file of files) {
    const relatedFunctions = functions.filter((fn) =>
      text.includes(`${file}`) && text.includes(`${fn}`)
    );

    const relatedLines = lines.filter((line) =>
      text.includes(`${file}`) && text.includes(`${line}`)
    );

    if (relatedFunctions.length > 0) {
      // File with function(s)
      for (const func of relatedFunctions) {
        const line = relatedLines.find((l) =>
          text.includes(`${func}`) && text.includes(`${l}`)
        );

        const hint: CodeHint = {
          file,
          function: func,
          confidence: calculateConfidence(true, true, !!line, contextQuality),
        };

        if (line !== undefined) {
          (hint as any).line = line;
        }

        hints.push(hint);
      }
    } else if (relatedLines.length > 0) {
      // File with line(s) but no function
      for (const line of relatedLines) {
        const hint: CodeHint = {
          file,
          confidence: calculateConfidence(true, false, true, contextQuality),
        };
        (hint as any).line = line;
        hints.push(hint);
      }
    } else {
      // File only
      hints.push({
        file,
        confidence: calculateConfidence(true, false, false, contextQuality),
      });
    }
  }

  // Create hints from functions without files
  const functionsWithoutFiles = functions.filter(
    (fn) => !files.some((file) => text.includes(`${file}`) && text.includes(`${fn}`))
  );

  for (const func of functionsWithoutFiles) {
    hints.push({
      function: func,
      confidence: calculateConfidence(false, true, false, contextQuality),
    });
  }

  // Sort by confidence descending
  hints.sort((a, b) => b.confidence - a.confidence);

  // Return top 10 hints
  return hints.slice(0, 10);
}
