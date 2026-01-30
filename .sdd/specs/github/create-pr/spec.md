---
status: draft
created: 2026-01-30
domain: github
feature: create-pr
depends: [common/types]
---

# Create PR

> 자동 수정된 코드를 autofixing 브랜치로 Pull Request 생성하는 Tool

## Requirement: REQ-001 - autofixing 브랜치 타겟 PR 생성

시스템은 수정 브랜치에서 autofixing 브랜치로 PR을 생성해야 한다(SHALL).

### Scenario: 단일 이슈 PR 생성

- **GIVEN** 브랜치 "fix/issue-123"에 Issue #123 수정 커밋이 존재
- **WHEN** `create_pr({ branch: "fix/issue-123", target: "autofixing", issues: [123] })`를 호출
- **THEN** "fix/issue-123" → "autofixing" PR이 생성되어야 함

### Scenario: 그룹 이슈 PR 생성

- **GIVEN** 브랜치 "fix/issue-124-125"에 Issue #124, #125 수정 커밋이 존재
- **WHEN** `create_pr({ branch: "fix/issue-124-125", target: "autofixing", issues: [124, 125] })`를 호출
- **THEN** "fix/issue-124-125" → "autofixing" PR이 생성되어야 함

### Scenario: 커스텀 타겟 브랜치

- **GIVEN** 특수한 경우로 main으로 직접 PR 생성 필요
- **WHEN** `create_pr({ branch: "hotfix/critical", target: "main", issues: [999] })`를 호출
- **THEN** "hotfix/critical" → "main" PR이 생성되어야 함

## Requirement: REQ-002 - PR 제목 및 본문 자동 생성

시스템은 이슈 정보를 기반으로 PR 제목과 본문을 자동으로 생성해야 한다(SHALL).

### Scenario: 단일 이슈 PR 제목

- **GIVEN** Issue #123의 제목이 "TypeError in handleSave"
- **WHEN** `create_pr({ issues: [123] })`를 호출
- **THEN** PR 제목이 "fix: TypeError in handleSave (#123)"이어야 함

### Scenario: 그룹 이슈 PR 제목

- **GIVEN** Issue #124, #125가 모두 "canvas-core" 컴포넌트 관련
- **WHEN** `create_pr({ issues: [124, 125] })`를 호출
- **THEN** PR 제목이 "fix: canvas-core issues (#124, #125)"이어야 함

### Scenario: PR 본문 템플릿

- **GIVEN** Issue #123에 대한 PR 생성
- **WHEN** `create_pr({ issues: [123], test_results: {...} })`를 호출
- **THEN** PR 본문이 다음 형식이어야 함
  ```markdown
  ## 🤖 Auto-Fix PR

  ### Related Issues
  - Closes #123

  ### Changes
  - src/components/Editor.tsx: null 체크 추가

  ### Test Results
  - ✅ Unit Tests: Passed
  - ✅ Type Check: Passed
  - ✅ Lint: Passed

  ---
  > 이 PR은 Claude Code에 의해 자동 생성되었습니다.
  ```

## Requirement: REQ-003 - Issue Closes 링크

시스템은 PR 본문에 "Closes #issue_number"를 포함하여 이슈 자동 종료를 지원해야 한다(SHALL).

### Scenario: 단일 이슈 Closes

- **GIVEN** Issue #123에 대한 PR
- **WHEN** `create_pr({ issues: [123] })`를 호출
- **THEN** PR 본문에 "Closes #123"이 포함되어야 함

### Scenario: 다중 이슈 Closes

- **GIVEN** Issue #124, #125에 대한 PR
- **WHEN** `create_pr({ issues: [124, 125] })`를 호출
- **THEN** PR 본문에 "Closes #124, Closes #125"가 포함되어야 함

### Scenario: PR 머지 시 이슈 자동 종료

- **GIVEN** PR #201이 "Closes #123"을 포함하고 autofixing에 머지됨
- **WHEN** 사용자가 autofixing → main PR을 머지
- **THEN** Issue #123이 자동으로 종료되어야 함 (GitHub 기능)

## Requirement: REQ-004 - 라벨 및 메타데이터

시스템은 PR에 적절한 라벨과 메타데이터를 자동으로 추가해야 한다(SHALL).

### Scenario: 자동 라벨 추가

- **GIVEN** 자동 수정 PR 생성
- **WHEN** `create_pr({ issues: [123] })`를 호출
- **THEN** PR에 "auto-fix", "bot" 라벨이 자동으로 추가되어야 함

### Scenario: 컴포넌트 라벨 상속

- **GIVEN** Issue #123이 "component:editor" 라벨을 가짐
- **WHEN** `create_pr({ issues: [123] })`를 호출
- **THEN** PR에 "component:editor" 라벨이 자동으로 추가되어야 함

