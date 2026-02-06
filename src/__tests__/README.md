# Test Structure Guide

## Naming Conventions

### File Names

- `*.test.ts` - Unit tests (단위 테스트)
- `*.integration.test.ts` - Integration tests (통합 테스트)
- `*.e2e.test.ts` - End-to-end tests (E2E 테스트)

### Directory Structure

```
src/
├── __tests__/
│   └── helpers/           # Shared test utilities
│       ├── fixtures.ts     # Mock data generators
│       ├── mocks.ts        # Mock implementations
│       ├── assertions.ts   # Custom assertions
│       └── index.ts        # Centralized exports
└── <module>/
    └── __tests__/
        ├── <module>.test.ts           # Unit tests
        ├── integration.test.ts        # Integration tests
        └── e2e.test.ts                # E2E tests
```

## Test Helpers

### Fixtures (`helpers/fixtures.ts`)

공통 테스트 데이터 생성 함수:

- `createMockIssue(number, overrides?)` - GitHub 이슈 mock
- `createMockIssueGroup(overrides?)` - 이슈 그룹 mock
- `createMockWorktree(branch, overrides?)` - Worktree mock
- `createMockPullRequest(number, overrides?)` - PR mock
- `createMockAsanaTask(gid?, overrides?)` - Asana 태스크 mock
- `createMockConfig(overrides?)` - 설정 객체 mock

예제:
```typescript
import { createMockIssue } from '../../__tests__/helpers/index.js';

const issue = createMockIssue(123, {
  labels: ['bug', 'priority:high'],
  component: 'auth',
});
```

### Mocks (`helpers/mocks.ts`)

외부 라이브러리 mock 생성:

- `createMockOctokit()` - GitHub API client
- `createMockAsanaClient()` - Asana API client
- `createMockGit()` - simple-git instance
- `setupGitHubMocks()` - GitHub mock 자동 설정
- `setupAsanaMocks()` - Asana mock 자동 설정
- `setupGitMocks()` - Git mock 자동 설정
- `setupFsMocks()` - File system mock 자동 설정
- `setupTestEnvironment()` - 전체 테스트 환경 설정

예제:
```typescript
import { setupGitHubMocks } from '../../__tests__/helpers/index.js';

const mockOctokit = setupGitHubMocks();
mockOctokit.issues.listForRepo.mockResolvedValue({ data: [] });
```

### Assertions (`helpers/assertions.ts`)

커스텀 assertion 헬퍼:

- `assertValidIssue(issue)` - 이슈 구조 검증
- `assertValidWorktree(worktree)` - Worktree 구조 검증
- `assertValidPullRequest(pr)` - PR 구조 검증
- `assertSuccess(result)` - Result 타입 성공 검증
- `assertFailure(result)` - Result 타입 실패 검증
- `assertErrorWithCode(error, code)` - 에러 코드 검증
- `assertLabelsContain(labels, expected)` - 라벨 포함 검증

예제:
```typescript
import { assertSuccess, assertValidIssue } from '../../__tests__/helpers/index.js';

const result = await fetchIssue(123);
assertSuccess(result);
assertValidIssue(result.data);
```

## Best Practices

### 1. DRY (Don't Repeat Yourself)

중복된 mock 설정이나 fixture 데이터는 helpers로 추출:

```typescript
// ❌ Bad - 매 테스트마다 반복
const issue = {
  number: 123,
  title: 'Test',
  body: 'Test body',
  state: 'open',
  labels: [],
  // ... 20+ lines
};

// ✅ Good - 헬퍼 사용
const issue = createMockIssue(123);
```

### 2. Setup/Teardown

beforeEach/afterEach에서 공통 설정:

```typescript
import { setupTestEnvironment, resetAllMocks } from '../../__tests__/helpers/index.js';

describe('My Tests', () => {
  const env = setupTestEnvironment();

  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    env.cleanup();
  });
});
```

### 3. Test Isolation

각 테스트는 독립적으로 실행 가능해야 함:

```typescript
// ✅ Good - 테스트마다 새로운 instance
beforeEach(() => {
  mockOctokit = createMockOctokit();
});

// ❌ Bad - 전역 변수 공유
const mockOctokit = createMockOctokit();
```

### 4. Descriptive Names

테스트 이름은 명확하고 구체적으로:

```typescript
// ❌ Bad
it('should work', () => {});

// ✅ Good
it('should return 401 error when GitHub token is invalid', () => {});
```

### 5. AAA Pattern

Arrange-Act-Assert 패턴 사용:

```typescript
it('should filter issues by label', async () => {
  // Arrange
  const mockIssues = [
    createMockIssue(1, { labels: ['bug'] }),
    createMockIssue(2, { labels: ['feature'] }),
  ];

  // Act
  const filtered = filterIssues(mockIssues, { labels: ['bug'] });

  // Assert
  expect(filtered).toHaveLength(1);
  expect(filtered[0]?.number).toBe(1);
});
```

## Migration Guide

기존 테스트를 새로운 구조로 마이그레이션:

### Step 1: Import Helpers

```typescript
// Before
function createMockIssue(number: number) { /* ... */ }

// After
import { createMockIssue } from '../../__tests__/helpers/index.js';
```

### Step 2: Replace Mock Implementations

```typescript
// Before
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(() => ({
    issues: { listForRepo: vi.fn() },
  })),
}));

// After
import { setupGitHubMocks } from '../../__tests__/helpers/index.js';
const mockOctokit = setupGitHubMocks();
```

### Step 3: Use Custom Assertions

```typescript
// Before
expect(result.success).toBe(true);
expect(result.data).toBeDefined();

// After
import { assertSuccess } from '../../__tests__/helpers/index.js';
assertSuccess(result);
```

## Running Tests

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Specific file
npm run test src/github/list-issues/__tests__/list-issues.test.ts
```

## Coverage Goals

- Unit tests: 80%+
- Integration tests: 60%+
- E2E tests: Critical paths
