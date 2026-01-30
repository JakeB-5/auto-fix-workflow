---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Issue Generator 구현 계획

## 기술 결정

### 결정 1: 템플릿 엔진 선택
**선택:** Template Literals (네이티브) + 헬퍼 함수
**근거:**
- 마크다운 템플릿은 복잡한 로직 불필요 (조건부 렌더링 정도)
- Handlebars, EJS 등은 오버헤드 (번들 크기, 학습 곡선)
- TypeScript 네이티브 지원으로 타입 안전성 확보
- 유지보수 용이: 템플릿 코드가 순수 TypeScript

### 결정 2: GitHub Issue 생성 방법
**선택:** Octokit REST API (@octokit/rest)
**근거:**
- 공식 GitHub API 클라이언트, 안정성 보장
- TypeScript 타입 정의 제공
- Rate limiting, 재시도, 인증 자동 처리
- GraphQL 대비 단순 CRUD 작업에 적합

### 결정 3: 코드 스니펫 추출 전략
**선택:** Read 도구 + Context Window (에러 라인 ±5줄)
**근거:**
- 에러 발생 지점만 보면 원인 파악 어려움
- 앞뒤 5줄: 함수 시그니처, 변수 선언 등 컨텍스트 제공
- 너무 길면 Issue가 비대해짐 (±10줄은 과도)
- Read 도구의 line offset/limit 기능 활용

### 결정 4: Suggested Fix Direction 생성 방법
**선택:** 에러 패턴 매칭 + 템플릿 라이브러리
**근거:**
- 일반적 에러 패턴(null check, type error)은 템플릿으로 대응
- 패턴 매칭 라이브러리:
  ```typescript
  const FIX_PATTERNS = {
    "Cannot read property": "Optional chaining 또는 null 체크",
    "is not a function": "함수 존재 여부 체크",
    "Maximum call stack": "재귀 종료 조건 검토"
  };
  ```
- 확장 가능: 새 패턴 추가 시 맵만 업데이트
- 향후 AI 기반 제안으로 업그레이드 가능

### 결정 5: Label 정규화 규칙
**선택:** Convention-based Naming + 검증 레이어
**근거:**
- 컴포넌트: `component:canvas-core` (접두사 + kebab-case)
- 우선순위: `priority:high` (소문자)
- 소스: `asana`, `sentry` (단일 단어)
- 공백을 `-`로 치환, 특수문자 제거
- GitHub Label 제약 준수 (최대 50자)

## 구현 단계

### Step 1: 프로젝트 초기화 및 타입 정의
**산출물:**
- [ ] `src/analyzer/issue-generator/` 디렉토리 생성
- [ ] `types.ts`: 모든 인터페이스 정의
  - `IssueTemplate`, `IssueGenerationInput`, `IssueGenerationResult`
- [ ] `.env.example`: `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`
- [ ] Octokit 클라이언트 초기화 헬퍼

### Step 2: GitHub API 클라이언트 래퍼
**산출물:**
- [ ] `GitHubClient.ts` 클래스
- [ ] `createIssue(template: IssueTemplate): Promise<IssueCreationResult>` 메서드
- [ ] Rate limiting 처리 및 재시도 로직
- [ ] 에러 타입 정의: `GitHubAPIError`, `RateLimitError`
- [ ] Label 존재 여부 확인 및 자동 생성 로직

### Step 3: 마크다운 템플릿 시스템
**산출물:**
- [ ] `templates/` 디렉토리 생성
- [ ] `issueTemplate.ts`: 메인 템플릿 함수
  ```typescript
  generateIssueBody(input: IssueGenerationInput): string
  ```
- [ ] 섹션별 헬퍼 함수:
  - `renderTypeSection(source: string): string`
  - `renderContextSection(location?: CodeLocation): string`
  - `renderCodeAnalysis(code?: string): string`
  - `renderSuggestedFix(patterns: string[]): string`
  - `renderAcceptanceCriteria(type: string, scenarios: string[]): string`
- [ ] 마크다운 이스케이프 유틸리티

