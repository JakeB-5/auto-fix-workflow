---
created: 2026-02-04
constitution_version: 1.1.0
---

# CLI Standalone Commands Specification

## 개요

| 항목 | 내용 |
|------|------|
| **기능 ID** | cli/standalone-commands |
| **버전** | 1.1.0 |
| **상태** | Draft |
| **작성일** | 2026-02-04 |
| **수정일** | 2026-02-04 |
| **작성자** | Claude |

## 목적

`triage`와 `autofix` 명령어를 MCP 서버 없이 CLI에서 독립적으로 실행할 수 있도록 지원한다.

## 배경

현재 `triage` 명령어는 MCP Client를 통해 외부 도구를 호출하는 구조로, 독립 실행이 불가능하다.
`autofix` 명령어는 이미 독립 실행 가능한 구조이나 CLI 진입점(`src/index.ts`)에 연결되어 있지 않다.

---

## 아키텍처 개요

### 현재 상태 vs 목표 상태

```
현재 (MCP 의존):                         목표 (Standalone 지원):
┌─────────────────────────────┐          ┌─────────────────────────────┐
│      src/index.ts           │          │      src/index.ts           │
│   (init, help만 지원)       │          │   (init, triage, autofix)   │
└─────────────────────────────┘          └─────────────────────────────┘
                                                      │
                                         ┌────────────┴────────────┐
                                         ▼                         ▼
┌─────────────────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  triage/mcp-tools/          │   │ triage/         │   │ autofix/        │
│  (MCP Client 필요)          │   │ cli-entry.ts    │   │ index.ts        │
│  └─▶ client.callTool()      │   │ (Standalone)    │   │ (이미 완성)     │
└─────────────────────────────┘   └─────────────────┘   └─────────────────┘
            ✗                              │                     ✓
                                           ▼
                              ┌─────────────────────────┐
                              │  triage/direct-tools/   │
                              │  └─▶ Direct API 호출    │
                              └─────────────────────────┘
                                           │
                              ┌────────────┴────────────┐
                              ▼                         ▼
                    ┌─────────────────┐       ┌─────────────────┐
                    │  src/asana/*    │       │  src/github/*   │
                    │  (기존 모듈)    │       │  (기존 모듈)    │
                    └─────────────────┘       └─────────────────┘
```

### 구현 난이도

| 명령어 | 난이도 | 작업량 | 이유 |
|--------|--------|--------|------|
| `autofix` | ✅ Trivial | ~10줄 | `main()` 이미 존재, index.ts 연결만 필요 |
| `triage` | ⚠️ Complex | 2-3일 | MCP 의존성 제거, Direct API 어댑터 구현 필요 |

---

## 요구사항

### REQ-001: Autofix CLI 연결 (Trivial)

시스템은 기존 `autofix/index.ts`의 `main()` 함수를 `src/index.ts`에서 호출할 수 있어야 한다(SHALL).

**구현 예시**:
```typescript
// src/index.ts에 추가
} else if (command === 'autofix') {
  const { main } = await import('./commands/autofix/index.js');
  await main(args.slice(1));
}
```

#### Scenario: autofix 명령어 실행

- **GIVEN** 사용자가 터미널에서 패키지를 실행할 때
- **WHEN** `npx auto-fix-workflow autofix --issue 123` 명령을 입력하면
- **THEN** 기존 autofix 워크플로우가 실행되어야 한다

#### Scenario: autofix 배치 처리

- **GIVEN** 라벨 필터가 주어질 때
- **WHEN** `npx auto-fix-workflow autofix --label auto-fix` 실행하면
- **THEN** 해당 라벨의 모든 이슈에 대해 autofix가 실행되어야 한다

---

### REQ-002: Triage CLI 진입점 (Complex)

시스템은 `triage` 명령어를 MCP Client 없이 CLI에서 실행할 수 있어야 한다(SHALL).

```bash
npx auto-fix-workflow triage [options]
```

#### Scenario: triage 명령어 실행

- **GIVEN** 사용자가 터미널에서 패키지를 실행할 때
- **WHEN** `npx auto-fix-workflow triage --project <id>` 명령을 입력하면
- **THEN** triage 워크플로우가 CLI 모드로 실행되어야 한다

