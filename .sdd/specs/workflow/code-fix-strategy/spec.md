---
status: draft
created: 2026-01-30
constitution_version: "1.1.0"
domain: workflow
feature: code-fix-strategy
depends: "common/types"
---

# Code Fix Strategy

> Claude Code가 코드를 자동 수정할 때 준수해야 할 안전장치 및 수정 전략 가이드라인

## Requirement: REQ-WF-CFS-001 - 수정 범위 제한

Claude Code의 수정 범위를 명확히 제한하여 예상치 못한 부작용을 방지해야 한다.

### Scenario: 단일 파일 수정 (Simple Fix)

- **GIVEN** 이슈가 단일 파일 내 특정 함수의 버그를 나타내고
- **WHEN** Claude Code가 코드 수정을 수행할 때
- **THEN** 해당 파일의 해당 함수만 수정해야 한다
- **AND** 수정은 최대 30줄 이내여야 한다 (SHOULD)
- **AND** 파일의 다른 부분은 수정하지 않아야 한다

**Constraints:**
- 수정 범위는 MUST be limited to the identified function/method
- 수정 줄 수는 SHOULD NOT exceed 30 lines
- 함수 시그니처 변경은 SHOULD be avoided (하위 호환성)

### Scenario: 다중 파일 수정 (Related Fix)

- **GIVEN** 이슈가 여러 관련 파일의 수정을 필요로 하고
- **WHEN** Claude Code가 코드 수정을 수행할 때
- **THEN** 수정 파일 수는 최대 3개를 초과하지 않아야 한다 (MUST)
- **AND** 각 파일의 수정은 명확한 연관성이 있어야 한다
- **AND** 수정 전 사용자에게 영향 범위를 명시해야 한다

**Constraints:**
- 다중 파일 수정은 MUST NOT exceed 3 files
- 각 파일의 수정 사유는 MUST be documented in commit message
- 테스트 파일 추가는 파일 수 제한에 포함되지 않음

### Scenario: 테스트 파일 추가

- **GIVEN** 버그 수정과 함께 재현 테스트가 필요하고
- **WHEN** 테스트 파일을 추가할 때
- **THEN** 테스트 파일은 수정 파일 수 제한에 포함되지 않아야 한다
- **AND** 테스트는 해당 버그의 재현 및 수정 검증에 집중해야 한다
- **AND** 기존 테스트 파일이 있다면 새 파일보다 수정을 우선해야 한다

## Requirement: REQ-WF-CFS-002 - 금지된 수정

특정 유형의 수정은 자동화하지 않고 수동 검토를 필수로 해야 한다.

### Scenario: 보안 관련 코드 수정 금지

- **GIVEN** 이슈가 인증, 권한, 암호화와 관련된 코드 변경을 요구하고
- **WHEN** Claude Code가 수정 계획을 수립할 때
- **THEN** 자동 수정을 거부해야 한다 (MUST)
- **AND** 이슈에 `auto-fix-skip` 라벨과 함께 사유를 코멘트해야 한다
- **AND** 수동 검토가 필요함을 명시해야 한다

**금지 키워드 (보안):**
- `auth`, `authentication`, `authorization`, `jwt`, `token`, `session`
- `password`, `secret`, `apiKey`, `credentials`, `encrypt`, `decrypt`
- `permission`, `role`, `acl`, `oauth`, `saml`, `hash`, `crypto`

### Scenario: 데이터베이스 마이그레이션 금지

- **GIVEN** 이슈가 DB 스키마 변경 또는 마이그레이션을 요구하고
- **WHEN** Claude Code가 수정 계획을 수립할 때
- **THEN** 자동 수정을 거부해야 한다 (MUST)
- **AND** `auto-fix-skip` 라벨 추가와 함께 수동 처리 요청해야 한다

**금지 키워드 (DB):**
- `migration`, `schema`, `ALTER TABLE`, `CREATE TABLE`, `DROP TABLE`
- `prisma migrate`, `knex migrate`, `sequelize migration`
- `addColumn`, `dropColumn`, `renameColumn`, `addIndex`

### Scenario: 대규모 리팩토링 금지

