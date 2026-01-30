---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 8
completed: 0
---

# List Asana Tasks 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|---------|---------|----------|
| 🔴 HIGH | 3 | 6h |
| 🟡 MEDIUM | 4 | 7h |
| 🟢 LOW | 1 | 2h |

---

### list-tasks-001: Asana API 클라이언트 초기화

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
Asana API 클라이언트 싱글톤 생성 및 에러 핸들링 wrapper 구현

#### 완료 조건
- [ ] `src/asana/client.ts` 파일 생성
- [ ] 환경변수 `ASANA_TOKEN` 검증 로직 구현
- [ ] Rate limiting 설정 (150 requests/minute)
- [ ] Exponential backoff 로직 구현 (초기 1초, 최대 30초)
- [ ] Retry 조건 처리 (429, 500, 502, 503, 504)
- [ ] 최대 재시도 3회 설정
- [ ] 에러 핸들링 wrapper 함수 작성

---

### list-tasks-002: 섹션 캐시 구현

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** list-tasks-001

#### 설명
In-memory 캐시 모듈로 섹션 ID → 섹션명 매핑 및 TTL 기반 자동 만료 로직 구현

#### 완료 조건
- [ ] `src/asana/cache.ts` 파일 생성
- [ ] SectionCache 인터페이스 정의
- [ ] get(projectId, sectionName) 메서드 구현
- [ ] invalidate(projectId) 메서드 구현
- [ ] TTL 5분 설정 및 자동 만료 로직
- [ ] 캐시 히트/미스 로깅

---

### list-tasks-003: 태스크 목록 조회 함수

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** list-tasks-001

#### 설명
Asana API를 호출하여 프로젝트의 태스크 목록을 조회하고 필요한 필드만 요청

#### 완료 조건
- [ ] `src/asana/list-tasks.ts` 파일 생성
- [ ] `/projects/{project_id}/tasks` API 호출 구현
- [ ] opt_fields 파라미터 설정 (name, created_at, tags.name, memberships.section.name, assignee.name)
- [ ] API 응답 파싱 및 타입 정의
- [ ] 에러 핸들링 (401, 404 등)

---

### list-tasks-004: 필터링 로직 구현

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** list-tasks-002, list-tasks-003

#### 설명
섹션 필터(API 레벨), 태그 필터(클라이언트 레벨), 특정 태스크 조회 로직 구현

#### 완료 조건
- [ ] 섹션 필터링 구현 (section 파라미터 처리)
- [ ] 섹션 캐시 조회 후 findBySection API 호출
- [ ] 태그 필터링 구현 (클라이언트 레벨)
- [ ] tags 배열의 태그가 없는 태스크만 필터링
- [ ] task_id 파라미터 우선 처리 (다른 필터 무시)
- [ ] 필터링 로직 단위 테스트 작성

---

### list-tasks-005: 응답 포맷팅

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1.5h
- **의존성:** list-tasks-003

#### 설명
일관된 응답 구조 생성 및 데이터 변환 (날짜, 태그 등)

#### 완료 조건
- [ ] 응답 타입 정의 (tasks 배열, total 카운트)
- [ ] 날짜를 ISO 8601 형식으로 변환
- [ ] 태그를 문자열 배열로 변환
- [ ] 섹션명 추출 및 매핑
- [ ] assignee 정보 포맷팅
- [ ] 응답 예제 JSON 작성

---

### list-tasks-006: MCP Tool 등록

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2h
- **의존성:** list-tasks-004, list-tasks-005

#### 설명
MCP Tool로 등록하고 파라미터 검증 스키마 작성

#### 완료 조건
- [ ] `src/mcp/tools/list-asana-tasks.ts` 파일 생성
- [ ] Zod 스키마 정의 (project_id, section, tags, task_id, limit)
- [ ] limit 기본값 100, 최대 500 설정
- [ ] Tool description 작성
- [ ] 사용 예제 작성
- [ ] MCP 서버에 Tool 등록

---

### list-tasks-007: 단위 및 통합 테스트

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1.5h
- **의존성:** list-tasks-006

#### 설명
섹션 캐시, 필터링 로직, 에러 핸들링에 대한 테스트 작성

#### 완료 조건
- [ ] 섹션 캐시 TTL 동작 테스트
- [ ] 태그 필터링 다양한 케이스 테스트
- [ ] 에러 핸들링 테스트 (401, 404, 429, 500)
- [ ] task_id 파라미터 우선순위 테스트
- [ ] Asana API mock 서버 설정
- [ ] Rate limiting 시나리오 테스트

---

### list-tasks-008: 문서화 및 설정 파일

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** list-tasks-007

#### 설명
환경변수 설정 가이드 및 섹션명 설정 파일 작성

#### 완료 조건
- [ ] .env.example에 ASANA_TOKEN 추가
- [ ] config.json에 섹션명 설정 예제 추가
- [ ] README에 Tool 사용법 문서화
- [ ] 에러 메시지 개선 (명확한 가이드 제공)
- [ ] 로그 레벨 설정 및 디버깅 가이드
