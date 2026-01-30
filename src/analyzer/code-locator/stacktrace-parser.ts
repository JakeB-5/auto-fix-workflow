/**
 * @module analyzer/code-locator/stacktrace-parser
 * @description Stack trace parsing for multiple language formats
 */

import type { StackFrame } from './types.js';

/**
 * Parse stack trace string into structured frames
 *
 * @param trace - Stack trace string
 * @returns Array of parsed stack frames
 */
export function parseStackTrace(trace: string): StackFrame[] {
  const lines = trace.split('\n').map(line => line.trim()).filter(Boolean);
  const frames: StackFrame[] = [];

  for (const line of lines) {
    const frame = parseStackLine(line);
    if (frame) {
      frames.push(frame);
    }
  }

  return frames;
}

/**
 * Parse a single stack trace line
 *
 * @param line - Stack trace line
 * @returns Parsed frame or null if not parseable
 */
function parseStackLine(line: string): StackFrame | null {
  // Try Node.js format first
  const nodeFrame = parseNodeJsStackLine(line);
  if (nodeFrame) return nodeFrame;

  // Try Python format
  const pythonFrame = parsePythonStackLine(line);
  if (pythonFrame) return pythonFrame;

  // Try Java format
  const javaFrame = parseJavaStackLine(line);
  if (javaFrame) return javaFrame;

  return null;
}

/**
 * Parse Node.js/JavaScript stack trace line
 * Format: "at functionName (filePath:line:column)" or "at filePath:line:column"
 *
 * @param line - Stack trace line
 * @returns Parsed frame or null
 */
function parseNodeJsStackLine(line: string): StackFrame | null {
  // Match: "at functionName (filePath:line:column)"
  const withFunctionMatch = line.match(
    /at\s+(?:([^\s]+)\s+)?\(?([^:]+):(\d+):(\d+)\)?/
  );

  if (withFunctionMatch) {
    const [, functionName, filePath, lineNum, colNum] = withFunctionMatch;
    let frame: StackFrame = {
      filePath: filePath?.trim() ?? '',
      raw: line,
    };

    if (lineNum) {
      frame = { ...frame, lineNumber: parseInt(lineNum, 10) };
    }
    if (colNum) {
      frame = { ...frame, columnNumber: parseInt(colNum, 10) };
    }
    if (functionName?.trim()) {
      frame = { ...frame, functionName: functionName.trim() };
    }

    return frame;
  }

  return null;
}

/**
 * Parse Python stack trace line
 * Format: 'File "filePath", line lineNum, in functionName'
 *
 * @param line - Stack trace line
 * @returns Parsed frame or null
 */
function parsePythonStackLine(line: string): StackFrame | null {
  const match = line.match(/File\s+"([^"]+)",\s+line\s+(\d+)(?:,\s+in\s+(.+))?/);

  if (match) {
    const [, filePath, lineNum, functionName] = match;
    let frame: StackFrame = {
      filePath: filePath ?? '',
      raw: line,
    };

    if (lineNum) {
      frame = { ...frame, lineNumber: parseInt(lineNum, 10) };
    }
    if (functionName?.trim()) {
      frame = { ...frame, functionName: functionName.trim() };
    }

    return frame;
  }

  return null;
}

/**
 * Parse Java stack trace line
 * Format: "at package.ClassName.methodName(FileName.java:lineNum)"
 *
 * @param line - Stack trace line
 * @returns Parsed frame or null
 */
function parseJavaStackLine(line: string): StackFrame | null {
  const match = line.match(
    /at\s+(?:([a-zA-Z0-9_.]+)\.)?([a-zA-Z0-9_]+)\(([^:)]+):(\d+)\)/
  );

  if (match) {
    const [, packagePath, methodName, fileName, lineNum] = match;
    const className = packagePath?.split('.').pop();

    let frame: StackFrame = {
      filePath: fileName ?? '',
      raw: line,
    };

    if (lineNum) {
      frame = { ...frame, lineNumber: parseInt(lineNum, 10) };
    }
    if (methodName) {
      frame = { ...frame, functionName: methodName };
    }
    if (className) {
      frame = { ...frame, className };
    }

    return frame;
  }

  return null;
}

/**
 * Extract file paths from stack frames
 *
 * @param frames - Stack frames
 * @returns Array of unique file paths
 */
export function extractFilePaths(frames: StackFrame[]): string[] {
  const paths = new Set<string>();

  for (const frame of frames) {
    if (frame.filePath) {
      paths.add(frame.filePath);
    }
  }

  return Array.from(paths);
}

/**
 * Extract function names from stack frames
 *
 * @param frames - Stack frames
 * @returns Array of unique function names
 */
export function extractFunctionNames(frames: StackFrame[]): string[] {
  const names = new Set<string>();

  for (const frame of frames) {
    if (frame.functionName) {
      names.add(frame.functionName);
    }
  }

  return Array.from(names);
}
