---
status: draft
created: 2026-01-30
domain: asana
feature: list-tasks
depends: [common/types]
---

# List Asana Tasks

> Asana 프로젝트에서 조건에 맞는 태스크 목록을 조회하는 Tool

## Requirement: REQ-001 - 프로젝트별 태스크 목록 조회

Tool은 지정된 Asana 프로젝트에서 태스크 목록을 조회할 수 있어야 한다.

### Scenario: 기본 태스크 목록 조회

- **GIVEN** 유효한 Asana 프로젝트 ID가 주어지고
- **WHEN** `list_asana_tasks`를 `project_id`와 함께 호출하면
- **THEN** 해당 프로젝트의 모든 태스크 목록을 반환해야 한다
- **AND** 각 태스크는 `id`, `name`, `created_at`, `tags` 정보를 포함해야 한다

### Scenario: 섹션 필터링

- **GIVEN** 프로젝트에 "To Triage", "Triaged" 섹션이 존재하고
- **WHEN** `list_asana_tasks`를 `section: "To Triage"`와 함께 호출하면
- **THEN** "To Triage" 섹션의 태스크만 반환해야 한다

### Scenario: 태그 필터링

- **GIVEN** 프로젝트에 다양한 태그가 붙은 태스크들이 존재하고
- **WHEN** `list_asana_tasks`를 `tags: ["needs-more-info"]`와 함께 호출하면
- **THEN** "needs-more-info" 태그가 붙지 않은 태스크만 반환해야 한다

## Requirement: REQ-002 - /triage 커맨드를 위한 필터링

Tool은 `/triage` 커맨드에서 처리 대상 태스크를 필터링할 수 있어야 한다.

### Scenario: Triage 대상 태스크 조회

- **GIVEN** "To Triage" 섹션에 여러 태스크가 존재하고
- **AND** 일부는 이미 "triaged" 태그가 붙어 있고
- **WHEN** `/triage` 커맨드가 실행되면
- **THEN** Tool은 "To Triage" 섹션의 태스크 중
- **AND** "triaged", "needs-more-info", "cannot-reproduce", "unclear-requirement", "needs-context", "auto-fix-skip" 태그가 없는 태스크만 반환해야 한다

### Scenario: 특정 태스크 ID로 조회

- **GIVEN** `/triage --task 12345` 커맨드가 실행되고
- **WHEN** `list_asana_tasks`를 `task_id: "12345"`와 함께 호출하면
- **THEN** 해당 태스크만 반환해야 한다
- **AND** 태그 필터링은 적용하지 않아야 한다

## Requirement: REQ-003 - 응답 형식

Tool은 일관된 형식으로 태스크 목록을 반환해야 한다.

### Scenario: 성공적인 조회

- **GIVEN** 유효한 파라미터가 주어지고
- **WHEN** Tool이 성공적으로 실행되면
- **THEN** 다음 구조의 결과를 반환해야 한다:

```typescript
{
  tasks: [
    {
      id: string;           // Asana 태스크 ID
      name: string;         // 태스크 제목
      created_at: string;   // ISO 8601 형식
      tags: string[];       // 태그명 목록
      section: string;      // 섹션명
      assignee?: string;    // 담당자 (optional)
    }
  ];
  total: number;            // 총 태스크 수
}
```

### Scenario: 빈 결과

- **GIVEN** 조건에 맞는 태스크가 없고
- **WHEN** Tool이 실행되면
- **THEN** `tasks: []`, `total: 0`을 반환해야 한다

### Scenario: 권한 없음

- **GIVEN** Asana API 토큰이 프로젝트 접근 권한이 없고
- **WHEN** Tool이 실행되면
- **THEN** 에러를 반환해야 한다
- **AND** 에러 메시지는 "Unauthorized access to project"를 포함해야 한다

## Parameters

```typescript
interface ListAsanaTasksParams {
  project_id?: string;          // Asana 프로젝트 ID (설정 파일에서 기본값)
  section?: string;             // 섹션명 필터 (예: "To Triage")
  tags?: string[];              // 제외할 태그 목록
  task_id?: string;             // 특정 태스크 ID (이 경우 다른 필터 무시)
  limit?: number;               // 최대 결과 수 (기본: 100)
}
```

## Implementation Notes

- Asana API `/projects/{project_id}/tasks` 엔드포인트 사용
- MUST use environment variable `ASANA_TOKEN` for authentication
- SHOULD cache project sections for performance
- MUST handle rate limiting with exponential backoff
- SHOULD log API calls for debugging
