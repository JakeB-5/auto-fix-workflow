---
status: draft
created: 2026-01-30
spec: ./spec.md
---

# List Asana Tasks 구현 계획

## 기술 결정

### 결정 1: Asana API 클라이언트 선택
**선택:** 공식 Asana JavaScript SDK 사용 (`asana` npm package)
**근거:**
- 타입 정의와 에러 핸들링이 내장되어 있음
- Rate limiting 자동 처리 가능
- 프로젝트 표준 라이브러리로 채택하여 일관성 유지

### 결정 2: 필터링 로직 구현 위치
**선택:** Tool 레이어에서 필터링 수행 (API 쿼리 + 클라이언트 필터링 조합)
**근거:**
- Asana API는 섹션 필터는 지원하지만 태그 제외 필터는 미지원
- 클라이언트에서 태그 필터링하여 유연성 확보
- 성능: 대부분의 프로젝트가 100개 미만 태스크이므로 허용 가능

### 결정 3: 캐싱 전략
**선택:** 섹션 목록을 메모리 캐시 (5분 TTL)
**근거:**
- 섹션은 자주 변경되지 않음
- 매 호출마다 섹션 조회는 API quota 낭비
- In-memory cache로 단순 구현 (Redis 불필요)

### 결정 4: 에러 핸들링
**선택:** 구조화된 에러 객체 반환 (throw 대신 결과 객체)
**근거:**
- MCP Tool은 JSON 응답을 반환해야 함
- 에이전트가 에러를 parsing하여 재시도 전략 결정 가능
- 일관된 에러 형식: `{ error: string, code: string, retryable: boolean }`

## 구현 단계

### Step 1: Asana API 클라이언트 초기화
**산출물:**
- [ ] `src/asana/client.ts` - Asana 클라이언트 싱글톤
- [ ] 환경변수 `ASANA_TOKEN` 검증 로직
- [ ] Rate limiting 설정 (150 requests/minute)
- [ ] 에러 핸들링 wrapper 함수

**기술 세부사항:**
- Exponential backoff: 초기 1초, 최대 30초
- Retry 조건: 429 (rate limit), 500, 502, 503, 504
- 최대 재시도: 3회

### Step 2: 섹션 캐시 구현
**산출물:**
- [ ] `src/asana/cache.ts` - In-memory 캐시 모듈
- [ ] 섹션 ID → 섹션명 매핑 캐시
- [ ] TTL 기반 자동 만료 로직

**인터페이스:**
```typescript
interface SectionCache {
  get(projectId: string, sectionName: string): Promise<string | null>;
  invalidate(projectId: string): void;
}
```

### Step 3: 태스크 목록 조회 함수
**산출물:**
- [ ] `src/asana/list-tasks.ts` - 핵심 비즈니스 로직
- [ ] Asana API `/projects/{project_id}/tasks` 호출
- [ ] `opt_fields` 파라미터로 필요한 필드만 요청

**요청 필드:**
```
name,created_at,tags.name,memberships.section.name,assignee.name
```

### Step 4: 필터링 로직 구현
**산출물:**
- [ ] 섹션 필터링: `section` 파라미터가 있으면 해당 섹션만
- [ ] 태그 필터링: `tags` 파라미터의 태그가 없는 태스크만
- [ ] 특정 태스크 조회: `task_id`가 있으면 다른 필터 무시

**로직:**
```typescript
// Section filter (API level)
if (section) {
  const sectionId = await cache.get(projectId, section);
  tasks = await client.tasks.findBySection(sectionId);
}

// Tag filter (client level)
if (tags && tags.length > 0) {
  tasks = tasks.filter(task => {
    const taskTags = task.tags.map(t => t.name);
    return !tags.some(excludeTag => taskTags.includes(excludeTag));
  });
}
```

### Step 5: MCP Tool 등록
**산출물:**
- [ ] `src/mcp/tools/list-asana-tasks.ts` - Tool 정의
- [ ] 파라미터 검증 (Zod 스키마)
- [ ] Tool description과 예제

**Tool 스키마:**
```typescript
const schema = z.object({
  project_id: z.string().optional(),
  section: z.string().optional(),
  tags: z.array(z.string()).optional(),
  task_id: z.string().optional(),
  limit: z.number().min(1).max(500).default(100),
});
```

### Step 6: 응답 포맷팅
**산출물:**
- [ ] 일관된 응답 구조 생성
- [ ] 날짜를 ISO 8601 형식으로 변환
- [ ] 태그를 문자열 배열로 변환

**응답 예제:**
```json
{
  "tasks": [
    {
      "id": "1234567890",
      "name": "버튼 클릭 시 에러 발생",
      "created_at": "2026-01-30T10:00:00Z",
      "tags": ["bug", "ui"],
      "section": "To Triage",
      "assignee": "John Doe"
    }
  ],
  "total": 1
}
```

## 테스트 전략

### 단위 테스트
- [ ] 섹션 캐시 TTL 동작 확인
- [ ] 태그 필터링 로직 (다양한 케이스)
- [ ] 에러 핸들링 (401, 404, 429, 500)
- [ ] `task_id` 파라미터가 다른 필터를 무시하는지 확인

### 통합 테스트
- [ ] Asana API mock 서버 사용
- [ ] Rate limiting 시나리오 (429 응답 → 재시도)
- [ ] 실제 프로젝트 데이터로 end-to-end 테스트

### 테스트 데이터
```typescript
const mockTasks = [
  { id: "1", name: "Task A", tags: ["bug"], section: "To Triage" },
  { id: "2", name: "Task B", tags: ["triaged"], section: "To Triage" },
  { id: "3", name: "Task C", tags: [], section: "Triaged" },
];
```

**테스트 케이스:**
1. `section="To Triage"` → Task A, B 반환
2. `section="To Triage", tags=["triaged"]` → Task A만 반환
3. `task_id="2"` → Task B만 반환 (섹션/태그 필터 무시)

## 리스크 분석

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| Asana API rate limit 초과 | High | Exponential backoff + 요청 최소화 (opt_fields) |
| 섹션명이 프로젝트마다 다름 | Medium | 섹션명을 설정 파일에서 관리 (config.json) |
| 대량의 태스크 조회 시 성능 저하 | Medium | `limit` 파라미터로 제한, 페이지네이션 고려 |
| 환경변수 `ASANA_TOKEN` 누락 | High | 초기화 시 검증, 명확한 에러 메시지 |
| 태그명 오타로 필터링 실패 | Low | 로그에 필터 조건 명시, 결과 수 확인 |

## 의존성

### 선행 작업
- `common/types` - 공통 타입 정의 (AsanaTask, AsanaTag 등)
- 환경변수 설정 (`.env` 파일)

### 외부 패키지
- `asana` - 공식 SDK
- `zod` - 파라미터 검증
- `@modelcontextprotocol/sdk` - MCP Tool 등록

### 후속 작업
- `get-task` - 상세 조회에서 이 Tool의 결과를 활용 가능
- `analyze-task` - 분석 대상 태스크 목록 조회 시 사용
