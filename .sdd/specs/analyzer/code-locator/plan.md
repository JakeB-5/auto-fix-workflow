---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Code Locator 구현 계획

## 기술 결정

### 결정 1: 스택트레이스 파싱 라이브러리
**선택:** stacktrace-parser + 커스텀 정규식
**근거:**
- stacktrace-parser: JavaScript/Node.js 스택트레이스 표준 파서
- Python/Java 등 다른 언어는 커스텀 정규식으로 확장
- 경량화: 전체 파서 라이브러리(error-stack-parser) 대비 오버헤드 적음
- 유지보수성: 언어별 패턴 추가 시 정규식만 관리

### 결정 2: 파일 탐색 전략
**선택:** Glob 도구 + 점진적 탐색 (Progressive Search)
**근거:**
- 1단계: 정확한 경로 매칭 (가장 빠름)
- 2단계: 파일명 매칭 (Glob `**/${filename}`)
- 3단계: 패턴 매칭 (kebab-case ↔ PascalCase)
- 4단계: Grep 키워드 검색 (가장 느림)
- 성능: 대부분 1-2단계에서 해결, 3-4단계는 fallback

### 결정 3: 코드 분석 방법
**선택:** 정적 분석 (AST 파싱 없이 정규식 + Grep)
**근거:**
- AST 파싱(babel, typescript-parser)은 대규모 프로젝트에서 느림
- 함수 정의 탐지는 정규식으로 충분 (function, const, class)
- Grep을 활용한 빠른 검색 (ripgrep 엔진)
- 필요 시 향후 AST 파싱으로 업그레이드 가능 (점진적 개선)

### 결정 4: 신뢰도 점수 계산
**선택:** 가중치 기반 점수 시스템 (Weighted Scoring)
**근거:**
```
스택트레이스 정확 매칭: 0.6점
함수명 매칭: 0.2점
라인 번호 매칭: 0.1점
파일 경로 매칭: 0.1점
```
- 스택트레이스가 가장 신뢰도 높음 (직접 증거)
- 함수명은 동일 이름 함수가 여러 곳에 존재 가능
- 라인 번호는 코드 변경으로 불일치 가능

### 결정 5: 컴포넌트 라벨 추론
**선택:** 디렉토리 구조 기반 규칙 (Convention over Configuration)
**근거:**
- 프로젝트마다 디렉토리 구조가 일관적
- `src/canvas/core/**` → `component: "canvas-core"`
- 설정 파일(`component-map.json`)로 커스터마이징 가능
- 기본 규칙 제공으로 zero-config 목표

## 구현 단계

### Step 1: 프로젝트 구조 및 타입 정의
**산출물:**
- [ ] `src/analyzer/code-locator/` 디렉토리 생성
- [ ] `types.ts`: 모든 데이터 타입 정의
  - `StackFrame`, `ParsedStackTrace`
  - `CodeLocation`, `CodeSearchResult`
- [ ] `errors.ts`: 커스텀 에러 클래스
  - `StackTraceParseError`
  - `FileNotFoundError`

### Step 2: 스택트레이스 파서 구현
**산출물:**
- [ ] `StackTraceParser.ts` 클래스
- [ ] JavaScript/TypeScript 파서:
  - 정규식: `at (.+?) \((.+?):(\d+):(\d+)\)`
- [ ] Python 파서:
  - 정규식: `File "(.+?)", line (\d+), in (.+)`
- [ ] Java 파서:
  - 정규식: `at (.+?)\.(.+?)\((.+?):(\d+)\)`
- [ ] 경로 정규화 함수: 절대 경로 → 프로젝트 상대 경로
- [ ] `parse(stackTrace: string): ParsedStackTrace` 메서드

### Step 3: 파일 탐색 엔진
**산출물:**
- [ ] `FileLocator.ts` 클래스
- [ ] 1단계 - 정확한 경로 매칭:
  ```typescript
  findExactPath(relativePath: string): string | null
  ```
- [ ] 2단계 - 파일명 Glob 검색:
  ```typescript
  findByFilename(filename: string): string[]
  ```
- [ ] 3단계 - 패턴 매칭 (case conversion):
  ```typescript
  findByPattern(componentName: string): string[]
  ```
- [ ] 우선순위 정렬: 프로덕션 > 테스트 > 레거시

### Step 4: 함수/클래스 위치 특정
**산출물:**
- [ ] `FunctionLocator.ts` 클래스
- [ ] 함수 정의 검색 정규식:
  - `function ${name}`, `const ${name} =`, `${name}: () =>`
- [ ] 클래스 메서드 검색:
  - `class ${className}` 내부 `${methodName}(`
- [ ] 라인 범위 추출 로직:
  ```typescript
  getFunctionRange(file: string, functionName: string): { start: number, end: number }
  ```
- [ ] Grep 도구 활용한 빠른 검색

### Step 5: 컴포넌트 식별 및 라벨 추론
**산출물:**
- [ ] `ComponentAnalyzer.ts` 클래스
- [ ] React 컴포넌트 탐지:
  - export 문 파싱 (`export default`, `export { }`)
  - JSX/TSX 파일 확인
- [ ] 컴포넌트 라벨 추론 규칙:
  ```typescript
  inferComponentLabel(filePath: string): string | undefined
  ```
- [ ] 설정 파일 로더: `component-map.json` (선택적)
- [ ] Import 분석 (간단한 정규식 기반)

### Step 6: 텍스트 기반 코드 탐색
**산출물:**
- [ ] `TextSearcher.ts` 클래스
- [ ] 코드 스니펫 검색:
  ```typescript
  findCodeSnippet(snippet: string): CodeLocation[]
  ```
