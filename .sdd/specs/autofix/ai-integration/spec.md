---
status: draft
created: 2026-02-02
constitution_version: "1.1.0"
domain: autofix
feature: ai-integration
depends: "common/types, common/config-loader, autofix/budget, autofix/prompts"
---

# AI Integration (Claude CLI Wrapper)

> Claude CLI를 subprocess로 실행하여 코드 분석 및 수정을 수행하는 통합 모듈

---

## Requirement: REQ-AI-001 - Claude CLI 래퍼 기본 구현

Claude CLI를 subprocess로 실행하고 결과를 수집해야 한다(SHALL).

### Scenario: 기본 CLI 호출

- **GIVEN** Claude CLI가 설치되어 있고 (`claude --version` 실행 가능)
- **WHEN** `invokeClaudeCLI(prompt, options)`를 호출하면
- **THEN** `spawn('claude', args)`로 subprocess를 실행해야 함
- **AND** `--dangerously-skip-permissions` 플래그를 포함해야 함
- **AND** `--print` 플래그로 비대화형 모드를 사용해야 함
- **AND** `--output-format json` 옵션을 사용해야 함

### Scenario: 작업 디렉토리 설정

- **GIVEN** worktree 경로가 지정되고
- **WHEN** CLI를 실행할 때
- **THEN** `cwd` 옵션을 worktree 경로로 설정해야 함
- **AND** Claude가 해당 디렉토리 내 파일에만 접근하게 해야 함

### Scenario: stdout/stderr 수집

- **GIVEN** CLI 실행이 완료되고
- **WHEN** 결과를 반환할 때
- **THEN** stdout을 `output` 필드로 반환해야 함
- **AND** stderr를 `error` 필드로 반환해야 함
- **AND** exit code를 `success` 필드 (code === 0)로 변환해야 함

---

## Requirement: REQ-AI-002 - 모델 선택 및 옵션

다양한 Claude CLI 옵션을 지원해야 한다(SHALL).

### Scenario: 모델 선택

- **GIVEN** options에 model이 지정되고
- **WHEN** CLI를 실행할 때
- **THEN** `--model <model>` 옵션을 추가해야 함
- **AND** 기본 모델은 `opus`여야 함

**지원 모델:**
- `opus` - 가장 강력한 모델 (기본값)
- `sonnet` - 균형 잡힌 모델 (폴백)
- `haiku` - 빠른 모델 (비용 초과 시)

### Scenario: 허용 도구 제한

- **GIVEN** options에 allowedTools가 지정되고
- **WHEN** CLI를 실행할 때
- **THEN** `--allowedTools <tools>` 옵션을 추가해야 함
- **AND** 분석용과 수정용 도구 세트를 구분해야 함

**분석용 도구:**
- `Read`, `Glob`, `Grep`

**수정용 도구:**
- `Read`, `Edit`, `Glob`, `Grep`, `Bash`

### Scenario: 비용 제한

- **GIVEN** options에 maxBudget이 지정되고
- **WHEN** CLI를 실행할 때
- **THEN** `--max-budget-usd <amount>` 옵션을 추가해야 함
- **AND** 기본값은 무제한이어야 함 (또는 설정에서 지정)

---

## Requirement: REQ-AI-003 - analyzeGroup 함수

이슈 그룹을 분석하여 수정 전략을 제안해야 한다(SHALL).

### Scenario: 분석 프롬프트 구성

- **GIVEN** IssueGroup이 전달되고
- **WHEN** 분석을 수행할 때
- **THEN** 분석용 프롬프트를 구성해야 함
- **AND** 이슈 제목, 본문, 관련 파일 정보를 포함해야 함
- **AND** JSON 스키마로 구조화된 출력을 요청해야 함

### Scenario: 분석 결과 반환

- **GIVEN** CLI 분석이 완료되고
- **WHEN** 결과를 파싱할 때
- **THEN** `AIAnalysisResult` 타입으로 반환해야 함:
  ```typescript
  interface AIAnalysisResult {
    confidence: number;      // 0.0 - 1.0
    rootCause: string;       // 근본 원인 분석
    suggestedFix: string;    // 제안된 수정 방향
    affectedFiles: string[]; // 영향받는 파일 목록
    complexity: 'low' | 'medium' | 'high';
  }
  ```
- **AND** confidence가 임계값(기본: 0.5) 미만이면 저신뢰 표시해야 함

### Scenario: 분석 실패 처리

- **GIVEN** CLI 실행이 실패하거나 JSON 파싱이 실패하고
- **WHEN** 에러를 처리할 때
- **THEN** `Result.err()`로 에러를 반환해야 함
- **AND** 에러 메시지에 실패 원인을 포함해야 함

---

## Requirement: REQ-AI-004 - applyFix 함수

분석 결과를 바탕으로 코드 수정을 적용해야 한다(SHALL).

