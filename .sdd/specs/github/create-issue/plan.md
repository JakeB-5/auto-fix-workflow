---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Create Issue 구현 계획

## 기술 결정

### 결정 1: 템플릿 생성 방식
**선택:** Template Literal 기반 문자열 생성
**근거:**
- Markdown 템플릿은 고정된 구조이므로 템플릿 엔진 불필요
- Tagged Template Literal로 가독성 유지하며 동적 데이터 삽입 용이
- 템플릿 변경 시 코드 수정만으로 대응 가능 (외부 파일 불필요)

### 결정 2: 라벨 자동 추가 전략
**선택:** 기본 라벨 + 소스 라벨 + 커스텀 라벨 병합
**근거:**
- 기본 라벨: "auto-fix" (항상 추가)
- 소스 라벨: asana_task_id → "asana", sentry_link → "sentry" 자동 추가
- 커스텀 라벨: params.labels에서 제공된 라벨 추가
- 중복 제거 (Set 사용)

### 결정 3: 중복 이슈 방지 전략
**선택:** Asana Task ID 기반 검색
**근거:**
- 동일 Asana 태스크로 GitHub Issue가 중복 생성되는 것 방지
- Issue 본문에 `asana_task_id` 포함하여 검색 가능하도록 함
- list_issues + body 검색으로 중복 체크

### 결정 4: Asana 업데이트 실패 처리
**선택:** 비블로킹 + 경고 반환
**근거:**
- GitHub Issue 생성은 핵심 작업, Asana 업데이트는 부가 작업
- Asana API 실패 시 GitHub Issue를 롤백하지 않음
- 결과 객체의 asana_updated.error에 실패 정보 포함하여 사용자에게 알림

## 구현 단계

### Step 1: 타입 정의
**산출물:**
- [ ] `types/github.ts`: CreateIssueParams, CreateIssueResult 인터페이스

**작업 내용:**
- spec.md Interface 섹션 → TypeScript 타입
- AsanaUpdateResult 타입 추가 (success, tag_added, comment_added, error)

### Step 2: 템플릿 생성 유틸리티 구현
**산출물:**
- [ ] `utils/issue-template-generator.ts`: generateAutoFixIssueBody 함수

**작업 내용:**
```typescript
interface IssueTemplateData {
  type: 'bug' | 'error' | 'feature';
  source: 'asana' | 'sentry' | 'direct';
  file?: string;
  function?: string;
  lines?: string;
  component?: string;
  description?: string;
  stack_trace?: string;
  event_count?: number;
  sentry_link?: string;
  asana_link?: string;
  asana_task_id?: string;
}

function generateAutoFixIssueBody(data: IssueTemplateData): string {
  return `## 🤖 Auto-Fix Issue

### Type
- [x] ${typeToEmoji(data.type)} ${typeToLabel(data.type)}

### Source
- **Origin**: ${sourceToLabel(data.source)}
${data.asana_link ? `- **Reference**: ${data.asana_link}` : ''}
${data.sentry_link ? `- **Reference**: ${data.sentry_link}` : ''}
${data.event_count ? `- **Event Count**: ${data.event_count}` : ''}
${data.asana_task_id ? `- **Asana Task ID**: ${data.asana_task_id}` : ''}

### Context
${data.file ? `- **파일**: \`${data.file}\`` : ''}
${data.function ? `- **함수/클래스**: \`${data.function}\`` : ''}
${data.lines ? `- **라인**: ${data.lines}` : ''}
${data.component ? `- **컴포넌트**: ${data.component}` : ''}

### Problem Description
${data.description || 'N/A'}

${data.stack_trace ? `### Stack Trace
\`\`\`
${data.stack_trace}
\`\`\`` : ''}
`.trim();
}
```

### Step 3: 라벨 자동 생성 로직 구현
**산출물:**
- [ ] `utils/label-generator.ts`: generateLabels 함수

