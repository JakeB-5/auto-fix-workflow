---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 10
completed: 0
---

# Task Analyzer 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|---------|---------|----------|
| 🔴 HIGH | 4 | 8h |
| 🟡 MEDIUM | 4 | 8h |
| 🟢 LOW | 2 | 4h |
| **합계** | **10** | **20h** |

---

### task-analyzer-task-001: 프로젝트 초기화 및 Asana 클라이언트 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
프로젝트 구조 설정 및 Asana API 통신을 위한 기본 인프라를 구축합니다. TypeScript 환경 설정, 필요한 의존성 설치, Asana SDK 래퍼 클래스를 구현합니다.

#### 완료 조건
- [ ] `package.json` 생성 (natural, asana SDK, TypeScript, Jest 포함)
- [ ] `tsconfig.json` 설정 (strict mode, ES2020)
- [ ] `.env.example` 파일 생성 (ASANA_ACCESS_TOKEN, ASANA_WORKSPACE_ID)
- [ ] `src/analyzer/task-analyzer/` 디렉토리 구조 생성
- [ ] `AsanaClient.ts` 클래스 구현
- [ ] `getTask(taskId: string)` 메서드 동작 확인
- [ ] `getTasksInSection(sectionId: string)` 메서드 동작 확인
- [ ] 에러 타입 정의 (`AsanaAPIError`, `TaskNotFoundError`)
- [ ] 태그 필터링 로직 구현

---

### task-analyzer-task-002: 재현 가능성 판단 엔진 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** task-analyzer-task-001

#### 설명
태스크 설명에서 재현 가능성을 판단하는 NLP 기반 분석기를 구현합니다. 키워드 패턴 매칭과 구조 분석을 통해 "clear", "partial", "unclear" 판정을 내립니다.

#### 완료 조건
- [ ] `ReproducibilityAnalyzer.ts` 클래스 생성
- [ ] 재현 단계 키워드 패턴 정의 (When, Steps, 재현, 조건 등)
- [ ] 번호 매겨진 리스트 탐지 정규식 구현
- [ ] 조건문 패턴 분석 (`if`, `when`, `만약`)
- [ ] natural.js Tokenizer 통합
- [ ] 반환 타입: `"clear" | "partial" | "unclear"`
- [ ] 한국어/영어 키워드 병행 탐지
- [ ] 단위 테스트 10개 이상 작성

---

### task-analyzer-task-003: 정보 충분성 평가 및 Confidence 계산

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** task-analyzer-task-002

#### 설명
태스크에 필요한 정보가 충분한지 체크리스트 기반으로 평가하고, 규칙 기반 점수 시스템으로 Confidence 레벨을 계산합니다.

#### 완료 조건
- [ ] `InformationAnalyzer.ts` 클래스 구현
- [ ] 체크리스트 검증 로직 (에러 메시지, 재현 단계, 기대 동작, 관련 화면)
- [ ] `missing_info` 배열 생성
- [ ] 스크린샷 전용 태스크 탐지
- [ ] `ConfidenceCalculator.ts` 클래스 구현
- [ ] 점수 계산 알고리즘 (재현 단계 40점, 에러 메시지 30점, 코드 위치 30점)
- [ ] 레벨 매핑 (high >= 80, medium 50-79, low < 50)
- [ ] `can_auto_convert` 플래그 결정 로직
- [ ] 경계값 테스트 (79, 80, 49, 50점)

---

### task-analyzer-task-004: 코드 위치 힌트 추출 및 Asana 액션 생성

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** task-analyzer-task-003

#### 설명
태스크 설명에서 파일명, 함수명, 컴포넌트 이름 등의 코드 위치 힌트를 추출하고, low confidence 태스크에 대한 Asana 액션(태그, 코멘트)을 생성합니다.

#### 완료 조건
- [ ] `CodeLocationHint.ts` 클래스 구현
- [ ] 파일명 패턴 추출 정규식 (`.tsx`, `.ts`, `.js` 등)
- [ ] 함수명 추출 (camelCase, 동사 패턴)
- [ ] 컴포넌트 이름 추론 (PascalCase 패턴)
- [ ] `identified_files` 배열 생성
- [ ] `AsanaActionGenerator.ts` 클래스 구현
- [ ] `low` confidence 시 `needs-more-info` 태그 제안
- [ ] 보충 요청 코멘트 템플릿 생성
- [ ] 누락 정보별 맞춤 메시지 구현

---

### task-analyzer-task-005: TaskAnalyzer 메인 클래스 통합

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** task-analyzer-task-004

