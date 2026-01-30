---
version: 1.1.0
created: 2026-01-30
updated: 2026-01-30
---

# Constitution: auto-fix-workflow

> 이 프로젝트의 모든 설계와 구현은 아래 원칙을 준수해야 한다(SHALL).

## 핵심 원칙

### 1. 품질 우선

- 모든 기능은 테스트와 함께 구현해야 한다(SHALL)
- 코드 리뷰 없이 머지해서는 안 된다(SHALL NOT)

### 2. 명세 우선

- 모든 기능은 스펙 문서가 먼저 작성되어야 한다(SHALL)
- 스펙은 RFC 2119 키워드를 사용해야 한다(SHALL)
- 모든 요구사항은 GIVEN-WHEN-THEN 시나리오를 포함해야 한다(SHALL)

## 금지 사항

- 스펙 없이 기능을 구현해서는 안 된다(SHALL NOT)
- 테스트 없이 배포해서는 안 된다(SHALL NOT)

## 기술 스택

### Runtime & Language
- Node.js 20+ (SHALL)
- TypeScript strict mode (SHALL)

### Framework
- MCP SDK for tool server implementation (SHALL)

### Dependencies
- `@octokit/rest` - GitHub API 클라이언트 (SHALL)
- `simple-git` - Git 작업 (SHALL)
- `zod` - 스키마 검증 (SHALL)

### External Services
- GitHub API (REST/GraphQL) (SHALL)
- Asana API (SHALL)
- Sentry API (Webhook) (MAY)

## 품질 기준

- 테스트 커버리지: 80% 이상(SHOULD)
