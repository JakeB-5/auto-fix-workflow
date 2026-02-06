/**
 * @module workflow/group-issues/file-extractor
 * @description 이슈에서 파일 경로 추출
 */

import type { Issue } from '../../common/types/index.js';

/**
 * 이슈에서 파일 경로 추출
 *
 * 우선순위:
 * 1. codeAnalysis.filePath
 * 2. context.relatedFiles
 * 3. body에서 파싱 (Code Analysis 섹션)
 *
 * @param issue - 대상 이슈
 * @returns 파일 경로 목록
 */
export function extractFilePaths(issue: Issue): string[] {
  const paths = new Set<string>();

  // 1. codeAnalysis.filePath
  if (issue.codeAnalysis?.filePath) {
    paths.add(normalizePath(issue.codeAnalysis.filePath));
  }

  // 2. context.relatedFiles
  for (const file of issue.context.relatedFiles) {
    paths.add(normalizePath(file));
  }

  // 3. body에서 추출
  const bodyPaths = extractFilePathsFromBody(issue.body);
  for (const path of bodyPaths) {
    paths.add(normalizePath(path));
  }

  return Array.from(paths);
}

/**
 * 이슈 본문에서 파일 경로 추출
 *
 * ## Code Analysis 섹션에서 파일 목록 파싱
 *
 * @param body - 이슈 본문
 * @returns 파일 경로 목록
 */
function extractFilePathsFromBody(body: string): string[] {
  const paths: string[] = [];

  // ## Code Analysis 또는 ## Files 섹션 찾기
  const sections = [
    /##\s*Code Analysis\s*\n([\s\S]*?)(?=\n##|\n$|$)/i,
    /##\s*Files\s*\n([\s\S]*?)(?=\n##|\n$|$)/i,
    /##\s*Related Files\s*\n([\s\S]*?)(?=\n##|\n$|$)/i,
  ];

  for (const regex of sections) {
    const match = body.match(regex);
    if (match) {
      const section = match[1];
      if (section !== undefined) {
        const filePaths = parseFilePathsFromSection(section);
        paths.push(...filePaths);
      }
    }
  }

  // 코드 블록에서도 파일 경로 추출
  const codeBlockPaths = extractPathsFromCodeBlocks(body);
  paths.push(...codeBlockPaths);

  return paths;
}

/**
 * 섹션 텍스트에서 파일 경로 파싱
 *
 * - src/components/Button.tsx
 * - `src/utils/helpers.ts`
 *
 * @param section - 섹션 텍스트
 * @returns 파일 경로 목록
 */
function parseFilePathsFromSection(section: string): string[] {
  const paths: string[] = [];
  const lines = section.split('\n');

  for (const line of lines) {
    // - 로 시작하는 리스트 항목
    const listMatch = line.match(/^[\s-]*`?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z]+)`?/);
    if (listMatch) {
      const matchedPath = listMatch[1];
      if (matchedPath !== undefined) {
        paths.push(matchedPath);
      }
      continue;
    }

    // 일반 파일 경로 패턴
    const pathMatches = Array.from(line.matchAll(/([a-zA-Z0-9_\-./\\]+\.(ts|tsx|js|jsx|vue|svelte|py|java|go|rs))/g));
    for (const match of pathMatches) {
      const matchedPath = match[1];
      if (matchedPath !== undefined) {
        paths.push(matchedPath);
      }
    }
  }

  return paths;
}

/**
 * 코드 블록에서 파일 경로 추출
 *
 * ```typescript
 * // src/components/Button.tsx
 * ```
 *
 * @param body - 이슈 본문
 * @returns 파일 경로 목록
 */
function extractPathsFromCodeBlocks(body: string): string[] {
  const paths: string[] = [];
  const codeBlockRegex = /```[\s\S]*?```/g;
  const matches = Array.from(body.matchAll(codeBlockRegex));

  for (const match of matches) {
    const block = match[0];
    // 주석에서 파일 경로 찾기
    const commentMatches = Array.from(block.matchAll(/(?:\/\/|#)\s*([a-zA-Z0-9_\-./\\]+\.(ts|tsx|js|jsx|vue|svelte|py|java|go|rs))/g));
    for (const commentMatch of commentMatches) {
      const matchedPath = commentMatch[1];
      if (matchedPath !== undefined) {
        paths.push(matchedPath);
      }
    }
  }

  return paths;
}

/**
 * 파일 경로 정규화
 *
 * - 백슬래시를 슬래시로 변환
 * - 중복 슬래시 제거
 * - 앞의 ./ 제거
 *
 * @param path - 원본 경로
 * @returns 정규화된 경로
 */
function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\.\//, '');
}