---

### REQ-003: Triage Direct API 어댑터

시스템은 MCP Client 없이 Asana/GitHub API를 직접 호출하는 어댑터를 제공해야 한다(SHALL).

**어댑터 매핑 테이블**:

| MCP 어댑터 (현재) | Direct 어댑터 (목표) | 기존 모듈 |
|------------------|---------------------|-----------|
| `mcp-tools/asana-list.ts` | `direct-tools/asana-adapter.ts` | `src/asana/list-tasks/` |
| `mcp-tools/asana-update.ts` | `direct-tools/asana-adapter.ts` | `src/asana/update-task/` |
| `mcp-tools/github-create.ts` | `direct-tools/github-adapter.ts` | `src/github/create-issue/` |
| `mcp-tools/ai-analyze.ts` | `direct-tools/analyzer-adapter.ts` | `ai-integration.ts` 확장 |

#### Scenario: 직접 API 호출로 태스크 조회

- **GIVEN** Asana 토큰이 환경변수 또는 설정 파일에 존재할 때
- **WHEN** triage 명령이 태스크 목록을 조회하면
- **THEN** MCP Client 없이 `src/asana/list-tasks` 모듈을 직접 사용해야 한다

#### Scenario: 직접 API 호출로 GitHub 이슈 생성

- **GIVEN** GitHub 토큰이 환경변수에 존재할 때
- **WHEN** triage 명령이 이슈를 생성하면
- **THEN** MCP Client 없이 `src/github/create-issue` 모듈을 직접 사용해야 한다

---

### REQ-004: 도구 인터페이스 추상화

시스템은 MCP 도구와 Direct API 도구가 동일한 인터페이스를 구현하도록 해야 한다(SHALL).

```typescript
interface TriageToolset {
  asana: {
    listTasks(params: ListTasksParams): Promise<Result<AsanaTask[], Error>>;
    getTask(taskGid: string): Promise<Result<AsanaTaskDetail, Error>>;
    updateTask(params: UpdateTaskParams): Promise<Result<void, Error>>;
  };
  github: {
    createIssue(params: CreateIssueParams): Promise<Result<Issue, Error>>;
  };
  analyzer: {
    analyzeTask(task: AsanaTask): Promise<Result<TaskAnalysis, Error>>;
  };
}
```

**구현 클래스**:
- `MCPToolset` - 기존 `mcp-tools/` 래핑 (MCP Client 필요)
- `DirectAPIToolset` - 신규 `direct-tools/` 구현 (Standalone)

#### Scenario: 팩토리 패턴으로 도구 선택

- **GIVEN** CLI 모드로 실행될 때 (MCP Client 없음)
- **WHEN** TriageToolset을 생성하면
- **THEN** DirectAPIToolset 구현체가 반환되어야 한다

- **GIVEN** MCP Client가 제공될 때
- **WHEN** TriageToolset을 생성하면
- **THEN** MCPToolset 구현체가 반환되어야 한다

---

### REQ-005: Triage Direct AI 분석 어댑터

CLI 모드에서 AI 분석은 기존 `ai-integration.ts`의 `invokeClaudeCLI()` 함수를 재사용해야 한다(SHALL).

> **참조**: 상세 구현은 `.sdd/specs/autofix/ai-integration/spec.md` 참조

**구현 방식**:
```typescript
// src/commands/autofix/ai-integration.ts 확장
export class AIIntegration {
  // 기존 메서드 (autofix용)
  async analyzeGroup(issueGroup: IssueGroup): Promise<GroupAnalysis>;
  async applyFix(context: FixContext): Promise<FixResult>;

  // 신규 메서드 (triage용)
  async analyzeAsanaTask(task: AsanaTask): Promise<TaskAnalysis>;
}
```

#### Scenario: Claude Code CLI로 태스크 분석

- **GIVEN** Claude Code CLI가 설치되어 있고 인증되어 있을 때
- **WHEN** triage가 태스크를 분석하면
- **THEN** `invokeClaudeCLI()` 함수를 통해 AI 분석을 수행해야 한다

