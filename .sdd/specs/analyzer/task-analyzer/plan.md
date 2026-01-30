---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Task Analyzer 구현 계획

## 기술 결정

### 결정 1: NLP 라이브러리 선택
**선택:** natural.js + 커스텀 키워드 패턴 매칭
**근거:**
- 재현 가능성 판단은 특정 키워드 패턴("When", "Steps to reproduce") 탐지가 핵심
- 과도한 ML 모델 불필요 (오버엔지니어링 방지)
- natural.js의 Tokenizer와 TF-IDF로 텍스트 분석 충분
- 확장성: 향후 OpenAI API 연동으로 전환 가능

### 결정 2: Confidence 점수 계산 방식
**선택:** 규칙 기반 점수 시스템 (Rule-based Scoring)
**근거:**
- 명확한 기준: 재현 단계(40점) + 에러 메시지(30점) + 코드 위치(30점)
- 디버깅 용이성: 점수 계산 과정 추적 가능
- 유지보수성: 각 항목별 가중치 조정 간단
- 투명성: 사용자가 점수 근거 이해 가능

### 결정 3: Asana API 클라이언트
**선택:** Asana 공식 Node.js SDK (asana 패키지)
**근거:**
- 공식 지원으로 API 변경 대응 자동화
- 타입 정의 제공 (TypeScript 친화적)
- Rate limiting 및 재시도 로직 내장
- 인증 처리 표준화

### 결정 4: 정보 충분성 체크리스트 전략
**선택:** 필수/선택 필드 구분 + 타입별 체크리스트
**근거:**
- 버그 리포트: 에러 메시지, 재현 단계 필수
- 기능 요청: 기대 동작, 컨텍스트 필수
- 타입별로 다른 기준 적용으로 유연성 확보
- 확장 가능: 새로운 타입 추가 시 체크리스트만 정의

## 구현 단계

### Step 1: 프로젝트 초기화 및 의존성 설정
**산출물:**
- [ ] `package.json` 생성 (TypeScript, Jest, natural, asana SDK)
- [ ] `tsconfig.json` 설정 (strict mode, ES2020)
- [ ] `.env.example` 파일 (ASANA_ACCESS_TOKEN, ASANA_WORKSPACE_ID)
- [ ] `src/analyzer/task-analyzer/` 디렉토리 구조 생성

### Step 2: Asana API 클라이언트 래퍼 구현
**산출물:**
- [ ] `AsanaClient.ts` - Asana SDK 래퍼
- [ ] 태스크 조회 메서드: `getTask(taskId: string): Promise<AsanaTask>`
- [ ] 섹션별 태스크 조회: `getTasksInSection(sectionId: string): Promise<AsanaTask[]>`
- [ ] 태그 필터링 로직: 제외 태그 목록 적용
- [ ] 에러 타입 정의: `AsanaAPIError`, `TaskNotFoundError`

### Step 3: 재현 가능성 판단 엔진
**산출물:**
- [ ] `ReproducibilityAnalyzer.ts` 클래스
- [ ] 키워드 패턴 매칭 (When, Steps, 재현 단계, 조건 등)
- [ ] 번호 매겨진 리스트 탐지 정규식
- [ ] 조건문 패턴 분석 (`if`, `when`, `만약`)
- [ ] 반환 타입: `"clear" | "partial" | "unclear"`

### Step 4: 정보 충분성 평가 로직
**산출물:**
- [ ] `InformationAnalyzer.ts` 클래스
- [ ] 체크리스트 검증기:
  - [ ] 에러 메시지/스택트레이스 탐지
  - [ ] 발생 조건/재현 단계 탐지
  - [ ] 기대 동작 vs 실제 동작 탐지
  - [ ] 관련 화면/기능 명시 탐지
- [ ] `missing_info` 배열 생성 로직
- [ ] 스크린샷 전용 태스크 탐지

### Step 5: Confidence 레벨 계산 시스템
**산출물:**
- [ ] `ConfidenceCalculator.ts` 클래스
- [ ] 점수 계산 알고리즘 구현:
  ```typescript
  score = 0
  if (재현 단계 명확) score += 40
  if (에러 메시지 존재) score += 30
  if (코드 위치 식별 가능) score += 30
  ```
- [ ] 레벨 매핑: high (>=80), medium (50-79), low (<50)
- [ ] `can_auto_convert` 플래그 결정 로직

