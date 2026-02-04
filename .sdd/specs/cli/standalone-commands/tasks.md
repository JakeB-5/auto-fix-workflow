---
feature: standalone-commands
created: 2026-02-04
status: completed
plan_version: 1.0.0
---

# 작업 목록: CLI Standalone Commands

> 구현 계획 기반 실행 가능한 작업 분해

---

## 진행 현황

| 상태 | 개수 |
|------|------|
| ✅ 완료 | 10 |
| 🔄 진행 중 | 0 |
| ⏳ 대기 | 1 |
| 🚫 차단됨 | 0 |
| **총계** | **11** |

---

## Phase 1: Autofix CLI 연결

### CLI-001: src/index.ts에 autofix 명령어 추가

- **상태:** ✅ 완료
- **우선순위:** 🔴 HIGH
- **예상 시간:** 30분
- **의존성:** 없음
- **요구사항:** REQ-001

#### 설명

`src/index.ts`의 CLI 명령어 라우팅에 `autofix` 케이스를 추가하여 기존 `main()` 함수를 호출.

#### 구현 내용

```typescript
// src/index.ts CLI 라우팅 섹션에 추가
} else if (command === 'autofix') {
  const { main } = await import('./commands/autofix/index.js');
  await main(args.slice(1));
}
```

#### 완료 조건

- [x] `src/index.ts`에 autofix 케이스 추가
- [x] `npx auto-fix-workflow autofix --help` 실행 시 도움말 출력
- [x] exit code 0 반환

---

### CLI-002: Autofix CLI 수동 테스트

- **상태:** ✅ 완료
- **우선순위:** 🔴 HIGH
- **예상 시간:** 30분
- **의존성:** CLI-001
- **요구사항:** REQ-001

#### 설명

Autofix CLI 연결이 정상 동작하는지 수동 테스트 수행.

#### 완료 조건

- [x] `autofix --help` 도움말 출력 확인
- [x] `autofix --version` 버전 출력 확인
- [x] `autofix --dry-run --issue 1` dry-run 동작 확인

---

## Phase 2: TriageToolset 인터페이스

### CLI-003: TriageToolset 인터페이스 정의

- **상태:** ✅ 완료
- **우선순위:** 🔴 HIGH
- **예상 시간:** 1시간
- **의존성:** 없음
- **요구사항:** REQ-004

#### 설명

MCP/Direct 구현체 공통 인터페이스 정의. 기존 `mcp-tools/` 구조를 분석하여 인터페이스 설계.

#### 구현 내용

`src/commands/triage/toolset.types.ts` 생성:

```typescript
import { Result } from '../../common/types/result.js';

export interface TriageToolset {
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

export type ToolsetMode = 'mcp' | 'direct';
```

#### 완료 조건

- [x] `toolset.types.ts` 파일 생성
- [x] 모든 메서드 시그니처 정의
- [x] 타입 체크 통과

---

### CLI-004: Toolset 팩토리 함수 구현

- **상태:** ✅ 완료
- **우선순위:** 🔴 HIGH
- **예상 시간:** 1시간
- **의존성:** CLI-003
- **요구사항:** REQ-004

#### 설명

실행 모드에 따라 적절한 Toolset 구현체를 반환하는 팩토리 함수 구현.

#### 구현 내용

`src/commands/triage/toolset-factory.ts` 생성:

```typescript
export function createToolset(mode: ToolsetMode, context?: MCPContext): TriageToolset {
  if (mode === 'mcp' && context) {
    return new MCPToolset(context.client);
  }
  return new DirectAPIToolset();
}
```

#### 완료 조건

- [x] `toolset-factory.ts` 파일 생성
- [x] MCP 모드 시 MCPToolset 반환
- [x] Direct 모드 시 DirectAPIToolset 반환
- [ ] 단위 테스트 작성 (deferred to CLI-011)

---

## Phase 3: DirectAPIToolset 구현

### CLI-005: Asana Direct 어댑터 구현

- **상태:** ✅ 완료
- **우선순위:** 🔴 HIGH
- **예상 시간:** 3시간
- **의존성:** CLI-003
- **요구사항:** REQ-003

#### 설명

기존 `src/asana/*` 모듈을 래핑하는 Asana 어댑터 구현.

#### 구현 내용

`src/commands/triage/direct-tools/asana-adapter.ts`:

