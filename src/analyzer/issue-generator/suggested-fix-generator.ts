/**
 * @module analyzer/issue-generator/suggested-fix-generator
 * @description Generate Suggested Fix Direction section
 */

/**
 * Error pattern to fix suggestion mapping
 */
const ERROR_PATTERNS: Record<string, readonly string[]> = {
  'Cannot read property': [
    'Optional chaining 사용 검토 (?.)',
    'Null/undefined 체크 추가',
    '객체 초기화 확인',
  ],
  'Cannot read properties of undefined': [
    'Optional chaining 사용 검토 (?.)',
    'Null/undefined 체크 추가',
    '변수 초기화 시점 확인',
  ],
  'Cannot read properties of null': [
    'Null 체크 추가',
    'Optional chaining 사용 검토 (?.)',
    'Nullish coalescing 연산자 사용 (??)',
  ],
  'is not a function': [
    '함수 존재 여부 확인',
    '타입 체크 추가',
    '올바른 메서드 호출 확인',
  ],
  'is not defined': [
    '변수 선언 확인',
    '임포트 경로 확인',
    '스코프 확인',
  ],
  'Maximum call stack': [
    '재귀 종료 조건 검토',
    '무한 루프 확인',
    '순환 참조 확인',
  ],
  TypeError: [
    '타입 체크 추가',
    '타입 변환 확인',
    '올바른 타입 사용 확인',
  ],
  ReferenceError: [
    '변수 선언 확인',
    '임포트 확인',
    '스코프 확인',
  ],
  SyntaxError: [
    '문법 오류 수정',
    '괄호/중괄호 매칭 확인',
    '세미콜론 확인',
  ],
  RangeError: [
    '배열 인덱스 범위 확인',
    '숫자 범위 검증',
    '재귀 깊이 제한',
  ],
};

/**
 * Common fix patterns for general issues
 */
const COMMON_PATTERNS: readonly string[] = [
  '에러 핸들링 추가 (try-catch)',
  '입력 검증 추가',
  '테스트 케이스 추가',
];

/**
 * Generate fix suggestions based on error message
 *
 * @param errorMessage - Error message
 * @returns Array of fix suggestions
 */
export function generateFixSuggestions(
  errorMessage: string | undefined
): readonly string[] {
  if (!errorMessage) {
    return [];
  }

  // Find matching pattern
  for (const [pattern, suggestions] of Object.entries(ERROR_PATTERNS)) {
    if (errorMessage.includes(pattern)) {
      return suggestions;
    }
  }

  // Check for specific error types
  const firstPart = errorMessage.split(':')[0];
  if (firstPart) {
    const errorType = firstPart.trim();
    const pattern = ERROR_PATTERNS[errorType];
    if (pattern) {
      return pattern;
    }
  }

  // Return common patterns as fallback
  return COMMON_PATTERNS;
}

/**
 * Add reference hints to suggestions
 *
 * @param suggestions - Base suggestions
 * @param referenceFiles - Reference file paths
 * @returns Enhanced suggestions with references
 */
export function addReferenceHints(
  suggestions: readonly string[],
  referenceFiles: readonly string[] | undefined
): readonly string[] {
  if (!referenceFiles || referenceFiles.length === 0) {
    return suggestions;
  }

  const enhanced = [...suggestions];
  referenceFiles.forEach((file) => {
    enhanced.push(`참고: \`${file}\`의 패턴 확인`);
  });

  return enhanced;
}

/**
 * Generate suggested fix section
 *
 * @param data - Fix suggestion data
 * @returns Markdown section lines
 */
export function generateSuggestedFixSection(data: {
  readonly errorMessage: string | undefined;
  readonly referenceFiles: readonly string[] | undefined;
  readonly customSuggestions: readonly string[] | undefined;
}): string[] {
  const suggestions =
    data.customSuggestions ??
    generateFixSuggestions(data.errorMessage);

  if (suggestions.length === 0) {
    return [];
  }

  const enhanced = addReferenceHints(suggestions, data.referenceFiles);

  const lines: string[] = ['### Suggested Fix Direction'];
  enhanced.forEach((suggestion) => {
    lines.push(`- ${suggestion}`);
  });

  return lines;
}