### Scenario: 수정 프롬프트 구성

- **GIVEN** IssueGroup과 AIAnalysisResult가 전달되고
- **WHEN** 수정을 수행할 때
- **THEN** 수정용 프롬프트를 구성해야 함
- **AND** 분석 결과(rootCause, suggestedFix)를 포함해야 함
- **AND** 수정 범위 제한 지침을 포함해야 함

### Scenario: 파일 수정 허용

- **GIVEN** worktree 경로에서 실행되고
- **WHEN** 수정 도구를 사용할 때
- **THEN** `Edit` 도구로 파일을 수정할 수 있어야 함
- **AND** `Bash` 도구로 git 명령을 실행할 수 있어야 함

### Scenario: 수정 결과 반환

- **GIVEN** 수정이 완료되고
- **WHEN** 결과를 반환할 때
- **THEN** `AIFixResult` 타입으로 반환해야 함:
  ```typescript
  interface AIFixResult {
    success: boolean;
    summary: string;         // 수정 요약
    filesChanged: string[];  // 변경된 파일 목록
    error?: string;          // 실패 시 에러 메시지
  }
  ```

### Scenario: 수정 후 git staging

- **GIVEN** 코드 수정이 완료되고
- **WHEN** 결과를 확정할 때
- **THEN** 변경된 파일을 자동으로 git stage해야 함
- **AND** `git add` 명령을 실행해야 함

---

## Requirement: REQ-AI-005 - 에러 핸들링

CLI 실행 중 발생하는 다양한 에러를 처리해야 한다(SHALL).

### Scenario: Rate Limit 처리

- **GIVEN** API rate limit에 도달하고
- **WHEN** 재시도를 수행할 때
- **THEN** exponential backoff를 적용해야 함 (1s, 2s, 4s)
- **AND** 최대 3회까지 재시도해야 함

### Scenario: Overload 처리

- **GIVEN** API가 overloaded 상태이고
- **WHEN** 에러 메시지에 'overloaded'가 포함되면
- **THEN** 대기 후 재시도해야 함
- **AND** 재시도 간격을 점진적으로 증가해야 함

### Scenario: 타임아웃 처리

- **GIVEN** CLI 실행이 타임아웃되고
- **WHEN** 설정된 시간(기본: 분석 300초, 수정 600초)을 초과하면
- **THEN** 프로세스를 강제 종료해야 함
- **AND** 타임아웃 에러를 반환해야 함

### Scenario: 비용 초과 처리

- **GIVEN** 예산 제한에 도달하고
- **WHEN** 추가 API 호출이 필요하면
- **THEN** 폴백 모델(sonnet → haiku)로 전환해야 함
- **AND** 비용 초과 경고를 로깅해야 함

---

## Requirement: REQ-AI-006 - 구조화된 출력

JSON 스키마를 사용하여 구조화된 출력을 요청해야 한다(SHOULD).

### Scenario: 분석 결과 스키마

- **GIVEN** 분석을 수행할 때
- **WHEN** `--json-schema` 옵션을 사용하면
- **THEN** 다음 스키마를 적용해야 함:
  ```json
  {
    "type": "object",
    "properties": {
      "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
      "rootCause": { "type": "string" },
      "suggestedFix": { "type": "string" },
      "affectedFiles": { "type": "array", "items": { "type": "string" } },
      "complexity": { "enum": ["low", "medium", "high"] }
    },
    "required": ["confidence", "rootCause", "suggestedFix", "affectedFiles", "complexity"]
  }
  ```

### Scenario: JSON 파싱 실패 처리

- **GIVEN** CLI 출력이 유효한 JSON이 아니고
- **WHEN** 파싱을 시도할 때
- **THEN** 원본 출력을 로깅해야 함
- **AND** 파싱 에러를 반환해야 함
- **AND** 재시도 옵션을 제공해야 함

---

## Data Types

### ClaudeOptions

```typescript
interface ClaudeOptions {
  model?: 'opus' | 'sonnet' | 'haiku';  // 기본: opus
  workingDir?: string;                   // 작업 디렉토리
  allowedTools?: string[];               // 허용 도구 목록
  maxBudget?: number;                    // 최대 비용 (USD)
  timeout?: number;                      // 타임아웃 (ms)
  jsonSchema?: object;                   // 출력 스키마
}
```

**Constraints:**
- `model` MUST be one of 'opus', 'sonnet', 'haiku'
- `workingDir` MUST be a valid directory path
- `allowedTools` MUST only include valid Claude tool names
- `maxBudget` MUST be positive if specified
- `timeout` MUST be positive if specified

### ClaudeResult

```typescript
interface ClaudeResult {
  success: boolean;
  output: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    costUSD: number;
  };
}
```

**Constraints:**
- `success` MUST be true if exit code is 0
- `output` MUST contain stdout content
- `error` SHOULD contain stderr if not empty
- `usage` MAY be included if cost tracking is enabled