- **GIVEN** 이슈가 전체 아키텍처 변경 또는 대규모 리팩토링을 요구하고
- **WHEN** 수정 범위가 5개 이상 파일이거나 100줄 이상 변경이 예상되고
- **THEN** 자동 수정을 거부해야 한다 (MUST)
- **AND** 이슈를 여러 작은 이슈로 분할할 것을 제안해야 한다

**금지 패턴 (리팩토링):**
- 클래스/컴포넌트명 변경 (renaming across files)
- 디렉토리 구조 변경
- 패키지 의존성 메이저 버전 업그레이드
- API 엔드포인트 변경

### Scenario: 환경 설정 파일 수정 제한

- **GIVEN** 이슈가 `.env`, `config.yml`, `package.json` 등의 설정 파일 수정을 요구하고
- **WHEN** Claude Code가 수정 계획을 수립할 때
- **THEN** 다음 조건 중 하나라도 해당하면 수정을 거부해야 한다
  - 민감 정보 포함 가능성 (API keys, secrets)
  - 프로덕션 환경 설정 변경
  - 의존성 추가/제거 (devDependencies 제외)
- **AND** 안전한 변경만 허용해야 한다 (예: devDependencies 추가, 주석 수정)

## Requirement: REQ-WF-CFS-003 - 수정 검증 절차

모든 코드 수정은 자동화된 검증 절차를 통과해야 한다.

### Scenario: 로컬 CI 체크 필수

- **GIVEN** 코드 수정이 완료되고
- **WHEN** PR 생성 전 검증을 수행할 때
- **THEN** 다음 체크를 모두 통과해야 한다 (MUST)
  - 테스트 실행: `pnpm test` (또는 프로젝트 설정)
  - 타입 체크: `pnpm type-check` (TypeScript 프로젝트)
  - 린트 체크: `pnpm lint`
- **AND** 체크 실패 시 최대 3회까지 재시도할 수 있다
- **AND** 3회 실패 후에는 `auto-fix-failed` 라벨과 함께 이슈 업데이트해야 한다

**Constraints:**
- 모든 체크는 MUST pass before PR creation
- 재시도 횟수는 MUST NOT exceed 3
- 각 재시도 시 이전 실패 원인을 분석하여 수정해야 한다 (MUST)

### Scenario: 테스트 커버리지 유지

- **GIVEN** 프로젝트에 테스트 커버리지 임계값이 설정되어 있고
- **WHEN** 코드 수정으로 인해 커버리지가 감소하고
- **THEN** 감소분을 보충하는 테스트를 추가해야 한다 (SHOULD)
- **OR** 커버리지 감소가 불가피한 경우 PR 설명에 사유를 명시해야 한다

### Scenario: 기존 테스트 깨지지 않음 보장

- **GIVEN** 프로젝트에 기존 테스트가 존재하고
- **WHEN** 코드 수정 후 테스트를 실행하면
- **THEN** 수정 전에 통과하던 모든 테스트가 통과해야 한다 (MUST)
- **AND** 테스트 실패 시 코드 수정을 되돌리거나 테스트를 수정해야 한다
- **AND** 테스트 수정이 필요한 경우 이슈에 사유를 명시해야 한다

**Constraints:**
- 기존 테스트는 MUST NOT be removed without justification
- 테스트 수정은 MUST be limited to:
  - 버그로 인해 잘못된 기대값을 가진 테스트
  - 수정된 동작을 반영하는 업데이트 (breaking change 명시 필수)

### Scenario: 재시도 로직 및 실패 처리

- **GIVEN** 첫 번째 수정 시도가 테스트 실패로 종료되고
- **WHEN** 재시도를 수행할 때
- **THEN** 실패 로그를 분석하여 원인을 파악해야 한다 (MUST)
- **AND** 원인에 따라 수정 전략을 조정해야 한다
- **AND** 동일한 오류로 2회 연속 실패 시 다른 접근법을 시도해야 한다 (SHOULD)

**재시도 전략:**
1. 첫 시도: 이슈 설명 기반 수정
2. 재시도 1: 테스트 실패 로그 기반 디버깅
3. 재시도 2: 관련 코드 더 넓은 범위 분석
4. 재시도 3: 최소한의 안전한 수정으로 축소
5. 최종 실패: `auto-fix-failed` 라벨 추가 및 실패 사유 코멘트

