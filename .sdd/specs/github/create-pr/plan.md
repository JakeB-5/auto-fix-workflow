---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Create PR 구현 계획

## 기술 결정

### 결정 1: PR 본문 자동 생성 전략
**선택:** 템플릿 기반 생성 + 커스텀 오버라이드 지원
**근거:**
- 기본적으로 이슈 정보, 테스트 결과를 기반으로 표준 템플릿 자동 생성
- title, body 파라미터 제공 시 자동 생성 건너뛰고 사용자 값 사용
- 유연성과 편의성 균형 확보

### 결정 2: 변경사항 요약 생성 방식
**선택:** Git diff 기반 자동 추출 (선택사항)
**근거:**
- params.changes 제공 시 사용
- 미제공 시 `git diff target...branch --name-status`로 변경된 파일 목록 추출
- 각 파일의 첫 번째 커밋 메시지를 description으로 사용

### 결정 3: 라벨 상속 전략
**선택:** 원본 이슈의 라벨 자동 복사 + 기본 라벨 추가
**근거:**
- 원본 이슈의 "component:*", "priority:*" 라벨 상속
- 기본 라벨 "auto-fix", "bot" 자동 추가
- PR과 이슈의 연관성 유지 및 분류 용이

### 결정 4: 테스트 결과 형식화
**선택:** Markdown 체크리스트 형식
**근거:**
- ✅/❌/⚠️ emoji로 시각적 구분
- GitHub PR 본문에서 체크리스트로 렌더링되어 가독성 높음
- 경고 메시지 포함 시 별도 표시

## 구현 단계

### Step 1: 타입 정의
**산출물:**
- [ ] `types/github.ts`: CreatePRParams, CreatePRResult 인터페이스
- [ ] TestResults 타입 정의 (test, typecheck, lint 각각)

**작업 내용:**
- spec.md Interface → TypeScript 타입
- TestResult 인터페이스: { passed: boolean; output?: string; warnings?: string[] }

### Step 2: PR 제목 자동 생성 유틸리티 구현
**산출물:**
- [ ] `utils/pr-title-generator.ts`: generatePRTitle 함수

**작업 내용:**
```typescript
interface IssueDetail {
  number: number;
  title: string;
  component?: string;
}

function generatePRTitle(issues: IssueDetail[]): string {
  if (issues.length === 1) {
    return `fix: ${issues[0].title} (#${issues[0].number})`;
  }

  // 그룹 이슈: 공통 컴포넌트 추출
  const component = issues[0].component || 'multiple';
  const numbers = issues.map(i => `#${i.number}`).join(', ');
  return `fix: ${component} issues (${numbers})`;
}
```

### Step 3: PR 본문 자동 생성 유틸리티 구현
**산출물:**
- [ ] `utils/pr-body-generator.ts`: generatePRBody 함수

**작업 내용:**
```typescript
interface PRBodyParams {
  issues: number[];
  changes?: { file: string; description: string }[];
  test_results?: {
    test?: { passed: boolean; output?: string; warnings?: string[] };
    typecheck?: { passed: boolean; output?: string };
    lint?: { passed: boolean; output?: string };
  };
}

function generatePRBody(params: PRBodyParams): string {
  const closesLines = params.issues.map(n => `- Closes #${n}`).join('\n');

  const changesLines = params.changes
    ? params.changes.map(c => `- \`${c.file}\`: ${c.description}`).join('\n')
    : '_자동 감지된 변경사항_';

  const testResults = formatTestResults(params.test_results);

  return `## 🤖 Auto-Fix PR

### Related Issues
${closesLines}

### Changes
${changesLines}

### Test Results
${testResults}

---
> 이 PR은 Claude Code에 의해 자동 생성되었습니다.`;
}

function formatTestResults(results?: PRBodyParams['test_results']): string {
  if (!results) return '_테스트 결과 없음_';

  const lines: string[] = [];

  if (results.test) {
    const emoji = results.test.passed ? '✅' : '❌';
    const warning = results.test.warnings?.length ? ` (${results.test.warnings.length} warning)` : '';
    lines.push(`- ${emoji} Unit Tests: ${results.test.passed ? 'Passed' : 'Failed'}${warning}`);
  }

  if (results.typecheck) {
    const emoji = results.typecheck.passed ? '✅' : '❌';
    lines.push(`- ${emoji} Type Check: ${results.typecheck.passed ? 'Passed' : 'Failed'}`);
  }

  if (results.lint) {
    const emoji = results.lint.passed ? '✅' : '❌';
    lines.push(`- ${emoji} Lint: ${results.lint.passed ? 'Passed' : 'Failed'}`);
  }

  return lines.join('\n') || '_테스트 미실행_';
}
```

### Step 4: 변경사항 자동 추출 유틸리티 구현
**산출물:**
- [ ] `utils/git-changes-extractor.ts`: extractChanges 함수

**작업 내용:**
```typescript
async function extractChanges(
  branch: string,
  target: string
): Promise<{ file: string; description: string }[]> {
  // git diff로 변경된 파일 목록 추출
  const diffOutput = await execGit(`diff ${target}...${branch} --name-status`);
  const files = parseDiffOutput(diffOutput);

  // 각 파일의 첫 번째 커밋 메시지 추출
  const changes = await Promise.all(
    files.map(async (file) => {
      const log = await execGit(`log ${target}..${branch} --oneline --format=%s -- ${file}`);
      const firstCommitMsg = log.split('\n')[0] || 'Updated';
      return { file, description: firstCommitMsg };
    })
  );

  return changes;
}

