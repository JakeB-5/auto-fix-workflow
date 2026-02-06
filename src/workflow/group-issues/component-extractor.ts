/**
 * @module workflow/group-issues/component-extractor
 * @description 이슈에서 컴포넌트 정보 추출
 */

import type { Issue } from '../../common/types/index.js';

/**
 * 이슈에서 컴포넌트 정보 추출
 *
 * 우선순위:
 * 1. context.component (명시적 지정)
 * 2. labels (component:* 형식)
 * 3. filePath에서 추론 (파일 경로 기반)
 * 4. body에서 추출 (마크다운 파싱)
 *
 * @param issue - 대상 이슈
 * @returns 컴포넌트명 또는 null
 */
export function extractComponent(issue: Issue): string | null {
  // 1. context.component 우선
  if (issue.context.component) {
    return issue.context.component;
  }

  // 2. labels에서 component:* 패턴 찾기
  const componentLabel = issue.labels.find(label =>
    label.startsWith('component:') || label.startsWith('area:')
  );

  if (componentLabel) {
    const parts = componentLabel.split(':');
    const componentPart = parts[1];
    if (parts.length === 2 && componentPart !== undefined) {
      return capitalize(componentPart);
    }
  }

  // 3. 파일 경로에서 추론
  if (issue.codeAnalysis?.filePath) {
    const component = extractComponentFromPath(issue.codeAnalysis.filePath);
    if (component) {
      return component;
    }
  }

  // 4. relatedFiles 중 첫 번째 파일에서 추론
  const firstRelatedFile = issue.context.relatedFiles[0];
  if (firstRelatedFile !== undefined) {
    const component = extractComponentFromPath(firstRelatedFile);
    if (component) {
      return component;
    }
  }

  // 5. body에서 추출 시도
  const bodyComponent = extractComponentFromBody(issue.body);
  if (bodyComponent) {
    return bodyComponent;
  }

  return null;
}

/**
 * 파일 경로에서 컴포넌트명 추출
 *
 * 예: src/components/Button/Button.tsx -> Button
 *     src/utils/validation.ts -> utils
 *
 * @param filePath - 파일 경로
 * @returns 컴포넌트명 또는 null
 */
function extractComponentFromPath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');

  // components/Button/Button.tsx 형식
  if (parts.includes('components') && parts.length >= 3) {
    const idx = parts.indexOf('components');
    const componentPart = parts[idx + 1];
    if (componentPart !== undefined) {
      return capitalize(componentPart);
    }
  }

  // src/features/Auth/... 형식
  if (parts.includes('features') && parts.length >= 3) {
    const idx = parts.indexOf('features');
    const featurePart = parts[idx + 1];
    if (featurePart !== undefined) {
      return capitalize(featurePart);
    }
  }

  // src/utils/... -> utils
  if (parts.includes('utils')) {
    return 'utils';
  }

  // src/lib/... -> lib
  if (parts.includes('lib')) {
    return 'lib';
  }

  // 파일명에서 추출 (확장자 제거)
  const fileName = parts[parts.length - 1];
  if (fileName) {
    const nameWithoutExt = fileName.replace(/\.(tsx?|jsx?|vue|svelte)$/, '');
    if (nameWithoutExt && nameWithoutExt !== 'index') {
      return capitalize(nameWithoutExt);
    }
  }

  return null;
}

/**
 * 이슈 본문에서 컴포넌트 정보 추출
 *
 * Component: Button 형식 또는 ## Component 섹션 찾기
 *
 * @param body - 이슈 본문
 * @returns 컴포넌트명 또는 null
 */
function extractComponentFromBody(body: string): string | null {
  // Component: XXX 패턴
  const inlineMatch = body.match(/Component:\s*([A-Z][a-zA-Z0-9]*)/);
  if (inlineMatch) {
    const matchedComponent = inlineMatch[1];
    if (matchedComponent !== undefined) {
      return matchedComponent;
    }
  }

  // ## Component 섹션
  const sectionMatch = body.match(/##\s*Component\s*\n\s*([A-Z][a-zA-Z0-9]*)/);
  if (sectionMatch) {
    const matchedSection = sectionMatch[1];
    if (matchedSection !== undefined) {
      return matchedSection;
    }
  }

  return null;
}

/**
 * 문자열 첫 글자 대문자 변환
 */
function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
