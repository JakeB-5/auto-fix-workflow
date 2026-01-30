/**
 * @module commands/init/generators/gitignore
 * @description .gitignore 파일 관리 유틸리티
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { Result } from '../../../common/types/index.js';
import { ok, err } from '../../../common/types/index.js';

/**
 * .gitignore 파일에 특정 항목이 존재하는지 확인
 *
 * @param projectRoot - 프로젝트 루트 경로
 * @param entry - 확인할 gitignore 항목
 * @returns 항목 존재 여부
 */
export async function hasGitignoreEntry(
  projectRoot: string,
  entry: string
): Promise<boolean> {
  const gitignorePath = join(projectRoot, '.gitignore');

  try {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    const lines = content.split('\n').map((line) => line.trim());

    // 정확한 일치 또는 주석 없이 일치하는 항목 확인
    return lines.some((line) => {
      const trimmedLine = line.split('#')[0].trim();
      return trimmedLine === entry;
    });
  } catch (error) {
    // 파일이 없으면 false 반환
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * .gitignore 파일에 항목 추가
 *
 * @param projectRoot - 프로젝트 루트 경로
 * @param entry - 추가할 gitignore 항목
 * @returns 성공 시 true, 실패 시 Error
 */
export async function addToGitignore(
  projectRoot: string,
  entry: string
): Promise<Result<boolean, Error>> {
  const gitignorePath = join(projectRoot, '.gitignore');

  try {
    // 이미 항목이 존재하는지 확인
    const hasEntry = await hasGitignoreEntry(projectRoot, entry);
    if (hasEntry) {
      return ok(true);
    }

    // 기존 내용 읽기 (파일이 없으면 빈 문자열)
    let existingContent = '';
    try {
      existingContent = await fs.readFile(gitignorePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    // 새로운 내용 구성
    let newContent: string;
    if (existingContent.length === 0) {
      // 빈 파일인 경우
      newContent = `${entry}\n`;
    } else if (existingContent.endsWith('\n')) {
      // 마지막이 개행 문자인 경우
      newContent = `${existingContent}${entry}\n`;
    } else {
      // 마지막이 개행 문자가 아닌 경우
      newContent = `${existingContent}\n${entry}\n`;
    }

    // 파일 쓰기
    await fs.writeFile(gitignorePath, newContent, 'utf-8');

    return ok(true);
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error(`Failed to add entry to .gitignore: ${String(error)}`)
    );
  }
}

/**
 * .auto-fix.yaml 파일이 .gitignore에 포함되도록 보장
 *
 * @param projectRoot - 프로젝트 루트 경로
 * @returns 성공 시 true, 실패 시 Error
 */
export async function ensureAutoFixYamlIgnored(
  projectRoot: string
): Promise<Result<boolean, Error>> {
  return addToGitignore(projectRoot, '.auto-fix.yaml');
}