### Step 4: Type 자동 판단 로직
**산출물:**
- [ ] `TypeDetector.ts` 클래스
- [ ] `detectIssueType(input: IssueGenerationInput): IssueType` 메서드
- [ ] 판단 규칙:
  - Sentry 소스 → `🔴 Sentry Error`
  - 에러 메시지 존재 → `🐛 Bug Report`
  - 에러 없음 → `✨ Feature Request`
- [ ] 체크박스 형식 반환: `- [x] 🐛 Bug Report`

### Step 5: Context 섹션 생성기
**산출물:**
- [ ] `ContextRenderer.ts` 클래스
- [ ] 단일 파일 처리:
  ```typescript
  renderSingleFile(location: CodeLocation): string
  ```
- [ ] 다중 파일 처리:
  ```typescript
  renderMultipleFiles(locations: CodeLocation[]): string
  ```
- [ ] 컴포넌트 라벨 포맷팅
- [ ] 누락 필드 생략 로직 (빈 값 대신 제외)

### Step 6: Code Analysis 섹션 생성기
**산출물:**
- [ ] `CodeAnalysisRenderer.ts` 클래스
- [ ] Read 도구를 사용한 코드 추출:
  ```typescript
  extractCodeSnippet(file: string, line: number): Promise<string>
  ```
