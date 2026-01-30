---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 17
completed: 0
---

# /triage 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|----------|---------|-----------|
| 🔴 HIGH  | 7       | 14h       |
| 🟡 MEDIUM| 6       | 12h       |
| 🟢 LOW   | 4       | 8h        |
| **합계** | **17**  | **34h**   |

---

### triage-task-001: Asana MCP 도구 구현 - 조회 기능

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 3h
- **의존성:** 없음

#### 설명
Asana API와 통신하여 태스크를 조회하는 MCP 도구를 구현합니다. `list_asana_tasks`와 `get_asana_task` 두 개의 도구를 포함합니다.

#### 완료 조건
- [ ] `list_asana_tasks` MCP 도구 구현
  - project_id, section, exclude_tags 파라미터 지원
  - 필터링된 태스크 목록 반환
  - API 인증 실패 및 네트워크 에러 처리
- [ ] `get_asana_task` MCP 도구 구현
  - task_id로 태스크 상세 정보 조회
  - description, notes, attachments 포함
  - 동일 task_id에 대한 중복 호출 방지 (캐싱)
- [ ] Asana 공식 SDK 연동 (asana npm package)
- [ ] 단위 테스트 작성 (mock API 사용)

---

### triage-task-002: GitHub MCP 도구 구현 - Issue 생성

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
GitHub API를 사용하여 Issue를 생성하는 MCP 도구를 구현합니다. 템플릿 기반 Issue 생성을 지원합니다.

#### 완료 조건
- [ ] `create_issue` MCP 도구 구현
  - title, body, labels, asana_task_id 파라미터 지원
  - 생성된 Issue 객체 반환 (number, html_url)
  - asana_task_id를 Issue description에 메타데이터로 임베드
- [ ] Octokit SDK 연동
- [ ] GitHub Issue 템플릿 구조 정의 및 문서화
- [ ] 단위 테스트 작성

---

### triage-task-003: Asana MCP 도구 구현 - 업데이트 기능

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** triage-task-001

#### 설명
Asana 태스크를 업데이트하는 MCP 도구를 구현합니다. 태그 추가, 코멘트 작성, 섹션 이동 기능을 포함합니다.

#### 완료 조건
- [ ] `update_asana_task` MCP 도구 구현
  - task_id, tags, comment, section 파라미터 지원
  - success boolean 반환
  - 멱등성 보장 (동일 태그 중복 추가 방지)
- [ ] 태그 관리 로직 구현
- [ ] 코멘트 추가 기능 구현
- [ ] 단위 테스트 작성

---

### triage-task-004: AI 분석 MCP 도구 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 4h
- **의존성:** triage-task-001

#### 설명
Claude AI를 사용하여 Asana 태스크를 분석하고 GitHub Issue 생성 가능 여부를 판단하는 MCP 도구를 구현합니다.

#### 완료 조건
- [ ] `analyze_asana_task` MCP 도구 구현 (AI 에이전트)
  - task_id 파라미터 받아 태스크 정보 조회
  - Claude Sonnet API 호출
  - success boolean + github_issue 또는 feedback 반환
- [ ] 분석 프롬프트 작성
  - 재현 단계 추출 지시
  - 에러 증거 확인 지시
  - 코드 컨텍스트 분석 지시
  - 수정 방향 제안 지시
- [ ] Anthropic Claude SDK 연동
- [ ] 프롬프트 튜닝 및 샘플 테스트 (최소 5개 샘플)
- [ ] 통합 테스트 작성

---

### triage-task-005: 설정 시스템 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
YAML 기반 설정 파일을 로드하고 검증하는 시스템을 구현합니다. 환경 변수 및 CLI 파라미터로 오버라이드 가능합니다.

#### 완료 조건
- [ ] `autofix.config.yml` 스키마 정의 (Zod)
  - asana: workspace_id, project_id, sections, tags
  - github: repository, labels
  - 필수 필드 검증
- [ ] 설정 로더 구현
  - YAML 파싱
  - 환경 변수 우선순위 처리 (ASANA_TOKEN 등)
  - CLI 파라미터 오버라이드 처리
- [ ] 시작 시 검증 로직
  - ASANA_TOKEN 존재 여부
  - GitHub PAT 권한 체크 (issues:write)
  - workspace_id, project_id 유효성 검증
  - 명확한 에러 메시지 제공
