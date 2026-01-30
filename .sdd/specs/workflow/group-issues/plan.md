---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Group Issues 구현 계획

## 기술 결정

### 결정 1: 이슈 정보 수집 방식
**선택:** GitHub REST API를 사용하여 이슈 상세 정보 조회
**근거:**
- 라벨, 본문, 타이틀 등 모든 정보 접근 가능
- GraphQL보다 간단하고 학습 곡선 낮음
- 캐싱으로 API 호출 최소화 가능
- Octokit 라이브러리로 타입 안전성 보장

### 결정 2: 컴포넌트 정보 추출 방법
**선택:** Issue 템플릿의 구조화된 필드 파싱 (정규식 + YAML frontmatter)
**근거:**
- GitHub Issue Template은 마크다운 형식
- "Context.컴포넌트" 또는 "Component:" 패턴 검색
- YAML frontmatter 지원 시 더 정확한 파싱
- 템플릿 변경에 유연하게 대응

### 결정 3: 파일 경로 추출 방법
**선택:** 이슈 본문에서 코드 블록 및 경로 패턴 정규식 추출
**근거:**
- 개발자들이 이슈에 파일 경로 자주 언급
- 패턴: `src/.../*.{ts,tsx,js,jsx}`, `path/to/file.ext`
- 코드 블록 내 import 문 파싱
- 여러 파일 언급 시 모두 추출

### 결정 4: 그룹화 알고리즘
**선택:** Map 기반 그룹핑, 이슈가 여러 그룹에 속할 수 있음
**근거:**
- 파일 기반: 하나의 이슈가 여러 파일 수정 가능
- 라벨 기반: 여러 라벨 보유 가능
- 컴포넌트 기반: 단일 컴포넌트만 (중복 불가)
- Map 자료구조로 O(n) 복잡도 유지

### 결정 5: 브랜치명 생성 전략
**선택:** 이슈 개수와 그룹 키 조합으로 결정
**근거:**
- 1개 이슈: `fix/issue-{N}`
- 2-3개 이슈: `fix/issue-{N1}-{N2}-{N3}`
- 4개 이상: `fix/{group-key}-issues`
- 브랜치명 길이 제한 (50자) 고려
- kebab-case로 통일

### 결정 6: 최대 그룹 크기 제한
**선택:** 기본 5개, 초과 시 경고와 함께 반환 (분할하지 않음)
**근거:**
- 자동 분할은 복잡도 높고 오히려 혼란
- 5개는 리뷰 가능한 합리적 수준
- 경고만 주고 사용자 판단에 맡김
- 추후 분할 로직 추가 가능

## 구현 단계

### Step 1: 기본 인터페이스 및 타입 정의
**산출물:**
- [ ] `GroupIssuesParams` 인터페이스 정의
- [ ] `GroupIssuesResult` 인터페이스 정의
- [ ] `IssueGroup` 인터페이스 정의
- [ ] `IssueDetail` 내부 타입 정의 (캐싱용)
- [ ] 파라미터 검증 함수 구현

### Step 2: GitHub API 연동 및 이슈 정보 수집
**산출물:**
- [ ] Octokit 초기화 함수
- [ ] `fetchIssueDetails()` 함수 구현
- [ ] 병렬 API 호출 로직 (Promise.all)
- [ ] API 응답 캐싱 (메모리 기반)
- [ ] 에러 처리 (rate limit, 404 등)

**상세:**
```typescript
async function fetchIssueDetails(
  issueNumbers: number[]
): Promise<IssueDetail[]> {
  const octokit = getOctokit();

  const promises = issueNumbers.map(num =>
    octokit.rest.issues.get({
      owner,
      repo,
      issue_number: num
    })
  );

  const responses = await Promise.all(promises);

  return responses.map(r => ({
    number: r.data.number,
    title: r.data.title,
    body: r.data.body,
    labels: r.data.labels.map(l => l.name)
  }));
}
```

### Step 3: 컴포넌트 정보 추출 로직
**산출물:**
- [ ] `extractComponent()` 함수 구현
- [ ] Issue 템플릿 파싱 정규식
- [ ] YAML frontmatter 파싱 (optional)
- [ ] 폴백: 타이틀에서 컴포넌트명 추출

**상세:**
```typescript
function extractComponent(issue: IssueDetail): string | null {
  const { title, body } = issue;

  // 1. YAML frontmatter 체크
  const yamlMatch = body.match(/^---\n([\s\S]+?)\n---/);
  if (yamlMatch) {
    const yaml = parseYaml(yamlMatch[1]);
    if (yaml.component) return yaml.component;
  }

  // 2. "Context.컴포넌트:" 패턴
  const contextMatch = body.match(/Context\.컴포넌트:\s*(.+)/i);
  if (contextMatch) return contextMatch[1].trim();

  // 3. "Component:" 패턴
  const componentMatch = body.match(/Component:\s*(.+)/i);
  if (componentMatch) return componentMatch[1].trim();

  // 4. 타이틀에서 추출 (예: "[Button] Fix click issue")
  const titleMatch = title.match(/^\[(.+?)\]/);
  if (titleMatch) return titleMatch[1];

  return null;
}
```