## Requirement: REQ-WF-CFS-004 - 커밋 메시지 규칙

모든 자동 수정은 일관된 커밋 메시지 형식을 따라야 한다.

### Scenario: 단일 이슈 수정 커밋 메시지

- **GIVEN** 하나의 이슈를 수정하는 커밋을 작성할 때
- **WHEN** 커밋 메시지를 생성하면
- **THEN** 다음 형식을 따라야 한다 (MUST)
  ```
  fix: {간결한 요약} (#{issue_number})

  {상세 설명 - 변경 사유 및 방법}

  Closes #{issue_number}

  Co-Authored-By: Claude Code <noreply@anthropic.com>
  ```
- **AND** 첫 줄은 50자 이내여야 한다 (SHOULD)
- **AND** 본문은 72자에서 줄바꿈해야 한다 (SHOULD)

**Constraints:**
- 제목 형식: MUST be `{type}: {description} (#{number})`
- Type은 MUST be one of: `fix`, `feat`, `refactor`, `test`, `docs`
- Closes 라인: MUST include `Closes #{issue_number}`

### Scenario: 다중 이슈 그룹 수정 커밋 메시지

- **GIVEN** 여러 이슈를 함께 수정하는 커밋을 작성할 때
- **WHEN** 커밋 메시지를 생성하면
- **THEN** 다음 형식을 따라야 한다 (MUST)
  ```
  fix: {컴포넌트명} multiple issues (#{issue1}, #{issue2}, #{issue3})

  {각 이슈별 변경 사항 요약}
  - #{issue1}: {요약}
  - #{issue2}: {요약}
  - #{issue3}: {요약}

  Closes #{issue1}, #{issue2}, #{issue3}

  Co-Authored-By: Claude Code <noreply@anthropic.com>
  ```
- **AND** 각 이슈별 변경 사항을 명시해야 한다

### Scenario: 테스트 추가 커밋 분리

- **GIVEN** 버그 수정과 함께 테스트를 추가하고
- **WHEN** 커밋을 구성할 때
- **THEN** 다음 중 하나를 선택해야 한다 (SHOULD)
  - 옵션 1: 단일 커밋 (수정 + 테스트)
  - 옵션 2: 두 개의 커밋 (1. 수정, 2. 테스트 추가)
- **AND** 옵션 2 선택 시 테스트 커밋 메시지는 다음 형식을 따라야 한다
  ```
  test: add test for #{issue_number}

  {테스트 추가 사유 및 커버하는 케이스}

  Related to #{issue_number}

  Co-Authored-By: Claude Code <noreply@anthropic.com>
  ```

**권장사항:**
- 간단한 테스트 (10줄 이하): 수정 커밋에 포함 (옵션 1)
- 복잡한 테스트 (10줄 초과): 별도 커밋 (옵션 2)

### Scenario: 커밋 메시지 본문 작성 원칙

- **GIVEN** 커밋 메시지 본문을 작성할 때
- **WHEN** 변경 사항을 설명하면
- **THEN** 다음 원칙을 따라야 한다 (SHOULD)
  - **What (무엇)**: 변경된 내용 (간결하게)
  - **Why (왜)**: 변경이 필요했던 이유 (핵심)
  - **How (어떻게)**: 구현 방법 (간단히)
- **AND** 코드만 보면 알 수 있는 내용은 생략해야 한다
- **AND** 미래의 개발자가 왜 이 수정이 필요했는지 이해할 수 있도록 작성해야 한다

**Good Example:**
```
fix: prevent null reference error in handleSave (#123)

When saving a new document without an existing ID, the handleSave
function attempted to access document.id without checking if the
document exists. This caused TypeError in production.

Added null check and fallback to create API for new documents.

Closes #123
```

**Bad Example:**
```
fix: fixed bug (#123)

Changed code.

Closes #123
```

## Requirement: REQ-WF-CFS-005 - PR 생성 규칙

자동 생성되는 PR은 명확한 정보를 포함하고 검토 가능해야 한다.

### Scenario: PR 제목 및 본문 형식

