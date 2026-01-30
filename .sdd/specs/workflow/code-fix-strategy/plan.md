---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Code Fix Strategy 구현 계획

## 기술 결정

### 결정 1: 금지 패턴 감지 방식
**선택:** 키워드 기반 필터링 + 컨텍스트 분석 조합
**근거:**
- 이슈 제목과 본문에서 금지 키워드 검색
- 단순 키워드 매칭만으로는 오탐 가능성 있음
- 컨텍스트 분석으로 실제 보안/DB 변경인지 확인
- 카테고리별로 키워드 그룹화하여 관리 용이
- 추후 ML 기반 분류로 발전 가능

### 결정 2: 수정 범위 추정 방법
**선택:** 이슈 분석 + 코드베이스 검색 조합
**근거:**
- 이슈에서 언급된 파일/함수 추출
- 코드베이스에서 관련 파일 검색 (AST 또는 grep)
- 영향 범위 추정 (직접 수정 파일 + 간접 영향 파일)
- 추정치로 자동 수정 가능 여부 판단
- 보수적 접근 (불확실하면 수동 처리)

### 결정 3: 재시도 전략 구조
**선택:** 3단계 점진적 범위 축소 전략
**근거:**
- 1차 시도: 이슈 설명 기반 정상 범위 수정
- 2차 시도: 에러 로그 분석 후 관련 코드 확대
- 3차 시도: 최소한의 안전한 수정으로 축소
- 각 시도마다 접근법 변경으로 성공률 향상
- 동일 실수 반복 방지

### 결정 4: 커밋 메시지 생성 방식
**선택:** 템플릿 기반 + 동적 정보 삽입
**근거:**
- Conventional Commits 형식 준수
- 템플릿으로 일관성 보장
- 이슈 정보, 변경 파일, 근본 원인 자동 삽입
- Claude가 자연어로 상세 설명 생성
- 미래 개발자를 위한 Why 중심 작성

### 결정 5: PR 생성 정책
**선택:** autofixing 브랜치 타겟, auto-fix 라벨 자동 추가
**근거:**
- main에 직접 머지하지 않음 (안전성)
- autofixing 브랜치에서 일괄 검토 후 main으로 머지
- 라벨로 자동 생성 PR 명확히 구분
- Draft PR 사용하지 않음 (이미 검증 완료)
- 사람의 최종 검토 강제

### 결정 6: 검증 체크 구성
**선택:** typecheck → lint → test 순서 필수
**근거:**
- 타입 체크가 가장 빠르고 명확한 에러 제공
- 린트는 타입 에러 수정 후 의미 있음
- 테스트는 가장 시간 소요, 마지막 검증
- 하나라도 실패 시 조기 종료로 시간 절약
- 재시도 시 동일 순서 유지

## 구현 단계

### Step 1: 기본 인터페이스 및 상수 정의
**산출물:**
- [ ] `CodeFixConfig` 인터페이스 정의
- [ ] `FixAttempt` 인터페이스 정의
- [ ] `CommitMessage` 인터페이스 정의
- [ ] `ForbiddenPattern` 인터페이스 정의
- [ ] 금지 패턴 상수 배열 정의 (`FORBIDDEN_PATTERNS`)
- [ ] 기본 설정값 상수 정의

**상세:**
```typescript
const DEFAULT_CONFIG: CodeFixConfig = {
  max_files: 3,
  max_lines_per_file: 30,
  max_retry: 3,
  forbidden_patterns: [
    // security, database, refactoring, config
  ],
  required_checks: ["typecheck", "lint", "test"]
};

const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  {
    category: "security",
    keywords: ["auth", "password", "secret", "token", "encrypt", "jwt", "oauth"],
    reason: "보안 관련 코드는 수동 검토 필수"
  },
  // ... 나머지 패턴
];
```

### Step 2: 금지 패턴 감지 로직
**산출물:**
- [ ] `detectForbiddenPatterns()` 함수 구현
- [ ] 키워드 매칭 로직
- [ ] 컨텍스트 분석 로직 (선택적)
- [ ] `handleForbiddenPattern()` 함수 (이슈 라벨링)

**상세:**
```typescript
function detectForbiddenPatterns(issue: Issue): ForbiddenPattern | null {
  for (const pattern of FORBIDDEN_PATTERNS) {
    const hasMatch = pattern.keywords.some(keyword =>
      issue.title.toLowerCase().includes(keyword.toLowerCase()) ||
      issue.body.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasMatch) {
      // 컨텍스트 확인 (선택적)
      if (isActuallyForbidden(issue, pattern)) {
        return pattern;
      }
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
    comment: generateSkipComment(pattern)
  });
}
```