function parseDiffOutput(output: string): string[] {
  return output.split('\n')
    .filter(line => line.trim())
    .map(line => {
      const [_status, file] = line.split('\t');
      return file;
    });
}
```

### Step 5: 라벨 자동 생성 로직 구현
**산출물:**
- [ ] `utils/pr-label-generator.ts`: generatePRLabels 함수

**작업 내용:**
```typescript
async function generatePRLabels(issueNumbers: number[]): Promise<string[]> {
  const labels = new Set<string>();

  // 기본 라벨
  labels.add('auto-fix');
  labels.add('bot');

  // 원본 이슈의 라벨 상속
  for (const num of issueNumbers) {
    const issue = await getIssue({ issue_number: num });
    issue.labels.forEach((label) => {
      if (label.startsWith('component:') || label.startsWith('priority:')) {
        labels.add(label);
      }
    });
  }

  return Array.from(labels);
}
```

### Step 6: Create PR Tool 핵심 로직 구현
**산출물:**
- [ ] `tools/create-pr.ts`: createPR 함수

**작업 내용:**
```typescript
async function createPR(params: CreatePRParams): Promise<CreatePRResult> {
  // 1. 파라미터 검증
  if (!params.branch) {
    throw new MCPError('INVALID_PARAMS', 'branch is required');
  }
  if (!params.issues || params.issues.length === 0) {
    throw new MCPError('INVALID_PARAMS', 'issues is required');
  }

  const target = params.target || 'autofixing';

  // 2. 브랜치 존재 확인
  const branchExists = await checkBranchExists(params.branch);
  if (!branchExists) {
    throw new MCPError('NOT_FOUND', `Branch not found: ${params.branch}`);
  }

  // 3. 변경사항 확인
  const hasChanges = await checkHasChanges(params.branch, target);
  if (!hasChanges) {
    throw new MCPError('NO_CHANGES', 'No changes to create PR');
  }

  // 4. 중복 PR 체크
  const existingPR = await checkExistingPR(params.branch, target);
  if (existingPR) {
    throw new MCPError('DUPLICATE', `PR already exists: #${existingPR}`);
  }

  // 5. 이슈 상세 정보 조회
  const issuesDetail = await Promise.all(
    params.issues.map(num => getIssue({ issue_number: num }))
  );

  // 6. 제목 생성 (커스텀 또는 자동)
  const title = params.title || generatePRTitle(issuesDetail);

  // 7. 변경사항 추출 (커스텀 또는 자동)
  const changes = params.changes || await extractChanges(params.branch, target);

  // 8. 본문 생성 (커스텀 또는 자동)
  const body = params.body || generatePRBody({
    issues: params.issues,
    changes,
    test_results: params.test_results,
  });

  // 9. 라벨 생성
  const labels = await generatePRLabels(params.issues);

  // 10. PR 생성
  const pr = await octokit.pulls.create({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    title,
    body,
    head: params.branch,
    base: target,
  });

  // 11. 라벨 추가
  await octokit.issues.addLabels({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    issue_number: pr.data.number,
    labels,
  });

  // 12. 결과 반환
  return {
    pr_number: pr.data.number,
    url: pr.data.html_url,
    title: pr.data.title,
    branch: params.branch,
    target,
    created_at: pr.data.created_at,
    labels,
  };
}
```

### Step 7: Git 유틸리티 함수 구현
**산출물:**
- [ ] `utils/git-helper.ts`: checkBranchExists, checkHasChanges, checkExistingPR 함수

**작업 내용:**
```typescript
async function checkBranchExists(branch: string): Promise<boolean> {
  try {
    await execGit(`rev-parse --verify ${branch}`);
    return true;
  } catch {
    return false;
  }
}

async function checkHasChanges(branch: string, target: string): Promise<boolean> {
  const diff = await execGit(`diff ${target}...${branch}`);
  return diff.trim().length > 0;
}

