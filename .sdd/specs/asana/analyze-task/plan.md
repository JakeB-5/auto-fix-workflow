---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Analyze Asana Task 구현 계획

## 기술 결정

### 결정 1: 분석 엔진 선택
**선택:** LLM 기반 분석 (Claude API) + 휴리스틱 조합
**근거:**
- 자연어 이해가 필요 (재현 단계 명확성, 요구사항 파악)
- 코드베이스 매핑은 휴리스틱으로 먼저 시도, 실패 시 LLM
- Claude Haiku로 비용 절감, 복잡한 경우만 Sonnet 사용

### 결정 2: 신뢰도 점수 산출 방식
**선택:** 가중치 기반 점수 시스템
**근거:**
- 재현 단계 명확성: 40점
- 에러 메시지 존재: 30점
- 코드 위치 특정 가능: 20점
- 기대 동작 명시: 10점
- **70점 이상 → "success"**, 미만 → 적절한 실패 이유 반환

### 결정 3: 코드베이스 탐색 전략
**선택:** 키워드 추출 → Grep → 파일 랭킹
**근거:**
- 에러 메시지에서 함수명/파일명 추출 (정규식)
- Grep으로 codebase 전체 검색
- 언급 빈도와 컨텍스트로 관련 파일 랭킹
- 최대 5개 파일까지 제시

### 결정 4: GitHub Issue 템플릿 생성
**선택:** 구조화된 템플릿 + LLM으로 섹션 채우기
**근거:**
- 템플릿 구조는 고정 (auto-fix-workflow 표준)
- LLM으로 Asana 내용 → Issue 섹션 매핑
- 코드 스니펫과 분석 결과 자동 삽입

## 구현 단계

### Step 1: 휴리스틱 분석 모듈
**산출물:**
- [ ] `src/analysis/heuristics.ts` - 규칙 기반 분석
- [ ] 재현 단계 감지 (숫자 나열, "단계", "steps" 키워드)
- [ ] 에러 메시지 추출 (정규식: `Error:`, `TypeError`, 스택 트레이스)
- [ ] 파일명/함수명 추출 (`.tsx`, `.ts`, camelCase 패턴)

**추출 패턴:**
```typescript
const patterns = {
  errorMessage: /(?:Error|Exception|Failed):\s*(.+)/gi,
  filePath: /([a-z0-9-_\/]+\.(ts|tsx|js|jsx))/gi,
  functionName: /([a-z][a-zA-Z0-9]+)\s*\(/gi,
  stepNumbers: /^\s*\d+\.\s+/gm,
};
```

### Step 2: 신뢰도 점수 산출
**산출물:**
- [ ] `src/analysis/scoring.ts` - 점수 계산 로직
- [ ] 각 기준별 가중치 적용
- [ ] 점수에 따른 분석 결과 판정

**점수 로직:**
```typescript
function calculateConfidence(task: AsanaTask): number {
  let score = 0;

  // 재현 단계 (40점)
  if (hasReproductionSteps(task.description)) {
    score += 40;
  } else if (hasVagueSteps(task.description)) {
    score += 20;  // 부분 점수
  }

  // 에러 메시지 (30점)
  if (extractErrors(task.description).length > 0) {
    score += 30;
  }

  // 코드 위치 (20점)
  if (extractCodeLocations(task.description).length > 0) {
    score += 20;
  }

  // 기대 동작 (10점)
  if (hasExpectedBehavior(task.description)) {
    score += 10;
  }

  return score;
}
```

### Step 3: LLM 기반 분석
**산출물:**
- [ ] `src/analysis/llm-analyzer.ts` - Claude API 호출
- [ ] Prompt 템플릿 (분석 요청 형식)
- [ ] 응답 파싱 (JSON 구조화)

**Prompt 구조:**
```
Analyze this Asana task for auto-fix workflow:

Task: {task_name}
Description: {task_description}
Comments: {task_comments}

Evaluate:
1. Reproduction clarity (0-10)
2. Error information completeness (0-10)
3. Expected behavior clarity (0-10)

Output JSON:
{
  "reproduction_clarity": 8,
  "error_completeness": 9,
  "expected_behavior_clarity": 7,
  "issue_type": "bug" | "feature_request",
  "missing_info": ["list", "of", "missing"],
  "suggested_component": "editor"
}
```

### Step 4: 코드베이스 탐색
**산출물:**
- [ ] `src/analysis/code-search.ts` - 코드 위치 찾기
- [ ] Grep Tool 호출 (키워드 기반)
- [ ] 파일 랭킹 알고리즘

**랭킹 로직:**
```typescript
function rankFiles(searchResults: GrepResult[], keywords: string[]): CodeLocation[] {
  const fileScores = new Map<string, number>();

  searchResults.forEach(result => {
    const score = keywords.filter(kw => result.content.includes(kw)).length;
    fileScores.set(result.file, (fileScores.get(result.file) || 0) + score);
  });

  return Array.from(fileScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([file, score]) => ({ file, confidence: score / keywords.length }));
}
```

