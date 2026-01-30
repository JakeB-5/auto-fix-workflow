---
status: draft
created: 2026-01-30
plan: ./plan.md
total_tasks: 8
completed: 0
---

# Update Asana Task 작업 목록

## 요약
| 우선순위 | 작업 수 | 예상 시간 |
|---------|---------|----------|
| 🔴 HIGH | 4 | 8.5h |
| 🟡 MEDIUM | 3 | 5.5h |
| 🟢 LOW | 1 | 2h |

---

### update-task-001: 태그 관리 모듈

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2.5h
- **의존성:** list-tasks-001 (Asana 클라이언트)

#### 설명
태그 추가 로직 및 중복 필터링 구현

#### 완료 조건
- [ ] `src/asana/tag-manager.ts` 파일 생성
- [ ] addTags 함수 구현
- [ ] 기존 태그 조회 및 중복 필터링
- [ ] 새 태그만 API 호출로 추가
- [ ] 태그 추가 결과 반환 (added_tags 배열)
- [ ] 에러 핸들링 (태그 추가 실패)

---

### update-task-002: 태그 생성 및 캐싱

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** update-task-001

#### 설명
태그 자동 생성 및 태그 ID 캐싱 구현

#### 완료 조건
- [ ] findOrCreateTag 함수 구현
- [ ] `/workspaces/{workspace_id}/tags` 조회 API 호출
- [ ] 태그가 없으면 자동 생성 (POST)
- [ ] 태그 캐시 구현 (key: `tag:{workspace_id}:{tag_name}`)
- [ ] TTL 24시간 설정
- [ ] 태그 색상 기본값 설정

---

### update-task-003: Markdown to HTML 변환

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** 없음

#### 설명
코멘트를 Markdown에서 Asana HTML 형식으로 변환

#### 완료 조건
- [ ] `src/asana/markdown-converter.ts` 파일 생성
- [ ] marked 라이브러리 설치 및 설정
- [ ] breaks: true, gfm: true 옵션 설정
- [ ] Asana HTML 래핑 (`<body>...</body>`)
- [ ] 링크 target="_blank" 설정
- [ ] Sanitization 구현
- [ ] 단위 테스트 (링크, 볼드, 리스트, 코드 블록)

---

### update-task-004: 코멘트 추가

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1.5h
- **의존성:** update-task-003

#### 설명
Markdown 코멘트를 HTML로 변환하여 Asana에 추가

#### 완료 조건
- [ ] `/tasks/{task_id}/stories` POST API 호출
- [ ] html_text 파라미터로 변환된 HTML 전송
- [ ] 코멘트 작성 성공 응답 처리
- [ ] 코멘트 작성 실패 에러 처리
- [ ] 작성된 코멘트 ID 반환

---

### update-task-005: 섹션 이동

- **상태:** 대기
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2h
- **의존성:** list-tasks-002 (섹션 캐시)

#### 설명
태스크를 다른 섹션으로 이동

#### 완료 조건
- [ ] moveToSection 함수 구현
- [ ] 섹션 캐시에서 섹션 ID 조회
- [ ] `/tasks/{task_id}/addProject` API 호출
- [ ] project와 section 파라미터 전송
- [ ] 섹션 이동 전/후 정보 반환
- [ ] 잘못된 섹션명 에러 처리

---

### update-task-006: 통합 업데이트 함수

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2.5h
- **의존성:** update-task-001, update-task-004, update-task-005

#### 설명
모든 업데이트 작업을 통합하고 부분 실패 처리

#### 완료 조건
- [ ] `src/asana/update-task.ts` 파일 생성
- [ ] 순차적 업데이트 실행 (태그 → 섹션 → 코멘트)
- [ ] 부분 실패 시에도 계속 실행
- [ ] 각 작업의 성공/실패 기록
- [ ] 최종 결과 집계 (updates, errors 배열)
- [ ] 트랜잭션 로그 (디버깅용)

---

### update-task-007: MCP Tool 등록

- **상태:** 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1.5h
- **의존성:** update-task-006

#### 설명
MCP Tool로 등록하고 파라미터 검증 구현

#### 완료 조건
- [ ] `src/mcp/tools/update-asana-task.ts` 파일 생성
- [ ] Zod 스키마 정의 (task_id, tags, comment, section, completed, assignee)
- [ ] 최소 1개 업데이트 파라미터 필수 검증
- [ ] Tool description 및 예제 작성
- [ ] MCP 서버에 Tool 등록

---

### update-task-008: 통합 테스트 및 문서화

- **상태:** 대기
- **우선순위:** 🟢 LOW
- **예상 시간:** 2h
- **의존성:** update-task-007

#### 설명
통합 테스트 및 멱등성 검증

#### 완료 조건
- [ ] 모든 파라미터 동시 업데이트 테스트
- [ ] 부분 실패 시나리오 테스트 (태그 성공, 섹션 실패)
- [ ] 멱등성 테스트 (같은 요청 2번 → 동일 결과)
- [ ] 중복 태그 케이스 테스트
- [ ] Markdown → HTML XSS 테스트
- [ ] README에 사용 예제 추가
