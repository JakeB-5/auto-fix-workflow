---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Update Issue 구현 계획

## 기술 결정

### 결정 1: 라벨 업데이트 방식
**선택:** add_labels, remove_labels 분리 (Option 2)
**근거:**
- labels 파라미터는 전체 라벨 교체로 위험 (실수로 기존 라벨 삭제 가능)
- add_labels, remove_labels로 명시적 제어하여 안전성 확보
- GitHub API는 두 방식 모두 지원하므로 구현 복잡도 동일

### 결정 2: 멱등성 보장 전략
**선택:** 현재 상태 조회 후 차이만 적용
**근거:**
- 동일한 라벨 중복 추가 방지: 현재 라벨 목록을 먼저 조회하여 이미 존재하면 건너뛰기
- 없는 라벨 제거 시도: 에러 없이 성공 반환
- 코멘트는 항상 새로 추가되므로 멱등성 해당 없음

### 결정 3: 부분 실패 처리 전략
**선택:** Best-Effort + 경고 반환
**근거:**
- 코멘트 추가 성공 + 라벨 변경 실패 → 코멘트는 유지하고 warnings 배열에 실패 정보 포함
- 예: 존재하지 않는 라벨 추가 시도 → 경고만 반환, 에러는 아님
- 사용자가 부분 성공 상태를 인지하고 후속 조치 가능

### 결정 4: 진행 상황 코멘트 형식 표준화
**선택:** Emoji prefix + 단계별 템플릿
**근거:**
- 일관된 형식으로 파싱 및 시각화 용이
- Emoji로 상태 구분 (🔄 시작, ✅ 성공, ❌ 실패)
- 템플릿 함수 제공으로 사용자가 직접 형식 맞출 필요 없음

## 구현 단계

### Step 1: 타입 정의
**산출물:**
- [ ] `types/github.ts`: UpdateIssueParams, UpdateIssueResult 인터페이스

**작업 내용:**
- spec.md Interface → TypeScript 타입
- warnings 배열 타입 정의 (string[])
- 코멘트 형식 표준화를 위한 ProgressComment 타입 추가 (선택)

### Step 2: 진행 상황 코멘트 생성 유틸리티 구현
**산출물:**
- [ ] `utils/progress-comment-generator.ts`: generateProgressComment 함수

**작업 내용:**
```typescript
type ProgressStage = 'start' | 'analyzing' | 'fixing' | 'testing' | 'success' | 'failed';

function generateProgressComment(
  stage: ProgressStage,
  details?: string
): string {
  const templates = {
    start: '🔄 자동 수정을 시작합니다...',
    analyzing: '🔍 분석 완료',
    fixing: '✏️ 코드 수정 완료',
    testing: '🧪 테스트 실행 중...',
    success: '✅ PR 생성 완료',
    failed: '❌ 자동 수정에 실패했습니다',
  };

  const base = templates[stage];
  return details ? `${base}: ${details}` : base;
}
```

### Step 3: 라벨 관리 유틸리티 구현
**산출물:**
- [ ] `utils/label-manager.ts`: computeLabelChanges 함수

**작업 내용:**
```typescript
interface LabelChanges {
  toAdd: string[];      // 추가할 라벨 (현재 없는 것만)
  toRemove: string[];   // 제거할 라벨 (현재 있는 것만)
}

function computeLabelChanges(
  currentLabels: string[],
  addLabels?: string[],
  removeLabels?: string[]
): LabelChanges {
  const current = new Set(currentLabels);

  const toAdd = (addLabels || []).filter(l => !current.has(l));
  const toRemove = (removeLabels || []).filter(l => current.has(l));

  return { toAdd, toRemove };
}
```

### Step 4: Update Issue Tool 핵심 로직 구현
**산출물:**
- [ ] `tools/update-issue.ts`: updateIssue 함수

**작업 내용:**
```typescript
async function updateIssue(params: UpdateIssueParams): Promise<UpdateIssueResult> {
  // 1. 파라미터 검증
  if (!params.issue_number) {
    throw new MCPError('INVALID_PARAMS', 'issue_number is required');
  }
  if (!params.comment && !params.add_labels && !params.remove_labels && !params.labels) {
    throw new MCPError('INVALID_PARAMS', 'At least one of comment, labels, add_labels, remove_labels is required');
  }

  // 2. 현재 이슈 상태 조회
  const issue = await octokit.issues.get({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    issue_number: params.issue_number,
  });

  const currentLabels = issue.data.labels.map(l => typeof l === 'string' ? l : l.name || '');
  const warnings: string[] = [];

  // 3. 코멘트 추가 (선택)
  let comment_added = false;
  if (params.comment) {
    try {
      await octokit.issues.createComment({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        issue_number: params.issue_number,
        body: params.comment,
      });
      comment_added = true;
    } catch (error) {
      warnings.push(`Failed to add comment: ${error.message}`);
    }
  }

  // 4. 라벨 업데이트 (선택)
  let labels_updated = false;
  let finalLabels = currentLabels;

  if (params.labels) {
    // Option 1: 전체 라벨 교체
    try {
      await octokit.issues.setLabels({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        issue_number: params.issue_number,
        labels: params.labels,
      });
      finalLabels = params.labels;
      labels_updated = true;
    } catch (error) {
      warnings.push(`Failed to set labels: ${error.message}`);
    }
  } else if (params.add_labels || params.remove_labels) {
    // Option 2: 추가/제거 분리
    const changes = computeLabelChanges(currentLabels, params.add_labels, params.remove_labels);

    // 추가할 라벨
    if (changes.toAdd.length > 0) {
      try {
        await octokit.issues.addLabels({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          issue_number: params.issue_number,
          labels: changes.toAdd,
        });
        finalLabels = [...finalLabels, ...changes.toAdd];
        labels_updated = true;
      } catch (error) {
        warnings.push(`Failed to add labels: ${error.message}`);
      }
    }

    // 제거할 라벨
    for (const label of changes.toRemove) {
      try {
        await octokit.issues.removeLabel({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          issue_number: params.issue_number,
          name: label,
        });
        finalLabels = finalLabels.filter(l => l !== label);
        labels_updated = true;
      } catch (error) {
        warnings.push(`Failed to remove label ${label}: ${error.message}`);
      }
    }
  }

  // 5. 결과 반환
  return {
    issue_number: params.issue_number,
    updated_at: new Date().toISOString(),
    comment_added,
    labels_updated,
    current_labels: finalLabels,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
```

