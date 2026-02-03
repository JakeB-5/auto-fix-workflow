/**
 * @module commands/init/generators/issue-template
 * @description GitHub Issue Template generator for auto-fix workflow
 */

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import type { Result } from '../../../common/types/index.js';
import { ok, err } from '../../../common/types/index.js';

/**
 * Issue template content for auto-fix workflow
 */
const ISSUE_TEMPLATE_CONTENT = `name: Auto-Fix Issue
description: Issue for automated fixing by auto-fix-workflow
labels: ["auto-fix"]
body:
  - type: dropdown
    id: type
    attributes:
      label: Type
      description: Select the type of issue
      options:
        - "🔴 Sentry Error"
        - "🐛 Bug Report"
        - "✨ Feature Request"
        - "🔧 Refactoring"
    validations:
      required: true

  - type: input
    id: source
    attributes:
      label: Source
      description: "Origin of this issue (Sentry/Asana/Direct)"
      placeholder: "e.g., Sentry Issue #123 or Asana Task"

  - type: textarea
    id: context
    attributes:
      label: Context
      description: "Relevant context about the issue"
      placeholder: |
        - Component: auth
        - Related files: src/auth/login.ts
        - Environment: production

  - type: textarea
    id: problem
    attributes:
      label: Problem Description
      description: "Describe the problem or error in detail"
      placeholder: |
        What went wrong?
        Include error messages, stack traces, or unexpected behavior.
    validations:
      required: true

  - type: textarea
    id: code-analysis
    attributes:
      label: Code Analysis
      description: "Analysis of the problematic code (optional)"
      placeholder: |
        - Root cause: ...
        - Affected files: ...
        - Related symbols: ...

  - type: textarea
    id: suggested-fix
    attributes:
      label: Suggested Fix
      description: "Proposed solution or fix approach (optional)"
      placeholder: |
        - Approach: ...
        - Files to modify: ...
        - Testing strategy: ...

  - type: textarea
    id: acceptance-criteria
    attributes:
      label: Acceptance Criteria
      description: "How to verify the fix is correct"
      placeholder: |
        - [ ] Error no longer occurs
        - [ ] All tests pass
        - [ ] No regression in related functionality
`;

/**
 * Check if issue template already exists
 */
export async function issueTemplateExists(projectRoot: string): Promise<boolean> {
  const templatePath = join(projectRoot, '.github', 'ISSUE_TEMPLATE', 'auto-fix-issue.yml');
  try {
    await fs.access(templatePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write GitHub Issue Template for auto-fix workflow
 *
 * @param projectRoot - Project root path
 * @returns Result indicating success or failure
 */
export async function writeIssueTemplate(
  projectRoot: string
): Promise<Result<boolean, Error>> {
  const templateDir = join(projectRoot, '.github', 'ISSUE_TEMPLATE');
  const templatePath = join(templateDir, 'auto-fix-issue.yml');

  try {
    // Create directory if it doesn't exist
    await fs.mkdir(templateDir, { recursive: true });

    // Write the template file
    await fs.writeFile(templatePath, ISSUE_TEMPLATE_CONTENT, 'utf-8');

    return ok(true);
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error(`Failed to write issue template: ${String(error)}`)
    );
  }
}