### AIAnalysisResult

```typescript
interface AIAnalysisResult {
  confidence: number;
  rootCause: string;
  suggestedFix: string;
  affectedFiles: string[];
  complexity: 'low' | 'medium' | 'high';
}
```

**Constraints:**
- `confidence` MUST be between 0.0 and 1.0
- `affectedFiles` MUST NOT be empty
- `complexity` MUST be one of 'low', 'medium', 'high'

### AIFixResult

```typescript
interface AIFixResult {
  success: boolean;
  summary: string;
  filesChanged: string[];
  error?: string;
}
```

**Constraints:**
- `success` MUST reflect actual fix outcome
- `summary` SHOULD be human-readable
- `filesChanged` MUST list all modified files

---

## Command Line Interface

### invokeClaudeCLI 인자 구성

```bash
claude \
  --dangerously-skip-permissions \
  --print \
  --output-format json \
  --model <model> \
  --allowedTools <tools...> \
  --max-budget-usd <amount> \
  "<prompt>"
```

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `AI_PREFERRED_MODEL` | 선호 모델 | `opus` |
| `AI_FALLBACK_MODEL` | 폴백 모델 | `sonnet` |
| `AI_MAX_BUDGET_PER_ISSUE` | 이슈당 최대 비용 | `Infinity` |
| `AI_MAX_BUDGET_PER_SESSION` | 세션당 최대 비용 | `Infinity` |
| `AI_ANALYSIS_TIMEOUT` | 분석 타임아웃 (초) | `300` |
| `AI_FIX_TIMEOUT` | 수정 타임아웃 (초) | `600` |
| `AI_MIN_CONFIDENCE` | 최소 신뢰도 | `0.5` |

---

## Implementation Notes

### CLI 래퍼 구현 패턴

```typescript
export async function invokeClaudeCLI(
  prompt: string,
  options: ClaudeOptions = {}
): Promise<ClaudeResult> {
  const args = [
    '--dangerously-skip-permissions',
    '--print',
    '--output-format', 'json',
  ];

  if (options.model) {
    args.push('--model', options.model);
  }

  if (options.allowedTools?.length) {
    args.push('--allowedTools', ...options.allowedTools);
  }

  if (options.maxBudget) {
    args.push('--max-budget-usd', options.maxBudget.toString());
  }

  args.push(prompt);

  return new Promise((resolve, reject) => {
    const claude = spawn('claude', args, {
      cwd: options.workingDir || process.cwd(),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => { stdout += data; });
    claude.stderr.on('data', (data) => { stderr += data; });

    claude.on('close', (code) => {
      resolve({
        success: code === 0,
        output: stdout,
        error: stderr || undefined,
      });
    });

    claude.on('error', reject);
  });
}
```

### 재시도 로직

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

      // Rate limit or overload check
      if (result.error?.includes('overloaded') || result.error?.includes('rate_limit')) {
        await sleep(Math.pow(2, i) * 1000);  // Exponential backoff
        continue;
      }

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

---

## Security Considerations

### Scenario: 프롬프트 Injection 방지

- **GIVEN** 이슈 내용에 악의적인 프롬프트가 포함될 수 있고
- **WHEN** 프롬프트를 구성할 때
- **THEN** 이슈 내용을 별도 섹션으로 격리해야 함
- **AND** 시스템 지시와 사용자 데이터를 명확히 구분해야 함

### Scenario: 파일 접근 제한

- **GIVEN** CLI가 파일 시스템에 접근하고
- **WHEN** worktree 외부 접근을 시도하면
- **THEN** `--add-dir` 옵션으로 worktree만 허용해야 함
- **AND** 민감 파일(.env, credentials)은 자동 제외해야 함

---

## Testing Scenarios

### 단위 테스트

1. **CLI 래퍼 기본**: 정상 호출, stdout/stderr 수집
2. **옵션 구성**: 모델, 도구, 비용 제한 인자 검증
3. **JSON 파싱**: 유효/무효 JSON 처리
4. **에러 핸들링**: 타임아웃, rate limit, 파싱 실패

### 통합 테스트

1. **분석 흐름**: IssueGroup → analyzeGroup → AIAnalysisResult
2. **수정 흐름**: 분석 결과 → applyFix → AIFixResult
3. **재시도 흐름**: 실패 → 재시도 → 성공/최종실패
4. **비용 관리**: 예산 초과 → 모델 폴백

---

## Related Specs

- [autofix/budget](../budget/spec.md) - 비용 관리
- [autofix/prompts](../prompts/spec.md) - 프롬프트 템플릿
- [workflow/code-fix-strategy](../../workflow/code-fix-strategy/spec.md) - 수정 전략
- [commands/autofix](../../commands/autofix/spec.md) - Autofix 커맨드
