---
feature: standalone-commands
created: 2026-02-04
status: draft
spec_version: 1.1.0
---

# 구현 계획: CLI Standalone Commands

> `triage`와 `autofix` 명령어를 MCP 서버 없이 CLI에서 독립 실행 가능하도록 구현

---

## 개요

### 목표

- `npx auto-fix-workflow autofix` - 기존 main() 함수 연결 (Trivial)
- `npx auto-fix-workflow triage` - MCP 의존성 제거 후 standalone 실행 (Complex)

### 범위

| 항목 | In Scope | Out of Scope |
|------|----------|--------------|
| CLI 진입점 | ✓ | |
| Direct API 어댑터 | ✓ | |
| 인터페이스 추상화 | ✓ | |
| AI 분석 어댑터 | ✓ | |
| 새 API 클라이언트 | | ✗ (기존 모듈 재사용) |
| GUI/TUI | | ✗ |

---

## 기술 결정

### 결정 1: Autofix는 단순 연결만 수행

**근거:** `src/commands/autofix/index.ts`에 이미 완전한 `main()` 함수가 존재함. CLI 인자 파싱, 설정 로딩, 워크플로우 실행이 모두 구현되어 있어 `src/index.ts`에서 import 후 호출만 하면 됨.

**구현:**
```typescript
} else if (command === 'autofix') {
  const { main } = await import('./commands/autofix/index.js');
  await main(args.slice(1));
}
```

### 결정 2: Triage용 TriageToolset 인터페이스 도입

**근거:** 기존 `mcp-tools/`는 MCP Client에 의존하여 standalone 실행 불가. 동일 인터페이스로 MCP/Direct 구현체를 교체 가능하게 하여 기존 코드 변경 최소화.

**대안 검토:**
- ❌ MCP Client 제거하고 직접 호출로 변경 → 기존 MCP 모드 깨짐
- ❌ 조건문으로 분기 → 코드 복잡도 증가
- ✅ 인터페이스 추상화 + 팩토리 패턴 → 하위 호환성 유지

### 결정 3: AI 분석은 기존 ai-integration.ts 확장

**근거:** `invokeClaudeCLI()` 함수가 이미 구현되어 있음. 타임아웃, 재시도, JSON 파싱 로직을 재사용하고 `analyzeAsanaTask()` 메서드만 추가.

**구현:**
```typescript
// AIIntegration 클래스에 추가
async analyzeAsanaTask(task: AsanaTask): Promise<TaskAnalysis>
```

### 결정 4: 기존 cli.ts 파서 재사용

**근거:** `src/commands/triage/cli.ts`에 이미 CLI 인자 파싱 로직이 존재. 새로 만들지 않고 재사용.

**파일 역할 구분:**
- `cli.ts` - 인자 파싱 (기존, 재사용)
- `cli-entry.ts` - standalone main() 함수 (신규)

---

## 구현 단계

### Phase 1: Autofix CLI 연결 (1시간)

`src/index.ts`에 autofix 명령어 라우팅 추가.

**산출물:**
- [ ] `src/index.ts` 수정 (autofix 케이스 추가)
- [ ] 수동 테스트: `npx auto-fix-workflow autofix --help`

**요구사항:** REQ-001

### Phase 2: TriageToolset 인터페이스 정의 (2시간)

MCP/Direct 구현체 공통 인터페이스 정의.

**산출물:**
- [ ] `src/commands/triage/toolset.types.ts` (인터페이스 정의)
- [ ] `src/commands/triage/toolset-factory.ts` (팩토리 함수)

**요구사항:** REQ-004

### Phase 3: DirectAPIToolset 구현 (1일)

기존 API 모듈을 래핑하는 Direct 구현체 생성.

**산출물:**
- [ ] `src/commands/triage/direct-tools/index.ts` (DirectAPIToolset 클래스)
- [ ] `src/commands/triage/direct-tools/asana-adapter.ts`
- [ ] `src/commands/triage/direct-tools/github-adapter.ts`
- [ ] 단위 테스트: `direct-tools/*.test.ts`

**요구사항:** REQ-003

