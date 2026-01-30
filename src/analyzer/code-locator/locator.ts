/**
 * @module analyzer/code-locator/locator
 * @description Main CodeLocator class for analyzing and locating code
 */

import type { Result } from '../../common/types/result.js';
import { ok, err } from '../../common/types/result.js';
import type {
  CodeHint,
  CodeLocation,
  LocatorResult,
  LocatorError,
  StackFrame,
} from './types.js';
import { LocatorErrorCode } from './types.js';
import { parseStackTrace, extractFilePaths, extractFunctionNames } from './stacktrace-parser.js';
import { findFiles, findFilesByName, findSourceFiles, resolvePartialPath } from './file-explorer.js';
import { locateFunction, locateClass, locateMethod } from './function-locator.js';
import { identifyComponents, inferLabels, inferLabelsFromPaths } from './component-identifier.js';
import { searchCode, searchError } from './text-search.js';

/**
 * Main code locator class
 */
export class CodeLocator {
  private readonly cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Locate code based on hints
   *
   * @param hints - Array of code hints
   * @returns Promise resolving to Result with LocatorResult or LocatorError
   */
  async locate(hints: CodeHint[]): Promise<Result<LocatorResult, LocatorError>> {
    if (hints.length === 0) {
      return err({
        code: LocatorErrorCode.INVALID_HINT,
        message: 'No hints provided',
      });
    }

    try {
      const locations: CodeLocation[] = [];
      const allFiles = new Set<string>();

      // Process each hint
      for (const hint of hints) {
        const hintLocations = await this.processHint(hint);
        locations.push(...hintLocations);

        // Collect files for component identification
        hintLocations.forEach(loc => allFiles.add(loc.filePath));
      }

      // Remove duplicates and sort by confidence
      const uniqueLocations = this.deduplicateLocations(locations);
      const sortedLocations = uniqueLocations.sort((a, b) => b.confidence - a.confidence);

      // Identify components and labels
      const filePaths = Array.from(allFiles);
      const components = identifyComponents(filePaths);
      const suggestedLabels = this.combineLabels(components, filePaths);

      return ok({
        locations: sortedLocations,
        components,
        suggestedLabels,
      });
    } catch (error) {
      return err({
        code: LocatorErrorCode.SEARCH_FAILED,
        message: `Failed to locate code: ${error instanceof Error ? error.message : String(error)}`,
        cause: error,
      });
    }
  }

  /**
   * Process a single hint
   *
   * @param hint - Code hint
   * @returns Promise resolving to array of code locations
   */
  private async processHint(hint: CodeHint): Promise<CodeLocation[]> {
    switch (hint.type) {
      case 'stacktrace':
        return this.processStackTrace(hint.content);
      case 'filename':
        return this.processFilename(hint.content);
      case 'function':
        return this.processFunction(hint.content);
      case 'class':
        return this.processClass(hint.content);
      case 'text':
        return this.processText(hint.content);
      default:
        return [];
    }
  }

  /**
   * Process stack trace hint
   *
   * @param stackTrace - Stack trace string
   * @returns Promise resolving to code locations
   */
  private async processStackTrace(stackTrace: string): Promise<CodeLocation[]> {
    const frames = parseStackTrace(stackTrace);
    const locations: CodeLocation[] = [];

    // Process each frame
    for (const frame of frames) {
      const frameLocations = await this.processStackFrame(frame);
      locations.push(...frameLocations);
    }

    return locations;
  }

  /**
   * Process single stack frame
   *
   * @param frame - Stack frame
   * @returns Promise resolving to code locations
   */
  private async processStackFrame(frame: StackFrame): Promise<CodeLocation[]> {
    // Try to resolve the file path
    const resolvedPaths = await resolvePartialPath(frame.filePath, this.cwd);

    if (resolvedPaths.length === 0) {
      return [];
    }

    // Create locations from resolved paths
    return resolvedPaths.map(filePath => {
      let location: CodeLocation = {
        filePath,
        confidence: 0.9,
      };

      if (frame.lineNumber !== undefined) {
        location = { ...location, lineNumber: frame.lineNumber };
      }
      if (frame.functionName !== undefined) {
        location = { ...location, functionName: frame.functionName };
      }
      if (frame.className !== undefined) {
        location = { ...location, className: frame.className };
      }

      return location;
    });
  }

