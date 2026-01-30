/**
 * @module workflow/group-issues
 * @description 이슈 그룹화 모듈 - Public API
 */

// Main function
export { groupIssues } from './group-issues.js';

// Extractors
export { extractComponent } from './component-extractor.js';
export { extractFilePaths } from './file-extractor.js';

// Groupers
export {
  groupByComponent,
  groupByFile,
  groupByLabel,
} from './grouper.js';

// Branch name generator
export { generateBranchName } from './branch-name.js';

// GitHub API
export { fetchIssues } from './github-api.js';

// Types
export type {
  GroupError,
  GroupErrorCode,
  GroupBuilder,
} from './types.js';
