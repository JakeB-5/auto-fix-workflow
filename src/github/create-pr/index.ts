/**
 * @module github/create-pr
 * @description GitHub Pull Request 생성 모듈
 */

// 핵심 함수
export {
  createPR,
  addLabels,
  addReviewers,
  findExistingPR,
} from './create-pr.js';

// 유틸리티 함수
export { generatePRTitle } from './title-generator.js';
export { generatePRBody } from './body-generator.js';
export { generateLabels, isValidLabel, normalizeLabel } from './labels.js';
export {
  extractChanges,
  extractLocalChanges,
  calculateChangeStats,
} from './changes-extractor.js';
export {
  createGit,
  getCurrentBranch,
  getBranchInfo,
  getCommitMessages,
  isBranchUpToDate,
  hasChanges,
  pushBranch,
  hasDifference,
  isGitRepository,
  getRemoteUrl,
} from './git-utils.js';

// 오류 처리
export {
  GitHubApiError,
  GitHubApiErrorCode,
  GitError,
  handleOctokitError,
  handleGitError,
} from './error-handling.js';

// 타입
export type { CreatePRParams, ChangeInfo, BranchInfo } from './types.js';

// MCP Tool
export {
  createPRInputSchema,
  executeCreatePRTool,
  type CreatePRInput,
} from './tool.js';
