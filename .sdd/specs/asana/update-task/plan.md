---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Update Asana Task 구현 계획

## 기술 결정

### 결정 1: 원자적 업데이트 전략
**선택:** 순차적 API 호출 + 트랜잭션 로그
**근거:**
- Asana API는 단일 트랜잭션을 지원하지 않음
- 각 업데이트(태그, 코멘트, 섹션)는 별도 엔드포인트
- 실패 시 롤백 대신 부분 성공을 응답에 명시

### 결정 2: Markdown to HTML 변환
**선택:** `marked` 라이브러리 + Asana HTML 스타일 적용
**근거:**
- 코멘트는 Markdown으로 작성하지만 Asana는 HTML 저장
- `marked`는 경량이며 커스텀 렌더러 지원
- Asana HTML 스타일: `<body>` 태그로 감싸기

### 결정 3: 태그 생성 전략
**선택:** 태그가 없으면 자동 생성 (workspace 레벨)
**근거:**
- 새 태그를 매번 수동 생성하면 번거로움
- `/workspaces/{workspace_id}/tags` POST로 생성
- 태그 색상은 기본값 사용

### 결정 4: 섹션 이동 방법
**선택:** `addProject` API에 `section` 파라미터 사용
**근거:**
- Asana에서 섹션은 프로젝트의 하위 개념
- 섹션 ID를 캐시에서 조회 후 이동
- 잘못된 섹션명은 에러 반환

## 구현 단계

### Step 1: 태그 관리 모듈
**산출물:**
- [ ] `src/asana/tag-manager.ts` - 태그 추가/생성 로직
- [ ] 중복 태그 필터링 (이미 존재하면 스킵)
- [ ] 태그 생성 API 호출

**로직:**
```typescript
async function addTags(taskId: string, tags: string[]) {
  const task = await client.tasks.findById(taskId);
  const existingTags = task.tags.map(t => t.name);

  const newTags = tags.filter(tag => !existingTags.includes(tag));

  for (const tag of newTags) {
    const tagObj = await findOrCreateTag(tag);
    await client.tasks.addTag(taskId, { tag: tagObj.gid });
  }

  return newTags;
}
```

### Step 2: 태그 생성 및 캐싱
**산출물:**
- [ ] 태그 이름 → 태그 ID 매핑 캐시
- [ ] `/workspaces/{workspace_id}/tags` 조회/생성
- [ ] 태그 색상 기본값 설정

**캐시 전략:**
- Key: `tag:{workspace_id}:{tag_name}`
- TTL: 24시간 (태그는 거의 변경되지 않음)

### Step 3: Markdown to HTML 변환
**산출물:**
- [ ] `src/asana/markdown-converter.ts` - Markdown → HTML
- [ ] `marked` 설정 (링크 target="_blank", sanitization)
- [ ] Asana 형식으로 래핑 (`<body>...</body>`)

**변환 예제:**
```typescript
import { marked } from 'marked';

function markdownToAsanaHtml(markdown: string): string {
  const html = marked.parse(markdown, {
    breaks: true,  // 줄바꿈 보존
    gfm: true,     // GitHub Flavored Markdown
  });

  return `<body>${html}</body>`;
}
```

### Step 4: 코멘트 추가
**산출물:**
- [ ] `/tasks/{task_id}/stories` POST 호출
- [ ] HTML 변환 후 전송
- [ ] 코멘트 작성 실패 시 에러 처리

**API 요청:**
```typescript
await client.stories.createOnTask(taskId, {
  html_text: markdownToAsanaHtml(comment),
});
```

### Step 5: 섹션 이동
**산출물:**
- [ ] 섹션명 → 섹션 ID 조회 (캐시 활용)
- [ ] `/tasks/{task_id}/addProject` API 호출
- [ ] 현재 섹션 정보 반환 (before/after)

**로직:**
```typescript
async function moveToSection(taskId: string, sectionName: string) {
  const task = await client.tasks.findById(taskId);
  const project = task.projects[0];  // 첫 번째 프로젝트 사용

  const sectionId = await sectionCache.get(project.gid, sectionName);
  if (!sectionId) {
    throw new Error(`Section "${sectionName}" not found`);
  }

  await client.tasks.addProject(taskId, {
    project: project.gid,
    section: sectionId,
  });
}
```

