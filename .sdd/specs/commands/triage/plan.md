---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# /triage 구현 계획

## 기술 결정

### 결정 1: MCP 도구 우선 설계
**선택:** 실제 작업은 모두 MCP 도구에 위임하고, 커맨드는 오케스트레이션만 담당
**근거:**
- MCP 도구는 재사용 가능하고 테스트하기 쉬움
- 커맨드 레이어는 사용자 인터랙션과 플로우 제어에 집중
- 다른 자동화 시스템에서도 동일한 MCP 도구 활용 가능

### 결정 2: AI 분석 도구의 독립성
**선택:** `analyze_asana_task` MCP 도구는 독립적인 AI 에이전트로 구현
**근거:**
- 분석 로직의 복잡성을 캡슐화
- 프롬프트 엔지니어링을 중앙화하여 일관성 보장
- 분석 품질을 독립적으로 개선 가능

### 결정 3: 순차 처리 방식
**선택:** 태스크를 병렬이 아닌 순차적으로 처리
**근거:**
- API rate limit 준수 용이
- 진행 상황 추적 및 에러 핸들링 단순화
- 초기 버전에서는 성능보다 안정성 우선
- 향후 `--parallel` 옵션으로 확장 가능

### 결정 4: 설정 파일 기반 구성
**선택:** YAML 설정 파일 사용, 환경 변수로 오버라이드 가능
**근거:**
- 버전 관리 가능한 설정
- 팀 간 설정 공유 용이
- 민감 정보(토큰)는 환경 변수로 분리
- CLI 파라미터로 런타임 오버라이드 지원

### 결정 5: Dry-run 모드의 완전성
**선택:** Dry-run에서도 전체 분석을 수행하되 write 작업만 스킵
**근거:**
- 사용자가 실제 실행 전 결과를 정확히 예측 가능
- 분석 로직의 버그를 dry-run에서 발견 가능
- 트랜잭션 개념 적용: read는 수행, write는 롤백

### 결정 6: GitHub Issue 템플릿 구조화
**선택:** 고정된 마크다운 템플릿을 MCP 도구 내부에서 관리
**근거:**
- 일관된 Issue 형식 보장
- 자동화 도구(autofix)가 파싱하기 쉬운 구조
- 템플릿 변경은 중앙에서 관리

## 구현 단계

### Step 1: MCP 도구 구현
**산출물:**
- [ ] `list_asana_tasks` MCP 도구
  - 입력: project_id, section, exclude_tags
  - 출력: 필터링된 태스크 목록
  - 에러 처리: API 인증 실패, 네트워크 에러
- [ ] `get_asana_task` MCP 도구
  - 입력: task_id
  - 출력: 태스크 전체 상세 정보 (description, notes, attachments)
  - 캐싱: 동일 task_id에 대해 중복 호출 방지
- [ ] `analyze_asana_task` MCP 도구 (AI 에이전트)
  - 입력: task_id
  - 프롬프트: 재현 단계, 에러 증거, 코드 컨텍스트, 수정 방향 분석 지시
  - 출력: success boolean + github_issue 또는 feedback
  - AI 모델: Claude Sonnet (균형잡힌 성능과 비용)
- [ ] `create_issue` MCP 도구
  - 입력: title, body, labels, asana_task_id
  - 출력: 생성된 Issue 객체 (number, html_url)
  - 메타데이터: asana_task_id를 Issue description에 임베드
- [ ] `update_asana_task` MCP 도구
  - 입력: task_id, tags, comment, section
  - 출력: success boolean
  - 멱등성: 동일 태그 중복 추가 방지

**기술 스택:**
- MCP SDK: TypeScript 기반
- Asana API: Node.js `asana` 공식 SDK
- GitHub API: Octokit
- AI 분석: Anthropic Claude API

### Step 2: 설정 및 유효성 검사
**산출물:**
- [ ] `autofix.config.yml` 스키마 정의
  - asana: workspace_id, project_id, sections, tags
  - github: repository, labels
  - 검증: required 필드 체크
- [ ] 설정 로더 구현
  - YAML 파싱
  - 환경 변수 우선순위 처리
  - CLI 파라미터 오버라이드 처리
- [ ] 시작 시 검증 로직
  - ASANA_TOKEN 존재 여부
  - GitHub PAT 권한 체크 (issues:write)
  - workspace_id, project_id 유효성 검증
  - 명확한 에러 메시지 제공

