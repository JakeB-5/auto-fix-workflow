/**
 * @module common/issue-parser/__tests__/fixtures/sample-issues
 * @description Sample issue bodies for testing
 */

/**
 * Complete issue with all sections
 */
export const COMPLETE_ISSUE = `## Source

Sentry Issue: PROJ-12345
https://sentry.io/organizations/myorg/issues/12345/

## Type

Bug

## Context

**Component:** AuthService
**Service:** user-authentication
**Environment:** production
**Priority:** critical

### Related Files
- src/services/auth.ts
- src/utils/token.ts

### Related Symbols
- \`validateToken\`
- \`AuthService\`

## Problem Description

Users are experiencing random logouts when accessing the dashboard. The error occurs approximately every 30 minutes and affects roughly 15% of active users.

## Code Analysis

### Error Message
TypeError: Cannot read property 'exp' of undefined

### Stack Trace
\`\`\`
TypeError: Cannot read property 'exp' of undefined
    at validateToken (src/services/auth.ts:45:23)
    at AuthService.checkSession (src/services/auth.ts:78:12)
    at processRequest (src/middleware/auth.ts:34:8)
\`\`\`

### Code Snippet
\`\`\`typescript
// src/services/auth.ts:45
function validateToken(token: string): boolean {
  const decoded = jwt.decode(token);
  return decoded.exp > Date.now() / 1000; // Error here
}
\`\`\`

## Suggested Fix Direction

The issue is that \`jwt.decode\` can return null when the token is invalid or malformed. We should add null checking.

1. Add null check after decoding token
2. Return false or throw specific error for invalid tokens
3. Add logging for debugging
4. Update unit tests

## Acceptance Criteria

- [x] GIVEN an invalid token WHEN validateToken is called THEN it returns false without throwing
- [ ] GIVEN a valid token WHEN validateToken is called THEN it validates the expiration correctly
- [ ] GIVEN a null token WHEN validateToken is called THEN it returns false
- [ ] Unit tests cover all edge cases
`;

/**
 * Minimal issue with only required sections
 */
export const MINIMAL_ISSUE = `## Problem Description

The login button doesn't work on mobile devices.
`;

/**
 * Sentry-sourced issue
 */
export const SENTRY_ISSUE = `## Source

Sentry
Issue ID: FRONTEND-789
URL: https://sentry.io/organizations/company/issues/789/

## Type

Bug

## Problem Description

NullPointerException in payment processing flow.

## Code Analysis

\`\`\`
NullPointerException: null
    at PaymentService.process(PaymentService.java:123)
    at PaymentController.submit(PaymentController.java:45)
\`\`\`
`;

/**
 * Asana-sourced issue
 */
export const ASANA_ISSUE = `## Source

Asana Task: 1234567890
https://app.asana.com/0/123456789/1234567890

## Type

Feature

## Context

Component: Dashboard
Priority: high

## Problem Description

Add dark mode support to the dashboard.

## Suggested Fix

1. Create theme context
2. Add theme toggle component
3. Update all color references to use theme variables

## Acceptance Criteria

- [ ] Dark mode toggle is visible in settings
- [ ] All components respect the theme setting
- [ ] Theme preference persists across sessions
`;

/**
 * Issue with GIVEN-WHEN-THEN scenarios
 */
export const GWT_ISSUE = `## Problem Description

Search functionality returns incorrect results.

## Acceptance Criteria

GIVEN a user enters "typescript" in the search box
WHEN they press Enter
THEN only results containing "typescript" should be displayed

GIVEN a user enters an empty search term
WHEN they press Enter
THEN all results should be displayed

GIVEN a user enters special characters "<script>"
WHEN they press Enter
THEN the search should be sanitized and return no results
`;

/**
 * Issue with code blocks
 */