  /**
   * Process filename hint
   *
   * @param filename - Filename or pattern
   * @returns Promise resolving to code locations
   */
  private async processFilename(filename: string): Promise<CodeLocation[]> {
    const files = await findFilesByName(filename, this.cwd);

    return files.map(filePath => ({
      filePath,
      confidence: 0.8,
    }));
  }

  /**
   * Process function name hint
   *
   * @param functionName - Function name
   * @returns Promise resolving to code locations
   */
  private async processFunction(functionName: string): Promise<CodeLocation[]> {
    // Get source files
    const sourceFiles = await findSourceFiles(this.cwd);

    // Locate function
    return locateFunction(functionName, sourceFiles);
  }

  /**
   * Process class name hint
   *
   * @param className - Class name
   * @returns Promise resolving to code locations
   */
  private async processClass(className: string): Promise<CodeLocation[]> {
    // Get source files
    const sourceFiles = await findSourceFiles(this.cwd);

    // Locate class
    return locateClass(className, sourceFiles);
  }

  /**
   * Process text search hint
   *
   * @param text - Text to search
   * @returns Promise resolving to code locations
   */
  private async processText(text: string): Promise<CodeLocation[]> {
    // Get source files
    const sourceFiles = await findSourceFiles(this.cwd);

    // Search for text
    const results = await searchCode(text, this.cwd, sourceFiles);

    // Convert search results to code locations
    return results.map(result => ({
      filePath: result.filePath,
      lineNumber: result.lineNumber,
      confidence: result.confidence,
    }));
  }

  /**
   * Deduplicate code locations
   *
   * @param locations - Array of code locations
   * @returns Deduplicated array
   */
  private deduplicateLocations(locations: CodeLocation[]): CodeLocation[] {
    const seen = new Map<string, CodeLocation>();

    for (const location of locations) {
      const key = this.getLocationKey(location);
      const existing = seen.get(key);

      // Keep location with higher confidence
      if (!existing || location.confidence > existing.confidence) {
        seen.set(key, location);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Get unique key for a location
   *
   * @param location - Code location
   * @returns Unique key string
   */
  private getLocationKey(location: CodeLocation): string {
    return `${location.filePath}:${location.lineNumber ?? 0}:${location.functionName ?? ''}:${location.className ?? ''}`;
  }

  /**
   * Combine labels from components and file paths
   *
   * @param components - Array of components
   * @param filePaths - Array of file paths
   * @returns Combined array of labels
   */
  private combineLabels(components: string[], filePaths: string[]): string[] {
    const labels = new Set<string>();

    // Add component-based labels
    const componentLabels = inferLabels(components);
    componentLabels.forEach(label => labels.add(label));

    // Add path-based labels
    const pathLabels = inferLabelsFromPaths(filePaths);
    pathLabels.forEach(label => labels.add(label));

    return Array.from(labels).sort();
  }

  /**
   * Locate code from error message
   *
   * @param errorMessage - Error message
   * @returns Promise resolving to Result with LocatorResult
   */
  async locateFromError(
    errorMessage: string
  ): Promise<Result<LocatorResult, LocatorError>> {
    try {
      // Check if error message contains stack trace
      const hasStackTrace = /at\s+.+\(.+:\d+:\d+\)/i.test(errorMessage) ||
                           /File\s+".+",\s+line\s+\d+/i.test(errorMessage);

      if (hasStackTrace) {
        // Process as stack trace
        return this.locate([
          { type: 'stacktrace', content: errorMessage },
        ]);
      }

      // Otherwise, search for error text
      const sourceFiles = await findSourceFiles(this.cwd);
      const results = await searchError(errorMessage, sourceFiles);

      const locations = results.map(result => ({
        filePath: result.filePath,
        lineNumber: result.lineNumber,
        confidence: result.confidence,
      }));

      const filePaths = results.map(r => r.filePath);
      const components = identifyComponents(filePaths);
      const suggestedLabels = this.combineLabels(components, filePaths);

      return ok({
        locations,
        components,
        suggestedLabels,
      });
    } catch (error) {
      return err({
        code: LocatorErrorCode.SEARCH_FAILED,
        message: `Failed to locate from error: ${error instanceof Error ? error.message : String(error)}`,
        cause: error,
      });
    }
  }
}