### Step 3: CLI 파라미터 파싱 및 플로우 제어
**산출물:**
- [ ] 파라미터 파서 구현
  - `--task`, `--all`, `--dry-run`, `--project` 파싱
  - 상호 배타적 옵션 검증 (--task vs --all)
  - 유효하지 않은 조합 에러 처리
- [ ] 모드 결정 로직
  - 모드 타입: single_task | all_tasks | interactive
  - interactive 모드: 태스크 목록 표시 및 선택 UI
- [ ] 인터랙티브 선택 UI
  - 태스크 목록 포맷팅 (번호, 제목, ID, 날짜)
  - 사용자 입력 파싱 ("1,3" → [1, 3])
  - 입력 검증 및 재시도 로직

### Step 4: 태스크 처리 루프
**산출물:**
- [ ] 메인 처리 루프 구현
  - 태스크 순차 반복
  - 진행 상황 표시 ([1/5], [2/5], ...)
  - 단계별 상태 출력 (분석 중, 생성 중, 업데이트 중)
- [ ] 단일 태스크 처리 함수
  - 1. analyze_asana_task 호출
  - 2. success 분기:
    - create_issue (unless dry-run)
    - update_asana_task with "triaged" tag
  - 3. failure 분기:
    - update_asana_task with feedback tag + comment
- [ ] Dry-run 처리
  - write 작업 스킵 플래그
  - [DRY-RUN] 프리픽스 출력
  - 예상 결과 시뮬레이션

### Step 5: 에러 처리 및 재시도
**산출물:**
- [ ] 네트워크 에러 재시도 로직
  - 지수 백오프: 1s, 2s, 4s
  - 최대 3회 재시도
  - 재시도 상태 출력
- [ ] 부분 실패 처리
  - 태스크 실패 시 다음 태스크로 계속 진행
  - 실패 원인 수집 및 최종 리포트에 포함
- [ ] Rate limit 핸들링
  - GitHub/Asana API rate limit 응답 감지
  - 자동 대기 및 재시도
  - 태스크 간 500ms 딜레이 추가
- [ ] 명확한 에러 메시지
  - 에러 카테고리별 메시지 템플릿
  - 해결 방법 제안 포함

### Step 6: 결과 출력 및 요약
**산출물:**
- [ ] 요약 리포트 생성
  - 처리된 태스크 수
  - 성공 (생성된 Issue 목록 + 링크)
  - 실패 (피드백이 필요한 태스크 목록 + 이유)
- [ ] 출력 포맷팅
  - 이모지 및 컬러 사용 (성공: ✅, 실패: ❌, 정보: ℹ️)
  - 구조화된 섹션 (📊, 📤, 💡)
  - 링크 클릭 가능하게 표시
- [ ] Next steps 제안
  - 피드백 태스크가 있으면 Asana에서 정보 보충 안내
  - 생성된 Issue는 /autofix로 자동 수정 가능 안내

### Step 7: 배치 작업 확인
**산출물:**
- [ ] 대량 작업 확인 프롬프트
  - --all 사용 시 5개 초과면 확인 요청
  - 처리될 작업 개수 및 영향 범위 표시
  - y/N 선택으로 진행/취소
- [ ] 확인 스킵 조건
  - --all 플래그 사용
  - CI 환경 감지 시 자동 진행

## 테스트 전략

### 단위 테스트
**범위:**
- [ ] 파라미터 파싱 로직
  - 유효한 조합 테스트
  - 무효한 조합 에러 테스트 (--task + --all)
- [ ] 모드 결정 로직
  - 각 파라미터 조합별 올바른 모드 선택 검증
- [ ] 설정 로더
  - YAML 파싱 성공/실패 케이스
  - 환경 변수 오버라이드 우선순위
  - 필수 필드 누락 검증
- [ ] 에러 메시지 생성
  - 각 에러 카테고리별 메시지 검증

**도구:** Jest + TypeScript

### 통합 테스트
**범위:**
- [ ] MCP 도구 End-to-End
  - Mock Asana API 서버 사용
  - Mock GitHub API 서버 사용
  - 전체 플로우 테스트 (list → analyze → create → update)
- [ ] Dry-run 모드 검증
  - write 작업이 실제로 호출되지 않는지 확인
  - 출력에 [DRY-RUN] 프리픽스 포함 여부
