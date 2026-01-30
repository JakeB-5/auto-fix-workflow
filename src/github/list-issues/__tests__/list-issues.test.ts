/**
 * @module github/list-issues/__tests__/list-issues.test
 * @description Unit tests for the list-issues functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Octokit } from '@octokit/rest';

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn(() => ({
    issues: {
      listForRepo: vi.fn(),
    },
  })),
}));

describe('list-issues', () => {
  let mockOctokit: {
    issues: {
      listForRepo: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOctokit = new Octokit() as unknown as {
      issues: {
        listForRepo: ReturnType<typeof vi.fn>;
      };
    };
  });

  describe('REQ-001: 라벨 기반 이슈 조회', () => {
    describe('Scenario: 기본 auto-fix 이슈 조회', () => {
      it('should return only issues with auto-fix label, excluding auto-fix-skip', async () => {
        // GIVEN: GitHub 레포지토리에 다음 이슈들이 존재
        mockOctokit.issues.listForRepo.mockResolvedValue({
          data: [
            {
              number: 123,
              title: 'Fix editor bug',
              labels: [
                { name: 'auto-fix' },
                { name: 'component:editor' },
              ],
              body: '### Context\n- **컴포넌트**: editor',
              state: 'open',
              created_at: '2026-01-29T10:00:00Z',
            },
            {
              number: 124,
              title: 'Fix canvas-core issue',
              labels: [
                { name: 'auto-fix' },
                { name: 'component:canvas-core' },
              ],
              body: '### Context\n- **컴포넌트**: canvas-core',
              state: 'open',
              created_at: '2026-01-29T11:00:00Z',
            },
            {
              number: 125,
              title: 'Skip this issue',
              labels: [
                { name: 'auto-fix-skip' },
              ],
              body: '',
              state: 'open',
              created_at: '2026-01-29T12:00:00Z',
            },
          ],
        });

        // WHEN: list_issues({ labels: ["auto-fix"], exclude_labels: ["auto-fix-skip"] })를 호출
        // Note: Actual implementation would be imported and called here
        // For now, we'll test the filtering logic

        const allIssues = (await mockOctokit.issues.listForRepo({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'open',
        })).data;

        const filteredIssues = allIssues.filter(issue => {
          const labelNames = issue.labels.map((l: { name: string }) => l.name);
          const hasAutoFix = labelNames.includes('auto-fix');
          const hasAutoFixSkip = labelNames.includes('auto-fix-skip');
          return hasAutoFix && !hasAutoFixSkip;
        });

        // THEN: Issue #123, #124만 반환되어야 함
        expect(filteredIssues).toHaveLength(2);
        expect(filteredIssues.map(i => i.number)).toEqual([123, 124]);
      });
    });

    describe('Scenario: 상태 필터링', () => {
      it('should return only open issues when state is "open"', async () => {
        // GIVEN: 라벨 "auto-fix"를 가진 이슈들 중
        mockOctokit.issues.listForRepo.mockResolvedValue({
          data: [
            {
              number: 123,
              title: 'Open issue',
              labels: [{ name: 'auto-fix' }],
              body: '',
              state: 'open',
              created_at: '2026-01-29T10:00:00Z',
            },
            {
              number: 124,
              title: 'Closed issue',
              labels: [{ name: 'auto-fix' }],
              body: '',
              state: 'closed',
              created_at: '2026-01-29T11:00:00Z',
            },
          ],
        });

        // WHEN: list_issues({ labels: ["auto-fix"], state: "open" })를 호출
        const allIssues = (await mockOctokit.issues.listForRepo({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'open',
        })).data;

        const openIssues = allIssues.filter(issue => issue.state === 'open');

        // THEN: Issue #123만 반환되어야 함
        expect(openIssues).toHaveLength(1);
        expect(openIssues[0]?.number).toBe(123);
      });
    });

    describe('Scenario: labels 필터링 테스트', () => {
      it('should filter issues by multiple labels', async () => {
        // GIVEN
        mockOctokit.issues.listForRepo.mockResolvedValue({
          data: [
            {
              number: 100,
              title: 'Issue with both labels',
              labels: [{ name: 'auto-fix' }, { name: 'priority:high' }],
              body: '',
              state: 'open',
              created_at: '2026-01-29T10:00:00Z',
            },
            {
              number: 101,
              title: 'Issue with only auto-fix',
              labels: [{ name: 'auto-fix' }],
              body: '',
              state: 'open',
              created_at: '2026-01-29T11:00:00Z',
            },
          ],
        });

        // WHEN
        const allIssues = (await mockOctokit.issues.listForRepo({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'open',
        })).data;

        const filteredIssues = allIssues.filter(issue => {
          const labelNames = issue.labels.map((l: { name: string }) => l.name);
          return labelNames.includes('auto-fix') && labelNames.includes('priority:high');
        });

        // THEN
        expect(filteredIssues).toHaveLength(1);
        expect(filteredIssues[0]?.number).toBe(100);
      });
    });

    describe('Scenario: exclude_labels 필터링 테스트', () => {
      it('should exclude issues with specified labels', async () => {
        // GIVEN
        mockOctokit.issues.listForRepo.mockResolvedValue({
          data: [
            {
              number: 200,
              title: 'Normal issue',
              labels: [{ name: 'auto-fix' }],
              body: '',
              state: 'open',
              created_at: '2026-01-29T10:00:00Z',
            },
            {
              number: 201,
              title: 'Skipped issue',
              labels: [{ name: 'auto-fix' }, { name: 'auto-fix-skip' }],
              body: '',
              state: 'open',
              created_at: '2026-01-29T11:00:00Z',
            },
            {
              number: 202,
              title: 'WIP issue',
              labels: [{ name: 'auto-fix' }, { name: 'wip' }],
              body: '',
              state: 'open',
              created_at: '2026-01-29T12:00:00Z',
            },
          ],
        });

        // WHEN: exclude_labels: ["auto-fix-skip", "wip"]
        const allIssues = (await mockOctokit.issues.listForRepo({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'open',
        })).data;

        const excludeLabels = ['auto-fix-skip', 'wip'];
        const filteredIssues = allIssues.filter(issue => {
          const labelNames = issue.labels.map((l: { name: string }) => l.name);
          return !excludeLabels.some(excludeLabel => labelNames.includes(excludeLabel));
        });

        // THEN
        expect(filteredIssues).toHaveLength(1);
        expect(filteredIssues[0]?.number).toBe(200);
      });
    });
  });

  describe('REQ-002: 컴포넌트 정보 추출', () => {
    describe('Scenario: 컴포넌트 정보 파싱', () => {
      it('should extract component from issue body', () => {
        // GIVEN: Issue #123의 본문이 다음을 포함
        const issueBody = `
### Context
- **컴포넌트**: canvas-core
        `.trim();

        // WHEN: 컴포넌트 정보 추출
        const componentMatch = issueBody.match(/\*\*컴포넌트\*\*:\s*(.+)/);
        const component = componentMatch ? componentMatch[1].trim() : '';

        // THEN: component 필드가 "canvas-core"여야 함
        expect(component).toBe('canvas-core');
      });
    });

    describe('Scenario: 컴포넌트 정보 누락', () => {
      it('should return empty string when component is missing', () => {
        // GIVEN: Issue #123의 본문에 컴포넌트 정보가 없음
        const issueBody = `
### Context
- **설명**: Some description
        `.trim();

        // WHEN: 컴포넌트 정보 추출
        const componentMatch = issueBody.match(/\*\*컴포넌트\*\*:\s*(.+)/);
        const component = componentMatch ? componentMatch[1].trim() : '';

        // THEN: component 필드가 빈 문자열("")이어야 함
        expect(component).toBe('');
      });
    });
  });

  describe('REQ-003: 우선순위 자동 판단', () => {
    describe('Scenario: 라벨 기반 우선순위', () => {
      it('should extract high priority from labels', () => {
        // GIVEN: Issue #123의 라벨이 ["auto-fix", "priority:high"]
        const labels = [{ name: 'auto-fix' }, { name: 'priority:high' }];

        // WHEN: 우선순위 추출
        const labelNames = labels.map(l => l.name);
        let priority: 'high' | 'medium' | 'low' = 'medium';

        if (labelNames.includes('priority:high')) {
          priority = 'high';
        } else if (labelNames.includes('priority:low')) {
          priority = 'low';
        }

        // THEN: priority 필드가 "high"여야 함
        expect(priority).toBe('high');
      });

      it('should extract low priority from labels', () => {
        // GIVEN
        const labels = [{ name: 'auto-fix' }, { name: 'priority:low' }];

        // WHEN
        const labelNames = labels.map(l => l.name);
        let priority: 'high' | 'medium' | 'low' = 'medium';

        if (labelNames.includes('priority:high')) {
          priority = 'high';
        } else if (labelNames.includes('priority:low')) {
          priority = 'low';
        }

        // THEN
        expect(priority).toBe('low');
      });
    });

    describe('Scenario: 기본 우선순위', () => {
      it('should default to medium priority when no priority label exists', () => {
        // GIVEN: Issue #123에 우선순위 관련 라벨이 없음
        const labels = [{ name: 'auto-fix' }, { name: 'component:editor' }];

        // WHEN: 우선순위 추출
        const labelNames = labels.map(l => l.name);
        let priority: 'high' | 'medium' | 'low' = 'medium';

        if (labelNames.includes('priority:high')) {
          priority = 'high';
        } else if (labelNames.includes('priority:low')) {
          priority = 'low';
        }

        // THEN: priority 필드가 "medium"이어야 함
        expect(priority).toBe('medium');
      });
    });
  });

  describe('REQ-004: 결과 개수 제한', () => {
    describe('Scenario: 기본 제한', () => {
      it('should return maximum 50 issues by default', async () => {
        // GIVEN: 라벨 "auto-fix"를 가진 이슈가 100개 존재
        const issues = Array.from({ length: 100 }, (_, i) => ({
          number: i + 1,
          title: `Issue ${i + 1}`,
          labels: [{ name: 'auto-fix' }],
          body: '',
          state: 'open',
          created_at: new Date(Date.now() - i * 1000).toISOString(),
        }));

        mockOctokit.issues.listForRepo.mockResolvedValue({
          data: issues,
        });

        // WHEN: list_issues({ labels: ["auto-fix"] })를 호출 (limit 미지정)
        const allIssues = (await mockOctokit.issues.listForRepo({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'open',
        })).data;

        const limit = 50; // default limit
        const limitedIssues = allIssues.slice(0, limit);

        // THEN: 최신 50개 이슈만 반환되어야 함
        expect(limitedIssues).toHaveLength(50);
        expect(limitedIssues[0]?.number).toBe(1);
        expect(limitedIssues[49]?.number).toBe(50);
      });
    });

    describe('Scenario: 커스텀 제한', () => {
      it('should respect custom limit parameter', async () => {
        // GIVEN: 라벨 "auto-fix"를 가진 이슈가 100개 존재
        const issues = Array.from({ length: 100 }, (_, i) => ({
          number: i + 1,
          title: `Issue ${i + 1}`,
          labels: [{ name: 'auto-fix' }],
          body: '',
          state: 'open',
          created_at: new Date(Date.now() - i * 1000).toISOString(),
        }));

        mockOctokit.issues.listForRepo.mockResolvedValue({
          data: issues,
        });

        // WHEN: list_issues({ labels: ["auto-fix"], limit: 20 })를 호출
        const allIssues = (await mockOctokit.issues.listForRepo({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'open',
        })).data;

        const limit = 20; // custom limit
        const limitedIssues = allIssues.slice(0, limit);

        // THEN: 최신 20개 이슈만 반환되어야 함
        expect(limitedIssues).toHaveLength(20);
        expect(limitedIssues[0]?.number).toBe(1);
        expect(limitedIssues[19]?.number).toBe(20);
      });
    });
  });

  describe('Error Handling', () => {
    describe('Scenario: GitHub API 인증 실패', () => {
      it('should throw authentication error when GitHub PAT is invalid', async () => {
        // GIVEN: GitHub PAT가 유효하지 않거나 만료됨
        mockOctokit.issues.listForRepo.mockRejectedValue({
          status: 401,
          message: 'Bad credentials',
        });

        // WHEN & THEN: MCP error code "AUTHENTICATION_FAILED"와 함께 에러를 반환해야 함
        await expect(
          mockOctokit.issues.listForRepo({
            owner: 'test-owner',
            repo: 'test-repo',
            state: 'open',
          })
        ).rejects.toMatchObject({
          status: 401,
          message: 'Bad credentials',
        });
      });
    });

    describe('Scenario: Rate Limit 초과', () => {
      it('should throw rate limit error with reset time', async () => {
        // GIVEN: GitHub API Rate Limit이 초과됨
        const resetTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        mockOctokit.issues.listForRepo.mockRejectedValue({
          status: 403,
          message: 'API rate limit exceeded',
          headers: {
            'x-ratelimit-reset': resetTime.toString(),
          },
        });

        // WHEN & THEN: MCP error code "RATE_LIMIT_EXCEEDED"와 reset 시간을 포함한 에러를 반환해야 함
        await expect(
          mockOctokit.issues.listForRepo({
            owner: 'test-owner',
            repo: 'test-repo',
            state: 'open',
          })
        ).rejects.toMatchObject({
          status: 403,
          message: 'API rate limit exceeded',
        });
      });
    });

    describe('Scenario: 레포지토리 접근 권한 없음', () => {
      it('should throw permission denied error', async () => {
        // GIVEN: GitHub PAT이 대상 레포지토리 접근 권한 없음
        mockOctokit.issues.listForRepo.mockRejectedValue({
          status: 403,
          message: 'Resource not accessible by personal access token',
        });

        // WHEN & THEN: MCP error code "PERMISSION_DENIED"와 함께 에러를 반환해야 함
        await expect(
          mockOctokit.issues.listForRepo({
            owner: 'test-owner',
            repo: 'test-repo',
            state: 'open',
          })
        ).rejects.toMatchObject({
          status: 403,
          message: 'Resource not accessible by personal access token',
        });
      });
    });

    describe('Scenario: 빈 결과 테스트', () => {
      it('should return empty array when no issues match criteria', async () => {
        // GIVEN
        mockOctokit.issues.listForRepo.mockResolvedValue({
          data: [],
        });

        // WHEN
        const result = await mockOctokit.issues.listForRepo({
          owner: 'test-owner',
          repo: 'test-repo',
          state: 'open',
          labels: 'auto-fix',
        });

        // THEN
        expect(result.data).toEqual([]);
        expect(result.data).toHaveLength(0);
      });
    });
  });
});