```typescript
import { executeListTasks } from '../../../asana/list-tasks/index.js';
import { executeGetTask } from '../../../asana/get-task/index.js';
import { executeUpdateTask } from '../../../asana/update-task/index.js';

export class AsanaDirectAdapter {
  constructor(private config: AsanaConfig) {}

  async listTasks(params: ListTasksParams): Promise<Result<AsanaTask[], Error>> {
    return executeListTasks(this.config, params);
  }
  // ... 기타 메서드
}
```

#### 완료 조건

- [x] `asana-adapter.ts` 파일 생성
- [x] listTasks, getTask, updateTask 구현
- [x] 기존 API 모듈과 연동 확인
- [ ] 단위 테스트 작성 (deferred to CLI-011)

---

### CLI-006: GitHub Direct 어댑터 구현

- **상태:** ✅ 완료
- **우선순위:** 🔴 HIGH
- **예상 시간:** 2시간
- **의존성:** CLI-003
- **요구사항:** REQ-003

#### 설명

기존 `src/github/create-issue` 모듈을 래핑하는 GitHub 어댑터 구현.

#### 구현 내용

`src/commands/triage/direct-tools/github-adapter.ts`:

```typescript
import { handleCreateIssueTool } from '../../../github/create-issue/tool.js';

export class GitHubDirectAdapter {
  constructor(private config: GitHubConfig) {}

  async createIssue(params: CreateIssueParams): Promise<Result<Issue, Error>> {
    return handleCreateIssueTool(this.config, params);
  }
}
```

#### 완료 조건

- [x] `github-adapter.ts` 파일 생성
- [x] createIssue 구현
- [x] 기존 API 모듈과 연동 확인
- [ ] 단위 테스트 작성 (deferred to CLI-011)

---

### CLI-007: DirectAPIToolset 통합

- **상태:** ✅ 완료
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 2시간
- **의존성:** CLI-005, CLI-006
- **요구사항:** REQ-003

#### 설명

개별 어댑터를 통합하여 DirectAPIToolset 클래스 완성.

#### 구현 내용

`src/commands/triage/direct-tools/index.ts`:

```typescript
export class DirectAPIToolset implements TriageToolset {
  asana: AsanaDirectAdapter;
  github: GitHubDirectAdapter;
  analyzer: AnalyzerDirectAdapter;

  constructor(config: Config) {
    this.asana = new AsanaDirectAdapter(config.asana);
    this.github = new GitHubDirectAdapter(config.github);
    this.analyzer = new AnalyzerDirectAdapter();
  }
}
```

#### 완료 조건

- [x] `direct-tools/index.ts` 파일 생성
- [x] TriageToolset 인터페이스 구현
- [x] 모든 어댑터 통합
- [x] 타입 체크 통과

---

## Phase 4: AI 분석 어댑터

### CLI-008: AIIntegration 확장 (analyzeAsanaTask)

- **상태:** ✅ 완료
- **우선순위:** 🔴 HIGH
- **예상 시간:** 3시간
- **의존성:** 없음
- **요구사항:** REQ-005

#### 설명

기존 `ai-integration.ts`에 Asana 태스크 분석 메서드 추가.

#### 구현 내용

`src/commands/autofix/ai-integration.ts` 수정:

```typescript
export class AIIntegration {
  // 기존 메서드 유지
  async analyzeGroup(issueGroup: IssueGroup): Promise<GroupAnalysis>;
  async applyFix(context: FixContext): Promise<FixResult>;

  // 신규 메서드
  async analyzeAsanaTask(task: AsanaTask): Promise<TaskAnalysis> {
    const prompt = this.buildTaskAnalysisPrompt(task);
    try {
      const result = await invokeClaudeCLI({ prompt, model: 'haiku', timeoutMs: 30000 });
      return JSON.parse(result);
    } catch {
      return this.getFallbackAnalysis(task);
    }
  }

  private buildTaskAnalysisPrompt(task: AsanaTask): string { ... }
  private getFallbackAnalysis(task: AsanaTask): TaskAnalysis { ... }
}
```

#### 완료 조건

- [x] `analyzeAsanaTask` 메서드 추가
- [x] 프롬프트 빌더 구현
- [x] 폴백 분석 구현
- [ ] 단위 테스트 작성 (deferred to CLI-011)
- [x] Claude CLI 미설치 시 폴백 동작 확인

---

### CLI-009: Analyzer Direct 어댑터 구현

- **상태:** ✅ 완료
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 1시간
- **의존성:** CLI-008
- **요구사항:** REQ-005

#### 설명