- [ ] 단위 테스트 작성

---

### triage-task-006: CLI 파라미터 파싱 및 모드 결정

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
CLI 파라미터를 파싱하고 실행 모드(단일 태스크, 전체, 인터랙티브)를 결정하는 로직을 구현합니다.

#### 완료 조건
- [ ] 파라미터 파서 구현
  - `--task`, `--all`, `--dry-run`, `--project` 파싱
  - 상호 배타적 옵션 검증 (--task vs --all)
  - 유효하지 않은 조합 에러 처리
- [ ] 모드 결정 로직 구현
  - single_task | all_tasks | interactive 모드 구분
- [ ] 도움말 생성 (--help)
- [ ] 단위 테스트 작성 (유효/무효 조합)

---

### triage-task-007: 인터랙티브 선택 UI 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** triage-task-001, triage-task-006

#### 설명
사용자가 처리할 태스크를 선택할 수 있는 인터랙티브 UI를 구현합니다.

#### 완료 조건
- [ ] 태스크 목록 포맷팅
  - 번호, 제목, ID, 날짜 표시
  - 보기 쉬운 테이블 형식
- [ ] 사용자 입력 파싱
  - "1,3,5" 또는 "1-5" 형식 지원
  - 범위 및 개별 선택 조합 가능
- [ ] 입력 검증 및 재시도 로직
- [ ] 수동 테스트 (실제 사용성 확인)

---

### triage-task-008: 태스크 처리 메인 루프 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 3h
- **의존성:** triage-task-001, triage-task-002, triage-task-003, triage-task-004

#### 설명
선택된 태스크를 순차적으로 처리하는 메인 루프를 구현합니다. 각 태스크에 대해 분석, Issue 생성, 업데이트를 수행합니다.

#### 완료 조건
- [ ] 메인 처리 루프 구현
  - 태스크 순차 반복
  - 진행 상황 표시 ([1/5], [2/5], ...)
  - 단계별 상태 출력 (분석 중, 생성 중, 업데이트 중)
- [ ] 단일 태스크 처리 함수 구현
  - analyze_asana_task 호출
  - success 시: create_issue + update_asana_task (triaged 태그)
  - failure 시: update_asana_task (feedback 태그 + 코멘트)
- [ ] 태스크 간 500ms 딜레이 추가 (rate limit 방지)
- [ ] 통합 테스트 작성

---

### triage-task-009: Dry-run 모드 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** triage-task-008

#### 설명
실제 변경 없이 처리 결과를 미리 확인할 수 있는 dry-run 모드를 구현합니다.

#### 완료 조건
- [ ] Dry-run 플래그 처리
  - write 작업 스킵 (create_issue, update_asana_task)
  - read 작업은 정상 수행 (analyze_asana_task)
- [ ] [DRY-RUN] 프리픽스 출력
- [ ] 예상 결과 시뮬레이션 출력
  - "Would create issue: ..."
  - "Would add tag: ..."
- [ ] 통합 테스트 작성 (실제 변경 없음 확인)

---

### triage-task-010: 에러 처리 및 재시도 로직

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 3h
- **의존성:** triage-task-008

#### 설명
네트워크 에러, API rate limit, 부분 실패 등을 처리하는 로직을 구현합니다.

#### 완료 조건
- [ ] 네트워크 에러 재시도 로직
  - 지수 백오프: 1s, 2s, 4s
  - 최대 3회 재시도
  - 재시도 상태 출력
- [ ] 부분 실패 처리
  - 태스크 실패 시 다음 태스크로 계속 진행
  - 실패 원인 수집
- [ ] Rate limit 핸들링
  - GitHub/Asana API rate limit 응답 감지
  - 자동 대기 및 재시도
- [ ] 명확한 에러 메시지
  - 에러 카테고리별 메시지 템플릿
  - 해결 방법 제안 포함
- [ ] 통합 테스트 작성 (에러 시뮬레이션)

---

### triage-task-011: 결과 출력 및 요약 리포트

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** triage-task-008

#### 설명
처리 완료 후 요약 리포트를 생성하고 구조화된 형식으로 출력합니다.

#### 완료 조건
- [ ] 요약 리포트 생성
  - 처리된 태스크 수
  - 성공 (생성된 Issue 목록 + 링크)
  - 실패 (피드백이 필요한 태스크 목록 + 이유)
