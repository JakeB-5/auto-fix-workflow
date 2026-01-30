/**
 * @module asana/get-task
 * @description Public API for Asana task retrieval
 */

// API
export {
  type RawTaskData,
  getTaskFromApi,
  getTaskWithClient,
  getSubtasks,
} from './api.js';

// HTML to Markdown
export {
  type HtmlToMdOptions,
  htmlToMarkdown,
  containsHtml,
  stripHtml,
} from './html-to-md.js';

// Stories (comments)
export {
  type StoryType,
  type TaskStory,
  type GetStoriesOptions,
  getTaskStories,
  getTaskComments,
  getPinnedStories,
  formatStoriesAsMarkdown,
  getLatestComment,
} from './stories.js';

// Custom fields
export {
  type RawCustomField,
  type CustomFieldValue,
  type CustomFieldType,
  convertCustomFields,
  getCustomFieldByName,
  getCustomFieldValue,
  getCustomFieldDisplayValue,
  customFieldsToMap,
  customFieldsToObject,
  formatCustomFieldsAsMarkdown,
  isHighPriority,
} from './custom-fields.js';

// Attachments
export {
  type AttachmentResourceType,
  type TaskAttachment,
  type AttachmentSummary,
  getTaskAttachments,
  getAttachmentSummary,
  formatAttachmentsAsMarkdown,
  isImageAttachment,
  getImageAttachments,
  getDownloadUrls,
} from './attachments.js';

// Cache
export {
  getTaskWithCache,
  getTaskFresh,
  isTaskCached,
  getCachedTask,
  invalidateTaskCache,
  clearTaskCache,
  getTaskCacheStats,
  prefetchTasks,
  getTaskCacheAge,
} from './cache.js';

// Tool
export {
  GetTaskInputSchema,
  type GetTaskInput,
  type FormattedTaskDetail,
  type GetTaskOutput,
  type GetTaskError,
  executeGetTask,
  getToolDefinition,
} from './tool.js';