- [ ] 재시도 로직
  - 네트워크 에러 시뮬레이션
  - 재시도 횟수 및 백오프 타이밍 검증
- [ ] 부분 실패 시나리오
  - 일부 태스크 성공, 일부 실패
  - 최종 리포트에 양쪽 모두 포함 확인

**도구:** Jest + nock (HTTP mocking)

### E2E 테스트
**범위:**
- [ ] 실제 Asana Sandbox 프로젝트 사용
- [ ] 실제 GitHub Test 리포지토리 사용
- [ ] 시나리오:
  1. 충분한 정보를 가진 태스크 → Issue 생성 성공
  2. 불충분한 정보 태스크 → 피드백 추가 성공
  3. --dry-run 실행 → 실제 변경 없음
  4. --task 단일 처리 → 특정 태스크만 처리
  5. --all 대량 처리 → 모든 태스크 처리

**도구:** Playwright (CLI 테스트)

### 수동 테스트 체크리스트
- [ ] 인터랙티브 모드에서 태스크 선택
- [ ] 잘못된 입력 시 재시도 프롬프트
- [ ] 대량 작업 확인 프롬프트 (>5 tasks)
- [ ] 생성된 GitHub Issue 템플릿 형식 검증
- [ ] Asana 태스크에 올바른 태그 및 코멘트 추가 확인
- [ ] Rate limit 발생 시 자동 대기 동작 확인
- [ ] 네트워크 에러 시 재시도 동작 확인

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| **AI 분석 품질 불안정** | 높음 | - 분석 품질 기준 문서화<br>- 충분한 샘플로 프롬프트 튜닝<br>- Fallback: 사람이 검토할 수 있도록 피드백 제공 |
| **API Rate Limit 초과** | 중간 | - 태스크 간 500ms 딜레이<br>- Rate limit 헤더 모니터링<br>- 자동 대기 및 재시도 로직 |
| **Asana/GitHub API 변경** | 중간 | - 공식 SDK 사용 (asana, octokit)<br>- API 버전 명시<br>- 에러 핸들링 견고화 |
| **대량 태스크 처리 성능** | 낮음 | - 현재는 순차 처리 (단순하고 안정적)<br>- 향후 --parallel 옵션으로 확장 |
| **환경 설정 누락** | 중간 | - 시작 시 엄격한 검증<br>- 명확한 에러 메시지 및 문서 링크<br>- 설정 예제 제공 |
| **민감 정보 노출** | 높음 | - 토큰은 환경 변수로만 관리<br>- 설정 파일에 토큰 저장 금지<br>- .gitignore에 .env 추가 |
| **GitHub Issue 템플릿 파싱 실패** | 낮음 | - 고정된 템플릿 사용<br>- 템플릿 스키마 검증<br>- autofix 도구와 템플릿 형식 동기화 |

## 의존성

### 외부 의존성
- **Asana API**: v1.0
  - SDK: `asana` npm package (^3.0.0)
  - 인증: Personal Access Token
  - 권한: 태스크 읽기/쓰기, 태그 추가, 코멘트 작성
- **GitHub API**: REST API v3
  - SDK: `@octokit/rest` (^20.0.0)
  - 인증: Personal Access Token (PAT)
  - 권한: `repo` (issues 생성)
- **Anthropic Claude API**: Claude Sonnet
  - SDK: `@anthropic-ai/sdk` (^0.20.0)
  - 인증: API Key
  - 용도: `analyze_asana_task` AI 에이전트

### 내부 의존성
- **MCP SDK**: TypeScript MCP 도구 프레임워크
- **설정 시스템**: `autofix.config.yml` 로더
- **GitHub Issue 템플릿**: auto-fix-workflow.md 섹션 3.1에 정의

### 개발 의존성
- TypeScript 5.x
- Jest 29.x (테스트)
- nock 13.x (HTTP mocking)
- yaml 2.x (설정 파싱)
- zod 3.x (스키마 검증)

### 순서 의존성
**이 커맨드는 다음 작업 전에 완료되어야 함:**
- `/autofix` 커맨드: GitHub Issue가 먼저 생성되어야 autofix 가능

**이 커맨드가 의존하는 선행 작업:**
- MCP 도구 인프라 구축
- autofix.config.yml 스키마 정의
- GitHub Issue 템플릿 확정