- **GIVEN** 코드 수정이 완료되고 PR을 생성할 때
- **WHEN** PR 제목과 본문을 작성하면
- **THEN** 다음 형식을 따라야 한다 (MUST)
  ```
  Title: fix: {이슈 요약} (#{issue_number})

  Body:
  ## 🤖 Auto-Fix PR

  ### Related Issues
  - Closes #{issue_number}

  ### Changes
  {변경 사항 상세}

  ### Root Cause
  {문제의 근본 원인}

  ### Solution
  {해결 방법}

  ### Test Results
  - ✅ Unit Tests: Passed (X/X tests)
  - ✅ Type Check: Passed
  - ✅ Lint: Passed

  ### Files Changed
  - `path/to/file1.ts`: {변경 사유}
  - `path/to/file2.ts`: {변경 사유}

  ---
  > 이 PR은 Claude Code에 의해 자동 생성되었습니다.
  > 검토 후 autofixing 브랜치에 머지해주세요.
  ```
- **AND** "Related Issues" 섹션은 반드시 포함해야 한다

### Scenario: PR 라벨 및 타겟 브랜치

- **GIVEN** PR을 생성할 때
- **WHEN** PR 메타데이터를 설정하면
- **THEN** 다음 설정을 적용해야 한다 (MUST)
  - Target Branch: `autofixing`
  - Labels: `auto-fix`, `bot`
  - Reviewers: 없음 (수동 검토)
  - Assignees: 없음
- **AND** Draft PR로 생성하지 않아야 한다 (ready for review 상태)

### Scenario: 다중 이슈 PR 본문

- **GIVEN** 여러 이슈를 그룹화하여 수정하고
- **WHEN** PR 본문을 작성할 때
- **THEN** 각 이슈별로 변경 사항을 구분하여 명시해야 한다
  ```
  ### Related Issues
  - Closes #123, #124, #125

  ### Changes by Issue

  #### #123: TypeError in handleSave
  - Added null check for document object
  - Added fallback to create API for new documents

  #### #124: Null reference in renderPage
  - Added validation before accessing page.content
  - Added error boundary for rendering failures

  #### #125: Missing validation in exportPDF
  - Added input validation for PDF export options
  - Added user-friendly error messages
  ```

## Requirement: REQ-WF-CFS-006 - 안전장치 및 롤백

자동 수정 과정에서 문제 발생 시 안전하게 복구할 수 있어야 한다.

### Scenario: Worktree 격리를 통한 안전성 보장

- **GIVEN** 코드 수정을 수행할 때
- **WHEN** Git Worktree를 사용하면
- **THEN** 메인 레포지토리는 영향받지 않아야 한다 (MUST)
- **AND** 수정 실패 시 Worktree만 삭제하면 복구되어야 한다
- **AND** 여러 이슈를 동시 처리해도 서로 간섭하지 않아야 한다

### Scenario: 수정 전 상태 기록

- **GIVEN** 코드 수정을 시작할 때
- **WHEN** 수정 대상 파일을 식별하면
- **THEN** 수정 전 파일 상태를 이슈 코멘트에 기록해야 한다 (SHOULD)
  ```
  🔄 자동 수정 시작

  수정 대상 파일:
  - src/components/Editor.tsx (handleSave 함수)

  현재 커밋: abc1234
  브랜치: fix/issue-123
  Worktree: ../worktrees/fix-issue-123
  ```
- **AND** 롤백이 필요한 경우 이 정보를 사용할 수 있어야 한다

### Scenario: 최종 실패 시 처리

- **GIVEN** 3회 재시도 후에도 수정이 실패하고
- **WHEN** 최종 실패 처리를 수행할 때
- **THEN** 다음 작업을 수행해야 한다 (MUST)
  - 이슈에 `auto-fix-failed` 라벨 추가
  - 실패 사유를 상세히 코멘트 (실패한 테스트, 에러 로그 포함)
  - Worktree 정리
  - 브랜치 삭제 (선택)
- **AND** 수동 개입이 필요함을 명확히 알려야 한다

