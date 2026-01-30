---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# Get Asana Task 구현 계획

## 기술 결정

### 결정 1: HTML to Markdown 변환 라이브러리
**선택:** `turndown` 라이브러리 사용
**근거:**
- Asana API는 `html_notes` 필드로 HTML 반환
- 에이전트는 Markdown이 더 파싱하기 쉬움
- `turndown`은 경량이며 코드 블록, 링크 보존 지원

### 결정 2: 코멘트 조회 전략
**선택:** Stories API 사용 (`/tasks/{task_id}/stories`)
**근거:**
- Asana의 코멘트는 "stories" 타입으로 저장됨
- `type="comment"`로 필터링하여 시스템 이벤트 제외
- 시간순 정렬은 API에서 기본 제공

### 결정 3: 커스텀 필드 처리
**선택:** 필드명 → 값 매핑 객체로 변환
**근거:**
- Asana API는 `{ name, display_value }` 구조 반환
- 에이전트는 `{ "Priority": "High" }` 형식이 더 직관적
- enum 값은 `display_value` 사용 (ID 대신)

### 결정 4: 캐싱 전략
**선택:** 세션 단위 캐시 (Redis 없이 in-memory)
**근거:**
- 같은 세션 내에서 태스크 재조회 가능 (analyze → update)
- TTL 5분으로 stale 데이터 방지
- 메모리 사용량: 태스크당 ~10KB로 허용 가능

## 구현 단계

### Step 1: Asana API 호출 함수
**산출물:**
- [ ] `src/asana/get-task.ts` - 태스크 상세 조회 함수
- [ ] `opt_fields` 파라미터로 모든 필요 필드 요청
- [ ] 에러 핸들링 (404, 401, 403)

**요청 필드:**
```
name,notes,html_notes,created_at,modified_at,completed,
tags.name,memberships.section,assignee,custom_fields,
attachments,projects
```

### Step 2: HTML to Markdown 변환
**산출물:**
- [ ] `src/asana/html-converter.ts` - HTML → Markdown 변환
- [ ] `turndown` 설정 (줄바꿈 보존, 코드 블록 처리)
- [ ] XSS 방지를 위한 sanitization

**변환 옵션:**
```typescript
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});
```

### Step 3: Stories (코멘트) 조회
**산출물:**
- [ ] `/tasks/{task_id}/stories` API 호출
- [ ] `type="comment"`로 필터링
- [ ] 시간순 정렬, 작성자 정보 포함

**로직:**
```typescript
const stories = await client.stories.findByTask(taskId);
const comments = stories
  .filter(s => s.resource_subtype === 'comment_added')
  .map(s => ({
    id: s.gid,
    created_at: s.created_at,
    author: { name: s.created_by.name, email: s.created_by.email },
    text: s.text,
  }));
```

### Step 4: 커스텀 필드 변환
**산출물:**
- [ ] 커스텀 필드 배열 → 객체 매핑 함수
- [ ] enum, text, number 타입별 처리

**변환 예제:**
```typescript
// API 응답
custom_fields: [
  { name: "Priority", display_value: "High" },
  { name: "Component", display_value: "Editor" },
]

// 변환 결과
custom_fields: {
  "Priority": "High",
  "Component": "Editor",
}
```

### Step 5: 첨부파일 처리
**산출물:**
- [ ] 첨부파일 목록 추출
- [ ] `download_url` 필드 포함 (임시 URL)
- [ ] 파일 크기와 타입 정보 제공

**주의사항:**
- Asana의 `download_url`은 시간 제한 있음 (1시간)
- 대용량 파일(>10MB)은 별도 다운로드 Tool 필요

### Step 6: 캐시 레이어 구현
**산출물:**
- [ ] `src/asana/task-cache.ts` - In-memory 캐시
- [ ] TTL 5분, LRU eviction
- [ ] 캐시 키: `task:{task_id}`

**인터페이스:**
```typescript
interface TaskCache {
  get(taskId: string): Promise<AsanaTask | null>;
  set(taskId: string, task: AsanaTask): void;
  invalidate(taskId: string): void;
}
```

### Step 7: MCP Tool 등록
**산출물:**
- [ ] `src/mcp/tools/get-asana-task.ts` - Tool 정의
- [ ] 파라미터 스키마 (Zod)
- [ ] 조건부 필드 로딩 (`include_*` 파라미터)

**Tool 스키마:**
```typescript
const schema = z.object({
  task_id: z.string(),
  include_comments: z.boolean().default(true),
  include_attachments: z.boolean().default(true),
  include_custom_fields: z.boolean().default(true),
});
```

### Step 8: 응답 포맷팅
**산출물:**
- [ ] 일관된 응답 구조 생성
- [ ] 섹션 정보 추출 (프로젝트별로 다를 수 있음)
- [ ] 날짜 ISO 8601 형식 통일

## 테스트 전략

### 단위 테스트
- [ ] HTML → Markdown 변환 (다양한 HTML 패턴)
  - 코드 블록, 링크, 리스트, 볼드/이탤릭
  - XSS 시도 (script 태그 제거 확인)
- [ ] 커스텀 필드 매핑 (빈 값, null 처리)
- [ ] Stories 필터링 (comment만 추출)

### 통합 테스트
- [ ] Asana API mock 서버
- [ ] 존재하지 않는 태스크 조회 (404 에러)
- [ ] 권한 없는 태스크 조회 (403 에러)
- [ ] `include_*=false` 파라미터 동작 확인

### 테스트 데이터
```typescript
const mockTask = {
  gid: "1234567890",
  name: "버튼 클릭 시 에러",
  html_notes: "<p>에러 메시지: <code>TypeError</code></p>",
  custom_fields: [
    { name: "Priority", display_value: "High" },
  ],
  attachments: [
    { name: "screenshot.png", download_url: "https://...", size: 51200 },
  ],
};
```

**기대 결과:**
```json
{
  "task": {
    "id": "1234567890",
    "name": "버튼 클릭 시 에러",
    "description": "에러 메시지: `TypeError`",
    "custom_fields": { "Priority": "High" },
    "attachments": [
      { "name": "screenshot.png", "download_url": "https://...", "size": 51200 }
    ]
  }
}
```

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| HTML 변환 중 정보 손실 | Medium | Markdown 변환 실패 시 원본 HTML도 함께 반환 |
| 대용량 코멘트 (>1000개) | Low | 최신 100개만 조회 후 필요 시 페이지네이션 |
| 첨부파일 URL 만료 | High | 다운로드가 필요한 경우 즉시 처리, 재조회 가능 안내 |
| 커스텀 필드 스키마 변경 | Medium | 필드명을 설정 파일에서 관리, 버전별 매핑 |
| XSS 공격 (악의적 HTML) | High | `turndown` + DOMPurify로 sanitization |

## 의존성

### 선행 작업
- `common/types` - AsanaTask, AsanaComment 타입 정의
- `asana/client` - Asana API 클라이언트 초기화

### 외부 패키지
- `turndown` - HTML to Markdown 변환
- `dompurify` - HTML sanitization (선택적)
- `asana` - 공식 SDK

### 후속 작업
- `analyze-task` - 이 Tool의 결과를 분석 입력으로 사용
- `update-task` - 태스크 수정 시 현재 상태 확인용
