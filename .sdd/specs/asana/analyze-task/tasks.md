---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 9
completed: 0
---

# Analyze Asana Task 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|---------|---------|----------|
| 🔴 HIGH | 5 | 11h |
| 🟡 MEDIUM | 3 | 6h |
| 🟢 LOW | 1 | 2h |

---

### analyze-task-001: 휴리스틱 분석 모듈

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2.5h
- **의존성:** 없음

#### 설명
규칙 기반 패턴 매칭으로 빠른 초기 분석 수행

#### 설명
재현 단계, 에러 메시지, 파일명/함수명을 정규식으로 추출

#### 완료 조건
- [ ] `src/analysis/heuristics.ts` 파일 생성
- [ ] 재현 단계 감지 패턴 구현 (숫자 나열, "단계", "steps" 키워드)
- [ ] 에러 메시지 추출 정규식 (Error:, TypeError, 스택 트레이스)
- [ ] 파일명 추출 패턴 (.ts, .tsx, .js, .jsx)
- [ ] 함수명 추출 패턴 (camelCase)
- [ ] 기대 동작 감지 ("should", "expected", "기대" 키워드)
- [ ] 단위 테스트 작성 (다양한 입력 패턴)

---

### analyze-task-002: 신뢰도 점수 산출

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** analyze-task-001

#### 설명
가중치 기반 점수 시스템으로 분석 가능 여부 판단

#### 완료 조건
- [ ] `src/analysis/scoring.ts` 파일 생성
- [ ] calculateConfidence 함수 구현
- [ ] 재현 단계 명확성: 40점 (부분 점수 20점)
- [ ] 에러 메시지 존재: 30점
- [ ] 코드 위치 특정: 20점
- [ ] 기대 동작 명시: 10점
- [ ] 70점 미만 시 실패 이유 판정 로직
- [ ] 경계값 테스트 (69점, 70점, 100점)

---

### analyze-task-003: LLM 기반 분석

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 3h
- **의존성:** analyze-task-002

#### 설명
Claude API로 자연어 이해 기반 추가 검증 및 분석

#### 완료 조건
- [ ] `src/analysis/llm-analyzer.ts` 파일 생성
- [ ] Claude API 클라이언트 초기화 (Haiku 기본, Sonnet 옵션)
- [ ] Prompt 템플릿 작성 (재현 명확도, 에러 완성도, 기대 동작)
- [ ] JSON 응답 파싱 (reproduction_clarity, error_completeness, expected_behavior_clarity)
- [ ] issue_type 판정 (bug, feature_request)
- [ ] missing_info 배열 추출
- [ ] suggested_component 추출
- [ ] 타임아웃 60초 설정
- [ ] API 에러 핸들링

---

### analyze-task-004: 코드베이스 탐색

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2.5h
- **의존성:** analyze-task-001

#### 설명
키워드 추출 → Grep → 파일 랭킹 알고리즘 구현

#### 완료 조건
- [ ] `src/analysis/code-search.ts` 파일 생성
- [ ] 에러 메시지에서 키워드 추출 로직
- [ ] MCP Grep Tool 호출 (키워드 기반 검색)
- [ ] 파일 랭킹 알고리즘 구현 (키워드 매칭 빈도)
- [ ] 최대 5개 파일 반환
- [ ] 파일별 신뢰도 점수 계산
- [ ] CodeLocation 타입 정의 (file, confidence)

---

### analyze-task-005: GitHub Issue 템플릿 생성

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** analyze-task-003, analyze-task-004

#### 설명
구조화된 GitHub Issue 템플릿 생성

#### 완료 조건
- [ ] `src/analysis/issue-template.ts` 파일 생성
- [ ] 템플릿 구조 정의 (Type, Source, Context, Problem, Code Analysis, Suggested Fix)
- [ ] Asana → GitHub 섹션 매핑 로직
- [ ] 코드 스니펫 자동 삽입
- [ ] 라벨 자동 생성 (auto-fix, asana, bug, component:xxx)
- [ ] Asana 태스크 URL 링크
- [ ] Markdown 포맷팅

---

### analyze-task-006: 실패 이유별 메시지 생성

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** analyze-task-002

#### 설명
분석 실패 시 사용자 친화적인 가이드 메시지 작성

#### 완료 조건
- [ ] `src/analysis/failure-messages.ts` 파일 생성
- [ ] needs-more-info 템플릿 (필수 정보, 선택 정보 체크리스트)
- [ ] cannot-reproduce 템플릿 (재현 단계 요청)
- [ ] unclear-requirement 템플릿 (기대 동작 요청)
- [ ] needs-context 템플릿 (코드 위치 요청)
- [ ] 템플릿에 Markdown 이모지 추가
- [ ] 각 실패 타입별 예제 작성

---

### analyze-task-007: 통합 분석 파이프라인

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 3h
- **의존성:** analyze-task-003, analyze-task-004, analyze-task-005, analyze-task-006

#### 설명
모든 분석 단계를 통합하고 순차 실행

#### 완료 조건
- [ ] `src/analysis/analyze-task.ts` 파일 생성
- [ ] get_asana_task Tool 호출
- [ ] 휴리스틱 분석 실행
- [ ] 신뢰도 점수 < 70 시 실패 이유 판정 및 조기 종료
- [ ] 코드베이스 탐색 실행
- [ ] LLM 분석 실행 (추가 검증)
- [ ] GitHub Issue 템플릿 생성
- [ ] Asana 업데이트 정보 반환 (tags, comment)
- [ ] 전체 파이프라인 타임아웃 120초

---

### analyze-task-008: MCP Tool 등록

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** analyze-task-007

#### 설명
MCP Tool로 등록하고 파라미터 검증

#### 완료 조건
- [ ] `src/mcp/tools/analyze-asana-task.ts` 파일 생성
- [ ] Zod 스키마 정의 (task_id, codebase_path, search_depth, confidence_threshold)
- [ ] 기본값 설정 (codebase_path=cwd, search_depth=3, threshold=70)
- [ ] 타임아웃 60초 설정
- [ ] Tool description 및 사용 예제
- [ ] MCP 서버에 Tool 등록

---

### analyze-task-009: 통합 테스트 및 문서화

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** analyze-task-008

#### 설명
다양한 시나리오 테스트 및 문서 작성

#### 완료 조건
- [ ] 명확한 버그 리포트 테스트 (confidence=90+, Issue 생성)
- [ ] 모호한 설명 테스트 (needs-more-info 반환)
- [ ] 재현 불가 테스트 (cannot-reproduce 반환)
- [ ] 코드 위치 불명 테스트 (needs-context 반환)
- [ ] LLM API 실패 시 fallback 테스트
- [ ] 타임아웃 시나리오 테스트
- [ ] README에 분석 결과 예제 추가
- [ ] 신뢰도 점수 조정 가이드 작성
