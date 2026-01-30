---
status: draft
created: 2026-01-30
spec: commands/init
plan: commands/init
---

# Tasks: init Command

## Task List

### Phase 1: CLI 기반 구조

- [ ] **TASK-001**: CLI 진입점 생성
  - **상태:** 대기
  - **우선순위:** 🔴 HIGH
  - **파일:** `src/commands/init/index.ts`
  - **내용:** 명령어 등록 및 진입점
  - **의존성:** 없음

- [ ] **TASK-002**: CLI 파서 구현
  - **상태:** 대기
  - **우선순위:** 🔴 HIGH
  - **파일:** `src/commands/init/cli.ts`
  - **내용:** 플래그 파싱 (--non-interactive, --force, --skip-validation, --help)
  - **의존성:** TASK-001

- [ ] **TASK-003**: 도움말 출력 구현
  - **상태:** 대기
  - **우선순위:** 🟡 MEDIUM
  - **파일:** `src/commands/init/cli.ts`
  - **내용:** --help 플래그 처리
  - **의존성:** TASK-002

### Phase 2: 대화형 프롬프트

- [ ] **TASK-004**: 프롬프트 유틸리티 구현
  - **상태:** 대기
  - **우선순위:** 🔴 HIGH
  - **파일:** `src/commands/init/prompts.ts`
  - **내용:** readline 기반 입력 유틸리티
  - **의존성:** 없음

- [ ] **TASK-005**: 토큰 입력 프롬프트
  - **상태:** 대기
  - **우선순위:** 🔴 HIGH
  - **파일:** `src/commands/init/prompts.ts`
  - **내용:** GitHub/Asana 토큰 입력 (마스킹 옵션)
  - **의존성:** TASK-004

- [ ] **TASK-006**: 확인 프롬프트
  - **상태:** 대기
  - **우선순위:** 🟡 MEDIUM
  - **파일:** `src/commands/init/prompts.ts`
  - **내용:** Y/N 확인 프롬프트 (파일 덮어쓰기 확인용)
  - **의존성:** TASK-004

### Phase 3: 설정 파일 생성

- [ ] **TASK-007**: .mcp.json 생성기 구현
  - **상태:** 대기
  - **우선순위:** 🔴 HIGH
  - **파일:** `src/commands/init/generators/mcp-config.ts`
  - **내용:** MCP 설정 파일 생성 (env는 비워둠, 토큰 저장 안함)
  - **의존성:** 없음

- [ ] **TASK-008**: .auto-fix.yaml 생성기 구현
  - **상태:** 대기
  - **우선순위:** 🔴 HIGH
  - **파일:** `src/commands/init/generators/yaml-config.ts`
  - **내용:** YAML 설정 템플릿 생성 (tokens 섹션 포함)
  - **의존성:** 없음

- [ ] **TASK-009**: .gitignore 업데이트 구현
  - **상태:** 대기
  - **우선순위:** 🔴 HIGH
  - **파일:** `src/commands/init/generators/gitignore.ts`
  - **내용:** `.auto-fix.yaml`을 .gitignore에 추가 (중복 방지, 파일 없으면 생성)
  - **의존성:** 없음

- [ ] **TASK-010**: 기존 파일 병합 로직
  - **상태:** 대기
  - **우선순위:** 🟡 MEDIUM
  - **파일:** `src/commands/init/generators/mcp-config.ts`
  - **내용:** 기존 mcpServers 보존하며 병합
  - **의존성:** TASK-007

- [ ] **TASK-011**: 생성기 통합 모듈
  - **상태:** 대기
  - **우선순위:** 🟡 MEDIUM
  - **파일:** `src/commands/init/generators/index.ts`
  - **내용:** 모든 생성기 통합 export
  - **의존성:** TASK-007, TASK-008, TASK-009

### Phase 4: 토큰 검증

- [ ] **TASK-012**: GitHub 토큰 검증 구현
  - **상태:** 대기
  - **우선순위:** 🟡 MEDIUM
  - **파일:** `src/commands/init/validators.ts`
  - **내용:** GET /user API 호출로 토큰 검증
  - **의존성:** 없음

- [ ] **TASK-013**: Asana 토큰 검증 구현
  - **상태:** 대기
  - **우선순위:** 🟡 MEDIUM
  - **파일:** `src/commands/init/validators.ts`
  - **내용:** GET /users/me API 호출로 토큰 검증
  - **의존성:** 없음

- [ ] **TASK-014**: 토큰 형식 검증 (오프라인)
  - **상태:** 대기
  - **우선순위:** 🟡 MEDIUM
  - **파일:** `src/commands/init/validators.ts`
  - **내용:** 토큰 형식 패턴 검증 (github_pat_*, ghp_*, 1/xxx 등)
  - **의존성:** 없음

### Phase 5: 결과 출력

- [ ] **TASK-015**: 결과 출력 포맷터 구현
  - **상태:** 대기
  - **우선순위:** 🟡 MEDIUM
  - **파일:** `src/commands/init/output.ts`
  - **내용:** 생성된 파일 목록, 보안 안내 출력
  - **의존성:** 없음

