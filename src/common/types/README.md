# Common Types Module

Core TypeScript type definitions for the auto-fix-workflow system.

## Overview

This module provides strongly-typed interfaces, discriminated unions, and utility types used throughout the application. All types are immutable (readonly) by design to ensure data integrity and prevent accidental mutations.

## Type Categories

### Result Type

Functional error handling using discriminated unions. Provides a type-safe alternative to throwing exceptions.

```typescript
import { ok, err, Result, isSuccess } from './types';

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Division by zero');
  }
  return ok(a / b);
}

const result = divide(10, 2);
if (isSuccess(result)) {
  console.log(result.data); // 5
}
```

**Key Features:**
- Type-safe success/failure handling
- Rich utility functions (map, flatMap, unwrap, etc.)
- Promise interop (fromPromise, toPromise)
- Composable with `all()` for multiple results

### Issue Types

GitHub issue management with extended metadata.

```typescript
import type { Issue, IssueContext } from './types';

const issue: Issue = {
  number: 123,
  title: 'Fix login bug',
  state: 'open',
  type: 'bug',
  context: {
    component: 'auth',
    priority: 'high',
    relatedFiles: ['src/auth/login.ts'],
    source: 'github',
  },
  // ... other required fields
};
```

**Key Types:**
- `Issue` - Full issue representation
- `IssueContext` - Extended metadata (component, priority, source)
- `CodeAnalysis` - Code location and snippet information
- `SuggestedFix` - AI-generated fix suggestions
- `PullRequest` - PR representation

**Enums:**
- `IssueSource`: `asana | sentry | manual | github`
- `IssueType`: `bug | feature | refactor | docs | test | chore`
- `IssuePriority`: `critical | high | medium | low`
- `IssueStatus`: `open | in_progress | resolved | closed`

### Worktree Types

Git worktree management and lifecycle tracking.

```typescript
import type { WorktreeInfo, CreateWorktreeParams } from './types';

const params: CreateWorktreeParams = {
  branchName: 'fix/issue-123',
  baseBranch: 'main',
  issueNumbers: [123, 124],
};

const worktree: WorktreeInfo = {
  path: '/tmp/worktrees/fix-issue-123',
  branch: 'fix/issue-123',
  status: 'ready',
  issueNumbers: [123, 124],
  createdAt: new Date(),
  lastActivityAt: new Date(),
};
```

**Key Types:**
- `WorktreeInfo` - Current worktree state
- `CreateWorktreeParams` - Worktree creation parameters
- `ManageWorktreeRequest` - Unified worktree operations

**Status Flow:**
```
creating → ready → in_use → checking → committing → cleaning
                                     ↓
                                  error
```

### Check Types

Quality check execution and result tracking.

```typescript
import type { CheckResult, SingleCheckResult } from './types';

const result: CheckResult = {
  passed: true,
  results: [
    {
      check: 'test',
      passed: true,
      status: 'passed',
      durationMs: 1234,
      exitCode: 0,
    },
  ],
  attempt: 1,
  totalDurationMs: 1234,
};
```

**Key Types:**
- `CheckResult` - Aggregated check results
- `SingleCheckResult` - Individual check result
- `CheckCommand` - Check execution configuration

**Check Types:**
- `test` - Unit/integration tests
- `typecheck` - TypeScript type checking
- `lint` - Code linting

**Status Flow:**
```
pending → running → passed
                 ↓
              failed → (retry) → timeout
                 ↓
              skipped
```

### Config Types

Application configuration with strong typing.

```typescript
import type { Config } from './types';

const config: Config = {
  github: {
    token: process.env.GITHUB_TOKEN!,
    owner: 'org',
    repo: 'repo',
  },
  asana: {
    token: process.env.ASANA_TOKEN!,
    workspaceGid: '123',
    projectGids: ['456'],
  },
  worktree: {
    baseDir: '/tmp/worktrees',
    maxConcurrent: 3,
  },
};
```

**Key Types:**
- `Config` - Full application configuration
- `GitHubConfig` - GitHub API settings
- `AsanaConfig` - Asana integration settings
- `WorktreeConfig` - Worktree management settings
- `ChecksConfig` - Quality check settings
- `LoggingConfig` - Logging configuration

### Issue Group Types

Issue batching and grouping for parallel processing.

```typescript
import type { IssueGroup, GroupIssuesParams } from './types';

const params: GroupIssuesParams = {
  issueNumbers: [1, 2, 3, 4, 5],
  groupBy: 'component',
  maxGroupSize: 3,
};

const group: IssueGroup = {
  id: 'group-1',
  name: 'Auth Component Fixes',
  groupBy: 'component',
  key: 'auth',
  issues: [/* ... */],
  branchName: 'fix/auth-issues',
  relatedFiles: ['src/auth/login.ts'],
  components: ['auth'],
  priority: 'high',
};
```

