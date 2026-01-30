---
status: draft
created: 2026-01-30
spec: commands/init
---

# Implementation Plan: /init Command

## 1. Overview

init 명령어는 auto-fix-workflow를 프로젝트에 설정하는 CLI 도구입니다.

## 2. Architecture

```
src/commands/init/
├── index.ts           # 명령어 진입점
├── cli.ts             # CLI 파서 및 인터페이스
├── prompts.ts         # 대화형 프롬프트
├── validators.ts      # 토큰 검증 로직
├── generators/
│   ├── mcp-config.ts  # .mcp.json 생성
│   └── yaml-config.ts # .auto-fix.yaml 생성
├── output.ts          # 결과 출력 포맷팅
└── __tests__/
    ├── cli.test.ts
    ├── validators.test.ts
    └── generators.test.ts
```

## 3. Dependencies

### Internal
- `common/config-loader`: 기존 설정 파일 읽기

### External
- `readline`: Node.js 내장 (대화형 입력)
- `@octokit/rest`: GitHub API 검증 (기존 의존성)
- `node-fetch` 또는 내장 fetch: Asana API 검증

## 4. Implementation Steps

### Phase 1: CLI 기반 구조
1. CLI 파서 구현 (`cli.ts`)
2. 도움말 출력 기능
3. 플래그 파싱 (--non-interactive, --force, --skip-validation)

### Phase 2: 대화형 프롬프트
1. readline 기반 프롬프트 유틸리티
2. 토큰 입력 (마스킹 처리)
3. 확인 프롬프트 (Y/N)

### Phase 3: 설정 파일 생성
1. `.mcp.json` 생성/업데이트
2. `.auto-fix.yaml` 템플릿 생성
3. 기존 파일 병합 로직

### Phase 4: 토큰 검증
1. GitHub 토큰 검증 (GET /user)
2. Asana 토큰 검증 (GET /users/me)
3. 오프라인 폴백 (형식 검증만)

### Phase 5: 결과 출력
1. 생성된 파일 목록
2. 수동 설정 항목 안내
3. 다음 단계 가이드

## 5. Key Decisions

### 토큰 저장 위치
- **선택**: `.mcp.json`의 env 필드에 저장
- **이유**: MCP 표준 형식 준수, Claude Desktop과 호환

### 기존 파일 처리
- **선택**: 병합 (mcpServers에 추가)
- **이유**: 다른 MCP 서버 설정 보존

### 검증 실패 시
- **선택**: 경고 후 계속 진행 가능
- **이유**: 네트워크 문제로 설정이 막히면 안됨

## 6. Testing Strategy

### Unit Tests
- CLI 파서 테스트
- 파일 생성 로직 테스트
- 토큰 형식 검증 테스트

### Integration Tests
- 전체 flow 테스트 (mock API)
- 기존 파일 병합 테스트

### Manual Tests
- 실제 토큰으로 검증 테스트
- 다양한 환경에서 실행 테스트

## 7. Rollout Plan

1. 기본 구현 및 테스트
2. 문서 업데이트 (README, SETUP.md)
3. v0.2.0 릴리즈에 포함