### Step 6: 통합 업데이트 함수
**산출물:**
- [ ] `src/asana/update-task.ts` - 모든 업데이트 통합
- [ ] 파라미터별 조건부 실행
- [ ] 부분 실패 처리

**실행 순서:**
1. 태그 추가 (실패해도 계속)
2. 섹션 이동 (실패해도 계속)
3. 코멘트 추가 (실패해도 계속)
4. 결과 집계 및 반환

### Step 7: MCP Tool 등록
**산출물:**
- [ ] `src/mcp/tools/update-asana-task.ts` - Tool 정의
- [ ] 파라미터 검증 (Zod)
- [ ] 최소 1개 이상의 업데이트 파라미터 필수

**Tool 스키마:**
```typescript
const schema = z.object({
  task_id: z.string(),
  tags: z.array(z.string()).optional(),
  comment: z.string().optional(),
  section: z.string().optional(),
  completed: z.boolean().optional(),
  assignee: z.string().optional(),
}).refine(
  data => data.tags || data.comment || data.section || data.completed !== undefined || data.assignee,
  { message: "At least one update parameter is required" }
);
```

### Step 8: 응답 포맷팅 및 에러 처리
**산출물:**
- [ ] 부분 성공 응답 구조
- [ ] 에러 메시지 집계

**응답 예제 (부분 실패):**
```json
{
  "success": false,
  "task_id": "1234567890",
  "updates": {
    "tags_added": ["triaged"],
    "comment_added": true,
    "section_changed": null
  },
  "errors": [
    {
      "operation": "section_change",
      "message": "Section 'Invalid Section' not found"
    }
  ],
  "updated_at": "2026-01-30T12:00:00Z"
}
```

## 테스트 전략

### 단위 테스트
- [ ] Markdown → HTML 변환
  - 링크, 볼드, 리스트, 코드 블록
  - 특수문자 이스케이프
- [ ] 중복 태그 필터링
- [ ] 섹션명 → ID 매핑 실패 시 에러

### 통합 테스트
- [ ] 모든 파라미터 동시 업데이트
- [ ] 부분 실패 시나리오 (태그는 성공, 섹션은 실패)
- [ ] 멱등성 테스트 (같은 요청 2번 → 동일 결과)

### 테스트 케이스
1. **성공 케이스:**
   - `tags=["triaged"]`, `comment="GitHub Issue: #123"`
   - 기대: 두 작업 모두 성공
2. **부분 실패 케이스:**
   - `tags=["triaged"]`, `section="Invalid"`
   - 기대: 태그는 추가, 섹션 이동은 에러
3. **중복 태그 케이스:**
   - 이미 "triaged" 태그가 있는 태스크에 `tags=["triaged"]`
   - 기대: `tags_added: []`, 에러 없음
4. **멱등성 케이스:**
   - 같은 코멘트를 2번 추가
   - 기대: 2개의 코멘트 생성 (Asana는 중복 방지 안 함)

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| 부분 실패 시 사용자 혼란 | Medium | 응답에 성공/실패 항목을 명확히 구분 |
| 태그 자동 생성으로 오타 태그 누적 | Low | 태그명 validation (허용 목록 설정 파일) |
| Markdown 변환 중 정보 손실 | Low | 변환 실패 시 원본 텍스트로 fallback |
| 섹션 이동 실패 (권한 문제) | Medium | 명확한 에러 메시지, 재시도 가능 표시 |
| API rate limit (여러 작업 순차 실행) | High | 최대 3개 API 호출로 제한, 캐시 활용 |

## 의존성

### 선행 작업
- `asana/client` - Asana API 클라이언트
- `asana/cache` - 태그 및 섹션 캐시
- `common/types` - UpdateResult 타입 정의

### 외부 패키지
- `marked` - Markdown to HTML 변환
- `asana` - 공식 SDK
- `zod` - 파라미터 검증

### 후속 작업
- `analyze-task` - 분석 완료 후 이 Tool 사용
- Workflow - Triage 완료 시 태그 및 섹션 업데이트