export const CODE_BLOCKS_ISSUE = `## Problem Description

Memory leak in event listener cleanup.

## Code Analysis

File: src/components/EventHandler.ts
Lines: 45-60

\`\`\`typescript
class EventHandler {
  private listeners: Function[] = [];

  addListener(fn: Function) {
    this.listeners.push(fn);
    window.addEventListener('resize', fn);
  }

  // Missing cleanup!
  destroy() {
    this.listeners = [];
    // Should remove event listeners here
  }
}
\`\`\`

## Suggested Fix

Add proper cleanup in the destroy method:

\`\`\`typescript
destroy() {
  this.listeners.forEach(fn => {
    window.removeEventListener('resize', fn);
  });
  this.listeners = [];
}
\`\`\`
`;

/**
 * Issue with refactor type
 */
export const REFACTOR_ISSUE = `## Type

Refactor

## Problem Description

The API client code has grown too complex and needs to be split into smaller modules.

## Context

Component: APIClient
Related Files:
- src/api/client.ts
- src/api/endpoints.ts

## Suggested Fix Direction

Should split into:
1. Base HTTP client
2. Request/response interceptors
3. Endpoint definitions
4. Error handling utilities
`;

/**
 * Documentation issue
 */
export const DOCS_ISSUE = `## Type

Documentation

## Problem Description

The README is outdated and missing setup instructions for Windows.

## Acceptance Criteria

- [ ] Add Windows-specific setup instructions
- [ ] Update dependency versions
- [ ] Add troubleshooting section
`;

/**
 * Issue with Python stack trace
 */
export const PYTHON_ISSUE = `## Source

Sentry

## Type

Bug

## Problem Description

ImportError when loading the ML model.

## Code Analysis

\`\`\`
Traceback (most recent call last):
  File "/app/ml/loader.py", line 23, in load_model
    model = torch.load(path)
  File "/app/ml/utils.py", line 45, in validate_path
    raise ValueError("Model not found")
ValueError: Model not found
\`\`\`
`;

/**
 * Issue without explicit sections (fallback test)
 */
export const UNSTRUCTURED_ISSUE = `
The application crashes when uploading files larger than 10MB.

Error: PayloadTooLargeError

This happens in the /api/upload endpoint.

Steps to reproduce:
1. Go to upload page
2. Select a file > 10MB
3. Click upload
4. See error

Expected: Should show friendly error message
Actual: Application crashes

Affected file: src/routes/upload.ts
`;

/**
 * Issue with manual source
 */
export const MANUAL_ISSUE = `## Source

Manual

## Type

Chore

## Problem Description

Update npm dependencies to latest versions.

## Acceptance Criteria

- [ ] Run npm audit
- [ ] Update all non-breaking dependencies
- [ ] Test application after updates
- [ ] Create PR with changes
`;

/**
 * Issue with multiple code snippets
 */
export const MULTI_SNIPPET_ISSUE = `## Problem Description

Type mismatch between API response and frontend types.

## Code Analysis

Backend returns:
\`\`\`json
{
  "user_name": "john",
  "created_at": "2024-01-01T00:00:00Z"
}
\`\`\`

Frontend expects:
\`\`\`typescript
interface User {
  userName: string;
  createdAt: Date;
}
\`\`\`

## Suggested Fix

Add a transformation layer or update the API to use camelCase.
`;

/**
 * Empty issue body
 */
export const EMPTY_ISSUE = '';

/**
 * Issue with only whitespace
 */
export const WHITESPACE_ISSUE = '   \n\n   \t  \n   ';

/**
 * All fixture exports for iteration
 */
export const ALL_FIXTURES = {
  COMPLETE_ISSUE,
  MINIMAL_ISSUE,
  SENTRY_ISSUE,
  ASANA_ISSUE,
  GWT_ISSUE,
  CODE_BLOCKS_ISSUE,
  REFACTOR_ISSUE,
  DOCS_ISSUE,
  PYTHON_ISSUE,
  UNSTRUCTURED_ISSUE,
  MANUAL_ISSUE,
  MULTI_SNIPPET_ISSUE,
  EMPTY_ISSUE,
  WHITESPACE_ISSUE,
} as const;
