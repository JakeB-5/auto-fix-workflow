/**
 * @module asana/update-task
 * @description Public API for Asana task updates
 */

// Tags
export {
  type TagInfo,
  type TagOperationResult,
  addTagToTask,
  removeTagFromTask,
  getWorkspaceTags,
  findTagByName,
  addTagsToTask,
  removeTagsFromTask,
  replaceTaskTags,
} from './tags.js';

// Tag cache
export {
  getTagsWithCache,
  getTagGidByName,
  createTag,
  getOrCreateTag,
  getOrCreateTags,
  invalidateTagCache,
  clearTagCache,
  getTagCacheStats,
  TAG_COLORS,
  type TagColor,
  isValidTagColor,
} from './tag-cache.js';

// Markdown to HTML
export {
  type MdToHtmlOptions,
  markdownToHtml,
  stripMarkdown,
  containsMarkdown,
} from './md-to-html.js';

// Comments
export {
  type AddCommentOptions,
  type CreatedComment,
  addComment,
  addTextComment,
  addMarkdownComment,
  addPinnedComment,
  addPRLinkComment,
  addIssueLinkComment,
  addStatusComment,
  addWorkflowComment,
} from './comments.js';

// Sections
export {
  type SectionMoveResult,
  moveTaskToSection,
  moveTaskToSectionByName,
  moveToTriage,
  moveToDone,
  moveToInProgress,
  getCurrentSection,
  getProjectSections,
  moveTasksToSection,
} from './sections.js';

// Update
export {
  type UpdateTaskOptions,
  type UpdateTaskResult,
  updateTask,
  completeTask,
  reopenTask,
  assignTask,
  unassignTask,
  setDueDate,
} from './update.js';

// Tool
export {
  UpdateTaskInputSchema,
  type UpdateTaskInput,
  type UpdateTaskOutput,
  type UpdateTaskError,
  executeUpdateTask,
  getToolDefinition,
} from './tool.js';