### Step 6: 코드 위치 식별 힌트 추출
**산출물:**
- [ ] `CodeLocationHint.ts` - 코드 위치 힌트 추출기
- [ ] 파일명 패턴 추출 (`Editor.tsx`, `SaveButton` 등)
- [ ] 함수명 추출 (camelCase, 동사 패턴)
- [ ] 컴포넌트 이름 추론 (PascalCase 패턴)
- [ ] `identified_files` 배열 생성 (추정)

### Step 7: Asana 액션 생성기
**산출물:**
- [ ] `AsanaActionGenerator.ts` 클래스
- [ ] `low` confidence 시 태그 제안: `["needs-more-info"]`
- [ ] 보충 요청 코멘트 템플릿 생성
- [ ] 누락된 정보별 맞춤 메시지:
  - "에러 메시지를 추가해주세요"
  - "재현 단계를 상세히 기술해주세요"

### Step 8: TaskAnalyzer 메인 클래스 통합
**산출물:**
- [ ] `TaskAnalyzer.ts` - 메인 orchestrator
- [ ] `analyze(taskId: string): Promise<TaskAnalysisResult>` 메서드
- [ ] 각 분석기 조합 및 결과 병합
- [ ] `analyzed_at` 타임스탬프 자동 추가
- [ ] 에러 핸들링 및 예외 전파

### Step 9: 단위 테스트 작성
**산출물:**
- [ ] `ReproducibilityAnalyzer.test.ts` - 재현 가능성 테스트
- [ ] `InformationAnalyzer.test.ts` - 정보 충분성 테스트
- [ ] `ConfidenceCalculator.test.ts` - 점수 계산 테스트
- [ ] `TaskAnalyzer.test.ts` - 통합 테스트
- [ ] Mock Asana API 응답 fixture 생성

### Step 10: 통합 테스트 및 실제 Asana 태스크 검증
**산출물:**
- [ ] `integration.test.ts` - E2E 테스트
- [ ] 실제 Asana 태스크 샘플 3개로 검증:
  - High confidence 케이스
  - Medium confidence 케이스
  - Low confidence 케이스
- [ ] 성능 측정: 태스크당 처리 시간 < 2초

## 테스트 전략

### 단위 테스트
- **재현 가능성 판단**: 10개 이상의 텍스트 패턴 케이스
- **정보 충분성**: 각 체크리스트 항목별 독립 테스트
- **Confidence 계산**: 경계값 테스트 (79점, 80점, 49점, 50점)

### 통합 테스트
- Asana API 모킹 (nock 또는 msw 사용)
- 실제 JSON fixture 기반 시나리오 테스트
- 에러 케이스: API 타임아웃, 인증 실패, 존재하지 않는 태스크

### 검증 기준
- [ ] 코드 커버리지 > 85%
- [ ] 모든 REQ-001 ~ REQ-006 시나리오 통과
- [ ] 타입 에러 0개 (strict TypeScript)

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| Asana API 변경으로 스키마 깨짐 | 높음 | 공식 SDK 사용 + 버전 고정, API 응답 스키마 검증 레이어 추가 |
| 자연어 패턴 탐지 정확도 낮음 | 중간 | 키워드 사전 지속 업데이트, 실패 케이스 로깅 및 분석 |
| 다국어 태스크 처리 실패 | 중간 | 한국어/영어 키워드 병행 탐지, 언어별 패턴 확장 |
| 코드 위치 추정 오류 | 낮음 | code-locator에 위임, task-analyzer는 힌트만 제공 |
| Rate limiting으로 대량 분석 실패 | 낮음 | Asana SDK의 재시도 로직 활용, 배치 처리 시 지연 추가 |

## 의존성

### 외부 의존성
- **Asana SDK** (`asana@^2.0.0`): 태스크 조회 및 업데이트
- **natural** (`natural@^5.0.0`): 텍스트 토큰화 및 키워드 추출
- **dotenv** (`dotenv@^16.0.0`): 환경 변수 관리

### 내부 의존성
- `common/types`: `AsanaTask`, `TaskAnalysisResult` 타입 정의
- `analyzer/code-locator` (약결합): 코드 위치 힌트 검증용 (선택적)

### 환경 요구사항
- Node.js >= 18.x
- TypeScript >= 5.0
- Asana 워크스페이스 접근 권한 및 Personal Access Token
