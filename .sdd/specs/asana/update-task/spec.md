---
status: draft
created: 2026-01-30
domain: asana
feature: update-task
depends: [common/types]
---

# Update Asana Task

> Asana 태스크에 태그를 추가하거나 코멘트를 남기는 Tool

## Requirement: REQ-001 - 태그 추가

Tool은 태스크에 태그를 추가할 수 있어야 한다.

### Scenario: 단일 태그 추가

- **GIVEN** 유효한 Asana 태스크 ID가 주어지고
- **WHEN** `update_asana_task`를 `tags: ["triaged"]`와 함께 호출하면
- **THEN** 해당 태스크에 "triaged" 태그가 추가되어야 한다
- **AND** 기존 태그들은 유지되어야 한다

### Scenario: 여러 태그 추가

- **GIVEN** 태스크가 존재하고
- **WHEN** `update_asana_task`를 `tags: ["needs-more-info", "high-priority"]`와 함께 호출하면
- **THEN** 두 태그 모두 추가되어야 한다

### Scenario: 중복 태그 처리

- **GIVEN** 태스크에 이미 "triaged" 태그가 있고
- **WHEN** `update_asana_task`를 `tags: ["triaged"]`와 함께 호출하면
- **THEN** 중복 추가 없이 기존 태그를 유지해야 한다
- **AND** 에러를 발생시키지 않아야 한다

## Requirement: REQ-002 - 코멘트 추가

Tool은 태스크에 코멘트를 남길 수 있어야 한다.

### Scenario: 분석 완료 코멘트

- **GIVEN** 에이전트가 태스크 분석을 완료하고
- **WHEN** `update_asana_task`를 GitHub Issue 링크 코멘트와 함께 호출하면
- **THEN** 코멘트가 태스크에 추가되어야 한다
- **AND** 코멘트 작성자는 MCP 서버의 봇 계정이어야 한다

### Scenario: 분석 실패 코멘트

- **GIVEN** 에이전트가 태스크 분석에 실패하고
- **WHEN** `update_asana_task`를 부족한 정보 요청 코멘트와 함께 호출하면
- **THEN** 구조화된 코멘트가 추가되어야 한다
- **AND** 코멘트는 필요한 정보를 명확히 나열해야 한다

### Scenario: Markdown 형식 코멘트

- **GIVEN** 코멘트에 Markdown 형식이 포함되어 있고
- **WHEN** Tool이 실행되면
- **THEN** Markdown을 Asana HTML 형식으로 변환하여 추가해야 한다
- **AND** 링크, 볼드, 리스트 형식을 보존해야 한다

## Requirement: REQ-003 - 태그와 코멘트 동시 업데이트

Tool은 한 번의 호출로 태그 추가와 코멘트 작성을 모두 수행할 수 있어야 한다.

### Scenario: 분석 성공 시 업데이트

- **GIVEN** 에이전트가 태스크를 성공적으로 분석하여 GitHub Issue를 생성하고
- **WHEN** `update_asana_task`를 `tags: ["triaged"]`와 GitHub Issue 링크 코멘트로 호출하면
- **THEN** "triaged" 태그가 추가되어야 한다
- **AND** GitHub Issue 링크를 포함한 코멘트가 추가되어야 한다
- **AND** 두 작업이 원자적으로 수행되어야 한다

### Scenario: 분석 실패 시 업데이트

- **GIVEN** 에이전트가 재현 불가 판정을 내리고
- **WHEN** `update_asana_task`를 `tags: ["cannot-reproduce"]`와 보충 요청 코멘트로 호출하면
- **THEN** "cannot-reproduce" 태그가 추가되어야 한다
- **AND** 재현 단계 상세화 요청 코멘트가 추가되어야 한다

## Requirement: REQ-004 - 섹션 이동

Tool은 태스크를 다른 섹션으로 이동할 수 있어야 한다.

### Scenario: Triaged 섹션으로 이동

- **GIVEN** "To Triage" 섹션에 태스크가 있고
- **WHEN** `update_asana_task`를 `section: "Triaged"`와 함께 호출하면
- **THEN** 태스크가 "Triaged" 섹션으로 이동해야 한다

### Scenario: Needs More Info 섹션으로 이동

- **GIVEN** 분석 결과 정보 부족으로 판정되고
- **WHEN** `update_asana_task`를 `section: "Needs More Info"`와 함께 호출하면
- **THEN** 태스크가 "Needs More Info" 섹션으로 이동해야 한다

## Requirement: REQ-005 - 응답 형식

Tool은 업데이트 결과를 명확히 반환해야 한다.

### Scenario: 성공적인 업데이트

- **GIVEN** 유효한 파라미터가 주어지고
- **WHEN** Tool이 성공적으로 실행되면
- **THEN** 다음 구조의 결과를 반환해야 한다:

```typescript
{
  success: true;
  task_id: string;
  updates: {
    tags_added?: string[];
    comment_added?: boolean;
    section_changed?: {
      from: string;
      to: string;
    };
  };
  updated_at: string;  // ISO 8601
}
```

### Scenario: 부분 실패

- **GIVEN** 태그 추가는 성공했지만 코멘트 추가가 실패하고
- **WHEN** Tool이 실행되면
- **THEN** 성공한 작업과 실패한 작업을 구분하여 반환해야 한다
- **AND** 에러 메시지를 포함해야 한다

## Parameters

```typescript
interface UpdateAsanaTaskParams {
  task_id: string;                  // REQUIRED: Asana 태스크 ID
  tags?: string[];                  // 추가할 태그 목록
  comment?: string;                 // 추가할 코멘트 (Markdown 지원)
  section?: string;                 // 이동할 섹션명
  completed?: boolean;              // 완료 처리 여부
  assignee?: string;                // 담당자 변경 (Asana user ID)
}
```

## Implementation Notes

- Asana API 사용:
  - `/tasks/{task_id}/addTag` - 태그 추가
  - `/tasks/{task_id}/stories` - 코멘트 추가
  - `/tasks/{task_id}/addProject` - 섹션 이동
- MUST handle tag creation if tag doesn't exist in workspace
- SHOULD convert Markdown to Asana-compatible HTML for comments
- MUST use transactional approach for multiple updates
- SHOULD validate section name exists before moving
- MUST log all updates for audit trail
- SHOULD support idempotent operations (safe to retry)