### Step 5: 에러 핸들링
**산출물:**
- [ ] 모든 에러 시나리오 처리

**작업 내용:**
- GitHub API 404 → MCP "NOT_FOUND"
- GitHub API 403 → MCP "PERMISSION_DENIED"
- 빈 업데이트 요청 → MCP "INVALID_PARAMS"
- 부분 실패 → 경고 배열 반환 (에러 아님)

### Step 6: MCP Tool 통합
**산출물:**
- [ ] `index.ts`: update_issue Tool 등록

## 테스트 전략

### Unit Tests
- `progress-comment-generator.ts`:
  - 각 단계별 코멘트 형식 검증
  - details 추가 시 형식
- `label-manager.ts`:
  - 중복 추가 방지 (이미 존재하는 라벨)
  - 없는 라벨 제거 시도 (빈 배열 반환)
  - 정상 케이스

### Integration Tests
- Mock Octokit으로 updateIssue 함수 테스트
  - 코멘트만 추가
  - 라벨만 변경 (add_labels, remove_labels)
  - 코멘트 + 라벨 동시 변경
  - 멱등성 검증 (동일 요청 재시도)
  - 부분 실패 (코멘트 성공, 라벨 실패)
  - 404 에러 처리

### Manual Testing
- 실제 GitHub 이슈로 진행 상황 추적
  - 워크플로우 전체 단계별 코멘트 추가
  - 라벨 상태 변화 (processing → success/failed)
  - 부분 실패 시나리오 (존재하지 않는 라벨)

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| 라벨 전체 교체 실수 (labels 사용 시) | 높음 | add_labels, remove_labels 사용 권장, 문서에 경고 추가 |
| 부분 실패 처리 복잡도 | 중간 | Best-Effort 전략, warnings 배열로 실패 정보 전달 |
| 코멘트 중복 추가 (멱등성) | 낮음 | 코멘트는 항상 새로 추가되므로 의도된 동작, 사용자가 호출 횟수 제어 |
| GitHub API Rate Limit | 낮음 | 각 업데이트는 1~3회 API 호출로 Rate Limit 영향 미미 |
| 동시 업데이트 경쟁 조건 | 낮음 | GitHub API는 원자적 연산 보장, 동일 이슈를 동시에 업데이트할 가능성 낮음 |

## 의존성

### 선행 의존성
- `common/types`: MCP 에러 코드, GitHub 설정
- `common/error-handler`: 에러 변환
- `utils/github-client`: Octokit 인스턴스
- 환경 변수: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO

### 후행 의존성
- `orchestrator`: 자동 수정 워크플로우 각 단계에서 호출
- `create-pr`: PR 생성 후 원본 이슈에 PR 링크 코멘트 추가

### 외부 라이브러리
- `@octokit/rest`: ^20.0.0

## 구현 순서 요약

1. 타입 정의 (Step 1)
2. 진행 상황 코멘트 유틸리티 (Step 2)
3. 라벨 관리 유틸리티 (Step 3)
4. 핵심 로직 (Step 4)
5. 에러 핸들링 (Step 5)
6. MCP 통합 (Step 6)

## 참고사항

### 워크플로우 전체 진행 상황 추적 예시
```typescript
// 1. 시작
await updateIssue({
  issue_number: 123,
  comment: generateProgressComment('start'),
  add_labels: ['auto-fix-processing'],
});

// 2. 분석 완료
await updateIssue({
  issue_number: 123,
  comment: generateProgressComment('analyzing', '3개 파일 수정 필요'),
});

// 3. 수정 완료
await updateIssue({
  issue_number: 123,
  comment: generateProgressComment('fixing'),
});

// 4. 테스트 실행
await updateIssue({
  issue_number: 123,
  comment: generateProgressComment('testing'),
});

// 5. 성공 (PR 생성)
await updateIssue({
  issue_number: 123,
  comment: generateProgressComment('success', 'PR #201'),
  remove_labels: ['auto-fix-processing'],
});

// 6. 실패 시
await updateIssue({
  issue_number: 123,
  comment: generateProgressComment('failed', '테스트 통과 안됨'),
  add_labels: ['auto-fix-failed'],
  remove_labels: ['auto-fix-processing'],
});
```

### 라벨 상태 전환 패턴
- 시작: +`auto-fix-processing`
- 성공: -`auto-fix-processing`
- 실패: -`auto-fix-processing`, +`auto-fix-failed`
- 재시도: -`auto-fix-failed`, +`auto-fix-processing`