#### Scenario: Claude Code CLI 미설치 시 Fallback

- **GIVEN** Claude Code CLI가 설치되어 있지 않을 때
- **WHEN** triage가 태스크를 분석하면
- **THEN** `getFallbackAnalysis()` 휴리스틱 분석을 사용해야 한다

#### Scenario: Claude Code CLI 호출 실패 시 Fallback

- **GIVEN** Claude Code CLI 호출이 실패할 때 (타임아웃, 인증 오류 등)
- **WHEN** triage가 태스크를 분석하면
- **THEN** `getFallbackAnalysis()` 휴리스틱 분석으로 폴백해야 한다

---

### REQ-006: 설정 파일 지원

CLI 명령어는 `.auto-fix.yaml` 설정 파일에서 기본값을 읽어야 한다(SHALL).

> **참조**: 기존 Config 로더는 `src/common/config-loader/` 사용

```yaml
# .auto-fix.yaml
cli:
  triage:
    defaultProject: "1234567890"
    defaultSection: "Triage"
  autofix:
    defaultLabel: "auto-fix"
    dryRun: false
```

#### Scenario: 설정 파일에서 기본 프로젝트 로드

- **GIVEN** `.auto-fix.yaml`에 `cli.triage.defaultProject`가 설정되어 있을 때
- **WHEN** `npx auto-fix-workflow triage` (프로젝트 미지정) 실행하면
- **THEN** 설정 파일의 기본 프로젝트를 사용해야 한다

---

### REQ-007: 환경변수 및 의존성 지원

CLI 명령어는 다음 환경변수를 지원해야 한다(SHALL).

| 환경변수 | 용도 | 필수 여부 |
|---------|------|----------|
| `GITHUB_TOKEN` | GitHub API 인증 | 필수 |
| `ASANA_TOKEN` | Asana API 인증 | triage 시 필수 |
| `AUTO_FIX_CONFIG` | 설정 파일 경로 | 선택 |

외부 의존성:

| 도구 | 용도 | 필수 여부 |
|------|------|----------|
| `claude` CLI | AI 분석 | 선택 (미설치 시 휴리스틱 사용) |

#### Scenario: 필수 토큰 누락 시 오류

- **GIVEN** `ASANA_TOKEN` 환경변수가 없을 때
- **WHEN** `npx auto-fix-workflow triage` 실행하면
- **THEN** 명확한 오류 메시지와 함께 종료해야 한다

#### Scenario: Claude CLI 미설치 안내

- **GIVEN** `claude` CLI가 설치되어 있지 않을 때
- **WHEN** triage 명령을 실행하면
- **THEN** "Claude Code CLI 미설치. 휴리스틱 분석 사용." 경고를 출력해야 한다

---

### REQ-008: CLI 옵션

> **참조**: 기존 CLI 옵션은 각 명령어 스펙 참조
> - Triage: `.sdd/specs/commands/triage/spec.md`
> - Autofix: `.sdd/specs/commands/autofix/spec.md`

#### Triage 옵션

| 옵션 | 단축 | 설명 | 기본값 |
|------|------|------|--------|
| `--project <gid>` | `-p` | Asana 프로젝트 GID | config 또는 필수 |
| `--section <name>` | `-s` | 대상 섹션 이름 | "Triage" |
| `--mode <mode>` | `-m` | interactive/batch/single | interactive |
| `--dry-run` | `-d` | 실제 변경 없이 시뮬레이션 | false |
| `--limit <n>` | `-l` | 처리할 최대 태스크 수 | 무제한 |
| `--yes` | `-y` | 확인 프롬프트 건너뛰기 | false |
| `--verbose` | `-v` | 상세 로그 출력 | false |

#### Autofix 옵션

| 옵션 | 단축 | 설명 | 기본값 |
|------|------|------|--------|
| `--issue <number>` | `-i` | 단일 이슈 번호 | - |
| `--label <name>` | `-l` | 라벨로 이슈 필터 | "auto-fix" |
| `--owner <name>` | `-o` | GitHub 소유자 | config 필수 |
| `--repo <name>` | `-r` | GitHub 저장소 | config 필수 |
| `--dry-run` | `-d` | 실제 변경 없이 시뮬레이션 | false |
| `--parallel <n>` | | 동시 처리 수 | 1 |
| `--verbose` | `-v` | 상세 로그 출력 | false |