### Step 3: 수정 범위 분석 및 결정 로직
**산출물:**
- [ ] `canAutoFix()` 함수 구현
- [ ] `analyzeAffectedFiles()` 함수 구현
- [ ] `estimateChangedLines()` 함수 구현
- [ ] `FixDecision` 타입 정의

**상세:**
```typescript
interface FixDecision {
  can_fix: boolean;
  reason?: string;
  suggested_action?: string;
  estimated_files?: number;
  estimated_lines?: number;
}

async function canAutoFix(
  issue: Issue,
  codebase: Codebase
): Promise<FixDecision> {
  // 1. 금지 패턴 체크
  const forbidden = detectForbiddenPatterns(issue);
  if (forbidden) {
    return {
      can_fix: false,
      reason: `금지된 패턴: ${forbidden.category}`,
      suggested_action: "수동 검토 필요"
    };
  }

  // 2. 영향 범위 분석
  const affectedFiles = await analyzeAffectedFiles(issue, codebase);

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

### Step 4: 재시도 전략 구현
**산출물:**
- [ ] `attemptFix()` 함수 구현
- [ ] `getRetryStrategy()` 함수 구현
- [ ] `RetryStrategy` 타입 정의
- [ ] 이전 에러 누적 로직

**상세:**
```typescript
interface RetryStrategy {
  scope: "narrow" | "normal" | "wide";
  approach: "issue-based" | "error-analysis" | "minimal-safe";
  targetFile?: string;
}