### Step 4: 파일 경로 추출 로직
**산출물:**
- [ ] `extractFilePaths()` 함수 구현
- [ ] 파일 경로 정규식 패턴 정의
- [ ] 코드 블록 내 import 문 파싱
- [ ] 유효한 파일 경로 필터링

**상세:**
```typescript
function extractFilePaths(issue: IssueDetail): string[] {
  const { body } = issue;
  const paths: string[] = [];

  // 1. 명시적 파일 경로 패턴
  const pathPattern = /(?:src|lib|app)\/[\w\/\-\.]+\.(ts|tsx|js|jsx|vue|svelte)/g;
  const matches = body.matchAll(pathPattern);
  for (const match of matches) {
    paths.push(match[0]);
  }

  // 2. 코드 블록 내 import 문
  const codeBlockPattern = /```[\w]*\n([\s\S]+?)```/g;
  const codeBlocks = body.matchAll(codeBlockPattern);
  for (const block of codeBlocks) {
    const importPattern = /from ['"](.+?)['"]/g;
    const imports = block[1].matchAll(importPattern);
    for (const imp of imports) {
      if (imp[1].startsWith('.') || imp[1].startsWith('/')) {
        paths.push(imp[1]);
      }
    }
  }

  // 3. 중복 제거
  return [...new Set(paths)];
}
```

### Step 5: 그룹화 알고리즘 구현
**산출물:**
- [ ] `groupByComponent()` 함수 구현
- [ ] `groupByFile()` 함수 구현
- [ ] `groupByLabel()` 함수 구현
- [ ] 빈 그룹 필터링
- [ ] 그룹 정렬 (크기 기준 내림차순)

**상세:**
```typescript
function groupByComponent(
  issues: IssueDetail[]
): Map<string, number[]> {
  const groups = new Map<string, number[]>();

  for (const issue of issues) {
    const component = extractComponent(issue) || "unknown";

    if (!groups.has(component)) {
      groups.set(component, []);
    }

    groups.get(component)!.push(issue.number);
  }

  return groups;
}

function groupByFile(
  issues: IssueDetail[]
): Map<string, number[]> {
  const groups = new Map<string, number[]>();

  for (const issue of issues) {
    const files = extractFilePaths(issue);

    if (files.length === 0) {
      // "unknown" 그룹에 추가
      if (!groups.has("unknown")) {
        groups.set("unknown", []);
      }
      groups.get("unknown")!.push(issue.number);
    } else {
      // 각 파일 그룹에 추가 (중복 가능)
      for (const file of files) {
        if (!groups.has(file)) {
          groups.set(file, []);
        }
        groups.get(file)!.push(issue.number);
      }
    }
  }

  return groups;
}
```

### Step 6: 브랜치명 생성 로직
**산출물:**
- [ ] `generateBranchName()` 함수 구현
- [ ] 그룹 키 sanitization
- [ ] 길이 제한 처리 (50자)
- [ ] kebab-case 변환

**상세:**
```typescript
function generateBranchName(group: IssueGroup): string {
  const issueNumbers = group.issues.sort((a, b) => a - b);

  // 1개 이슈
  if (issueNumbers.length === 1) {
    return `fix/issue-${issueNumbers[0]}`;
  }

  // 2-3개 이슈
  if (issueNumbers.length <= 3) {
    return `fix/issue-${issueNumbers.join("-")}`;
  }

  // 4개 이상: 그룹 키 활용
  const sanitizedKey = sanitize(group.key);
  const branchName = `fix/${sanitizedKey}-issues`;

  // 길이 제한
  if (branchName.length > 50) {
    const truncated = sanitizedKey.slice(0, 30);
    return `fix/${truncated}-issues`;
  }

  return branchName;
}

function sanitize(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9\-\/]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
```

### Step 7: 메인 함수 구현
**산출물:**
- [ ] `groupIssues()` 메인 함수 구현
- [ ] group_by 파라미터별 라우팅
- [ ] 최대 그룹 크기 체크 및 경고
- [ ] 결과 정렬 및 반환

**상세:**
```typescript
async function groupIssues(
  params: GroupIssuesParams
): Promise<GroupIssuesResult> {
  // 1. 파라미터 검증
  validateParams(params);

  // 2. 이슈 상세 정보 조회
  const issueDetails = await fetchIssueDetails(params.issues);

  // 3. 그룹화
  let groupMap: Map<string, number[]>;

  switch (params.group_by) {
    case "component":
      groupMap = groupByComponent(issueDetails);
      break;
    case "file":
      groupMap = groupByFile(issueDetails);
      break;
    case "label":
      groupMap = groupByLabel(issueDetails);
      break;
  }

  // 4. IssueGroup 객체 생성
  const groups: IssueGroup[] = [];

  for (const [key, issues] of groupMap.entries()) {
    if (issues.length === 0) continue; // 빈 그룹 제외

    groups.push({
      key,
      issues,
      suggested_branch: generateBranchName({ key, issues })
    });
  }

  // 5. 크기 체크 (경고)
  const maxSize = params.max_group_size || 5;
  const oversizedGroups = groups.filter(g => g.issues.length > maxSize);

  if (oversizedGroups.length > 0) {
    console.warn(
      `경고: ${oversizedGroups.length}개 그룹이 최대 크기(${maxSize})를 초과했습니다.`
    );
  }

  // 6. 정렬 (크기 기준 내림차순)
  groups.sort((a, b) => b.issues.length - a.issues.length);

  return { groups };
}
```

