# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 필수 참조 문서

작업 전 반드시 `.sdd/constitution.md`를 읽고 프로젝트 원칙을 숙지할 것.

## 언어 규칙

- **소통 언어**: 한글
- **문서 작성**: 한글
- **코드 주석**: 영어
- **커밋 메시지**: 영어

## 프로젝트 개요

GitHub Issue에 등록된 버그, 에러, 간단한 기능 요청을 Claude Code가 자동으로 분석하고 수정하여 PR을 생성하는 MCP 서버 기반 워크플로우.

### 핵심 특징

- **다중 프로젝트 지원**: MCP 서버로 구현하여 여러 프로젝트에서 재사용
- **완전 자율 수정**: 분석 → 수정 → 테스트 → PR 생성까지 자동
- **병렬 처리**: Git Worktree를 활용한 동시 다중 이슈 처리
- **유사 이슈 그룹핑**: 같은 컴포넌트 관련 이슈를 함께 처리

### 이슈 소스

| 소스 | 트리거 | 조건 |
|------|--------|------|
| Sentry | 자동 | N회 이상 발생 AND 특정 심각도 이상 |
| Asana | 수동 (`/triage`) | 에이전트가 분석 후 GitHub Issue 자동 생성 |
| GitHub | 직접 | 수동 생성된 Issue |

## 아키텍처

### 브랜치 전략

```
main ◀─────────────── (수동 머지)
  └── autofixing ◀─── (PR 타겟)
        ├── fix/issue-123
        ├── fix/issue-124-125 (그룹)
        └── fix/issue-126
```

### MCP 서버 Tool 구조

| 도메인 | Tool | 설명 |
|--------|------|------|
| GitHub | `list_issues`, `get_issue`, `update_issue`, `create_issue`, `create_pr` | 이슈/PR 관리 |
| Asana | `list_asana_tasks`, `get_asana_task`, `update_asana_task`, `analyze_asana_task` | 태스크 분석 |
| Git | `manage_worktree`, `run_checks`, `group_issues` | Worktree 관리 |

### 프로젝트 구조 (예상)

```
autofix-mcp-server/
├── src/
│   ├── index.ts              # MCP 서버 엔트리
│   ├── tools/
│   │   ├── github/           # GitHub API Tool
│   │   ├── asana/            # Asana API Tool
│   │   └── git/              # Git/Worktree Tool
│   ├── services/             # API 래퍼
│   ├── analyzers/            # 태스크 분석/코드 탐색
│   └── types/
└── autofix.config.yml        # 프로젝트별 설정
```

## 기술 스택

- Runtime: Node.js 20+
- Language: TypeScript
- Framework: MCP SDK
- Dependencies: `@octokit/rest`, `simple-git`, `zod`

## SDD 워크플로우

이 프로젝트는 Spec-Driven Development(SDD)를 따릅니다.

### 핵심 규칙

- 모든 기능은 스펙 문서가 먼저 작성되어야 한다(SHALL)
- 스펙은 RFC 2119 키워드를 사용해야 한다(SHALL)
- 모든 요구사항은 GIVEN-WHEN-THEN 시나리오를 포함해야 한다(SHALL)
- 테스트 커버리지: 80% 이상(SHOULD)

### 주요 커맨드

| 명령어 | 설명 |
|--------|------|
| `/sdd.new <feature>` | 신규 스펙 생성 |
| `/sdd.plan` | 구현 계획 수립 |
| `/sdd.tasks` | 작업 분해 |
| `/sdd.validate` | 형식 검증 |
| `/sdd.status` | 현황 조회 |
| `/sdd.reverse` | 레거시 코드에서 스펙 역추출 |

### 디렉토리 구조

```
.sdd/
├── constitution.md    # 프로젝트 헌법 (원칙, 제약)
├── AGENTS.md          # AI 워크플로우 지침
├── domains.yml        # 도메인 정의
├── specs/             # 스펙 문서
├── changes/           # 변경 제안
└── templates/         # 템플릿 파일
```

## 커밋 메시지 컨벤션

```
<type>(<scope>): <subject>

# 스펙 타입: spec, spec-update, spec-status, plan, tasks, constitution, sdd-config
# 일반 타입: feat, fix, docs, style, refactor, test, chore

# 스코프 예시:
#   spec(auth): ...              - 도메인 전체
#   spec(auth/user-login): ...   - 특정 스펙

# Footer:
# Refs: #이슈번호
# Breaking-Spec: 영향받는-스펙
# Depends-On: 의존-스펙
```

## CI/CD

- `.sdd/**` 경로 변경 시 자동 검증 실행 (sdd validate)
- PR 생성 시 변경된 도메인에 따라 `spec:<domain>` 라벨 자동 추가
