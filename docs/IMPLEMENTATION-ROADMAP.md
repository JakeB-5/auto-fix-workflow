# Auto-Fix Workflow 구현 로드맵

> 이 문서는 auto-fix-workflow를 완전히 동작하게 만들기 위해 필요한 작업을 정리합니다.

## 목차

1. [구현 준비 상태](#구현-준비-상태)
2. [현재 구현 상태 요약](#현재-구현-상태-요약)
3. [핵심 미구현 컴포넌트](#핵심-미구현-컴포넌트)
4. [Claude CLI 연동 방식](#claude-cli-연동-방식)
5. [컴포넌트별 상세 분석](#컴포넌트별-상세-분석)
6. [의존성 관계](#의존성-관계)
7. [구현 우선순위](#구현-우선순위)
8. [작업량 추정](#작업량-추정)
9. [구현 체크리스트](#구현-체크리스트)

---

## 구현 준비 상태

> **결론: 바로 구현 가능합니다.**

### 준비 완료 체크리스트

| 항목 | 상태 | 설명 |
|------|------|------|
| Claude CLI | ✅ 준비됨 | `claude --version` 실행 가능 |
| GitHub API | ✅ 이미 구현됨 | `CreatePRTool`, `ListIssuesTool` 등 존재 |
| Asana API | ✅ 이미 구현됨 | `AnalyzeTaskTool` 등 존재 |
| 인터페이스/타입 | ✅ 이미 정의됨 | `AIAnalysisResult`, `AIFixResult` 등 |
| 호출 파이프라인 | ✅ 이미 구현됨 | `pipeline.ts`가 ai-integration 호출 |
| 테스트 구조 | ✅ 이미 존재 | stub 테스트 → 실제 테스트로 전환만 |

### 실제 구현할 것 (단 2개)

#### 1. `ai-integration.ts` - CLI 래퍼 작성

```typescript
// 핵심 코드 (실제 구현 시 이것만 작성)
import { spawn } from 'child_process';

export async function invokeClaudeCLI(prompt: string, options: ClaudeOptions): Promise<ClaudeResult> {
  const args = [
    '--dangerously-skip-permissions',
    '--print',
    '--output-format', 'json',
    '--model', options.model || 'sonnet',
  ];

  if (options.allowedTools) {
    args.push('--allowedTools', options.allowedTools.join(','));
  }

  if (options.maxBudget) {
    args.push('--max-budget-usd', options.maxBudget.toString());
  }

  args.push(prompt);

  return new Promise((resolve) => {
    const claude = spawn('claude', args, { cwd: options.workingDir });
    let stdout = '';
    claude.stdout.on('data', (d) => stdout += d);
    claude.on('close', (code) => resolve({ success: code === 0, output: stdout }));
  });
}

export async function analyzeGroup(group: IssueGroup, worktreePath: string): Promise<AIAnalysisResult> {
  const prompt = buildAnalysisPrompt(group);  // 프롬프트 구성
  const result = await invokeClaudeCLI(prompt, {
    workingDir: worktreePath,
    allowedTools: ['Read', 'Glob', 'Grep']
  });
  return JSON.parse(result.output);  // 타입 매핑
}

export async function applyFix(group: IssueGroup, analysis: AIAnalysisResult, worktreePath: string): Promise<AIFixResult> {
  const prompt = buildFixPrompt(group, analysis);
  const result = await invokeClaudeCLI(prompt, {
    workingDir: worktreePath,
    allowedTools: ['Read', 'Edit', 'Glob', 'Grep', 'Bash'],
    maxBudget: 1.0
  });
  return JSON.parse(result.output);
}
```

#### 2. `orchestrator.ts:199` - PR 생성 연결

```typescript
// 현재 (Mock)
return { success: true, prNumber: 999, prUrl: 'mock://pr' };

// 변경 후 (실제 연결)
const prTool = new CreatePRTool(this.config.github);
return prTool.createPR(prParams);
```

### 복잡도 분석

| 작업 | 복잡도 | 이유 |
|------|--------|------|
| CLI 래퍼 | **낮음** | `spawn()` 호출 + JSON 파싱 |
| 프롬프트 구성 | **낮음** | 문자열 조합 |
| PR 연결 | **매우 낮음** | 이미 있는 Tool 호출 |
| 타입 매핑 | **낮음** | `JSON.parse()` + 타입 캐스팅 |

### 예상 시간

| 작업 | 시간 |
|------|------|
| `ai-integration.ts` 구현 | 1-2일 |
| `orchestrator.ts` 연결 | 2-4시간 |
| 테스트 및 디버깅 | 1일 |
| **총계** | **2-3일** |

### 왜 간단한가?

1. **Claude CLI가 복잡한 부분을 처리**
   - 토큰 관리 ❌ 불필요
   - 프롬프트 엔지니어링 ❌ CLI가 최적화
   - 컨텍스트 수집 ❌ CLI가 자동 탐색
   - 코드 수정 실행 ❌ CLI의 Edit 도구

2. **인프라가 이미 완성됨**
   - GitHub API Tool ✅ 구현됨
   - 파이프라인 ✅ 구현됨
   - 타입 정의 ✅ 완료됨
   - 에러 핸들링 구조 ✅ 있음

3. **연결만 하면 됨**
   - stub 함수 → 실제 구현으로 교체
   - Mock 반환 → 실제 API 호출로 교체

---

## 현재 구현 상태 요약

### 전체 현황

| 영역 | 구현율 | 상태 |
|------|--------|------|
| 인프라 (Config, Logging, Types) | 100% | ✅ 완료 |
| GitHub Integration | 95% | ✅ 거의 완료 |
| Asana Integration | 90% | ✅ 거의 완료 |
| Git Worktree | 100% | ✅ 완료 |
| Checks (lint, test, typecheck) | 100% | ✅ 완료 |
| Init Command | 100% | ✅ 완료 |
| Triage Command | 70% | ⚠️ AI 분석 미구현 |
| Autofix Command | 40% | ❌ AI 통합 필요 |
| E2E Workflow | 30% | ❌ 핵심 로직 미구현 |

### 동작 여부 매트릭스

| 기능 | 현재 상태 | 비고 |
|------|----------|------|
| `npx auto-fix-workflow init` | ✅ 완전 동작 | 토큰 설정, 파일 생성 |
| `npx auto-fix-workflow triage` | ⚠️ 부분 동작 | 휴리스틱만, LLM 분석 미수행 |
| `npx auto-fix-workflow autofix` | ❌ 동작 불가 | AI 통합 stub 상태 |
| MCP Server Tools | ✅ 완전 동작 | 11개 tool 등록 |
| GitHub Issue CRUD | ✅ 완전 동작 | - |
| Asana Task CRUD | ✅ 완전 동작 | - |
| Worktree 관리 | ✅ 완전 동작 | - |
| 코드 품질 체크 | ✅ 완전 동작 | - |

---

## 핵심 미구현 컴포넌트

### 🚨 Critical: 이것 없이는 Autofix 동작 불가

#### 1. Claude AI Integration
- **파일**: `src/commands/autofix/ai-integration.ts`
- **현황**: 전체 Stub (껍데기만 존재)
- **영향**: Autofix 명령의 핵심 로직

```typescript
// 현재 상태 - 모든 함수가 stub
export async function analyzeGroup(group: IssueGroup): Promise<AnalysisResult> {
  return { confidence: 0.0, /* ... */ };  // 항상 0 반환
}

export async function applyFix(strategy: FixStrategy): Promise<FixResult> {
  return { success: false, /* ... */ };  // 항상 실패 반환
}

export async function invokeClaudeAPI(request: ClaudeRequest): Promise<ClaudeResponse> {
  throw new Error('NOT_IMPLEMENTED');  // 에러 발생
}
```

#### 2. PR Creation Integration
- **파일**: `src/workflow/code-fix-strategy/orchestrator.ts`
- **위치**: Line 199
- **현황**: TODO 주석, Mock PR 반환

```typescript
// Line 199 - TODO 상태
private async createPullRequest(context: FixContext): Promise<PullRequestResult> {
  // TODO: 실제 GitHub API 연동 구현
  return { success: true, prNumber: 999, prUrl: 'mock://pr' };
}
```

### ⚠️ Major: 정확도/기능 향상에 필요

#### 3. LLM Task Analysis
- **파일**: `src/asana/analyze-task/llm-analysis.ts`
- **현황**: Stub - LLM 분석 건너뜀

```typescript
export async function analyzeWithLLM(task: AsanaTask): Promise<LLMAnalysisResult> {
  return { performed: false, /* ... */ };  // 항상 미수행
}
```

#### 4. GitHub API for Issue Grouping
- **파일**: `src/workflow/group-issues/github-api.ts`
- **현황**: Line 15에 TODO, Mock 데이터 사용

```typescript
// Line 15 - TODO 상태
// TODO: 실제 GitHub API 연동 구현
```

### 🟢 Enhancement: 있으면 좋은 기능

#### 5. Codebase Explorer
- **파일**: `src/asana/analyze-task/codebase.ts`
- **현황**: Placeholder - 실제 파일시스템 접근 없음

```typescript
export async function exploreCodebase(hints: CodeHints): Promise<CodebaseResult> {
  return { exists: true, /* ... */ };  // 항상 존재한다고 가정
}
```

#### 6. Asana Tag GID Lookup
- **파일**: `src/commands/triage/processor.ts`
- **위치**: Line 292
- **현황**: 단순화됨 - 태그 GID 조회 생략

---

## Claude CLI 연동 방식

### 개요

AI 연동은 Anthropic API 직접 호출 대신 **Claude CLI를 subprocess로 실행**하는 방식을 사용합니다.

```bash
claude --dangerously-skip-permissions "<prompt>"
```

### 장점

| 장점 | 설명 |
|------|------|
| **토큰 관리 불필요** | Claude CLI가 인증 처리 |
| **MCP 서버 자동 연동** | CLI 설정의 MCP 서버 활용 가능 |
| **Tool 사용 가능** | Read, Edit, Bash 등 파일시스템 접근 |
| **컨텍스트 자동 수집** | 프로젝트 구조 자동 인식 |

### 핵심 옵션

```bash
claude [options] <prompt>

# 필수 옵션
--dangerously-skip-permissions  # 권한 확인 없이 실행 (자동화 필수)
-p, --print                     # 비대화형 출력 모드

# 유용한 옵션
--model <model>                 # 모델 선택 (sonnet, opus, haiku)
--output-format <format>        # 출력 형식 (text, json, stream-json)
--json-schema <schema>          # 구조화된 출력 스키마
--max-budget-usd <amount>       # API 비용 제한
--allowedTools <tools...>       # 허용할 도구 목록
--add-dir <directories...>      # 추가 디렉토리 접근 허용
```

### 구현 패턴

#### 1. 기본 실행 패턴

```typescript
import { spawn } from 'child_process';

interface ClaudeResult {
  success: boolean;
  output: string;
  error?: string;
}

async function invokeClaudeCLI(prompt: string, options?: ClaudeOptions): Promise<ClaudeResult> {
  return new Promise((resolve, reject) => {
    const args = [
      '--dangerously-skip-permissions',
      '--print',
      '--output-format', 'json',
    ];

    if (options?.model) {
      args.push('--model', options.model);
    }

    if (options?.maxBudget) {
      args.push('--max-budget-usd', options.maxBudget.toString());
    }

    if (options?.allowedTools) {
      args.push('--allowedTools', ...options.allowedTools);
    }

    args.push(prompt);

    const claude = spawn('claude', args, {
      cwd: options?.workingDir || process.cwd(),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => { stdout += data; });
    claude.stderr.on('data', (data) => { stderr += data; });

    claude.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        resolve({ success: false, output: stdout, error: stderr });
      }
    });

    claude.on('error', (err) => {
      reject(err);
    });
  });
}
```

#### 2. 구조화된 출력 패턴

```typescript
interface AnalysisResult {
  confidence: number;
  rootCause: string;
  suggestedFix: string;
  affectedFiles: string[];
}

async function analyzeIssue(issue: GitHubIssue): Promise<AnalysisResult> {
  const schema = JSON.stringify({
    type: 'object',
    properties: {
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      rootCause: { type: 'string' },
      suggestedFix: { type: 'string' },
      affectedFiles: { type: 'array', items: { type: 'string' } }
    },
    required: ['confidence', 'rootCause', 'suggestedFix', 'affectedFiles']
  });

  const prompt = `
Analyze this GitHub issue and provide a fix strategy.

## Issue #${issue.number}: ${issue.title}

${issue.body}

## Instructions
1. Identify the root cause
2. Suggest a fix approach
3. List affected files
4. Rate your confidence (0-1)
`;

  const result = await invokeClaudeCLI(prompt, {
    model: 'sonnet',
    outputFormat: 'json',
    jsonSchema: schema,
    allowedTools: ['Read', 'Glob', 'Grep'],
  });

  return JSON.parse(result.output);
}
```

#### 3. 코드 수정 패턴

```typescript
async function applyFix(
  worktreePath: string,
  issue: GitHubIssue,
  analysis: AnalysisResult
): Promise<FixResult> {
  const prompt = `
## Task
Fix the issue described below by editing the necessary files.

## Issue #${issue.number}: ${issue.title}
${issue.body}

## Analysis
- Root Cause: ${analysis.rootCause}
- Suggested Fix: ${analysis.suggestedFix}
- Files to modify: ${analysis.affectedFiles.join(', ')}

## Instructions
1. Read the affected files
2. Make the minimum necessary changes to fix the issue
3. Do NOT add unnecessary comments or documentation
4. Ensure the fix is complete and correct

After making changes, output a summary of what was changed.
`;

  const result = await invokeClaudeCLI(prompt, {
    workingDir: worktreePath,
    model: 'sonnet',
    allowedTools: ['Read', 'Edit', 'Glob', 'Grep', 'Bash'],
    maxBudget: 1.0,  // $1 limit per fix
  });

  return {
    success: result.success,
    summary: result.output,
    error: result.error,
  };
}
```

### Worktree 연동

```typescript
async function autofixIssue(issue: GitHubIssue): Promise<AutofixResult> {
  // 1. Worktree 생성
  const worktree = await createWorktree({
    branchName: `fix/issue-${issue.number}`,
    baseBranch: 'main',
  });

  try {
    // 2. Claude CLI로 분석 (worktree 디렉토리에서 실행)
    const analysis = await analyzeIssue(issue);

    if (analysis.confidence < 0.5) {
      return { success: false, reason: 'Low confidence analysis' };
    }

    // 3. Claude CLI로 수정 적용
    const fixResult = await applyFix(worktree.path, issue, analysis);

    if (!fixResult.success) {
      return { success: false, reason: fixResult.error };
    }

    // 4. Checks 실행
    const checkResult = await runChecks(worktree.path);

    if (!checkResult.allPassed) {
      // 실패 시 Claude에게 수정 요청
      const retryResult = await retryFix(worktree.path, checkResult.failures);
      if (!retryResult.success) {
        return { success: false, reason: 'Checks failed after retry' };
      }
    }

    // 5. Commit & Push
    await commitChanges(worktree.path, `fix: resolve issue #${issue.number}`);
    await pushBranch(worktree.path);

    // 6. PR 생성
    const pr = await createPullRequest({
      title: `fix: ${issue.title}`,
      body: `Closes #${issue.number}\n\n${fixResult.summary}`,
      head: worktree.branchName,
      base: 'autofixing',
    });

    return { success: true, prNumber: pr.number, prUrl: pr.url };

  } finally {
    // 7. Worktree 정리
    await removeWorktree(worktree.path);
  }
}
```

### 에러 핸들링

```typescript
async function safeInvokeClaude(
  prompt: string,
  options: ClaudeOptions,
  maxRetries = 3
): Promise<ClaudeResult> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await invokeClaudeCLI(prompt, options);

      if (result.success) {
        return result;
      }

      // Rate limit or overload 체크
      if (result.error?.includes('overloaded') || result.error?.includes('rate_limit')) {
        await sleep(Math.pow(2, i) * 1000);  // Exponential backoff
        continue;
      }

      // 다른 에러는 즉시 반환
      return result;

    } catch (err) {
      lastError = err as Error;
      await sleep(1000);
    }
  }

  return {
    success: false,
    output: '',
    error: lastError?.message || 'Max retries exceeded',
  };
}
```

### 비용 관리

```typescript
interface BudgetConfig {
  maxPerIssue: number;      // 이슈당 최대 비용 ($)
  maxPerSession: number;    // 세션당 최대 비용 ($)
  preferredModel: string;   // 기본 모델
  fallbackModel: string;    // 비용 초과 시 대체 모델
}

const defaultBudget: BudgetConfig = {
  maxPerIssue: Infinity,     // 무제한 (또는 설정으로 제한)
  maxPerSession: Infinity,   // 무제한 (또는 설정으로 제한)
  preferredModel: 'opus',    // 기본: opus
  fallbackModel: 'sonnet',   // 폴백: sonnet
};
```

> **Note:** 예산 제한이 필요한 경우 `.auto-fix.yaml`의 `ai:` 섹션에서 설정할 수 있습니다.

### 보안 고려사항

| 항목 | 권장 설정 | 이유 |
|------|----------|------|
| `--allowedTools` | 필요한 것만 명시 | 불필요한 도구 접근 방지 |
| `--add-dir` | worktree 경로만 | 다른 디렉토리 접근 차단 |
| `--max-budget-usd` | 이슈당 제한 설정 | 비용 폭주 방지 |
| 프롬프트 검증 | 이슈 내용 sanitize | Prompt injection 방지 |

### 테스트 방법

```bash
# 1. 기본 동작 테스트
claude --dangerously-skip-permissions --print "Hello, respond with OK"

# 2. JSON 출력 테스트
claude --dangerously-skip-permissions --print --output-format json \
  "Respond with JSON: {\"status\": \"ok\"}"

# 3. 파일 접근 테스트
claude --dangerously-skip-permissions --print \
  --allowedTools "Read,Glob" \
  "List all TypeScript files in src/"

# 4. 코드 수정 테스트 (별도 테스트 디렉토리에서)
claude --dangerously-skip-permissions --print \
  --allowedTools "Read,Edit" \
  "Add a comment to the first line of test.ts"
```

---

## 컴포넌트별 상세 분석

### Triage Command 분석

```
src/commands/triage/
├── index.ts          ✅ 100% - CLI 엔트리포인트
├── config.ts         ✅ 100% - 설정 스키마
├── processor.ts      ⚠️ 95%  - 태그 GID lookup 단순화 (Line 292)
└── mcp-tools.ts      ✅ 100% - MCP tool 정의

의존하는 모듈:
├── src/asana/analyze-task/
│   ├── index.ts      ✅ 100% - 메인 분석 로직
│   ├── heuristics.ts ✅ 100% - 휴리스틱 분석
│   ├── llm-analysis.ts ❌ Stub - LLM 분석 미구현
│   └── codebase.ts   ❌ Stub - 코드베이스 탐색 미구현
└── src/analyzer/
    ├── issue-generator.ts ✅ 100%
    └── code-locator.ts    ✅ 100%
```

**Triage 동작 흐름:**
```
1. Asana Task 조회 ✅
2. Task 분석 (휴리스틱) ✅
3. Task 분석 (LLM) ❌ 건너뜀
4. 코드베이스 탐색 ❌ 건너뜀
5. GitHub Issue 생성 ✅
6. Asana Task 업데이트 ✅
```

### Autofix Command 분석

```
src/commands/autofix/
├── index.ts          ✅ 100% - CLI 엔트리포인트
├── config.ts         ✅ 100% - 설정 스키마
├── pipeline.ts       ⚠️ 90%  - AI 통합 stub 호출
├── queue.ts          ✅ 100% - 작업 큐 관리
├── progress.ts       ✅ 100% - 진행 상황 추적
├── ai-integration.ts ❌ 0%   - **전체 Stub**
└── mcp-tools.ts      ✅ 100% - MCP tool 정의

의존하는 모듈:
├── src/workflow/group-issues/
│   ├── index.ts      ✅ 100%
│   ├── component-extractor.ts ✅ 100%
│   └── github-api.ts ❌ Mock - GitHub API 미연동
└── src/workflow/code-fix-strategy/
    ├── orchestrator.ts ⚠️ 75% - generateFix, createPR TODO
    ├── validator.ts    ✅ 100%
    └── retry-strategy.ts ✅ 100%
```

**Autofix 동작 흐름:**
```
1. GitHub Issue 조회 ✅
2. Issue 그룹핑 ⚠️ (Mock API)
3. Worktree 생성 ✅
4. AI 분석 ❌ (항상 confidence: 0)
5. 코드 수정 ❌ (항상 success: false)
6. Checks 실행 ✅
7. PR 생성 ❌ (Mock PR)
8. Worktree 정리 ✅
```

---

## 의존성 관계

```
┌─────────────────────────────────────────────────────────────┐
│                    CRITICAL PATH                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ai-integration.ts (Stub)                                   │
│         │                                                   │
│         ▼                                                   │
│  orchestrator.ts (generateFix - TODO)                       │
│         │                                                   │
│         ▼                                                   │
│  pipeline.ts (ai_fix stage)                                 │
│         │                                                   │
│         ▼                                                   │
│  orchestrator.ts (createPullRequest - TODO)                 │
│         │                                                   │
│         ▼                                                   │
│  ═══════════════════════════════════════                    │
│  Autofix E2E Workflow 완성                                  │
│  ═══════════════════════════════════════                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  ENHANCEMENT PATH                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  llm-analysis.ts (Stub)                                     │
│         │                                                   │
│         ▼                                                   │
│  analyze-task/index.ts                                      │
│         │                                                   │
│         ▼                                                   │
│  Triage 정확도 향상                                         │
│                                                             │
│  ─────────────────────────────────────                      │
│                                                             │
│  github-api.ts (Mock)                                       │
│         │                                                   │
│         ▼                                                   │
│  group-issues/index.ts                                      │
│         │                                                   │
│         ▼                                                   │
│  Issue 그룹핑 정확도 향상                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 구현 우선순위

### Phase 1: MVP (Autofix 동작) - 필수

| 순서 | 작업 | 파일 | 설명 |
|------|------|------|------|
| 1 | Claude AI 통합 | `ai-integration.ts` | Anthropic API 연동 |
| 2 | PR 생성 연결 | `orchestrator.ts:199` | GitHub PR 생성 API 호출 |

**Phase 1 완료 시:**
- Autofix E2E 워크플로우 동작
- Issue → 분석 → 수정 → PR 생성 가능

### Phase 2: Enhanced Accuracy - 권장

| 순서 | 작업 | 파일 | 설명 |
|------|------|------|------|
| 3 | LLM Task 분석 | `llm-analysis.ts` | AI 기반 Task 분석 |
| 4 | GitHub API 연동 | `github-api.ts` | 실제 Issue 데이터로 그룹핑 |

**Phase 2 완료 시:**
- Triage 정확도 향상
- Issue 그룹핑 정확도 향상

### Phase 3: Advanced Features - 선택

| 순서 | 작업 | 파일 | 설명 |
|------|------|------|------|
| 5 | 코드베이스 탐색 | `codebase.ts` | 파일시스템 검색, AST 파싱 |
| 6 | 태그 GID Lookup | `processor.ts:292` | Asana 태그 정확한 매핑 |

**Phase 3 완료 시:**
- 코드 힌트 자동 발견
- Asana 태그 자동 적용

---

## 작업량 추정

### Phase 1 (MVP)

| 작업 | 난이도 | 예상 시간 | 필요 기술 |
|------|--------|----------|----------|
| Claude AI 통합 | High | 3-5일 | Anthropic API, 프롬프트 엔지니어링 |
| PR 생성 연결 | Low | 0.5-1일 | Octokit API |
| **소계** | - | **3.5-6일** | - |

### Phase 2 (Enhanced)

| 작업 | 난이도 | 예상 시간 | 필요 기술 |
|------|--------|----------|----------|
| LLM Task 분석 | Medium | 1-2일 | LLM API, JSON 파싱 |
| GitHub API 연동 | Low | 0.5-1일 | Octokit API |
| **소계** | - | **1.5-3일** | - |

### Phase 3 (Advanced)

| 작업 | 난이도 | 예상 시간 | 필요 기술 |
|------|--------|----------|----------|
| 코드베이스 탐색 | Medium | 2-3일 | TypeScript AST, glob |
| 태그 GID Lookup | Low | 0.5일 | Asana API |
| **소계** | - | **2.5-3.5일** | - |

### 총 예상 시간

| Phase | 시간 | 결과 |
|-------|------|------|
| Phase 1 | 3.5-6일 | Autofix E2E 동작 |
| Phase 2 | 1.5-3일 | 정확도 향상 |
| Phase 3 | 2.5-3.5일 | 고급 기능 |
| **전체** | **7.5-12.5일** | 완전한 기능 |

---

## 구현 체크리스트

### Phase 1: MVP

- [ ] **Claude CLI Integration** (`src/commands/autofix/ai-integration.ts`)
  - [ ] Claude CLI 래퍼 함수 구현
    - [ ] `invokeClaudeCLI()` - 기본 CLI 호출
    - [ ] spawn으로 subprocess 실행
    - [ ] `--dangerously-skip-permissions` 플래그 적용
    - [ ] `--print --output-format json` 출력 처리
    - [ ] stdout/stderr 수집
    - [ ] exit code 처리
  - [ ] `analyzeGroup()` 구현
    - [ ] Issue 컨텍스트를 프롬프트로 변환
    - [ ] `--json-schema`로 구조화된 출력 요청
    - [ ] `--allowedTools "Read,Glob,Grep"` 설정
    - [ ] JSON 응답 파싱 (confidence, rootCause, suggestedFix)
  - [ ] `applyFix()` 구현
    - [ ] worktree 경로를 `cwd`로 설정
    - [ ] `--allowedTools "Read,Edit,Glob,Grep,Bash"` 설정
    - [ ] `--max-budget-usd` 비용 제한 적용
    - [ ] 수정 결과 요약 수집
  - [ ] 에러 핸들링
    - [ ] Rate limit / overload 시 exponential backoff
    - [ ] 타임아웃 처리
    - [ ] 비용 초과 처리
  - [ ] 테스트 작성
    - [ ] Mock subprocess 테스트
    - [ ] 통합 테스트 (실제 CLI 호출)

- [ ] **PR Creation** (`src/workflow/code-fix-strategy/orchestrator.ts:199`)
  - [ ] `createPullRequest()` 구현
    - [ ] GitHub API 서비스 주입
    - [ ] PR 생성 API 호출
    - [ ] 결과 반환
  - [ ] 테스트 작성

- [ ] **비용 관리** (`src/commands/autofix/budget.ts`)
  - [ ] 이슈당 최대 비용 설정
  - [ ] 세션당 최대 비용 설정
  - [ ] 비용 초과 시 haiku 폴백

### Phase 2: Enhanced Accuracy

- [ ] **LLM Task Analysis** (`src/asana/analyze-task/llm-analysis.ts`)
  - [ ] `analyzeWithLLM()` 구현
    - [ ] Task 컨텍스트 포맷팅
    - [ ] Claude CLI 호출 (`--json-schema` 사용)
    - [ ] 결과 파싱 (reproducibility, severity, code hints)
  - [ ] 테스트 작성

- [ ] **GitHub API Integration** (`src/workflow/group-issues/github-api.ts`)
  - [ ] Mock 제거
  - [ ] 실제 Issue 조회 구현
  - [ ] 테스트 작성

### Phase 3: Advanced Features

- [ ] **Codebase Explorer** (`src/asana/analyze-task/codebase.ts`)
  - [ ] `exploreCodebase()` 구현
    - [ ] glob 기반 파일 검색
    - [ ] TypeScript AST 파싱
    - [ ] Symbol lookup
  - [ ] 테스트 작성

- [ ] **Tag GID Lookup** (`src/commands/triage/processor.ts:292`)
  - [ ] Asana API로 태그 조회
  - [ ] GID 캐싱
  - [ ] 테스트 작성

### 사전 요구사항

- [ ] Claude CLI 설치 확인
  ```bash
  claude --version
  ```
- [ ] Claude CLI 인증 설정
  ```bash
  claude setup-token
  ```
- [ ] 테스트 실행 권한 확인
  ```bash
  claude --dangerously-skip-permissions --print "test"
  ```

---

## 관련 문서

- [테스트 가이드](./TEST-GUIDE.md) - 현재 동작하는 기능 테스트 방법
- [설정 가이드](./SETUP.md) - 초기 설정 방법
- [SDD 스펙](./../.sdd/specs/) - 각 기능의 상세 스펙

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-02-02 | 1.2.0 | 구현 준비 상태 섹션 추가, 실제 구현 범위 명확화 |
| 2026-02-02 | 1.1.0 | Claude CLI 연동 방식 추가 |
| 2026-02-02 | 1.0.0 | 초기 문서 작성 |
