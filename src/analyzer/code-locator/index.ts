/**
 * @module analyzer/code-locator
 * @description Public API for code location and analysis
 */

// Main class
export { CodeLocator } from './locator.js';

// Types
export type {
  CodeLocation,
  CodeHint,
  LocatorResult,
  LocatorError,
  StackFrame,
  SearchResult,
} from './types.js';

export { LocatorErrorCode } from './types.js';

// Stack trace parsing
export {
  parseStackTrace,
  extractFilePaths,
  extractFunctionNames,
} from './stacktrace-parser.js';

// File exploration
export {
  findFiles,
  findFilesByName,
  findFilesByExtension,
  findFilesInDirectory,
  findSourceFiles,
  fileExists,
  resolvePartialPath,
} from './file-explorer.js';

// Function/class location
export {
  locateFunction,
  locateClass,
  locateMethod,
} from './function-locator.js';

// Component identification
export {
  identifyComponent,
  identifyComponents,
  inferLabels,
  inferLabelsFromPaths,
  getPrimaryComponent,
} from './component-identifier.js';

// Text search
export {
  searchCode,
  searchMultiple,
  searchError,
} from './text-search.js';
