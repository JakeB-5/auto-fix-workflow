/**
 * @module analyzer/issue-generator/generator
 * @description Main IssueGenerator class for generating GitHub Issues
 */

import type { Result, IssueSource } from '../../common/types/index.js';
import { ok, err } from '../../common/types/index.js';
import type { CodeLocation } from '../code-locator/types.js';
import type { GeneratedIssue, GeneratorError } from './types.js';
import { GeneratorErrorCode } from './types.js';
import { detectIssueType } from './type-detector.js';
import { generateTitle } from './title-generator.js';
import { inferLabels } from './labels-system.js';
import { generateIssueBody } from './template.js';
import type { TemplateData } from './template.js';

/**
 * Task data for issue generation
 */
export interface AsanaTask {
  readonly id: string;
  readonly name: string;
  readonly notes: string;
  readonly tags?: readonly string[];
  readonly custom_fields?: Record<string, unknown>;
}

/**
 * Task analysis result
 */
export interface TaskAnalysis {
  readonly task_id: string;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly can_auto_convert: boolean;
  readonly reproducibility: 'clear' | 'partial' | 'unclear';
  readonly has_sufficient_info: boolean;
  readonly missing_info: readonly string[];
  readonly identified_files?: readonly string[];
  readonly estimated_component?: string;
  readonly error_message?: string;
  readonly stack_trace?: string;
  readonly code_snippet?: string;
  readonly locations?: readonly CodeLocation[];
  readonly analyzed_at: string;
}

/**
 * Issue generation input
 */
export interface IssueGenerationInput {
  readonly task: AsanaTask;
  readonly analysis: TaskAnalysis;
  readonly source: IssueSource;
  readonly sourceUrl?: string;
  readonly priority?: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Main IssueGenerator class
 */
export class IssueGenerator {
  /**
   * Generate GitHub Issue from Asana task and analysis
   *
   * @param input - Issue generation input
   * @returns Result containing generated issue or error
   */
  async generate(
    input: IssueGenerationInput
  ): Promise<Result<GeneratedIssue, GeneratorError>> {
    // Validate input
    const validation = this.validateInput(input);
    if (!validation.success) {
      return validation;
    }

    // Detect issue type
    const type = detectIssueType({
      source: input.source,
      description: input.task.notes,
      errorMessage: input.analysis.error_message ?? undefined,
      stackTrace: input.analysis.stack_trace ?? undefined,
      title: input.task.name,
    });

    // Generate title
    const title = generateTitle({
      type,
      source: input.source,
      taskTitle: input.task.name,
      errorMessage: input.analysis.error_message ?? undefined,
      fileName: input.analysis.locations?.[0]?.filePath ?? undefined,
      component: input.analysis.estimated_component ?? undefined,
    });

    // Generate labels
    const labels = inferLabels({
      type,
      source: input.source,
      priority: input.priority ?? undefined,
      component: input.analysis.estimated_component ?? undefined,
      locations: input.analysis.locations ?? undefined,
    });

    // Generate issue body
    const body = this.generateBody(input, type);

    return ok({
      title,
      body,
      labels,
      type,
    });
  }

  /**
   * Validate issue generation input
   *
   * @param input - Input to validate
   * @returns Validation result
   */
  private validateInput(
    input: IssueGenerationInput
  ): Result<void, GeneratorError> {
    // Check if auto-conversion is possible
    if (!input.analysis.can_auto_convert) {
      return err({
        code: GeneratorErrorCode.INSUFFICIENT_DATA,
        message: `Cannot auto-convert task ${input.task.id}: insufficient data`,
        cause: {
          missing_info: input.analysis.missing_info,
          confidence: input.analysis.confidence,
        },
      });
    }

    // Check if task has minimum required info
    if (!input.task.name || !input.task.notes) {
      return err({
        code: GeneratorErrorCode.VALIDATION_ERROR,
        message: 'Task must have name and notes',
      });
    }

    return ok(undefined);
  }

  /**
   * Generate issue body from template
   *
   * @param input - Issue generation input
   * @param type - Detected issue type
   * @returns Generated issue body
   */
  private generateBody(
    input: IssueGenerationInput,
    type: 'bug' | 'feature' | 'refactor' | 'docs' | 'test' | 'chore'
  ): string {
    const templateData: TemplateData = {
      type,
      source: input.source,
      sourceUrl: input.sourceUrl ?? undefined,
      component: input.analysis.estimated_component ?? undefined,
      files: input.analysis.identified_files ?? undefined,
      locations: input.analysis.locations ?? undefined,
      description: input.task.notes,
      errorMessage: input.analysis.error_message ?? undefined,
      stackTrace: input.analysis.stack_trace ?? undefined,
      codeSnippet: input.analysis.code_snippet ?? undefined,
      suggestedFix: this.generateSuggestedFix(input.analysis),
      acceptanceCriteria: this.generateAcceptanceCriteria(type),
    };

    return generateIssueBody(templateData);
  }

  /**
   * Generate suggested fix based on error analysis
   *
   * @param analysis - Task analysis
   * @returns Array of fix suggestions
   */
  private generateSuggestedFix(
    analysis: TaskAnalysis
  ): readonly string[] | undefined {
    if (!analysis.error_message) {
      return undefined;
    }

    const suggestions: string[] = [];

    // Add basic error-based suggestions
    if (analysis.error_message.includes('Cannot read property')) {
      suggestions.push('Optional chaining 사용 검토 (?.)');
      suggestions.push('Null/undefined 체크 추가');
    } else if (analysis.error_message.includes('is not a function')) {
      suggestions.push('함수 존재 여부 확인');
      suggestions.push('타입 체크 추가');
    } else if (analysis.error_message.includes('is not defined')) {
      suggestions.push('변수 선언 확인');
      suggestions.push('임포트 경로 확인');
    }

    // Add reference files if available
    if (analysis.identified_files && analysis.identified_files.length > 0) {
      const primaryFile = analysis.identified_files[0];
      suggestions.push(`참고: \`${primaryFile}\`의 패턴 확인`);
    }

    return suggestions.length > 0 ? suggestions : undefined;
  }

  /**
   * Generate acceptance criteria based on issue type
   *
   * @param type - Issue type
   * @returns Array of acceptance criteria
   */
  private generateAcceptanceCriteria(
    type: 'bug' | 'feature' | 'refactor' | 'docs' | 'test' | 'chore'
  ): readonly string[] {
    switch (type) {
      case 'bug':
        return [
          '에러가 더 이상 발생하지 않음',
          '기존 테스트 모두 통과',
          '새로운 테스트 케이스 추가',
        ];
      case 'feature':
        return [
          '기능이 예상대로 동작함',
          '기존 기능에 영향 없음',
          '테스트 케이스 추가',
          '문서 업데이트',
        ];
      case 'refactor':
        return [
          '기능 동작이 변경되지 않음',
          '모든 테스트 통과',
          '코드 품질 개선',
        ];
      case 'docs':
        return ['문서가 명확하고 정확함', '예제 코드 포함', '최신 정보 반영'];
      case 'test':
        return ['모든 테스트 통과', '엣지 케이스 커버', '코드 커버리지 증가'];
      case 'chore':
        return ['변경사항이 의도대로 동작', '기존 기능에 영향 없음'];
      default:
        return ['작업이 완료됨', '테스트 통과'];
    }
  }
}
