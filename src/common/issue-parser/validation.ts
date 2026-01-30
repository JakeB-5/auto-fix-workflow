/**
 * @module common/issue-parser/validation
 * @description Validation logic for parsed issue data
 */

import type { ParsedIssue, ValidationResult, ValidationError, ValidationWarning } from './types.js';

/**
 * Minimum required length for problem description
 */
const MIN_PROBLEM_DESCRIPTION_LENGTH = 10;

/**
 * Maximum reasonable length for problem description
 */
const MAX_PROBLEM_DESCRIPTION_LENGTH = 10000;

/**
 * Valid issue sources
 */
const VALID_SOURCES = ['asana', 'sentry', 'manual', 'github'] as const;

/**
 * Valid issue types
 */
const VALID_TYPES = ['bug', 'feature', 'refactor', 'docs', 'test', 'chore'] as const;

/**
 * Valid priorities
 */
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

/**
 * File path pattern for validation
 */
const FILE_PATH_PATTERN = /^[./]?[\w\-./]+\.\w+$/;

/**
 * Validate a parsed issue
 *
 * @param issue - The parsed issue to validate
 * @returns Validation result with errors and warnings
 */
export function validateParsedIssue(issue: ParsedIssue): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Validate source
  if (!VALID_SOURCES.includes(issue.source)) {
    errors.push({
      field: 'source',
      message: `Invalid source: ${issue.source}. Must be one of: ${VALID_SOURCES.join(', ')}`,
      code: 'INVALID_SOURCE',
    });
  }

  // Validate type
  if (!VALID_TYPES.includes(issue.type)) {
    errors.push({
      field: 'type',
      message: `Invalid type: ${issue.type}. Must be one of: ${VALID_TYPES.join(', ')}`,
      code: 'INVALID_TYPE',
    });
  }

  // Validate problem description
  if (!issue.problemDescription || issue.problemDescription.length === 0) {
    errors.push({
      field: 'problemDescription',
      message: 'Problem description is required',
      code: 'MISSING_DESCRIPTION',
    });
  } else if (issue.problemDescription.length < MIN_PROBLEM_DESCRIPTION_LENGTH) {
    warnings.push({
      field: 'problemDescription',
      message: `Problem description is very short (${issue.problemDescription.length} chars). Consider adding more detail.`,
      code: 'SHORT_DESCRIPTION',
    });
  } else if (issue.problemDescription.length > MAX_PROBLEM_DESCRIPTION_LENGTH) {
    warnings.push({
      field: 'problemDescription',
      message: `Problem description is very long (${issue.problemDescription.length} chars). Consider summarizing.`,
      code: 'LONG_DESCRIPTION',
    });
  }

  // Validate context
  if (issue.context.priority !== undefined && !VALID_PRIORITIES.includes(issue.context.priority)) {
    errors.push({
      field: 'context.priority',
      message: `Invalid priority: ${issue.context.priority}. Must be one of: ${VALID_PRIORITIES.join(', ')}`,
      code: 'INVALID_PRIORITY',
    });
  }

  // Validate related files
  for (const filePath of issue.context.relatedFiles) {
    if (!FILE_PATH_PATTERN.test(filePath)) {
      warnings.push({
        field: 'context.relatedFiles',
        message: `Potentially invalid file path: ${filePath}`,
        code: 'INVALID_FILE_PATH',
      });
    }
  }

  // Validate code analysis
  if (issue.codeAnalysis) {
    if (issue.codeAnalysis.startLine !== undefined && issue.codeAnalysis.endLine !== undefined) {
      if (issue.codeAnalysis.startLine > issue.codeAnalysis.endLine) {
        errors.push({
          field: 'codeAnalysis',
          message: 'Start line cannot be greater than end line',
          code: 'INVALID_LINE_RANGE',
        });
      }
    }

    if (issue.codeAnalysis.startLine !== undefined && issue.codeAnalysis.startLine < 1) {
      errors.push({
        field: 'codeAnalysis.startLine',
        message: 'Line numbers must be positive',
        code: 'INVALID_LINE_NUMBER',
      });
    }
  }

  // Validate suggested fix
  if (issue.suggestedFix) {
    if (issue.suggestedFix.confidence < 0 || issue.suggestedFix.confidence > 1) {
      errors.push({
        field: 'suggestedFix.confidence',
        message: 'Confidence must be between 0 and 1',
        code: 'INVALID_CONFIDENCE',
      });
    }

    if (issue.suggestedFix.steps.length === 0) {
      warnings.push({
        field: 'suggestedFix.steps',
        message: 'Suggested fix has no steps',
        code: 'EMPTY_STEPS',
      });
    }
  }

  // Validate acceptance criteria
  if (issue.acceptanceCriteria.length === 0) {
    warnings.push({
      field: 'acceptanceCriteria',
      message: 'No acceptance criteria defined',
      code: 'NO_ACCEPTANCE_CRITERIA',
    });
  } else {
    for (let i = 0; i < issue.acceptanceCriteria.length; i++) {
      const criterion = issue.acceptanceCriteria[i];
      if (criterion && (!criterion.description || criterion.description.length === 0)) {
        errors.push({
          field: `acceptanceCriteria[${i}]`,
          message: 'Acceptance criterion has empty description',
          code: 'EMPTY_CRITERION',
        });
      }
    }
  }

  // Check for source-specific validation
  if (issue.source === 'sentry' && !issue.sourceId) {
    warnings.push({
      field: 'sourceId',
      message: 'Sentry issue should have a source ID',
      code: 'MISSING_SENTRY_ID',
    });
  }

  if (issue.source === 'asana' && !issue.sourceId) {
    warnings.push({
      field: 'sourceId',
      message: 'Asana task should have a source ID',
      code: 'MISSING_ASANA_ID',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if a validation result has critical errors
 *
 * @param result - Validation result
 * @returns Whether there are critical errors
 */
export function hasCriticalErrors(result: ValidationResult): boolean {
  const criticalCodes = ['INVALID_SOURCE', 'INVALID_TYPE', 'MISSING_DESCRIPTION'];
  return result.errors.some((e) => criticalCodes.includes(e.code));
}

/**
 * Get a summary of validation issues
 *
 * @param result - Validation result
 * @returns Summary string
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.valid && result.warnings.length === 0) {
    return 'Validation passed with no issues';
  }

  const parts: string[] = [];

  if (!result.valid) {
    parts.push(`${result.errors.length} error(s)`);
  }

  if (result.warnings.length > 0) {
    parts.push(`${result.warnings.length} warning(s)`);
  }

  return `Validation ${result.valid ? 'passed' : 'failed'}: ${parts.join(', ')}`;
}

/**
 * Merge validation results
 *
 * @param results - Array of validation results
 * @returns Merged validation result
 */
export function mergeValidationResults(
  results: readonly ValidationResult[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const result of results) {
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create a validation error
 */
export function createValidationError(
  field: string,
  message: string,
  code: string
): ValidationError {
  return { field, message, code };
}

/**
 * Create a validation warning
 */
export function createValidationWarning(
  field: string,
  message: string,
  code: string
): ValidationWarning {
  return { field, message, code };
}