async function attemptFix(
  issue: Issue,
  attempt: number,
  previousErrors?: PreviousError[]
): Promise<FixAttempt> {
  const strategy = getRetryStrategy(attempt, previousErrors);

  // 전략에 따라 수정 범위 조정
  const files = strategy.scope === "narrow"
    ? [strategy.targetFile!]
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

function getRetryStrategy(
  attempt: number,
  previousErrors?: PreviousError[]
): RetryStrategy {
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

### Step 5: 커밋 메시지 생성 로직
**산출물:**
- [ ] `generateCommitMessage()` 함수 구현
- [ ] `formatCommitMessage()` 함수 구현
- [ ] `determineCommitType()` 함수 구현
- [ ] `generateSummary()` 함수 (50자 제한)
- [ ] `generateBody()` 함수 (Why 중심)

**상세:**
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

function generateBody(issue: Issue, changes: CodeChange[]): string {
  return `${issue.title}

Root Cause:
${analyzeRootCause(issue, changes)}

Solution:
${describeSolution(changes)}

Files Changed:
${changes.map(c => `- ${c.file}: ${c.reason}`).join('\n')}`;
}
```

### Step 6: PR 생성 로직
**산출물:**
- [ ] `createFixPR()` 함수 구현
- [ ] PR 제목 생성 로직
- [ ] PR 본문 템플릿 구현
- [ ] 테스트 결과 포맷팅
- [ ] 단일/다중 이슈 처리 분기

**상세:**
```typescript
async function createFixPR(
  issue: Issue | Issue[],
  fixAttempt: FixAttempt
): Promise<PRResult> {
  const isMultiple = Array.isArray(issue);
  const issues = Array.isArray(issue) ? issue : [issue];

  const title = isMultiple
    ? `fix: ${issues.length}개 이슈 수정 (#${issues.map(i => i.number).join(", #")})`
    : `fix: ${issue.title} (#${issue.number})`;

  const body = `
## 🤖 Auto-Fix PR

### Related Issues
${issues.map(i => `- Closes #${i.number}`).join('\n')}

### Changes
${describeChanges(fixAttempt)}

### Root Cause
${analyzeRootCause(issues[0], fixAttempt.changed_files)}

### Solution
${describeSolution(fixAttempt.changed_files)}

### Test Results
${formatTestResults(fixAttempt.test_results)}

### Files Changed
${fixAttempt.changed_files.map(f => `- \`${f}\`: ${getChangeReason(f)}`).join('\n')}

---
> 이 PR은 Claude Code에 의해 자동 생성되었습니다.
> 검토 후 autofixing 브랜치에 머지해주세요.
`;

  return await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    body,
    head: fixAttempt.branch,
    base: "autofixing",
    labels: ["auto-fix", "bot"]
  });
}
```

### Step 7: 검증 체크 통합
**산출물:**
- [ ] `runAllChecks()` 함수 구현
- [ ] `run-checks` 모듈 연동
- [ ] 체크 실패 시 재시도 트리거
- [ ] 최종 실패 처리 로직

**상세:**
```typescript
async function runAllChecks(
  worktreePath: string,
  attempt: number
): Promise<CheckResult[]> {
  const result = await runChecks({
    worktree_path: worktreePath,
    checks: ["typecheck", "lint", "test"]
  });

  if (!result.passed && attempt < 3) {
    // 재시도 트리거
    return null; // 재시도 신호
  }

  return result.results;
}
```

### Step 8: 최종 실패 처리 로직
**산출물:**
- [ ] `handleFinalFailure()` 함수 구현
- [ ] 이슈 라벨링 (`auto-fix-failed`)
- [ ] 실패 사유 코멘트 생성
- [ ] Worktree 정리

**상세:**
```typescript
async function handleFinalFailure(
  issue: Issue,
  attempts: FixAttempt[]
): Promise<void> {
  const comment = `
❌ 자동 수정 실패

**시도 횟수**: ${attempts.length}회
**최종 실패 원인**: ${attempts[attempts.length - 1].failure_reason}

**시도 내역**:
${attempts.map((a, i) =>
  `${i + 1}. 시도 ${a.attempt_number}: ${a.failure_reason || "테스트 실패"}`
).join('\n')}

**수동 검토 필요 사항**:
${generateManualReviewSuggestions(attempts)}

수동으로 수정해주세요.
`;

  await updateIssue(issue.number, {
    labels: ["auto-fix-failed"],
    comment
  });

  // Worktree 정리
  await cleanupWorktree(issue.number);
}
```

### Step 9: 통합 및 오케스트레이션
**산출물:**
- [ ] `autoFixIssue()` 메인 함수 구현
- [ ] 전체 워크플로우 통합
- [ ] 에러 핸들링 및 로깅
- [ ] 성공/실패 메트릭 수집

**상세:**
```typescript
async function autoFixIssue(issue: Issue): Promise<FixResult> {
  // 1. 자동 수정 가능 여부 판단
  const decision = await canAutoFix(issue, codebase);

  if (!decision.can_fix) {
    await handleForbiddenPattern(issue, decision.reason);
    return { success: false, reason: decision.reason };
  }

  // 2. Worktree 생성
  const worktree = await createWorktree([issue.number]);

  // 3. 최대 3회 재시도
  const attempts: FixAttempt[] = [];

  for (let attempt = 1; attempt <= 3; attempt++) {
    const fixAttempt = await attemptFix(issue, attempt, attempts);
    attempts.push(fixAttempt);

    if (fixAttempt.success) {
      // 성공: PR 생성
      await createFixPR(issue, fixAttempt);
      await cleanupWorktree([issue.number]);
      return { success: true, attempts };
    }
  }

  // 4. 최종 실패
  await handleFinalFailure(issue, attempts);
  return { success: false, attempts };
}
```

### Step 10: 테스트 작성
**산출물:**
- [ ] 단위 테스트 (금지 패턴, 커밋 메시지 등)
- [ ] 통합 테스트 (재시도 로직)
- [ ] E2E 테스트 (전체 워크플로우)
- [ ] Mock 테스트 (GitHub API)

## 테스트 전략

### 단위 테스트
- **도구:** Vitest
- **대상:**
  - `detectForbiddenPatterns()`: 모든 카테고리 키워드 검증
  - `generateCommitMessage()`: Conventional Commits 형식 준수
  - `generateBranchName()`: 브랜치명 규칙
  - `formatTestResults()`: 테스트 결과 포맷팅

### 통합 테스트
- **도구:** 실제 Git 레포지토리 + Worktree
- **시나리오:**
  1. 자동 수정 가능 → 1회 성공
  2. 첫 시도 실패 → 재시도 → 성공
  3. 3회 모두 실패 → 최종 실패 처리
  4. 금지 패턴 감지 → auto-fix-skip 라벨

### Mock 테스트
- **대상:** GitHub API, run-checks 모듈
- **도구:** MSW, vitest.mock()
- **시나리오:**
  - API 호출 성공/실패
  - 체크 통과/실패
  - 네트워크 에러

### E2E 테스트
- **환경:** 실제 GitHub 테스트 레포지토리
- **시나리오:**
  1. 실제 이슈 생성 → 자동 수정 → PR 생성 → 검증
  2. 보안 키워드 이슈 → 자동 스킵
  3. 대규모 리팩토링 이슈 → 자동 거부

### 성능 테스트
- 단일 이슈 자동 수정: 5분 이내
- 재시도 포함 최대 시간: 15분 이내

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| 금지 패턴 오탐 (false positive) | 중 | 컨텍스트 분석 추가, 사용자 피드백 수집 |
| 금지 패턴 미탐 (false negative) | 높음 | 보수적 접근, 지속적 패턴 업데이트 |
| 재시도 전략이 비효율적 | 중 | 이전 에러 분석 개선, ML 기반 전략 도입 |
| 커밋 메시지 품질 낮음 | 저 | Claude에게 명확한 지침, 샘플 제공 |
| PR 자동 머지 위험 | 높음 | autofixing 브랜치 타겟으로 안전장치 |
| 테스트 커버리지 감소 | 중 | 테스트 추가 강제, 커버리지 체크 |
| 동시 실행 충돌 | 중 | Worktree 격리, 잠금 메커니즘 |

## 의존성

### 내부 의존성
- `common/types`: 공통 타입 정의
- `git/manage-worktree`: Worktree 생성/정리
- `checks/run-checks`: CI 체크 실행
- `github/create-pr`: PR 생성
- `github/update-issue`: 이슈 업데이트
- `workflow/group-issues`: 이슈 그룹화 (선택적)

### 외부 의존성
- `@octokit/rest`: GitHub API
- `@anthropic-ai/sdk`: Claude API (코드 수정)
- Node.js 16+
- Git 2.5+

### 선택적 의존성
- AST 파서 (TypeScript, JavaScript): 영향 범위 분석
- Zod: 타입 검증
- Winston: 로깅

### 피의존성
- `workflow/orchestrator`: 최상위 워크플로우 오케스트레이션

## 구현 우선순위

1. **Critical:** Step 2 (금지 패턴 감지) - 안전성 핵심
2. **Critical:** Step 3 (수정 범위 분석) - 자동화 가능 여부 판단
3. **High Priority:** Step 4 (재시도 전략) - 성공률 향상
4. **High Priority:** Step 5 (커밋 메시지) - 품질 보장
5. **High Priority:** Step 6 (PR 생성) - 워크플로우 완결
6. **Medium Priority:** Step 8 (최종 실패 처리) - 사용자 경험
7. **Low Priority:** 고급 기능 (ML 기반 분석, 커스텀 규칙 등)

## 구현 세부사항

### 금지 패턴 카테고리별 키워드

```typescript
const SECURITY_KEYWORDS = [
  "auth", "authentication", "authorization",
  "jwt", "token", "session", "cookie",
  "password", "secret", "apiKey", "credentials",
  "encrypt", "decrypt", "hash", "crypto",
  "permission", "role", "acl", "oauth", "saml"
];

const DATABASE_KEYWORDS = [
  "migration", "schema", "ALTER TABLE", "CREATE TABLE", "DROP TABLE",
  "prisma migrate", "knex migrate", "sequelize migration",
  "addColumn", "dropColumn", "renameColumn", "addIndex"
];

const REFACTORING_KEYWORDS = [
  "rename class", "rename component", "move file",
  "change directory structure", "refactor architecture",
  "breaking change", "major version"
];

const CONFIG_KEYWORDS = [
  ".env", "production", "API_KEY", "SECRET_KEY",
  "config.yml", "settings.json", "credentials.json"
];
```

### 재시도 전략 상세

| Attempt | Scope | Approach | Description |
|---------|-------|----------|-------------|
| 1 | Normal | Issue-based | 이슈 설명 기반 정상 수정 |
| 2 | Wide | Error-analysis | 에러 분석 후 관련 코드 확대 |
| 3 | Narrow | Minimal-safe | 최소한의 안전한 수정 |

### 커밋 메시지 예시

**Good Example:**
```
fix: prevent null reference error in handleSave (#123)

When saving a new document without an existing ID, the handleSave
function attempted to access document.id without checking if the
document exists. This caused TypeError in production.

Added null check and fallback to create API for new documents.

Closes #123

Co-Authored-By: Claude Code <noreply@anthropic.com>
```

**Bad Example:**
```
fix: fixed bug (#123)

Changed code.

Closes #123
```

## 참고 자료

- Conventional Commits: https://www.conventionalcommits.org/
- GitHub PR Best Practices: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests
- AST Explorer: https://astexplorer.net/
- TypeScript Compiler API: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
