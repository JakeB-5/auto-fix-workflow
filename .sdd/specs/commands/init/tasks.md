---
status: draft
created: 2026-01-30
spec: commands/init
plan: commands/init
---

# Tasks: /init Command

## Task List

### Phase 1: CLI 기반 구조

- [ ] **TASK-001**: CLI 진입점 생성
  - 파일: `src/commands/init/index.ts`
  - 내용: 명령어 등록 및 진입점
  - 예상: 단순

- [ ] **TASK-002**: CLI 파서 구현
  - 파일: `src/commands/init/cli.ts`
  - 내용: 플래그 파싱 (--non-interactive, --force, --skip-validation, --help)
  - 예상: 단순

- [ ] **TASK-003**: 도움말 출력 구현
  - 파일: `src/commands/init/cli.ts`
  - 내용: --help 플래그 처리
  - 예상: 단순

### Phase 2: 대화형 프롬프트

- [ ] **TASK-004**: 프롬프트 유틸리티 구현
  - 파일: `src/commands/init/prompts.ts`
  - 내용: readline 기반 입력 유틸리티
  - 예상: 중간

- [ ] **TASK-005**: 토큰 입력 프롬프트
  - 파일: `src/commands/init/prompts.ts`
  - 내용: GitHub/Asana 토큰 입력 (마스킹 옵션)
  - 예상: 중간

- [ ] **TASK-006**: 확인 프롬프트
  - 파일: `src/commands/init/prompts.ts`
  - 내용: Y/N 확인 프롬프트
  - 예상: 단순

### Phase 3: 설정 파일 생성

- [ ] **TASK-007**: .mcp.json 생성기 구현
  - 파일: `src/commands/init/generators/mcp-config.ts`
  - 내용: MCP 설정 파일 생성/업데이트
  - 예상: 중간

- [ ] **TASK-008**: .auto-fix.yaml 생성기 구현
  - 파일: `src/commands/init/generators/yaml-config.ts`
  - 내용: YAML 설정 템플릿 생성
  - 예상: 중간

- [ ] **TASK-009**: 기존 파일 병합 로직
  - 파일: `src/commands/init/generators/mcp-config.ts`
  - 내용: 기존 mcpServers 보존하며 병합
  - 예상: 중간

### Phase 4: 토큰 검증

- [ ] **TASK-010**: GitHub 토큰 검증 구현
  - 파일: `src/commands/init/validators.ts`
  - 내용: GET /user API 호출로 토큰 검증
  - 예상: 중간

- [ ] **TASK-011**: Asana 토큰 검증 구현
  - 파일: `src/commands/init/validators.ts`
  - 내용: GET /users/me API 호출로 토큰 검증
  - 예상: 중간

- [ ] **TASK-012**: 토큰 형식 검증 (오프라인)
  - 파일: `src/commands/init/validators.ts`
  - 내용: 토큰 형식 패턴 검증 (github_pat_*, 1/xxx 등)
  - 예상: 단순

### Phase 5: 결과 출력

- [ ] **TASK-013**: 결과 출력 포맷터 구현
  - 파일: `src/commands/init/output.ts`
  - 내용: 생성된 파일, 수동 설정 항목 출력
  - 예상: 중간

- [ ] **TASK-014**: 안내 메시지 작성
  - 파일: `src/commands/init/output.ts`
  - 내용: Asana ID 확인 방법, 라벨 생성 등 가이드
  - 예상: 단순

### Phase 6: 테스트

- [ ] **TASK-015**: CLI 파서 테스트
  - 파일: `src/commands/init/__tests__/cli.test.ts`
  - 내용: 플래그 파싱 테스트
  - 예상: 단순

- [ ] **TASK-016**: 생성기 테스트
  - 파일: `src/commands/init/__tests__/generators.test.ts`
  - 내용: 파일 생성/병합 테스트
  - 예상: 중간

- [ ] **TASK-017**: 검증기 테스트
  - 파일: `src/commands/init/__tests__/validators.test.ts`
  - 내용: 토큰 검증 테스트 (mock API)
  - 예상: 중간

### Phase 7: 통합

- [ ] **TASK-018**: 메인 CLI에 init 명령 등록
  - 파일: `src/index.ts`
  - 내용: init 명령어를 메인 CLI에 추가
  - 예상: 단순

- [ ] **TASK-019**: README 업데이트
  - 파일: `README.md`, `README.ko.md`
  - 내용: init 명령어 문서화
  - 예상: 단순

## Dependencies Graph

```
TASK-001 (진입점)
    └── TASK-002 (CLI 파서)
        └── TASK-003 (도움말)

TASK-004 (프롬프트 유틸)
    ├── TASK-005 (토큰 입력)
    └── TASK-006 (확인 프롬프트)

TASK-007 (mcp-config)
    └── TASK-009 (병합 로직)

TASK-010, TASK-011 (API 검증)
    └── TASK-012 (형식 검증)

TASK-013 (출력 포맷터)
    └── TASK-014 (안내 메시지)

전체 통합:
    TASK-018 (메인 CLI 등록)
        └── TASK-019 (문서 업데이트)
```

## Estimation

| Phase | Tasks | Complexity |
|-------|-------|------------|
| Phase 1 | 3 | 단순 |
| Phase 2 | 3 | 중간 |
| Phase 3 | 3 | 중간 |
| Phase 4 | 3 | 중간 |
| Phase 5 | 2 | 단순 |
| Phase 6 | 3 | 중간 |
| Phase 7 | 2 | 단순 |
| **Total** | **19** | - |
