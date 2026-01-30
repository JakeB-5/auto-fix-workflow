/**
 * @module github/create-pr/changes-extractor
 * @description 변경사항 추출 유틸리티
 */

import type { SimpleGit } from 'simple-git';
import type { ChangeInfo } from './types.js';
import { ok, err, type Result } from '../../common/types/index.js';

/**
 * Git diff로부터 변경사항 추출
 *
 * @param git - SimpleGit 인스턴스
 * @param base - 베이스 브랜치
 * @param head - 헤드 브랜치
 * @returns 변경사항 목록
 */
export async function extractChanges(
  git: SimpleGit,
  base: string,
  head: string
): Promise<Result<ChangeInfo[], Error>> {
  try {
    // diff 통계 가져오기
    const diffSummary = await git.diffSummary([`${base}...${head}`]);

    const changes: ChangeInfo[] = diffSummary.files.map((file) => {
      // 변경 유형 판단
      let changeType: ChangeInfo['changeType'];
      const insertions = 'insertions' in file ? file.insertions : 0;
      const deletions = 'deletions' in file ? file.deletions : 0;

      if ('binary' in file && file.binary) {
        changeType = 'modified';
      } else if (insertions > 0 && deletions === 0) {
        changeType = 'added';
      } else if (insertions === 0 && deletions > 0) {
        changeType = 'deleted';
      } else if (file.file.includes('{') && file.file.includes('}')) {
        // rename 패턴: "old/{file.txt => newfile.txt}"
        changeType = 'renamed';
      } else {
        changeType = 'modified';
      }

      return {
        filePath: file.file,
        additions: insertions,
        deletions: deletions,
        changeType,
      };
    });

    return ok(changes);
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error('Failed to extract changes from git diff')
    );
  }
}

/**
 * 현재 브랜치의 변경사항 추출 (unstaged + staged)
 *
 * @param git - SimpleGit 인스턴스
 * @returns 변경사항 목록
 */
export async function extractLocalChanges(
  git: SimpleGit
): Promise<Result<ChangeInfo[], Error>> {
  try {
    const diffSummary = await git.diffSummary();

    const changes: ChangeInfo[] = diffSummary.files.map((file) => {
      const insertions = 'insertions' in file ? file.insertions : 0;
      const deletions = 'deletions' in file ? file.deletions : 0;

      let changeType: ChangeInfo['changeType'];
      if (insertions > 0 && deletions === 0) {
        changeType = 'added';
      } else if (insertions === 0 && deletions > 0) {
        changeType = 'deleted';
      } else {
        changeType = 'modified';
      }

      return {
        filePath: file.file,
        additions: insertions,
        deletions: deletions,
        changeType,
      };
    });

    return ok(changes);
  } catch (error) {
    return err(
      error instanceof Error
        ? error
        : new Error('Failed to extract local changes from git')
    );
  }
}

/**
 * 변경사항 통계 계산
 *
 * @param changes - 변경사항 목록
 * @returns 통계 정보
 */
export function calculateChangeStats(changes: readonly ChangeInfo[]): {
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  byType: Record<ChangeInfo['changeType'], number>;
} {
  const stats = {
    totalFiles: changes.length,
    totalAdditions: 0,
    totalDeletions: 0,
    byType: {
      added: 0,
      modified: 0,
      deleted: 0,
      renamed: 0,
    },
  };

  for (const change of changes) {
    stats.totalAdditions += change.additions;
    stats.totalDeletions += change.deletions;
    stats.byType[change.changeType]++;
  }

  return stats;
}
