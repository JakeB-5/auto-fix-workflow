---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 10
completed: 0
---

# Code Locator 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|---------|---------|----------|
| 🔴 HIGH | 5 | 10h |
| 🟡 MEDIUM | 3 | 6h |
| 🟢 LOW | 2 | 4h |
| **합계** | **10** | **20h** |

---

### code-locator-task-001: 프로젝트 구조 및 스택트레이스 파서 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
프로젝트 기본 구조를 설정하고 다양한 언어의 스택트레이스를 파싱하는 핵심 엔진을 구현합니다.

#### 완료 조건
- [ ] `src/analyzer/code-locator/` 디렉토리 생성
- [ ] `types.ts` 파일 생성 (`StackFrame`, `ParsedStackTrace`, `CodeLocation`, `CodeSearchResult`)
- [ ] `errors.ts` 파일 생성 (`StackTraceParseError`, `FileNotFoundError`)
- [ ] `StackTraceParser.ts` 클래스 구현
- [ ] JavaScript/TypeScript 파서 구현 (정규식: `at (.+?) \((.+?):(\d+):(\d+)\)`)
- [ ] Python 파서 구현 (정규식: `File "(.+?)", line (\d+), in (.+)`)
- [ ] Java 파서 구현 (정규식: `at (.+?)\.(.+?)\((.+?):(\d+)\)`)
- [ ] 경로 정규화 함수 (절대 경로 → 프로젝트 상대 경로)
- [ ] `parse(stackTrace: string): ParsedStackTrace` 메서드 동작 확인

---

### code-locator-task-002: 파일 탐색 엔진 구현 (점진적 탐색)

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** code-locator-task-001

#### 설명
4단계 점진적 탐색 전략으로 파일을 찾는 엔진을 구현합니다. 정확한 경로 → 파일명 → 패턴 → Grep 순서로 탐색합니다.

#### 완료 조건
- [ ] `FileLocator.ts` 클래스 생성
- [ ] 1단계: `findExactPath(relativePath: string)` 구현
- [ ] 2단계: `findByFilename(filename: string)` 구현 (Glob `**/${filename}`)
- [ ] 3단계: `findByPattern(componentName: string)` 구현 (kebab-case ↔ PascalCase)
- [ ] 4단계: Grep 키워드 검색 fallback
- [ ] 우선순위 정렬 로직 (프로덕션 > 테스트 > 레거시)
- [ ] fast-glob 통합
- [ ] 성능 측정: 대부분 1-2단계에서 해결 확인

---

### code-locator-task-003: 함수/클래스 위치 특정

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** code-locator-task-002

#### 설명
파일 내에서 특정 함수나 클래스 메서드의 정확한 위치와 라인 범위를 추출합니다.

#### 완료 조건
- [ ] `FunctionLocator.ts` 클래스 생성
- [ ] 함수 정의 검색 정규식 (`function ${name}`, `const ${name} =`, `${name}: () =>`)
- [ ] 클래스 메서드 검색 정규식 (`class ${className}` 내부 `${methodName}(`)
- [ ] `getFunctionRange(file: string, functionName: string)` 메서드 구현
- [ ] 라인 범위 추출 로직 (시작/종료 라인)
- [ ] Grep 도구 활용한 빠른 검색
- [ ] JavaScript, TypeScript, Python 함수 패턴 지원
- [ ] 단위 테스트 (각 언어별 함수 정의 패턴)

---

### code-locator-task-004: 컴포넌트 식별 및 라벨 추론

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** code-locator-task-003

#### 설명
디렉토리 구조를 분석하여 컴포넌트를 식별하고 자동으로 라벨을 추론하는 시스템을 구현합니다.

#### 완료 조건
- [ ] `ComponentAnalyzer.ts` 클래스 생성
- [ ] React 컴포넌트 탐지 (export 문 파싱: `export default`, `export { }`)
- [ ] JSX/TSX 파일 확인 로직
- [ ] `inferComponentLabel(filePath: string)` 메서드 구현
- [ ] 디렉토리 기반 규칙 (`src/canvas/core/**` → `component: "canvas-core"`)
- [ ] `component-map.json` 설정 파일 로더 (선택적)
- [ ] Import 분석 (정규식 기반)
- [ ] 기본 규칙 제공 (zero-config)

---

### code-locator-task-005: 텍스트 기반 코드 탐색 및 신뢰도 점수 계산

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** code-locator-task-004

#### 설명
자연어 설명에서 키워드를 추출하여 코드를 찾고, 각 결과에 대한 신뢰도 점수를 계산합니다.