- [ ] 키워드 추출 및 검색:
  ```typescript
  extractKeywords(description: string): string[]
  searchByKeywords(keywords: string[]): CodeLocation[]
  ```
- [ ] 자연어 → 코드 패턴 매핑:
  - "저장 버튼" → `save`, `SaveButton`, `onSave`
  - "새 문서" → `createDocument`, `newDocument`
- [ ] Grep 멀티패턴 검색 최적화

### Step 7: 신뢰도 점수 계산 시스템
**산출물:**
- [ ] `ConfidenceScorer.ts` 클래스
- [ ] 점수 계산 로직:
  ```typescript
  calculateConfidence(location: CodeLocation, evidence: Evidence): number
  ```
- [ ] 매칭 근거 수집: `match_reasons` 배열 생성
- [ ] 가중치 상수 정의:
  ```typescript
  const WEIGHTS = {
    STACK_TRACE_EXACT: 0.6,
    FUNCTION_MATCH: 0.2,
    LINE_MATCH: 0.1,
    PATH_MATCH: 0.1
  };
  ```

### Step 8: CodeLocator 메인 통합 클래스
**산출물:**
- [ ] `CodeLocator.ts` - 메인 orchestrator
- [ ] `locate(input: LocatorInput): Promise<CodeSearchResult>` 메서드
- [ ] 입력 타입별 분기:
  - 스택트레이스 있음 → StackTraceParser 사용
  - 파일명/함수명만 → FileLocator + FunctionLocator
  - 텍스트 설명만 → TextSearcher
- [ ] 결과 병합 및 중복 제거
- [ ] `is_ambiguous`, `no_matches` 플래그 결정

### Step 9: 단위 테스트 작성
**산출물:**
- [ ] `StackTraceParser.test.ts` - 각 언어별 파싱 테스트
- [ ] `FileLocator.test.ts` - 파일 탐색 단계별 테스트
- [ ] `FunctionLocator.test.ts` - 함수 범위 추출 테스트
- [ ] `ComponentAnalyzer.test.ts` - 컴포넌트 라벨 추론 테스트
- [ ] `ConfidenceScorer.test.ts` - 점수 계산 검증
- [ ] Mock 파일 시스템 fixture 준비

### Step 10: 통합 테스트 및 실제 프로젝트 검증
**산출물:**
- [ ] `integration.test.ts` - E2E 시나리오
- [ ] 실제 스택트레이스 샘플로 테스트:
  - React 프로젝트 에러
  - Node.js 백엔드 에러
  - Python 스크립트 에러
- [ ] 성능 벤치마크:
  - 스택트레이스 파싱: < 50ms
  - 파일 탐색: < 500ms
  - 전체 locate: < 1초

## 테스트 전략

### 단위 테스트
- **스택트레이스 파싱**: 언어별 5개 이상의 실제 샘플
- **파일 탐색**: 각 단계별 독립 테스트 (정확 매칭, Glob, 패턴)
- **함수 위치**: JavaScript, TypeScript, Python 함수 정의 패턴
- **컴포넌트 라벨**: 다양한 디렉토리 구조 케이스

### 통합 테스트
- Mock 파일 시스템 (memfs 또는 fixture 디렉토리)
- 실제 프로젝트 샘플 데이터 (작은 규모 복제)
- 경계 케이스: 파일 없음, 여러 매칭, 함수명 중복

### 성능 테스트
- 대규모 프로젝트 시뮬레이션 (1000+ 파일)
- Grep 호출 최소화 검증
- 메모리 사용량 모니터링

### 검증 기준
- [ ] 코드 커버리지 > 80%
- [ ] 모든 REQ-001 ~ REQ-007 시나리오 통과
- [ ] 성능 목표 달성 (locate < 1초)

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| 대규모 프로젝트에서 Grep 성능 저하 | 높음 | 점진적 탐색으로 조기 종료, Grep 캐싱, ripgrep 활용 |
| 동일 파일명/함수명 중복으로 모호한 결과 | 중간 | 우선순위 정렬 강화, 신뢰도 점수로 명확화, 사용자 선택 옵션 제공 |
| 스택트레이스 포맷 변화 (언어 버전 업데이트) | 중간 | 정규식 패턴 버전 관리, 파싱 실패 시 fallback 로직 |
| 코드 변경으로 라인 번호 불일치 | 낮음 | 라인 번호는 참고만, 함수명 매칭 우선, 범위 검색으로 보완 |
| 언어별 특이 케이스 처리 누락 | 낮음 | 테스트 케이스 지속 추가, 실패 로깅 및 피드백 루프 |

## 의존성

### 외부 의존성
- **stacktrace-parser** (`stacktrace-parser@^0.1.10`): JS 스택트레이스 파싱
- **fast-glob** (`fast-glob@^3.3.0`): 빠른 파일 검색
- **minimatch** (`minimatch@^9.0.0`): 파일 패턴 매칭

### 내부 의존성
- `common/types`: `CodeLocation`, `ParsedStackTrace` 타입 공유
- Claude Code 도구:
  - **Grep**: 키워드 검색, 함수 정의 탐색
  - **Glob**: 파일 패턴 검색
  - **Read**: 코드 스니펫 추출, 라인 범위 읽기

### 환경 요구사항
- Node.js >= 18.x
- TypeScript >= 5.0
- ripgrep 설치 (Grep 도구 의존성)
- Git repository (프로젝트 루트 탐지)

### 선택적 의존성
- `component-map.json`: 프로젝트별 컴포넌트 라벨 매핑 (없으면 기본 규칙 사용)