async function checkExistingPR(branch: string, target: string): Promise<number | null> {
  const prs = await octokit.pulls.list({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    head: `${GITHUB_OWNER}:${branch}`,
    base: target,
    state: 'open',
  });

  return prs.data.length > 0 ? prs.data[0].number : null;
}
```

### Step 8: 에러 핸들링
**산출물:**
- [ ] 모든 에러 시나리오 처리

**작업 내용:**
- 브랜치 없음 → MCP "NOT_FOUND"
- 변경사항 없음 → MCP "NO_CHANGES"
- 중복 PR → MCP "DUPLICATE"
- GitHub API 403 → MCP "PERMISSION_DENIED"

### Step 9: MCP Tool 통합
**산출물:**
- [ ] `index.ts`: create_pr Tool 등록

## 테스트 전략

### Unit Tests
- `pr-title-generator.ts`:
  - 단일 이슈 제목 생성
  - 그룹 이슈 제목 생성 (공통 컴포넌트)
- `pr-body-generator.ts`:
  - 모든 섹션 포함 케이스
  - 테스트 결과 없음 케이스
  - 경고 포함 케이스
- `git-changes-extractor.ts`:
  - 파일 추가/수정/삭제 파싱
  - 커밋 메시지 추출
- `pr-label-generator.ts`:
  - 기본 라벨 추가
  - 이슈 라벨 상속 (component, priority)

### Integration Tests
- Mock Octokit + Mock Git으로 createPR 함수 테스트
  - 정상 PR 생성 (자동 생성)
  - 커스텀 title, body 제공
  - 브랜치 없음 에러
  - 변경사항 없음 에러
  - 중복 PR 에러

### Manual Testing
- 실제 GitHub 레포지토리에서 PR 생성
  - autofixing 브랜치로 PR 생성
  - Closes #issue_number 동작 확인
  - 라벨 자동 추가 확인

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| Git diff 파싱 실패 | 중간 | params.changes로 사용자가 직접 제공 가능, 파싱 실패 시 기본값 반환 |
| 중복 PR 감지 누락 | 중간 | GitHub API로 head/base 조합 검색, Open PR만 체크 |
| 테스트 결과 형식 불일치 | 낮음 | 유연한 파싱 (passed만 필수, output/warnings 선택) |
| 라벨 상속 실패 | 낮음 | 에러 없이 기본 라벨만 사용 |
| autofixing 브랜치 없음 | 낮음 | 명확한 에러 메시지로 사용자에게 안내 |

## 의존성

### 선행 의존성
- `common/types`: MCP 에러 코드, GitHub 설정
- `common/error-handler`: 에러 변환
- `utils/github-client`: Octokit 인스턴스
- `tools/get-issue`: 이슈 상세 정보 조회 (라벨 상속)
- Git CLI 접근 (브랜치 확인, diff)
- 환경 변수: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO

### 후행 의존성
- `orchestrator`: 자동 수정 완료 후 PR 생성
- `update-issue`: PR 생성 후 원본 이슈에 링크 코멘트 추가

### 외부 라이브러리
- `@octokit/rest`: ^20.0.0
- (선택) `simple-git`: ^3.0.0 (Git 명령 실행 유틸리티)

## 구현 순서 요약

1. 타입 정의 (Step 1)
2. PR 제목 생성 유틸리티 (Step 2)
3. PR 본문 생성 유틸리티 (Step 3)
4. 변경사항 추출 유틸리티 (Step 4)
5. 라벨 생성 로직 (Step 5) ← get-issue 의존
6. Git 유틸리티 함수 (Step 7)
7. 핵심 로직 (Step 6)
8. 에러 핸들링 (Step 8)
9. MCP 통합 (Step 9)

## 참고사항

### PR 생성 워크플로우 전체 흐름
```typescript
// 1. 이슈 수정 브랜치 생성
await execGit('checkout -b fix/issue-123');

// 2. 코드 수정 및 커밋
// ... (자동 수정 로직)

// 3. 테스트 실행
const test_results = {
  test: { passed: true },
  typecheck: { passed: true },
  lint: { passed: true, warnings: ['1 deprecated API'] },
};

// 4. PR 생성
const pr = await createPR({
  branch: 'fix/issue-123',
  target: 'autofixing',
  issues: [123],
  test_results,
});

// 5. 원본 이슈 업데이트
await updateIssue({
  issue_number: 123,
  comment: `✅ PR created: ${pr.url}`,
  remove_labels: ['auto-fix-processing'],
});
```

### PR 본문 예시
```markdown
## 🤖 Auto-Fix PR

### Related Issues
- Closes #123

### Changes
- `src/components/Editor.tsx`: Add null check in handleSave
- `src/types/document.ts`: Update Document interface

### Test Results
- ✅ Unit Tests: Passed
- ✅ Type Check: Passed
- ⚠️ Lint: Passed (1 warning)

---
> 이 PR은 Claude Code에 의해 자동 생성되었습니다.
```