#### 설명
모든 분석기를 조합하여 완전한 태스크 분석 결과를 생성하는 메인 orchestrator를 구현합니다.

#### 완료 조건
- [ ] `TaskAnalyzer.ts` 메인 클래스 생성
- [ ] `analyze(taskId: string): Promise<TaskAnalysisResult>` 메서드 구현
- [ ] 각 분석기 조합 및 결과 병합 로직
- [ ] `analyzed_at` 타임스탬프 자동 추가
- [ ] 에러 핸들링 및 예외 전파
- [ ] 타입 정의: `TaskAnalysisResult`
- [ ] Asana 태스크 조회 실패 처리
- [ ] 통합 플로우 단위 테스트

---

### task-analyzer-task-006: 단위 테스트 작성 (분석기별)

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** task-analyzer-task-005

#### 설명
각 분석기 클래스에 대한 독립적인 단위 테스트를 작성하여 로직의 정확성을 검증합니다.

#### 완료 조건
- [ ] `ReproducibilityAnalyzer.test.ts` 작성 (10개 이상의 패턴 케이스)
- [ ] `InformationAnalyzer.test.ts` 작성 (체크리스트 항목별 테스트)
- [ ] `ConfidenceCalculator.test.ts` 작성 (경계값 테스트)
- [ ] `CodeLocationHint.test.ts` 작성 (파일명, 함수명 추출)
- [ ] `AsanaActionGenerator.test.ts` 작성 (액션 생성 로직)
- [ ] Mock Asana API 응답 fixture 준비
- [ ] 코드 커버리지 > 85% 달성

---

### task-analyzer-task-007: 통합 테스트 및 E2E 검증

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** task-analyzer-task-006

#### 설명
실제 Asana 태스크 샘플을 사용하여 전체 분석 플로우를 검증하고 성능을 측정합니다.

#### 완료 조건
- [ ] `integration.test.ts` 파일 생성
- [ ] High confidence 케이스 테스트
- [ ] Medium confidence 케이스 테스트
- [ ] Low confidence 케이스 테스트
- [ ] Asana API 모킹 (nock 또는 msw)
- [ ] 실제 JSON fixture 기반 시나리오
- [ ] 성능 측정: 태스크당 < 2초
- [ ] 에러 케이스: API 타임아웃, 인증 실패, 존재하지 않는 태스크

---

### task-analyzer-task-008: 타입 정의 및 문서화

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** task-analyzer-task-007

#### 설명
모든 타입 정의를 정리하고 API 문서 및 사용 예제를 작성합니다.

#### 완료 조건
- [ ] `common/types/task-analyzer.ts` 타입 정의 파일 생성
- [ ] `TaskAnalysisResult` 인터페이스 문서화
- [ ] `AsanaTask` 타입 정의
- [ ] JSDoc 주석 추가 (모든 public 메서드)
- [ ] README.md 작성 (사용법, 예제 코드)
- [ ] 환경 변수 설정 가이드
- [ ] 타입 에러 0개 (strict TypeScript)

---

### task-analyzer-task-009: 실제 Asana 워크스페이스 연동 테스트

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** task-analyzer-task-008

#### 설명
실제 Asana 워크스페이스와 연동하여 전체 플로우를 검증하고 리얼 케이스에서의 정확도를 확인합니다.

#### 완료 조건
- [ ] 실제 Asana PAT 발급 및 설정
- [ ] 테스트 워크스페이스/프로젝트 생성
- [ ] 다양한 유형의 태스크 3개 이상 생성
- [ ] 각 태스크에 대한 분석 실행
- [ ] 결과 정확도 수동 검증
- [ ] 성능 측정 및 로깅
- [ ] 문제점 및 개선 사항 문서화

---

### task-analyzer-task-010: 리스크 완화 및 최적화

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** task-analyzer-task-009

#### 설명
plan.md에서 식별된 리스크를 완화하고 성능 최적화를 수행합니다.

#### 완료 조건
- [ ] Asana API 응답 스키마 검증 레이어 추가
- [ ] 실패 케이스 로깅 시스템 구현
- [ ] 다국어 태스크 처리 테스트 (한국어, 영어)
- [ ] Rate limiting 재시도 로직 검증
- [ ] 배치 처리 시 지연 추가 (필요 시)
- [ ] 키워드 사전 업데이트 메커니즘 구현
- [ ] 성능 프로파일링 및 병목 지점 개선
- [ ] 에러 복구 전략 문서화