- [ ] 출력 포맷팅
  - 이모지 및 컬러 사용 (✅, ❌, ℹ️)
  - 구조화된 섹션 (📊, 📤, 💡)
  - 링크 클릭 가능하게 표시
- [ ] Next steps 제안
  - 피드백 태스크 안내
  - /autofix 사용 안내
- [ ] 수동 테스트 (출력 가독성 확인)

---

### triage-task-012: 배치 작업 확인 프롬프트

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1h
- **의존성:** triage-task-006

#### 설명
대량 작업 실행 전 사용자에게 확인을 요청하는 프롬프트를 구현합니다.

#### 완료 조건
- [ ] 대량 작업 확인 프롬프트
  - --all 사용 시 5개 초과면 확인 요청
  - 처리될 작업 개수 및 영향 범위 표시
  - y/N 선택으로 진행/취소
- [ ] 확인 스킵 조건
  - --all 플래그 명시
  - CI 환경 감지 시 자동 진행 (CI=true 환경 변수)
- [ ] 단위 테스트 작성

---

### triage-task-013: 통합 테스트 구축

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 3h
- **의존성:** triage-task-008

#### 설명
Mock API 서버를 사용한 전체 플로우 통합 테스트를 구축합니다.

#### 완료 조건
- [ ] Mock Asana API 서버 구축 (nock 사용)
- [ ] Mock GitHub API 서버 구축 (nock 사용)
- [ ] 전체 플로우 테스트
  - list → analyze → create → update
- [ ] Dry-run 모드 검증
- [ ] 재시도 로직 검증
- [ ] 부분 실패 시나리오 검증

---

### triage-task-014: E2E 테스트 작성

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 3h
- **의존성:** triage-task-013

#### 설명
실제 Asana Sandbox와 GitHub Test 리포지토리를 사용한 E2E 테스트를 작성합니다.

#### 완료 조건
- [ ] Asana Sandbox 프로젝트 준비
- [ ] GitHub Test 리포지토리 준비
- [ ] 시나리오 1: 충분한 정보 태스크 → Issue 생성 성공
- [ ] 시나리오 2: 불충분한 정보 태스크 → 피드백 추가 성공
- [ ] 시나리오 3: --dry-run 실행 → 실제 변경 없음
- [ ] 시나리오 4: --task 단일 처리
- [ ] 시나리오 5: --all 대량 처리

---

### triage-task-015: 수동 테스트 및 사용성 검증

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** triage-task-011

#### 설명
실제 사용 시나리오를 기반으로 수동 테스트를 수행하고 사용성을 검증합니다.

#### 완료 조건
- [ ] 인터랙티브 모드에서 태스크 선택 테스트
- [ ] 잘못된 입력 시 재시도 프롬프트 확인
- [ ] 대량 작업 확인 프롬프트 테스트 (>5 tasks)
- [ ] 생성된 GitHub Issue 템플릿 형식 검증
- [ ] Asana 태스크에 올바른 태그 및 코멘트 추가 확인
- [ ] Rate limit 발생 시 자동 대기 동작 확인
- [ ] 네트워크 에러 시 재시도 동작 확인

---

### triage-task-016: 문서화 및 설정 예제 작성

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** triage-task-005

#### 설명
사용자를 위한 문서와 설정 예제 파일을 작성합니다.

#### 완료 조건
- [ ] autofix.config.yml 예제 파일 작성
- [ ] 환경 변수 설정 가이드 (.env.example)
- [ ] 사용법 문서 작성
  - 기본 사용법
  - 옵션 설명
  - 예제 시나리오
- [ ] 트러블슈팅 가이드
  - 일반적인 에러 및 해결 방법
  - API 권한 설정 방법

---

### triage-task-017: 성능 최적화 및 보안 강화

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 1h
- **의존성:** triage-task-008

#### 설명
성능을 최적화하고 보안을 강화합니다.

#### 완료 조건
- [ ] API 호출 배치 처리 (가능한 경우)
- [ ] 캐싱 전략 최적화
- [ ] 민감 정보 노출 방지
  - 토큰은 환경 변수로만 관리
  - 설정 파일에 토큰 저장 금지 검증
  - .gitignore에 .env 추가 확인
- [ ] 로그에서 민감 정보 마스킹
