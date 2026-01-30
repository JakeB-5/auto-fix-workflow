---
status: draft
created: 2026-01-30
domain: asana
feature: get-task
depends: [common/types]
---

# Get Asana Task

> 특정 Asana 태스크의 상세 정보를 조회하는 Tool

## Requirement: REQ-001 - 태스크 상세 정보 조회

Tool은 태스크 ID로 상세 정보를 조회할 수 있어야 한다.

### Scenario: 기본 태스크 정보 조회

- **GIVEN** 유효한 Asana 태스크 ID가 주어지고
- **WHEN** `get_asana_task`를 호출하면
- **THEN** 태스크의 모든 상세 정보를 반환해야 한다
- **AND** 제목, 설명, 태그, 섹션, 커스텀 필드를 포함해야 한다

### Scenario: 존재하지 않는 태스크

- **GIVEN** 존재하지 않는 태스크 ID가 주어지고
- **WHEN** Tool이 실행되면
- **THEN** 에러를 반환해야 한다
- **AND** 에러 메시지는 "Task not found"를 포함해야 한다

## Requirement: REQ-002 - 분석을 위한 충분한 컨텍스트 제공

Tool은 에이전트가 태스크를 분석하는데 필요한 모든 정보를 제공해야 한다.

### Scenario: 버그 리포트 태스크 조회

- **GIVEN** 버그 리포트 태스크가 존재하고
- **AND** 설명에 에러 메시지와 재현 단계가 포함되어 있고
- **WHEN** `get_asana_task`를 호출하면
- **THEN** 설명 전체를 반환해야 한다
- **AND** 첨부파일 URL 목록을 포함해야 한다
- **AND** 모든 코멘트를 시간순으로 정렬하여 포함해야 한다

### Scenario: 커스텀 필드 조회

- **GIVEN** 태스크에 "Priority", "Component", "Browser" 커스텀 필드가 설정되어 있고
- **WHEN** Tool이 실행되면
- **THEN** 커스텀 필드 값들을 반환해야 한다
- **AND** 필드명과 값을 매핑한 객체로 제공해야 한다

## Requirement: REQ-003 - 태스크 메타데이터

Tool은 태스크의 메타데이터를 제공해야 한다.

### Scenario: 태스크 상태 정보

- **GIVEN** 태스크가 조회되고
- **WHEN** Tool이 실행되면
- **THEN** 다음 메타데이터를 포함해야 한다:
  - 생성일시
  - 수정일시
  - 완료 여부
  - 담당자 정보
  - 프로젝트 정보
  - 섹션 정보

### Scenario: 첨부파일 목록

- **GIVEN** 태스크에 스크린샷 이미지가 첨부되어 있고
- **WHEN** Tool이 실행되면
- **THEN** 첨부파일 URL과 파일명을 반환해야 한다
- **AND** 에이전트가 이미지를 다운로드할 수 있어야 한다

## Requirement: REQ-004 - 응답 형식

Tool은 일관된 형식으로 태스크 상세 정보를 반환해야 한다.

### Scenario: 성공적인 조회

- **GIVEN** 유효한 태스크 ID가 주어지고
- **WHEN** Tool이 성공적으로 실행되면
- **THEN** 다음 구조의 결과를 반환해야 한다:

```typescript
{
  task: {
    id: string;
    name: string;
    description: string;          // HTML 또는 Markdown 형식
    notes?: string;               // 추가 노트
    created_at: string;           // ISO 8601
    modified_at: string;          // ISO 8601
    completed: boolean;
    tags: string[];
    section: {
      id: string;
      name: string;
    };
    assignee?: {
      id: string;
      name: string;
      email: string;
    };
    custom_fields: {
      [fieldName: string]: string | number | boolean;
    };
    attachments: Array<{
      id: string;
      name: string;
      download_url: string;
      content_type: string;
      size: number;
    }>;
    comments: Array<{
      id: string;
      created_at: string;
      author: {
        name: string;
        email: string;
      };
      text: string;
    }>;
  };
}
```

### Scenario: HTML 설명 변환

- **GIVEN** 태스크 설명이 HTML 형식이고
- **WHEN** Tool이 실행되면
- **THEN** HTML을 Markdown으로 변환하여 반환해야 한다
- **AND** 변환 시 줄바꿈, 링크, 코드 블록을 보존해야 한다

## Parameters

```typescript
interface GetAsanaTaskParams {
  task_id: string;                  // REQUIRED: Asana 태스크 ID
  include_comments?: boolean;       // 코멘트 포함 여부 (기본: true)
  include_attachments?: boolean;    // 첨부파일 포함 여부 (기본: true)
  include_custom_fields?: boolean;  // 커스텀 필드 포함 여부 (기본: true)
}
```

## Implementation Notes

- Asana API `/tasks/{task_id}` 엔드포인트 사용
- MUST request `opt_fields` to include all necessary data:
  - `name,notes,html_notes,created_at,modified_at,completed,tags,memberships.section,assignee,custom_fields,attachments,stories`
- SHOULD convert HTML notes to Markdown for easier parsing
- MUST handle large attachments gracefully
- SHOULD cache task data for repeated access within same session
- MUST sanitize HTML content to prevent XSS if displayed