### Scenario: 리뷰어 미지정

- **GIVEN** 자동 수정 PR 생성
- **WHEN** `create_pr({ issues: [123] })`를 호출
- **THEN** PR에 리뷰어가 지정되지 않아야 함 (수동 검토 대상)

## Requirement: REQ-005 - 테스트 결과 포함

시스템은 PR 본문에 로컬 테스트 결과를 포함해야 한다(SHALL).

### Scenario: 모든 테스트 통과

- **GIVEN** 로컬 테스트가 모두 통과
  ```typescript
  {
    test: { passed: true },
    typecheck: { passed: true },
    lint: { passed: true }
  }
  ```
- **WHEN** `create_pr({ issues: [123], test_results: {...} })`를 호출
- **THEN** PR 본문에 "✅ Unit Tests: Passed" 등이 포함되어야 함

### Scenario: 일부 테스트 실패 (경고)

- **GIVEN** 로컬 테스트는 통과했지만 경고가 있음
  ```typescript
  {
    test: { passed: true, warnings: ["1 deprecated API usage"] },
    typecheck: { passed: true },
    lint: { passed: true }
  }
  ```
- **WHEN** `create_pr({ issues: [123], test_results: {...} })`를 호출
- **THEN** PR 본문에 "⚠️ Unit Tests: Passed (1 warning)" 형식으로 포함되어야 함

## Interface

### Input Parameters

```typescript
interface CreatePRParams {
  branch: string;            // 소스 브랜치 (예: "fix/issue-123")
  target?: string;           // 타겟 브랜치 (기본: "autofixing")
  issues: number[];          // 관련 이슈 번호 목록

  // 선택사항 (자동 생성 가능)
  title?: string;            // 커스텀 제목 (미제공 시 자동 생성)
  body?: string;             // 커스텀 본문 (미제공 시 자동 생성)

  // 테스트 결과
  test_results?: {
    test?: { passed: boolean; output?: string; warnings?: string[] };
    typecheck?: { passed: boolean; output?: string };
    lint?: { passed: boolean; output?: string };
  };

  // 변경 요약 (자동 생성 가능)
  changes?: {
    file: string;
    description: string;
  }[];
}
```

### Output

```typescript
interface CreatePRResult {
  pr_number: number;
  url: string;
  title: string;
  branch: string;
  target: string;
  created_at: string;
  labels: string[];
}
```

## Error Handling

### Scenario: 브랜치가 존재하지 않음

- **GIVEN** 레포지토리에 "fix/issue-999" 브랜치가 없음
- **WHEN** `create_pr({ branch: "fix/issue-999", issues: [999] })`를 호출
- **THEN** MCP error code "NOT_FOUND"와 함께 "Branch not found" 에러를 반환해야 함

### Scenario: 변경사항 없음

- **GIVEN** "fix/issue-123" 브랜치가 "autofixing"과 동일한 상태
- **WHEN** `create_pr({ branch: "fix/issue-123", target: "autofixing", issues: [123] })`를 호출
- **THEN** MCP error code "NO_CHANGES"와 함께 "No changes to create PR" 에러를 반환해야 함

### Scenario: 중복 PR 방지

- **GIVEN** "fix/issue-123" → "autofixing" PR이 이미 존재
- **WHEN** `create_pr({ branch: "fix/issue-123", target: "autofixing", issues: [123] })`를 재호출
- **THEN** MCP error code "DUPLICATE"와 함께 기존 PR 번호를 포함한 에러를 반환해야 함

### Scenario: GitHub API 권한 부족

- **GIVEN** GitHub PAT이 PR 생성 권한이 없음
- **WHEN** `create_pr({ ... })`를 호출
- **THEN** MCP error code "PERMISSION_DENIED"와 함께 에러를 반환해야 함

## Auto-Generation Logic

### Scenario: 제목 자동 생성 로직

```typescript
function generateTitle(issues: IssueDetail[]): string {
  if (issues.length === 1) {
    return `fix: ${issues[0].title} (#${issues[0].number})`;
  } else {
    const component = issues[0].component;
    const numbers = issues.map(i => `#${i.number}`).join(", ");
    return `fix: ${component} issues (${numbers})`;
  }
}
```

### Scenario: 본문 자동 생성 로직

```typescript
function generateBody(params: CreatePRParams): string {
  const closesLines = params.issues.map(n => `- Closes #${n}`).join("\n");
  const changesLines = params.changes?.map(c => `- ${c.file}: ${c.description}`).join("\n") || "";
  const testResults = formatTestResults(params.test_results);

  return `
## 🤖 Auto-Fix PR

### Related Issues
${closesLines}

### Changes
${changesLines}

### Test Results
${testResults}

---
> 이 PR은 Claude Code에 의해 자동 생성되었습니다.
  `.trim();
}
```