### Step 5: GitHub Issue 템플릿 생성
**산출물:**
- [ ] `src/analysis/issue-template.ts` - 템플릿 생성
- [ ] 섹션별 내용 매핑 (Asana → GitHub)
- [ ] 라벨 자동 생성 (`auto-fix`, `asana`, `bug`, `component:xxx`)

**템플릿 구조:**
```markdown
<!-- AUTO-GENERATED FROM ASANA -->

## Type
- [x] Bug Report
- [ ] Feature Request

## Source
- **Asana Task:** [{task_name}]({task_url})
- **Created:** {created_at}

## Context
- **Files:** {code_files}
- **Component:** {component}
- **Function:** {function_names}

## Problem Description
{task_description}

**Error Message:**
```
{error_message}
```

## Code Analysis
{code_snippet}

## Suggested Fix Direction
{suggested_fix}
```

### Step 6: 실패 이유별 메시지 생성
**산출물:**
- [ ] `src/analysis/failure-messages.ts` - 코멘트 템플릿
- [ ] needs-more-info, cannot-reproduce, unclear-requirement, needs-context 각각의 템플릿

**needs-more-info 템플릿:**
```markdown
🤖 자동 분석 결과, 추가 정보가 필요합니다

다음 정보를 보충해주시면 분석을 다시 시도합니다:

**필수 정보:**
{missing_required}

**선택 정보 (있으면 더 좋음):**
{missing_optional}
```

### Step 7: 통합 분석 파이프라인
**산출물:**
- [ ] `src/analysis/analyze-task.ts` - 메인 분석 함수
- [ ] 단계별 분석 실행 및 결과 통합

**실행 순서:**
1. `get_asana_task` 호출로 상세 정보 조회
2. 휴리스틱 분석 (빠른 판단)
3. 신뢰도 점수 < 70 → 실패 이유 판정 후 종료
4. 코드베이스 탐색
5. LLM 분석 (추가 검증)
6. GitHub Issue 템플릿 생성
7. Asana 업데이트 정보 반환

### Step 8: MCP Tool 등록
**산출물:**
- [ ] `src/mcp/tools/analyze-asana-task.ts` - Tool 정의
- [ ] 파라미터 검증 (Zod)
- [ ] 타임아웃 설정 (최대 60초)

**Tool 스키마:**
```typescript
const schema = z.object({
  task_id: z.string(),
  codebase_path: z.string().default(process.cwd()),
  search_depth: z.number().min(1).max(5).default(3),
  confidence_threshold: z.number().min(0).max(100).default(70),
});
```

## 테스트 전략

### 단위 테스트
- [ ] 휴리스틱 패턴 매칭
  - 에러 메시지 추출 (다양한 형식)
  - 재현 단계 감지 (숫자/불렛 포인트)
- [ ] 신뢰도 점수 계산 (경계값 테스트)
- [ ] 코드 파일 랭킹 알고리즘

### 통합 테스트
- [ ] 명확한 버그 리포트 → "success" + Issue 템플릿
- [ ] 모호한 설명 → "needs-more-info" + 체크리스트
- [ ] 재현 불가 → "cannot-reproduce" + 질문
- [ ] 코드 위치 불명 → "needs-context"

### 테스트 케이스
1. **명확한 버그:**
   ```
   제목: 저장 버튼 클릭 시 에러
   설명:
   재현 단계:
   1. Editor에서 문서 작성
   2. 저장 버튼 클릭
   에러: TypeError: handleSave is not a function
   ```
   - 기대: confidence=90, issue 템플릿 생성, component="editor"

2. **정보 부족:**
   ```
   제목: 앱이 느려요
   설명: 가끔 느립니다.
   ```
   - 기대: confidence=20, "needs-more-info", 체크리스트

3. **재현 불가:**
   ```
   제목: 버그
   설명: 어떤 때는 되고 어떤 때는 안 됨
   ```
   - 기대: confidence=30, "cannot-reproduce", 재현 단계 요청

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| LLM 응답 느림 (30초+) | High | Haiku 사용, 타임아웃 60초, 휴리스틱 우선 |
| 코드베이스 탐색 실패 (파일 못 찾음) | Medium | 실패 시 "needs-context" 반환, 사용자에게 파일 명시 요청 |
| 잘못된 신뢰도 점수 (false positive) | High | 임계값 70점으로 보수적 판단, 로그로 피드백 수집 |
| 다국어 태스크 처리 | Low | LLM은 다국어 지원, 휴리스틱은 영문 중심 (한글 패턴 추가) |
| 이미지 첨부만 있는 태스크 | Medium | Vision API로 이미지 분석 (Phase 2), 현재는 "needs-more-info" |

## 의존성

### 선행 작업
- `asana/get-task` - 태스크 상세 조회
- `common/types` - AnalysisResult, CodeLocation 타입

### 외부 패키지
- `@anthropic-ai/sdk` - Claude API 호출
- `@modelcontextprotocol/sdk` - MCP Tools (Grep, Read)

### 후속 작업
- `github/create-issue` - Issue 생성 Tool (별도 feature)
- `asana/update-task` - 분석 완료 후 태그/코멘트 추가
- Workflow - `/triage` 커맨드에서 이 Tool 사용
