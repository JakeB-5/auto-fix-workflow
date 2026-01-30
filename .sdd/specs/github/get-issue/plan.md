---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Get Issue 구현 계획

## 기술 결정

### 결정 1: Markdown 파싱 방식
**선택:** marked 라이브러리 + 커스텀 AST 파싱
**근거:**
- 정규식만으로는 복잡한 중첩 구조 (코드 블록, 리스트) 파싱 어려움
- marked는 경량이며 AST를 제공하여 섹션별 추출 용이
- "### Type", "### Context", "### Stack Trace" 등 헤딩 기반 섹션 구조화

### 결정 2: 관련 이슈 추출 방식
**선택:** 정규식 기반 이슈 번호 추출
**근거:**
- "### Related Issues" 섹션에서 "#123" 패턴 추출
- GitHub는 #123 형식을 자동 링크로 변환하므로 패턴 일관성 보장
- 정규식: `/#(\d+)/g` (간단하고 빠름)

### 결정 3: 코멘트 조회 최적화
**선택:** 조건부 API 호출 (include_comments: true 시에만)
**근거:**
- 코멘트는 별도 API 엔드포인트 (`GET /repos/{owner}/{repo}/issues/{issue_number}/comments`)
- 불필요한 API 호출 방지로 Rate Limit 절약
- 기본값 false로 대부분의 경우 1회 API 호출로 처리

### 결정 4: 템플릿 파싱 실패 처리
**선택:** Graceful Degradation (부분 파싱)
**근거:**
- 템플릿 형식을 따르지 않는 이슈도 처리 가능해야 함
- 파싱 가능한 필드만 추출하고 나머지는 undefined 반환
- 에러를 발생시키지 않고 raw body는 항상 반환

## 구현 단계

### Step 1: 타입 정의
**산출물:**
- [ ] `types/github.ts`: GetIssueParams, GetIssueResult, ParsedContext 인터페이스

**작업 내용:**
- spec.md의 Interface → TypeScript 타입 변환
- ParsedContext의 선택적 필드 정의 (모든 필드 optional)
- Comment 타입 정의 (id, author, body, created_at)

### Step 2: Markdown 파싱 유틸리티 구현
**산출물:**
- [ ] `utils/markdown-parser.ts`: parseIssueTemplate 함수

**작업 내용:**
```typescript
function parseIssueTemplate(body: string): ParsedContext {
  const ast = marked.lexer(body);
  const sections = extractSections(ast); // 헤딩 기반 섹션 추출

  return {
    type: extractType(sections['Type']),
    source: extractSource(sections['Source']),
    file: extractField(sections['Context'], '파일'),
    function: extractField(sections['Context'], '함수/클래스'),
    lines: extractField(sections['Context'], '라인'),
    component: extractField(sections['Context'], '컴포넌트'),
    description: sections['Problem Description'],
    stack_trace: sections['Stack Trace'],
    event_count: extractEventCount(sections['Source']),
    sentry_link: extractLink(sections['Source'], 'sentry.io'),
    asana_link: extractLink(sections['Source'], 'asana.com'),
  };
}
```

### Step 3: 관련 이슈 추출 유틸리티 구현
**산출물:**
- [ ] `utils/related-issues-parser.ts`: extractRelatedIssues 함수

**작업 내용:**
```typescript
function extractRelatedIssues(body: string): number[] {
  const relatedSection = extractSection(body, 'Related Issues');
  if (!relatedSection) return [];

  const matches = relatedSection.matchAll(/#(\d+)/g);
  return Array.from(matches, m => parseInt(m[1]));
}
```

### Step 4: Get Issue Tool 핵심 로직 구현
**산출물:**
- [ ] `tools/get-issue.ts`: getIssue 함수 및 Tool 등록

**작업 내용:**
```typescript
async function getIssue(params: GetIssueParams): Promise<GetIssueResult> {
  // 1. 파라미터 검증
  if (!params.issue_number) {
    throw new MCPError('INVALID_PARAMS', 'issue_number is required');
  }

  // 2. 이슈 기본 정보 조회
  const issue = await octokit.issues.get({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    issue_number: params.issue_number,
  });

  // 3. 본문 파싱
  const parsed_context = parseIssueTemplate(issue.data.body || '');
  const related_issues = extractRelatedIssues(issue.data.body || '');

  // 4. 코멘트 조회 (조건부)
  let comments = undefined;
  if (params.include_comments) {
    const commentsResponse = await octokit.issues.listComments({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      issue_number: params.issue_number,
    });
    comments = commentsResponse.data.map(c => ({
      id: c.id,
      author: c.user.login,
      body: c.body,
      created_at: c.created_at,
    }));
  }

  // 5. 결과 반환
  return {
    number: issue.data.number,
    title: issue.data.title,
    body: issue.data.body || '',
    state: issue.data.state,
    labels: issue.data.labels.map(l => typeof l === 'string' ? l : l.name),
    author: issue.data.user.login,
    created_at: issue.data.created_at,
    updated_at: issue.data.updated_at,
    parsed_context,
    related_issues,
    comments,
  };
}
```