**실패 코멘트 예시:**
```
❌ 자동 수정 실패

**시도 횟수**: 3회
**최종 실패 원인**: 테스트 실패

**실패한 테스트**:
- `handleSave should create new document` (Expected: 201, Received: 500)

**시도 내역**:
1. 시도 1: null 체크 추가 → 테스트 실패 (API 호출 오류)
2. 시도 2: API 엔드포인트 수정 → 타입 에러
3. 시도 3: 타입 수정 → 테스트 여전히 실패

**수동 검토 필요 사항**:
- API 엔드포인트 확인 (`/api/documents/create`가 존재하는지)
- 테스트 모킹 설정 확인

수동으로 수정해주세요.
```

## Data Types

### CodeFixConfig

```typescript
interface CodeFixConfig {
  max_files: number;              // 최대 수정 파일 수 (기본: 3)
  max_lines_per_file: number;     // 파일당 최대 수정 줄 수 (권장: 30)
  max_retry: number;               // 최대 재시도 횟수 (기본: 3)
  forbidden_patterns: string[];    // 금지 키워드/패턴
  required_checks: string[];       // 필수 CI 체크
}
```

**Constraints:**
- `max_files` MUST be between 1 and 5
- `max_lines_per_file` SHOULD be less than 50
- `max_retry` MUST be between 1 and 5
- `forbidden_patterns` MUST include security-related keywords
- `required_checks` MUST include at least `["test"]`

### FixAttempt

```typescript
interface FixAttempt {
  attempt_number: number;          // 시도 번호 (1-3)
  changed_files: string[];         // 변경된 파일 목록
  commit_hash?: string;            // 커밋 해시 (성공 시)
  test_results: CheckResult[];     // 테스트 결과
  success: boolean;                // 성공 여부
  failure_reason?: string;         // 실패 사유
  timestamp: string;               // ISO 8601 timestamp
}

interface CheckResult {
  check: string;                   // 체크 종류 (test, lint, typecheck)
  passed: boolean;                 // 통과 여부
  output?: string;                 // 출력 로그
  error?: string;                  // 에러 메시지
}
```

**Constraints:**
- `attempt_number` MUST be between 1 and `max_retry`
- `changed_files` MUST NOT be empty
- `test_results` MUST contain results for all `required_checks`

### CommitMessage

```typescript
interface CommitMessage {
  type: "fix" | "feat" | "refactor" | "test" | "docs";
  summary: string;                 // 50자 이내
  body: string;                    // 상세 설명
  issue_numbers: number[];         // 관련 이슈 번호
  footer: string;                  // Closes, Co-Authored-By
}
```

**Constraints:**
- `summary` MUST be 50 characters or less
- `body` lines SHOULD wrap at 72 characters
- `issue_numbers` MUST NOT be empty
- `footer` MUST include `Closes #{number}` and `Co-Authored-By: Claude Code`

### ForbiddenPattern

```typescript
interface ForbiddenPattern {
  category: "security" | "database" | "refactoring" | "config";
  keywords: string[];              // 금지 키워드
  reason: string;                  // 금지 사유
}
```

**Default Forbidden Patterns:**
```typescript
const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  {
    category: "security",
    keywords: ["auth", "password", "secret", "token", "encrypt", "jwt", "oauth"],
    reason: "보안 관련 코드는 수동 검토 필수"
  },
  {
    category: "database",
    keywords: ["migration", "ALTER TABLE", "CREATE TABLE", "DROP TABLE", "prisma migrate"],
    reason: "DB 스키마 변경은 수동 처리 필수"
  },
  {
    category: "refactoring",
    keywords: ["rename class", "move file", "change directory structure"],
    reason: "대규모 리팩토링은 자동화 제외"
  },
  {
    category: "config",
    keywords: [".env", "production", "API_KEY", "SECRET_KEY"],
    reason: "환경 설정 변경은 수동 검토 필수"
  }
];
```

## Implementation Notes

### 수정 범위 판단 알고리즘

