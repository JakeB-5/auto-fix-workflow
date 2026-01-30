/**
 * @module analyzer/code-locator/function-locator
 * @description Locate functions and classes in source files
 */

import { promises as fs } from 'node:fs';
import type { CodeLocation } from './types.js';

/**
 * Locate function or class in files
 *
 * @param name - Function or class name to locate
 * @param files - Array of file paths to search
 * @returns Array of code locations
 */
export async function locateFunction(
  name: string,
  files: string[]
): Promise<CodeLocation[]> {
  const locations: CodeLocation[] = [];

  await Promise.all(
    files.map(async (filePath) => {
      const fileLocations = await locateFunctionInFile(name, filePath);
      locations.push(...fileLocations);
    })
  );

  return locations;
}

/**
 * Locate function or class in a single file
 *
 * @param name - Function or class name to locate
 * @param filePath - File path to search
 * @returns Array of code locations found in file
 */
async function locateFunctionInFile(
  name: string,
  filePath: string
): Promise<CodeLocation[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const locations: CodeLocation[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const location = parseFunctionDeclaration(line, name, filePath, i + 1);
      if (location) {
        locations.push(location);
      }
    }

    return locations;
  } catch (error) {
    // File read error, skip
    return [];
  }
}

/**
 * Parse line for function or class declaration
 *
 * @param line - Line of code
 * @param name - Name to search for
 * @param filePath - File path
 * @param lineNumber - Line number
 * @returns CodeLocation if match found
 */
function parseFunctionDeclaration(
  line: string,
  name: string,
  filePath: string,
  lineNumber: number
): CodeLocation | null {
  const trimmed = line.trim();

  // TypeScript/JavaScript function patterns
  const jsFunctionPatterns = [
    new RegExp(`function\\s+${escapeRegex(name)}\\s*\\(`),
    new RegExp(`const\\s+${escapeRegex(name)}\\s*=\\s*(?:async\\s+)?function`),
    new RegExp(`const\\s+${escapeRegex(name)}\\s*=\\s*(?:async\\s+)?\\(`),
    new RegExp(`${escapeRegex(name)}\\s*:\\s*(?:async\\s+)?\\(`),
    new RegExp(`(?:async\\s+)?${escapeRegex(name)}\\s*\\(`),
  ];

  for (const pattern of jsFunctionPatterns) {
    if (pattern.test(trimmed)) {
      return {
        filePath,
        lineNumber,
        functionName: name,
        confidence: 0.9,
      };
    }
  }

  // TypeScript/JavaScript class patterns
  const jsClassPatterns = [
    new RegExp(`class\\s+${escapeRegex(name)}(?:\\s+extends|\\s+implements|\\s*{)`),
    new RegExp(`interface\\s+${escapeRegex(name)}(?:\\s+extends|\\s*{)`),
    new RegExp(`type\\s+${escapeRegex(name)}\\s*=`),
  ];

  for (const pattern of jsClassPatterns) {
    if (pattern.test(trimmed)) {
      return {
        filePath,
        lineNumber,
        className: name,
        confidence: 0.9,
      };
    }
  }

  // Python function/class patterns
  const pythonPatterns = [
    new RegExp(`def\\s+${escapeRegex(name)}\\s*\\(`),
    new RegExp(`async\\s+def\\s+${escapeRegex(name)}\\s*\\(`),
    new RegExp(`class\\s+${escapeRegex(name)}\\s*[:(]`),
  ];

  for (const pattern of pythonPatterns) {
    if (pattern.test(trimmed)) {
      const isClass = trimmed.startsWith('class ');
      const location: CodeLocation = {
        filePath,
        lineNumber,
        confidence: 0.9,
      };

      if (isClass) {
        return { ...location, className: name };
      } else {
        return { ...location, functionName: name };
      }
    }
  }

  // Java method/class patterns
  const javaPatterns = [
    new RegExp(`(?:public|private|protected)?\\s*(?:static)?\\s*\\w+\\s+${escapeRegex(name)}\\s*\\(`),
    new RegExp(`(?:public|private|protected)?\\s*class\\s+${escapeRegex(name)}(?:\\s+extends|\\s+implements|\\s*{)`),
    new RegExp(`(?:public|private|protected)?\\s*interface\\s+${escapeRegex(name)}(?:\\s+extends|\\s*{)`),
  ];

  for (const pattern of javaPatterns) {
    if (pattern.test(trimmed)) {
      const isClass = /class\s+/.test(trimmed) || /interface\s+/.test(trimmed);
      const location: CodeLocation = {
        filePath,
        lineNumber,
        confidence: 0.85,
      };

      if (isClass) {
        return { ...location, className: name };
      } else {
        return { ...location, functionName: name };
      }
    }
  }

  return null;
}

/**
 * Escape special regex characters
 *
 * @param str - String to escape
 * @returns Escaped string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Locate class definition
 *
 * @param className - Class name to locate
 * @param files - Array of file paths to search
 * @returns Array of code locations
 */
export async function locateClass(
  className: string,
  files: string[]
): Promise<CodeLocation[]> {
  const locations = await locateFunction(className, files);

  // Filter to only class definitions
  return locations.filter(loc => loc.className !== undefined);
}

/**
 * Locate method within a class
 *
 * @param className - Class name
 * @param methodName - Method name
 * @param files - Array of file paths to search
 * @returns Array of code locations
 */
export async function locateMethod(
  className: string,
  methodName: string,
  files: string[]
): Promise<CodeLocation[]> {
  const locations: CodeLocation[] = [];

  await Promise.all(
    files.map(async (filePath) => {
      const fileLocations = await locateMethodInFile(className, methodName, filePath);
      locations.push(...fileLocations);
    })
  );

  return locations;
}

/**
 * Locate method within class in a file
 *
 * @param className - Class name
 * @param methodName - Method name
 * @param filePath - File path
 * @returns Array of code locations
 */
async function locateMethodInFile(
  className: string,
  methodName: string,
  filePath: string
): Promise<CodeLocation[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const locations: CodeLocation[] = [];

    let inClass = false;
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const trimmed = line.trim();

      // Check for class start
      const classPattern = new RegExp(`class\\s+${escapeRegex(className)}(?:\\s+extends|\\s+implements|\\s*{)`);
      if (classPattern.test(trimmed)) {
        inClass = true;
        braceCount = 0;
      }

      if (inClass) {
        // Count braces to track class scope
        braceCount += (line.match(/{/g) ?? []).length;
        braceCount -= (line.match(/}/g) ?? []).length;

        // Check for method
        const methodPattern = new RegExp(`${escapeRegex(methodName)}\\s*\\(`);
        if (methodPattern.test(trimmed)) {
          locations.push({
            filePath,
            lineNumber: i + 1,
            functionName: methodName,
            className,
            confidence: 0.95,
          });
        }

        // Exit class scope
        if (braceCount === 0 && trimmed === '}') {
          inClass = false;
        }
      }
    }

    return locations;
  } catch (error) {
    return [];
  }
}