**Key Types:**
- `IssueGroup` - Grouped issues for batch processing
- `GroupIssuesParams` - Grouping criteria
- `GroupIssuesResult` - Grouping output

**Grouping Strategies:**
- `component` - Group by component name
- `file` - Group by affected files
- `label` - Group by GitHub labels
- `type` - Group by issue type
- `priority` - Group by priority level

## Design Principles

### 1. Immutability

All types use `readonly` modifiers to prevent accidental mutations:

```typescript
export interface Issue {
  readonly number: number;
  readonly labels: readonly string[];
  // ... all fields readonly
}
```

### 2. Discriminated Unions

Union types use a discriminator field for type narrowing:

```typescript
export type Result<T, E> = Success<T> | Failure<E>;

// Type guard automatically narrows
if (isSuccess(result)) {
  result.data; // TypeScript knows this exists
}
```

### 3. Optional vs Required

Optional fields use `?:` consistently:

```typescript
export interface WorktreeInfo {
  readonly path: string;              // required
  readonly errorMessage?: string;     // optional
}
```

### 4. String Literal Unions

Enums are defined as string literal unions for better type safety:

```typescript
export type IssueType = 'bug' | 'feature' | 'refactor' | 'docs' | 'test' | 'chore';
```

### 5. Nested Type Composition

Complex types are built from smaller, reusable types:

```typescript
export interface Issue {
  readonly context: IssueContext;
  readonly codeAnalysis?: CodeAnalysis;
  readonly suggestedFix?: SuggestedFix;
}
```

## Usage Patterns

### Type Guards

Use type guards for safe narrowing:

```typescript
import { isSuccess, isFailure } from './types';

if (isSuccess(result)) {
  // result.data is accessible
}

if (isFailure(result)) {
  // result.error is accessible
}
```

### Result Utilities

Chain operations functionally:

```typescript
import { ok, map, flatMap } from './types';

const result = ok(5)
  .pipe(map(n => n * 2))
  .pipe(flatMap(n => divide(n, 2)));
```

Or use standalone functions:

```typescript
import { ok, map, flatMap } from './types';

const doubled = map(ok(5), n => n * 2);
const divided = flatMap(doubled, n => divide(n, 2));
```

### Working with Arrays

All array types are readonly, but support non-mutating methods:

```typescript
const issue: Issue = /* ... */;

// ✅ Reading and filtering
const bugLabels = issue.labels.filter(l => l.startsWith('bug-'));

// ✅ Mapping
const uppercased = issue.labels.map(l => l.toUpperCase());

// ❌ Mutation (TypeScript error)
issue.labels.push('new-label'); // Error: Property 'push' does not exist
```

### Date Handling

Dates are not readonly, but should be treated as immutable:

```typescript
const issue: Issue = /* ... */;

// ✅ Reading
const createdYear = issue.createdAt.getFullYear();

// ⚠️ Avoid mutation (not enforced by types)
issue.createdAt.setFullYear(2025); // Compiles but violates immutability
```

## Testing

The module includes comprehensive tests:

- **types.test.ts** - Unit tests for all types and utilities
- **validation.test.ts** - Integration tests for type validation

Run tests:
```bash
npm test src/common/types
```

## Module Structure

```
src/common/types/
├── check.ts           # Quality check types
├── config.ts          # Configuration types
├── issue.ts           # Issue and PR types
├── issue-group.ts     # Issue grouping types
├── result.ts          # Result type and utilities
├── worktree.ts        # Git worktree types
├── index.ts           # Barrel exports
├── __tests__/
│   ├── types.test.ts       # Unit tests
│   └── validation.test.ts  # Integration tests
└── README.md          # This file
```

## Exports

All types and utilities are exported through the barrel file:

```typescript
import {
  // Result utilities
  ok, err, isSuccess, isFailure,
  map, flatMap, unwrap, unwrapOr,

  // Types
  type Result,
  type Issue,
  type WorktreeInfo,
  type CheckResult,
  type Config,
  type IssueGroup,
} from './common/types';
```

## Best Practices

1. **Always use type guards** - Don't use type assertions unless absolutely necessary
2. **Prefer Result over exceptions** - Use `Result<T, E>` for operations that can fail
3. **Don't mutate** - Respect readonly properties even when not enforced
4. **Use discriminators** - Check status/state fields to narrow union types
5. **Validate at boundaries** - Use Zod or similar for runtime validation at API boundaries

## Related Modules

- `common/validation` - Runtime validation using Zod
- `common/utils` - Utility functions for type manipulation
- `core/*` - Core business logic using these types

## Contributing

When adding new types:

1. Add JSDoc comments with examples
2. Use readonly modifiers
3. Export through index.ts
4. Add comprehensive tests
5. Update this README
6. Follow existing naming conventions

## License

MIT