- [ ] 라인 번호 주석 추가 (```typescript 내부)
- [ ] Context window: 에러 라인 ±5줄
- [ ] 들여쓰기 유지 및 포맷팅
- [ ] 파일 접근 불가 시 fallback: 에러 메시지 스니펫 사용

### Step 7: Suggested Fix Direction 생성기
**산출물:**
- [ ] `FixSuggester.ts` 클래스
- [ ] 에러 패턴 맵 정의:
  ```typescript
  const ERROR_PATTERNS: Record<string, string[]> = {
    "Cannot read property": [
      "Optional chaining 사용 (?.)",
      "Null/undefined 체크 추가"
    ],
    // ...
  };
  ```
- [ ] 패턴 매칭 함수:
  ```typescript
  suggestFix(errorMessage: string): string[]
  ```
- [ ] 참조 파일 힌트 추가 (task-analyzer 제공 시)
- [ ] 제안 없으면 섹션 생략

### Step 8: Acceptance Criteria 생성기
**산출물:**
- [ ] `CriteriaGenerator.ts` 클래스
- [ ] Type별 기본 Criteria:
  - Bug/Sentry: "에러 미발생", "테스트 통과", "재현 시나리오 정상"
  - Feature: "기능 구현", "기존 기능 영향 없음", "테스트 추가"
- [ ] 재현 시나리오 기반 추가 Criteria:
  ```typescript
  addScenarioCriteria(scenarios: string[]): string[]
  ```
- [ ] 체크박스 리스트 형식 반환

### Step 9: Labels 자동 설정 시스템
**산출물:**
- [ ] `LabelManager.ts` 클래스
- [ ] 기본 라벨: `auto-fix` (항상 포함)
- [ ] 소스별 라벨 추가: `sentry`, `asana`
- [ ] 컴포넌트 라벨 정규화:
  ```typescript
  normalizeComponentLabel(component: string): string
  // "canvas core" → "component:canvas-core"
  ```
- [ ] 우선순위 라벨: Asana custom field 매핑
- [ ] Label 검증: 최대 50자, 특수문자 제거
- [ ] GitHub Label 존재 확인 및 생성 API 호출

### Step 10: Issue Title 생성기
**산출물:**
- [ ] `TitleGenerator.ts` 클래스
- [ ] Sentry 에러:
  ```typescript
  `[Sentry] ${errorType}: ${errorMessage}`
  ```
- [ ] Asana 버그:
  ```typescript
  `[Asana] ${taskTitle}`
  ```
- [ ] 파일명 추가 옵션 (간결성 유지):
  ```typescript
  `[Sentry] TypeError in Editor.tsx`
  ```
- [ ] 최대 256자 제한 준수 (초과 시 truncate)

### Step 11: IssueGenerator 메인 통합
**산출물:**
- [ ] `IssueGenerator.ts` - 메인 orchestrator
- [ ] `generate(input: IssueGenerationInput): Promise<IssueGenerationResult>` 메서드
- [ ] 검증 로직:
  - `can_auto_convert: false` → `InsufficientDataError`
  - 필수 필드 누락 체크
- [ ] 모든 렌더러 조합 및 템플릿 생성
- [ ] GitHub Issue 생성 API 호출
- [ ] 실패 시 Asana 코멘트 작성 (선택적)

### Step 12: 단위 테스트 작성
**산출물:**
- [ ] `TypeDetector.test.ts` - Type 판단 테스트
- [ ] `ContextRenderer.test.ts` - Context 섹션 테스트
- [ ] `CodeAnalysisRenderer.test.ts` - 코드 추출 테스트
- [ ] `FixSuggester.test.ts` - 패턴 매칭 테스트
- [ ] `LabelManager.test.ts` - Label 정규화 테스트
- [ ] `TitleGenerator.test.ts` - Title 생성 테스트
- [ ] Mock GitHub API 응답 fixture

### Step 13: 통합 테스트 및 실제 Issue 생성 검증
**산출물:**
- [ ] `integration.test.ts` - E2E 테스트
- [ ] 실제 GitHub 테스트 repo에 Issue 생성 (샌드박스)
- [ ] 3가지 시나리오:
  - High confidence (완전한 정보)
  - Medium confidence (부분 정보)
  - Low confidence (최소 정보, InsufficientDataError 예상)
- [ ] 생성된 Issue 마크다운 검증 (렌더링 오류 없음)
- [ ] Label 생성 및 할당 확인

## 테스트 전략

### 단위 테스트
- **템플릿 렌더링**: 각 섹션별 독립 테스트 (snapshot testing)
- **패턴 매칭**: 10개 이상의 에러 패턴 케이스
- **Label 정규화**: 특수문자, 공백, 길이 제한 케이스
- **Title 생성**: 최대 길이, 특수문자 이스케이프

### 통합 테스트
- GitHub API 모킹 (nock 또는 octokit mock)
- 실제 분석 결과 fixture 사용
- 마크다운 파싱 검증 (marked 또는 remark 사용)

### 검증 기준
- [ ] 코드 커버리지 > 85%
- [ ] 모든 REQ-001 ~ REQ-010 시나리오 통과
- [ ] 생성된 Issue가 GitHub에서 정상 렌더링
- [ ] Label이 올바르게 설정됨

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| GitHub Rate Limit 초과 | 높음 | Octokit의 재시도 로직 활용, 배치 처리 시 지연 추가, Secondary Rate Limit 모니터링 |
| 코드 스니펫 추출 실패 (파일 삭제/이동) | 중간 | Fallback: 에러 메시지 스니펫 사용, 섹션 생략 옵션, 에러 로깅 |
| 마크다운 렌더링 깨짐 (특수문자) | 중간 | 이스케이프 유틸리티 강화, 테스트 케이스 확대, GitHub 미리보기 검증 |
| Label 생성 실패 (권한 부족) | 낮음 | Label 생성 권한 확인, 실패 시 경고만 로깅 (Issue는 생성), 수동 라벨링 가이드 제공 |
| 긴 Issue body로 API 제한 초과 | 낮음 | 최대 65536자 검증, 코드 스니펫 길이 제한, 필요 시 truncate + "자세한 내용은 Asana 참조" |

## 의존성

### 외부 의존성
- **@octokit/rest** (`@octokit/rest@^19.0.0`): GitHub API 클라이언트
- **dotenv** (`dotenv@^16.0.0`): 환경 변수 관리

### 내부 의존성
- `common/types`: `IssueTemplate`, `CodeLocation` 타입
- `analyzer/task-analyzer`: `TaskAnalysisResult` 입력
- `analyzer/code-locator`: `CodeSearchResult` 입력
- Claude Code 도구:
  - **Read**: 코드 스니펫 추출
  - **Bash** (선택적): git log로 변경 이력 확인

### 환경 요구사항
- Node.js >= 18.x
- TypeScript >= 5.0
- GitHub Personal Access Token (repo 권한)
- 대상 GitHub Repository (write 권한)

### 선택적 의존성
- `fix-patterns.json`: 에러 패턴 → 수정 제안 맵 (없으면 내장 패턴 사용)
- Asana API (실패 시 코멘트 작성용, issue-generator 자체는 독립적)