---

## 비기능 요구사항

### NFR-001: 하위 호환성

MCP 서버 모드의 기존 동작에 영향을 주지 않아야 한다(SHALL NOT).

### NFR-002: 오류 처리

CLI 실행 중 오류 발생 시 명확한 오류 메시지와 exit code를 반환해야 한다(SHALL).

| Exit Code | 의미 |
|-----------|------|
| 0 | 성공 |
| 1 | 일반 오류 |
| 2 | 설정/인증 오류 |
| 3 | API 오류 |

### NFR-003: 진행 상황 표시

배치 처리 시 진행 상황을 터미널에 표시해야 한다(SHOULD).

```
[1/5] Analyzing task: Fix login bug...
[2/5] Creating GitHub issue...
✓ Created issue #123
[3/5] Analyzing task: Update docs...
```

---

## 구현 범위

### In Scope

- `autofix` CLI 진입점 연결 (`src/index.ts` 수정)
- `triage` CLI 진입점 신규 구현 (`cli-entry.ts`)
- Direct API 어댑터 구현 (기존 모듈 래핑)
- 도구 인터페이스 추상화 (`TriageToolset`)
- AI 분석 어댑터 (`ai-integration.ts` 확장)

### Out of Scope

- 새로운 API 클라이언트 구현 (기존 모듈 재사용)
- GUI/TUI 인터페이스
- 워크플로우 자동화 (CI/CD 통합은 별도 스펙)

---

## 파일 구조 (예상)

```
src/
├── index.ts                          # CLI 진입점 (autofix, triage 추가)
├── commands/
│   ├── triage/
│   │   ├── index.ts                  # 기존 (MCP 의존, 변경 없음)
│   │   ├── cli.ts                    # 기존 CLI 파서 (재사용)
│   │   ├── cli-entry.ts              # [신규] Standalone 진입점 (main 함수)
│   │   ├── toolset-factory.ts        # [신규] TriageToolset 팩토리
│   │   ├── mcp-tools/                # 기존 MCP 어댑터 (변경 없음)
│   │   │   ├── asana-list.ts
│   │   │   ├── asana-update.ts
│   │   │   ├── github-create.ts
│   │   │   └── ai-analyze.ts
│   │   └── direct-tools/             # [신규] Direct API 어댑터
│   │       ├── index.ts              # DirectAPIToolset 구현
│   │       ├── asana-adapter.ts      # src/asana/* 래핑
│   │       ├── github-adapter.ts     # src/github/* 래핑
│   │       └── analyzer-adapter.ts   # ai-integration 래핑
│   └── autofix/
│       ├── index.ts                  # 기존 (이미 main() 존재)
│       └── ai-integration.ts         # [수정] analyzeAsanaTask() 추가
```

---

## 구현 우선순위

| 순서 | 작업 | 예상 시간 | 요구사항 |
|------|------|----------|----------|
| 1 | Autofix CLI 연결 | 1시간 | REQ-001 |
| 2 | TriageToolset 인터페이스 정의 | 2시간 | REQ-004 |
| 3 | DirectAPIToolset 구현 | 1일 | REQ-003 |
| 4 | AI 분석 어댑터 확장 | 4시간 | REQ-005 |
| 5 | Triage CLI 진입점 구현 | 4시간 | REQ-002 |
| 6 | 통합 테스트 | 4시간 | - |

---

## 관련 문서

- Issue #7: CLI commands not implemented
- `.sdd/specs/commands/triage/spec.md`: Triage 명령어 스펙
- `.sdd/specs/commands/autofix/spec.md`: Autofix 명령어 스펙
- `.sdd/specs/autofix/ai-integration/spec.md`: Claude CLI 통합 스펙
- `src/commands/triage/cli.ts`: 기존 CLI 파서
- `src/commands/autofix/index.ts`: Autofix main 함수
- `src/commands/autofix/ai-integration.ts`: Claude CLI 래퍼 구현체