**작업 내용:**
```typescript
function generateLabels(params: CreateIssueParams): string[] {
  const labels = new Set<string>();

  // 기본 라벨
  labels.add('auto-fix');

  // 소스 라벨
  if (params.asana_task_id) labels.add('asana');
  if (params.body.includes('sentry.io')) labels.add('sentry');

  // 커스텀 라벨
  if (params.labels) {
    params.labels.forEach(l => labels.add(l));
  }

  return Array.from(labels);
}
```

### Step 4: 중복 이슈 체크 로직 구현
**산출물:**
- [ ] `utils/duplicate-checker.ts`: checkDuplicateIssue 함수

**작업 내용:**
```typescript
async function checkDuplicateIssue(asana_task_id: string): Promise<number | null> {
  if (!asana_task_id) return null;

  // auto-fix 라벨을 가진 열린 이슈 조회
  const issues = await listIssues({ labels: ['auto-fix'], state: 'open' });

  // 본문에 asana_task_id가 포함된 이슈 찾기
  for (const issue of issues.issues) {
    const fullIssue = await getIssue({ issue_number: issue.number });
    if (fullIssue.body.includes(`**Asana Task ID**: ${asana_task_id}`)) {
      return issue.number;
    }
  }

  return null;
}
```

### Step 5: Asana 연동 로직 구현 (선택사항)
**산출물:**
- [ ] `integrations/asana-client.ts`: updateAsanaTask 함수