#### 완료 조건
- [ ] `TextSearcher.ts` 클래스 생성
- [ ] `findCodeSnippet(snippet: string)` 메서드 구현
- [ ] 키워드 추출 함수: `extractKeywords(description: string)`
- [ ] `searchByKeywords(keywords: string[])` 메서드 구현
- [ ] 자연어 → 코드 패턴 매핑 ("저장 버튼" → `save`, `SaveButton`, `onSave`)
- [ ] Grep 멀티패턴 검색 최적화
- [ ] `ConfidenceScorer.ts` 클래스 생성
- [ ] 가중치 기반 점수 계산 (스택트레이스 0.6, 함수명 0.2, 라인 번호 0.1, 경로 0.1)
- [ ] `match_reasons` 배열 생성

---

### code-locator-task-006: CodeLocator 메인 통합 클래스

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** code-locator-task-005

#### 설명
모든 탐색기를 조합하여 입력 타입에 따라 적절한 전략을 선택하고 결과를 통합하는 메인 클래스를 구현합니다.

#### 완료 조건
- [ ] `CodeLocator.ts` 메인 클래스 생성
- [ ] `locate(input: LocatorInput): Promise<CodeSearchResult>` 메서드 구현
- [ ] 입력 타입별 분기 로직:
  - 스택트레이스 존재 → StackTraceParser 사용
  - 파일명/함수명만 → FileLocator + FunctionLocator
  - 텍스트 설명만 → TextSearcher
- [ ] 결과 병합 및 중복 제거
- [ ] `is_ambiguous` 플래그 결정 (여러 결과 시)
- [ ] `no_matches` 플래그 결정 (결과 없음 시)
- [ ] 에러 핸들링 및 예외 전파

---

### code-locator-task-007: 단위 테스트 작성 (컴포넌트별)

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** code-locator-task-006

#### 설명
각 탐색 컴포넌트에 대한 독립적인 단위 테스트를 작성하여 정확성을 검증합니다.

#### 완료 조건
- [ ] `StackTraceParser.test.ts` 작성 (언어별 5개 이상 샘플)
- [ ] `FileLocator.test.ts` 작성 (각 단계별 독립 테스트)
- [ ] `FunctionLocator.test.ts` 작성 (함수 범위 추출 테스트)
- [ ] `ComponentAnalyzer.test.ts` 작성 (라벨 추론 케이스)
- [ ] `ConfidenceScorer.test.ts` 작성 (점수 계산 검증)
- [ ] `TextSearcher.test.ts` 작성 (키워드 추출 및 검색)
- [ ] Mock 파일 시스템 fixture 준비
- [ ] 코드 커버리지 > 80% 달성

---

### code-locator-task-008: 통합 테스트 및 실제 프로젝트 검증

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** code-locator-task-007

#### 설명
실제 프로젝트의 스택트레이스와 에러 케이스로 전체 플로우를 검증하고 성능을 측정합니다.

#### 완료 조건
- [ ] `integration.test.ts` 파일 생성
- [ ] React 프로젝트 에러 케이스 테스트
- [ ] Node.js 백엔드 에러 케이스 테스트
- [ ] Python 스크립트 에러 케이스 테스트
- [ ] 경계 케이스 테스트 (파일 없음, 여러 매칭, 함수명 중복)
- [ ] 성능 벤치마크:
  - 스택트레이스 파싱: < 50ms
  - 파일 탐색: < 500ms
  - 전체 locate: < 1초
- [ ] 대규모 프로젝트 시뮬레이션 (1000+ 파일)

---

### code-locator-task-009: 문서화 및 사용 예제 작성

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** code-locator-task-008

#### 설명
API 문서, 사용 예제, 설정 가이드를 작성하여 다른 모듈에서 쉽게 사용할 수 있도록 합니다.

#### 완료 조건
- [ ] `common/types/code-locator.ts` 타입 정의 파일 생성
- [ ] `CodeSearchResult` 인터페이스 문서화
- [ ] JSDoc 주석 추가 (모든 public 메서드)
- [ ] README.md 작성 (사용법, 예제 코드)
- [ ] `component-map.json` 설정 예제
- [ ] 다양한 입력 타입별 사용 예제
- [ ] 트러블슈팅 가이드

---

### code-locator-task-010: 성능 최적화 및 리스크 완화

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** code-locator-task-009

#### 설명
plan.md에서 식별된 성능 리스크를 완화하고 대규모 프로젝트에서의 안정성을 확보합니다.

#### 완료 조건
- [ ] Grep 호출 최소화 로직 검증
- [ ] Grep 결과 캐싱 구현 (선택적)
- [ ] 점진적 탐색 조기 종료 최적화
- [ ] 우선순위 정렬 강화 (동일 파일명 중복 시)
- [ ] 스택트레이스 파싱 실패 시 fallback 로직
- [ ] 라인 번호 불일치 대응 (범위 검색)
- [ ] 메모리 사용량 모니터링 및 최적화
- [ ] 실패 케이스 로깅 시스템 구현