AIIntegration을 래핑하는 어댑터로 TriageToolset.analyzer 구현.

#### 구현 내용

`src/commands/triage/direct-tools/analyzer-adapter.ts`:

```typescript
import { AIIntegration } from '../../autofix/ai-integration.js';

export class AnalyzerDirectAdapter {
  private ai: AIIntegration;

  constructor() {
    this.ai = new AIIntegration();
  }

  async analyzeTask(task: AsanaTask): Promise<Result<TaskAnalysis, Error>> {
    try {
      const analysis = await this.ai.analyzeAsanaTask(task);
      return ok(analysis);
    } catch (error) {
      return err(error as Error);
    }
  }
}
```

#### 완료 조건

- [x] `analyzer-adapter.ts` 파일 생성
- [x] AIIntegration 연동
- [x] 에러 핸들링 구현
- [ ] 단위 테스트 작성 (deferred to CLI-011)

---

## Phase 5: Triage CLI 진입점

### CLI-010: Triage CLI 진입점 구현

- **상태:** ✅ 완료
- **우선순위:** 🔴 HIGH
- **예상 시간:** 3시간
- **의존성:** CLI-004, CLI-007, CLI-009
- **요구사항:** REQ-002

#### 설명

Standalone 실행을 위한 Triage main() 함수 구현 및 index.ts 연결.

#### 구현 내용

`src/commands/triage/cli-entry.ts`:

```typescript
import { parseArgs } from './cli.js';
import { loadConfig } from './config.js';
import { createToolset } from './toolset-factory.js';
import { TaskProcessor } from './processor.js';

export async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv);
  const config = await loadConfig();
  const toolset = createToolset('direct');

  const processor = new TaskProcessor(toolset, config, options);
  const result = await processor.processTasks();

  if (isFailure(result)) {
    console.error(result.error.message);
    process.exit(1);
  }
}
```

`src/index.ts`에 추가:

```typescript
} else if (command === 'triage') {
  const { main } = await import('./commands/triage/cli-entry.js');
  await main(args.slice(1));
}
```

#### 완료 조건

- [x] `cli-entry.ts` 파일 생성
- [x] `src/index.ts`에 triage 케이스 추가
- [x] `npx auto-fix-workflow triage --help` 동작 확인
- [x] `triage --dry-run` 동작 확인
- [x] 에러 시 적절한 exit code 반환

---

## Phase 6: 통합 테스트

### CLI-011: CLI 통합 테스트 작성

- **상태:** ⏳ 대기
- **우선순위:** 🟡 MEDIUM
- **예상 시간:** 4시간
- **의존성:** CLI-002, CLI-010
- **요구사항:** 전체

#### 설명

CLI 명령어들의 E2E 통합 테스트 작성.

#### 테스트 케이스

| 명령어 | 시나리오 | 기대 결과 |
|--------|---------|----------|
| `autofix --help` | 도움말 요청 | 도움말 출력, exit 0 |
| `autofix --dry-run` | dry-run 실행 | 시뮬레이션, API 호출 없음 |
| `triage --help` | 도움말 요청 | 도움말 출력, exit 0 |
| `triage` (토큰 없음) | 인증 오류 | 에러 메시지, exit 2 |
| `triage --dry-run` | dry-run 실행 | 시뮬레이션, API 호출 없음 |

#### 완료 조건

- [ ] `__tests__/cli-standalone.test.ts` 작성
- [ ] 모든 테스트 케이스 통과
- [ ] 커버리지 80% 이상

---

## 의존성 다이어그램

```
CLI-001 ──────────────────────────────────────┐
   │                                          │
   ▼                                          │
CLI-002                                       │
                                              │
CLI-003 ────────────────┬─────────────────────┤
   │                    │                     │
   ▼                    ▼                     │
CLI-004              CLI-005                  │
   │                    │                     │
   │                    ▼                     │
   │                 CLI-006                  │
   │                    │                     ▼
   │                    ▼                  CLI-011
   │                 CLI-007 ◀── CLI-008      ▲
   │                    │          │          │
   │                    │          ▼          │
   │                    │       CLI-009       │
   │                    │          │          │
   ▼                    ▼          ▼          │
   └────────────────▶ CLI-010 ────────────────┘
```

---

## 다음 단계

1. [ ] CLI-001부터 순차적으로 구현 시작
2. [ ] 각 작업 완료 시 상태 업데이트
3. [ ] Phase 완료 시 통합 테스트 수행