```typescript
function canAutoFix(issue: Issue, codebase: Codebase): FixDecision {
  // 1. 금지 패턴 체크
  const hasForbiddenPattern = FORBIDDEN_PATTERNS.some(pattern =>
    pattern.keywords.some(keyword =>
      issue.body.toLowerCase().includes(keyword.toLowerCase())
    )
  );

  if (hasForbiddenPattern) {
    return {
      can_fix: false,
      reason: "금지된 패턴 감지 (보안/DB/리팩토링)",
      suggested_action: "수동 검토 필요"
    };
  }

  // 2. 영향 범위 분석
  const affectedFiles = analyzeAffectedFiles(issue, codebase);

  if (affectedFiles.length > 3) {
    return {
      can_fix: false,
      reason: "수정 범위 초과 (3개 이상 파일)",
      suggested_action: "이슈를 여러 작은 이슈로 분할"
    };
  }

  // 3. 복잡도 추정
  const estimatedLines = estimateChangedLines(issue, affectedFiles);

  if (estimatedLines > 100) {
    return {
      can_fix: false,
      reason: "수정 복잡도 초과 (100줄 이상 예상)",
      suggested_action: "수동 처리 권장"
    };
  }

  // 4. 자동 수정 가능
  return {
    can_fix: true,
    estimated_files: affectedFiles.length,
    estimated_lines: estimatedLines
  };
}
```

### 재시도 전략 구현

```typescript
async function attemptFix(
  issue: Issue,
  attempt: number,
  previousError?: string
): Promise<FixAttempt> {
  const strategy = getRetryStrategy(attempt, previousError);

  // 전략에 따라 수정 범위 조정
  const files = strategy.scope === "narrow"
    ? [strategy.targetFile]
    : identifyRelatedFiles(issue);

  // 코드 수정 수행
  const changes = await applyFix(issue, files, strategy);

  // 테스트 실행
  const testResults = await runChecks(changes);

  return {
    attempt_number: attempt,
    changed_files: files,
    test_results: testResults,
    success: testResults.every(r => r.passed),
    failure_reason: testResults.find(r => !r.passed)?.error,
    timestamp: new Date().toISOString()
  };
}

function getRetryStrategy(attempt: number, previousError?: string): RetryStrategy {
  switch (attempt) {
    case 1:
      return { scope: "normal", approach: "issue-based" };
    case 2:
      return { scope: "wide", approach: "error-analysis" };
    case 3:
      return { scope: "narrow", approach: "minimal-safe" };
    default:
      throw new Error("Max retry exceeded");
  }
}
```

### 커밋 메시지 생성 로직

```typescript
function generateCommitMessage(
  issue: Issue,
  changes: CodeChange[]
): CommitMessage {
  const type = determineCommitType(changes);
  const summary = generateSummary(issue, 50);
  const body = generateBody(issue, changes);

  return {
    type,
    summary,
    body,
    issue_numbers: [issue.number],
    footer: `Closes #${issue.number}\n\nCo-Authored-By: Claude Code <noreply@anthropic.com>`
  };
}

function formatCommitMessage(msg: CommitMessage): string {
  return `${msg.type}: ${msg.summary} (#${msg.issue_numbers[0]})

${msg.body}

${msg.footer}`;
}
```

### 금지 패턴 감지

```typescript
function detectForbiddenPatterns(issue: Issue): ForbiddenPattern | null {
  for (const pattern of FORBIDDEN_PATTERNS) {
    const hasMatch = pattern.keywords.some(keyword =>
      issue.title.toLowerCase().includes(keyword.toLowerCase()) ||
      issue.body.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasMatch) {
      return pattern;
    }
  }

  return null;
}

async function handleForbiddenPattern(
  issue: Issue,
  pattern: ForbiddenPattern
): Promise<void> {
  await updateIssue(issue.number, {
    labels: ["auto-fix-skip"],
    comment: `🚫 자동 수정 불가

**카테고리**: ${pattern.category}
**사유**: ${pattern.reason}

감지된 키워드: ${pattern.keywords.join(", ")}

이 이슈는 수동으로 검토 및 수정해주세요.`
  });
}
```

## Related Specs

- [workflow/group-issues](../group-issues/spec.md) - 이슈 그룹핑 로직
- [git/manage-worktree](../../git/manage-worktree/spec.md) - Worktree 관리
- [checks/run-checks](../../checks/run-checks/spec.md) - CI 체크 실행
- [github/create-pr](../../github/create-pr/spec.md) - PR 생성
- [github/update-issue](../../github/update-issue/spec.md) - 이슈 업데이트