### Step 8: 테스트 작성
**산출물:**
- [ ] 단위 테스트 (추출 로직)
- [ ] 통합 테스트 (실제 GitHub API)
- [ ] Mock 테스트 (API 응답 시뮬레이션)
- [ ] 엣지 케이스 테스트

## 테스트 전략

### 단위 테스트
- **도구:** Vitest
- **대상:**
  - `extractComponent()`: 다양한 이슈 템플릿 패턴
  - `extractFilePaths()`: 경로 추출 정확성
  - `generateBranchName()`: 브랜치명 생성 규칙
  - `sanitize()`: 특수문자 처리

### Mock 테스트
- **대상:** GitHub API 호출
- **도구:** MSW (Mock Service Worker) 또는 nock
- **시나리오:**
  - 정상 응답
  - 404 에러
  - Rate limit 초과
  - 네트워크 타임아웃

### 통합 테스트
- **도구:** 실제 GitHub 테스트 레포지토리
- **전략:**
  1. 테스트용 이슈 생성 (beforeAll)
  2. 그룹화 실행 및 결과 검증
  3. 테스트 이슈 정리 (afterAll)

### E2E 테스트
- **시나리오:**
  1. 컴포넌트 기반 그룹화 (5개 이슈 → 2개 그룹)
  2. 파일 기반 그룹화 (중복 허용)
  3. 라벨 기반 그룹화 (여러 라벨 보유 이슈)
  4. 최대 그룹 크기 초과 경고

### 성능 테스트
- 50개 이슈 그룹화: 5초 이내
- API 호출 병렬화로 성능 최적화
- 캐싱으로 중복 호출 방지

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| GitHub API rate limit 초과 | 중 | 캐싱, 병렬 호출 제한, 재시도 로직 |
| 이슈 템플릿 변경으로 파싱 실패 | 중 | 여러 패턴 지원, 폴백 로직 |
| 파일 경로 추출 정확도 낮음 | 중 | 정규식 개선, 수동 라벨링 옵션 |
| 그룹 크기 불균형 (1개 그룹에 20개 이슈) | 저 | 경고 메시지, 수동 분할 제안 |
| 브랜치명 길이 제한 초과 | 저 | 50자 제한, 자동 truncate |
| 중복 그룹핑 (파일 기반 시) | 저 | 명확한 문서화, 의도된 동작임을 명시 |

## 의존성

### 내부 의존성
- `common/types`: 공통 타입 정의

### 외부 의존성
- `@octokit/rest`: GitHub REST API 클라이언트
- `js-yaml`: YAML frontmatter 파싱 (선택적)
- Node.js 16+

### 선택적 의존성
- Zod: 파라미터 검증
- lodash: 유틸리티 함수

### 피의존성
- `workflow/orchestrator`: 워크플로우에서 이슈 그룹화 사용
- `git/manage-worktree`: 그룹별 Worktree 생성

## 구현 우선순위

1. **High Priority:** Step 2 (GitHub API 연동) - 핵심 데이터 소스
2. **High Priority:** Step 5 (그룹화 알고리즘) - 핵심 로직
3. **High Priority:** Step 6 (브랜치명 생성) - 워크플로우 통합 필수
4. **Medium Priority:** Step 3, 4 (추출 로직) - 정확도 향상
5. **Low Priority:** 고급 기능 (자동 분할, ML 기반 그룹화 등)

## 구현 세부사항

### API 캐싱 전략

```typescript
const issueCache = new Map<number, IssueDetail>();

async function fetchIssueDetails(
  issueNumbers: number[]
): Promise<IssueDetail[]> {
  const uncached = issueNumbers.filter(n => !issueCache.has(n));

  if (uncached.length > 0) {
    const fresh = await fetchFromGitHub(uncached);
    fresh.forEach(issue => issueCache.set(issue.number, issue));
  }

  return issueNumbers.map(n => issueCache.get(n)!);
}
```

### 정규식 패턴 모음

```typescript
const PATTERNS = {
  component: [
    /Context\.컴포넌트:\s*(.+)/i,
    /Component:\s*(.+)/i,
    /^\[(.+?)\]/ // 타이틀 패턴
  ],

  filePath: [
    /(?:src|lib|app)\/[\w\/\-\.]+\.(ts|tsx|js|jsx|vue|svelte)/g,
    /`([\w\/\-\.]+\.(ts|tsx|js|jsx))`/g
  ],

  import: /from ['"](.+?)['"]/g
};
```

## 참고 자료

- Octokit REST API: https://octokit.github.io/rest.js/
- GitHub Issue Templates: https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests
- RegExp Guide: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