### Step 5: 에러 핸들링
**산출물:**
- [ ] 모든 에러 시나리오 처리 코드

**작업 내용:**
- GitHub API 404 → MCP "NOT_FOUND"
- GitHub API 401 → MCP "AUTHENTICATION_FAILED"
- GitHub API 403 → MCP "PERMISSION_DENIED"
- GitHub API 500/503 → MCP "EXTERNAL_SERVICE_ERROR"
- 파싱 실패 → 에러 없이 빈 parsed_context 반환

### Step 6: MCP Tool 통합
**산출물:**
- [ ] `index.ts`: get_issue Tool 등록
- [ ] Tool 메타데이터 및 스키마

## 테스트 전략

### Unit Tests
- `markdown-parser.ts`:
  - Auto-Fix Issue 템플릿 파싱 (모든 필드 존재)
  - Sentry Issue 템플릿 파싱 (source, stack_trace, event_count)
  - 불규칙한 형식 (섹션 누락, 순서 변경)
  - 코드 블록 내 헤딩 무시 (false positive 방지)
- `related-issues-parser.ts`:
  - 정상 케이스: "- #120 - 설명"
  - 여러 이슈: "#120, #121, #122"
  - 섹션 없음: 빈 배열 반환

### Integration Tests
- Mock Octokit으로 getIssue 함수 테스트
  - 정상 응답 (파싱 포함)
  - include_comments: true/false 동작
  - 404 에러 처리
  - 템플릿 파싱 실패 시 부분 결과 반환

### Manual Testing
- 실제 GitHub 이슈로 테스트
  - Auto-Fix 템플릿 이슈
  - Sentry 자동 생성 이슈
  - 일반 이슈 (템플릿 아님)
  - 코멘트 50개 이상 이슈 (페이지네이션)

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| 템플릿 형식 불일치 | 높음 | Graceful degradation (부분 파싱), 에러 없이 raw body 항상 반환 |
| Markdown 파싱 성능 | 중간 | marked는 경량 라이브러리, 이슈 본문은 대부분 수 KB 이하로 성능 문제 없음 |
| 코멘트 많은 이슈 (100개+) | 중간 | GitHub API는 페이지당 30개 제한, 필요 시 페이지네이션 구현 (현재는 첫 페이지만) |
| 존재하지 않는 이슈 조회 | 낮음 | 404 에러를 명확하게 NOT_FOUND로 매핑 |
| 비표준 Related Issues 형식 | 낮음 | 정규식으로 #숫자 패턴만 추출, 노이즈는 자연스럽게 필터링됨 |

## 의존성

### 선행 의존성
- `common/types`: MCP 에러 코드, GitHub 설정
- `common/error-handler`: 에러 변환
- `utils/github-client`: Octokit 인스턴스 (list-issues와 공유)
- 환경 변수: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO

### 후행 의존성
- `create-pr`: 이슈 상세 정보를 기반으로 PR 본문 생성
- `orchestrator`: 이슈 분석 후 자동 수정 전략 수립
- `update-issue`: 동일 이슈에 코멘트 추가 시 기존 정보 참조

### 외부 라이브러리
- `@octokit/rest`: ^20.0.0
- `marked`: ^11.0.0 (Markdown → AST 파싱)

## 구현 순서 요약

1. 타입 정의 (Step 1)
2. Markdown 파싱 유틸리티 (Step 2) ← marked 라이브러리 설치 필요
3. 관련 이슈 파싱 유틸리티 (Step 3)
4. 핵심 로직 (Step 4)
5. 에러 핸들링 (Step 5)
6. MCP 통합 (Step 6)

## 참고사항

### Auto-Fix Issue 템플릿 구조 예시
```markdown
## 🤖 Auto-Fix Issue

### Type
- [x] 🐛 Bug Report

### Source
- **Origin**: Asana
- **Reference**: https://app.asana.com/...

### Context
- **파일**: `src/components/Editor.tsx`
- **함수/클래스**: `handleSave()`
- **라인**: 142-156
- **컴포넌트**: editor

### Problem Description
새 문서 저장 시 TypeError 발생

### Related Issues
- #120 - 유사한 null 체크 이슈
```