### Phase 4: AI 분석 어댑터 확장 (4시간)

AIIntegration 클래스에 Asana 태스크 분석 메서드 추가.

**산출물:**
- [ ] `src/commands/autofix/ai-integration.ts` 수정 (`analyzeAsanaTask` 추가)
- [ ] `src/commands/triage/direct-tools/analyzer-adapter.ts`
- [ ] 단위 테스트

**요구사항:** REQ-005

### Phase 5: Triage CLI 진입점 (4시간)

Standalone 실행을 위한 main() 함수 구현.

**산출물:**
- [ ] `src/commands/triage/cli-entry.ts` (main 함수)
- [ ] `src/index.ts` 수정 (triage 케이스 추가)
- [ ] 수동 테스트: `npx auto-fix-workflow triage --help`

**요구사항:** REQ-002

### Phase 6: 통합 테스트 (4시간)

End-to-end 시나리오 검증.

**산출물:**
- [ ] 통합 테스트: `__tests__/cli-standalone.test.ts`
- [ ] dry-run 모드 검증
- [ ] 에러 핸들링 검증

---

## 의존성 그래프

```
Phase 1 (Autofix CLI)     ──────────────────────────────────────────┐
                                                                     │
Phase 2 (Toolset 인터페이스) ─────┬─────────────────────────────────┤
                                  │                                   │
                                  ▼                                   ▼
Phase 3 (DirectAPIToolset) ─────────────────┐                   Phase 6
                                            │                   (통합 테스트)
                                            ▼                        ▲
Phase 4 (AI 분석 어댑터) ───────────────────┤                        │
                                            │                        │
                                            ▼                        │
Phase 5 (Triage CLI 진입점) ─────────────────────────────────────────┘
```

---

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| 기존 MCP 모드 영향 | 🔴 HIGH | 인터페이스 추상화로 격리, MCP 테스트 유지 |
| Asana API 변경 | 🟡 MEDIUM | 기존 모듈 재사용으로 변경 최소화 |
| Claude CLI 미설치 | 🟢 LOW | getFallbackAnalysis() 휴리스틱 폴백 구현 |
| Config 호환성 | 🟡 MEDIUM | 기존 config-loader 재사용, 통합 테스트로 검증 |

---

## 테스트 전략

### 단위 테스트

| 대상 | 테스트 케이스 |
|------|--------------|
| `asana-adapter.ts` | listTasks, getTask, updateTask 각 성공/실패 |
| `github-adapter.ts` | createIssue 성공/실패 |
| `analyzer-adapter.ts` | Claude 성공, 폴백, 타임아웃 |
| `toolset-factory.ts` | CLI 모드 → Direct, MCP 모드 → MCP |

**커버리지 목표:** 80% 이상

### 통합 테스트

| 시나리오 | 검증 항목 |
|----------|----------|
| Autofix --help | 도움말 출력, exit 0 |
| Autofix --dry-run | 시뮬레이션 실행, API 호출 없음 |
| Triage --help | 도움말 출력, exit 0 |
| Triage --dry-run | 시뮬레이션 실행, API 호출 없음 |
| 토큰 누락 | 명확한 에러 메시지, exit 2 |

### E2E 테스트 (수동)

1. `ASANA_TOKEN` 설정 후 `triage --dry-run --project <gid>`
2. `GITHUB_TOKEN` 설정 후 `autofix --dry-run --issue <num>`

---

## 예상 일정

| Phase | 예상 시간 | 누적 |
|-------|----------|------|
| Phase 1 | 1시간 | 1시간 |
| Phase 2 | 2시간 | 3시간 |
| Phase 3 | 8시간 | 11시간 |
| Phase 4 | 4시간 | 15시간 |
| Phase 5 | 4시간 | 19시간 |
| Phase 6 | 4시간 | 23시간 |
| **총계** | **~3일** | |

---

## 다음 단계

1. [x] 이 계획에 대한 검토 및 승인
2. [ ] `/sdd.tasks` 명령으로 작업 분해
3. [ ] Phase 1부터 순차 구현 시작