**작업 내용:**
```typescript
async function updateAsanaTask(taskId: string, issueNumber: number, issueUrl: string): Promise<AsanaUpdateResult> {
  try {
    // Asana 태그 추가 (triaged)
    await asana.tasks.addTag(taskId, { tag: 'triaged' });

    // 코멘트 추가
    await asana.tasks.addComment(taskId, {
      text: `GitHub Issue #${issueNumber} created: ${issueUrl}`,
    });

    return {
      success: true,
      tag_added: true,
      comment_added: true,
    };
  } catch (error) {
    return {
      success: false,
      tag_added: false,
      comment_added: false,
      error: error.message,
    };
  }
}
```

### Step 6: Create Issue Tool 핵심 로직 구현
**산출물:**
- [ ] `tools/create-issue.ts`: createIssue 함수

**작업 내용:**
```typescript
async function createIssue(params: CreateIssueParams): Promise<CreateIssueResult> {
  // 1. 파라미터 검증
  if (!params.title) {
    throw new MCPError('INVALID_PARAMS', 'title is required');
  }
  if (!params.body || params.body.trim() === '') {
    throw new MCPError('INVALID_PARAMS', 'body must follow Auto-Fix Issue template');
  }

  // 2. 중복 이슈 체크
  if (params.asana_task_id) {
    const existingIssue = await checkDuplicateIssue(params.asana_task_id);
    if (existingIssue) {
      throw new MCPError('DUPLICATE', `Issue already exists: #${existingIssue}`);
    }
  }

  // 3. 라벨 생성
  const labels = generateLabels(params);

  // 4. GitHub Issue 생성
  const issue = await octokit.issues.create({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    title: params.title,
    body: params.body,
    labels: labels,
  });

  // 5. Asana 업데이트 (비블로킹)
  let asana_updated = undefined;
  if (params.asana_task_id) {
    asana_updated = await updateAsanaTask(
      params.asana_task_id,
      issue.data.number,
      issue.data.html_url
    );
  }

  // 6. 결과 반환
  return {
    issue_number: issue.data.number,
    url: issue.data.html_url,
    created_at: issue.data.created_at,
    labels: labels,
    asana_updated,
  };
}
```

### Step 7: 에러 핸들링
**산출물:**
- [ ] 모든 에러 시나리오 처리

**작업 내용:**
- 필수 파라미터 누락 → MCP "INVALID_PARAMS"
- 중복 이슈 → MCP "DUPLICATE" (기존 이슈 번호 포함)
- GitHub API 403 → MCP "PERMISSION_DENIED"
- 존재하지 않는 라벨 → 경고 (Issue는 생성됨)

### Step 8: MCP Tool 통합
**산출물:**
- [ ] `index.ts`: create_issue Tool 등록

## 테스트 전략

### Unit Tests
- `issue-template-generator.ts`:
  - 버그 리포트 템플릿 생성
  - Sentry 이슈 템플릿 생성 (stack_trace 포함)
  - Asana 이슈 템플릿 생성 (asana_link 포함)
  - 선택적 필드 누락 케이스
- `label-generator.ts`:
  - 기본 라벨만
  - asana_task_id 제공 시 "asana" 추가
  - body에 sentry.io 포함 시 "sentry" 추가
  - 중복 라벨 제거
- `duplicate-checker.ts`:
  - 중복 이슈 존재
  - 중복 없음
  - asana_task_id 미제공 시 건너뛰기

### Integration Tests
- Mock Octokit + Mock Asana로 createIssue 함수 테스트
  - 정상 생성 (Asana 업데이트 포함)
  - 중복 이슈 에러
  - Asana 업데이트 실패 시 경고 반환
  - 존재하지 않는 라벨 경고

### Manual Testing
- 실제 GitHub 레포지토리에 이슈 생성
- Asana 태스크 연동 확인
- 중복 방지 동작 확인

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| Asana API 실패 시 롤백 복잡도 | 높음 | GitHub Issue는 롤백하지 않고 경고만 반환 (비블로킹 처리) |
| 중복 체크 성능 (많은 open 이슈) | 중간 | auto-fix 라벨로 필터링하여 검색 범위 축소, 대부분 50개 이하 |
| 템플릿 생성 로직 복잡도 | 중간 | 단위 테스트로 모든 케이스 검증, Template Literal로 가독성 유지 |
| 존재하지 않는 라벨 처리 | 낮음 | GitHub는 존재하지 않는 라벨을 무시하므로 에러 없음, 경고로 사용자에게 알림 |
| GitHub PAT 권한 부족 | 낮음 | 명확한 에러 메시지로 필요 권한 (repo:write) 안내 |

## 의존성

### 선행 의존성
- `common/types`: MCP 에러 코드, GitHub 설정
- `common/error-handler`: 에러 변환
- `utils/github-client`: Octokit 인스턴스
- `tools/list-issues`: 중복 체크를 위한 이슈 조회
- `tools/get-issue`: 이슈 상세 정보 조회 (중복 체크)
- (선택) `integrations/asana-client`: Asana API 연동
- 환경 변수: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, ASANA_ACCESS_TOKEN

### 후행 의존성
- `orchestrator`: Asana 태스크 분석 후 GitHub Issue 자동 생성
- `asana-sync`: Asana → GitHub 동기화 워크플로우

### 외부 라이브러리
- `@octokit/rest`: ^20.0.0
- (선택) `asana`: ^3.0.0

## 구현 순서 요약

1. 타입 정의 (Step 1)
2. 템플릿 생성 유틸리티 (Step 2)
3. 라벨 생성 로직 (Step 3)
4. 중복 체크 로직 (Step 4) ← list-issues, get-issue 의존
5. Asana 연동 로직 (Step 5) ← 선택사항
6. 핵심 로직 (Step 6)
7. 에러 핸들링 (Step 7)
8. MCP 통합 (Step 8)

## 참고사항

### 템플릿 생성 함수 사용 예시
```typescript
// Asana 태스크 분석 결과 → GitHub Issue 생성
const body = generateAutoFixIssueBody({
  type: 'bug',
  source: 'asana',
  file: 'src/components/Editor.tsx',
  function: 'handleSave()',
  component: 'editor',
  description: '새 문서 저장 시 TypeError 발생',
  asana_task_id: '1234567890',
  asana_link: 'https://app.asana.com/0/123/456',
});

const result = await createIssue({
  title: '저장 버튼 클릭 시 에러 발생',
  body: body,
  labels: ['component:editor'],
  asana_task_id: '1234567890',
});
```