- [ ] **TASK-016**: 수동 설정 안내 메시지
  - **상태:** 대기
  - **우선순위:** 🟡 MEDIUM
  - **파일:** `src/commands/init/output.ts`
  - **내용:** GitHub/Asana 설정, 라벨 생성, 브랜치 생성 가이드
  - **의존성:** TASK-015

### Phase 6: 테스트

- [ ] **TASK-017**: CLI 파서 테스트
  - **상태:** 대기
  - **우선순위:** 🟡 MEDIUM
  - **파일:** `src/commands/init/__tests__/cli.test.ts`
  - **내용:** 플래그 파싱 테스트
  - **의존성:** TASK-002

- [ ] **TASK-018**: 생성기 테스트
  - **상태:** 대기
  - **우선순위:** 🟡 MEDIUM
  - **파일:** `src/commands/init/__tests__/generators.test.ts`
  - **내용:** 파일 생성/병합 테스트, .gitignore 중복 방지 테스트
  - **의존성:** TASK-007, TASK-008, TASK-009

- [ ] **TASK-019**: 검증기 테스트
  - **상태:** 대기
  - **우선순위:** 🟡 MEDIUM
  - **파일:** `src/commands/init/__tests__/validators.test.ts`
  - **내용:** 토큰 검증 테스트 (mock API)
  - **의존성:** TASK-012, TASK-013, TASK-014

### Phase 7: 통합

- [ ] **TASK-020**: 메인 CLI에 init 명령 등록
  - **상태:** 대기
  - **우선순위:** 🔴 HIGH
  - **파일:** `src/index.ts`
  - **내용:** init 명령어를 메인 CLI에 추가
  - **의존성:** Phase 1-5 완료

### Phase 8: 문서 및 릴리즈

- [ ] **TASK-021**: README 업데이트
  - **상태:** 대기
  - **우선순위:** 🟡 MEDIUM
  - **파일:** `README.md`, `README.ko.md`
  - **내용:** init 명령어 사용법 문서화
  - **의존성:** TASK-020

- [ ] **TASK-022**: SETUP 가이드 업데이트
  - **상태:** 대기
  - **우선순위:** 🟡 MEDIUM
  - **파일:** `docs/SETUP.md`, `docs/SETUP.ko.md`
  - **내용:** init 명령어로 초기 설정하는 방법 추가, 수동 설정 섹션 업데이트
  - **의존성:** TASK-020

- [ ] **TASK-023**: CHANGELOG 업데이트
  - **상태:** 대기
  - **우선순위:** 🟢 LOW
  - **파일:** `CHANGELOG.md`
  - **내용:** init 명령어 추가 기록
  - **의존성:** TASK-020, TASK-021, TASK-022

## Dependencies Graph

```
Phase 1: CLI 기반
TASK-001 (진입점)
    └── TASK-002 (CLI 파서)
        └── TASK-003 (도움말)

Phase 2: 프롬프트
TASK-004 (프롬프트 유틸)
    ├── TASK-005 (토큰 입력)
    └── TASK-006 (확인 프롬프트)

Phase 3: 설정 파일 생성
TASK-007 (mcp-config) ─┐
TASK-008 (yaml-config) ├── TASK-011 (통합)
TASK-009 (gitignore) ──┘
    │
    └── TASK-010 (병합 로직)

Phase 4: 토큰 검증 (병렬 가능)
TASK-012 (GitHub 검증)
TASK-013 (Asana 검증)
TASK-014 (형식 검증)

Phase 5: 결과 출력
TASK-015 (출력 포맷터)
    └── TASK-016 (안내 메시지)

Phase 6: 테스트 (각 Phase 완료 후)
TASK-017 (CLI 테스트)
TASK-018 (생성기 테스트)
TASK-019 (검증기 테스트)

Phase 7-8: 통합 및 문서
TASK-020 (메인 CLI 등록)
    ├── TASK-021 (README)
    ├── TASK-022 (SETUP 가이드)
    └── TASK-023 (CHANGELOG)
```

## Estimation

| Phase | Tasks | Complexity | 비고 |
|-------|-------|------------|------|
| Phase 1 | 3 | 단순 | CLI 기반 |
| Phase 2 | 3 | 중간 | 프롬프트 |
| Phase 3 | 5 | 중간 | 설정 파일 + gitignore |
| Phase 4 | 3 | 중간 | 토큰 검증 |
| Phase 5 | 2 | 단순 | 결과 출력 |
| Phase 6 | 3 | 중간 | 테스트 |
| Phase 7 | 1 | 단순 | 통합 |
| Phase 8 | 3 | 단순 | 문서 |
| **Total** | **23** | - | |

## 병렬 실행 가능 그룹

다음 태스크들은 병렬로 실행 가능:
- **그룹 A:** TASK-001~003 (CLI) + TASK-004~006 (프롬프트) + TASK-007~011 (생성기)
- **그룹 B:** TASK-012~014 (검증기) - 서로 독립적
- **그룹 C:** TASK-017~019 (테스트) - 각 모듈 완료 후
- **그룹 D:** TASK-021~023 (문서) - 통합 완료 후
