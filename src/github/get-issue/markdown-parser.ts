/**
 * @module github/get-issue/markdown-parser
 * @description Markdown parsing utilities for GitHub issues
 */

/**
 * Code block with language and content
 */
export interface CodeBlock {
  /** Programming language */
  readonly language: string;
  /** Code content */
  readonly content: string;
}

/**
 * Link with text and URL
 */
export interface Link {
  /** Link text */
  readonly text: string;
  /** Link URL */
  readonly url: string;
}

/**
 * Extract code blocks from markdown
 *
 * @param markdown - Markdown content
 * @returns Array of code blocks
 *
 * @example
 * ```typescript
 * const blocks = extractCodeBlocks('```ts\nconst x = 1;\n```');
 * // [{ language: 'ts', content: 'const x = 1;' }]
 * ```
 */
export function extractCodeBlocks(markdown: string): readonly CodeBlock[] {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: CodeBlock[] = [];

  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    if (match[2] !== undefined) {
      blocks.push({
        language: match[1] || 'text',
        content: match[2].trim(),
      });
    }
  }

  return blocks;
}

/**
 * Extract links from markdown
 *
 * @param markdown - Markdown content
 * @returns Array of links
 *
 * @example
 * ```typescript
 * const links = extractLinks('[Example](https://example.com)');
 * // [{ text: 'Example', url: 'https://example.com' }]
 * ```
 */
export function extractLinks(markdown: string): readonly Link[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: Link[] = [];

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(markdown)) !== null) {
    if (match[1] !== undefined && match[2] !== undefined) {
      links.push({
        text: match[1],
        url: match[2],
      });
    }
  }

  return links;
}

/**
 * Extract GitHub issue references (#123 format)
 *
 * @param markdown - Markdown content
 * @returns Array of issue numbers
 *
 * @example
 * ```typescript
 * const refs = extractIssueReferences('See #123 and #456');
 * // [123, 456]
 * ```
 */
export function extractIssueReferences(markdown: string): readonly number[] {
  const issueRefRegex = /#(\d+)/g;
  const refs = new Set<number>();

  let match: RegExpExecArray | null;
  while ((match = issueRefRegex.exec(markdown)) !== null) {
    if (match[1] !== undefined) {
      const issueNumber = parseInt(match[1], 10);
      if (!isNaN(issueNumber)) {
        refs.add(issueNumber);
      }
    }
  }

  return Array.from(refs).sort((a, b) => a - b);
}

/**
 * Extract task list items from markdown
 *
 * @param markdown - Markdown content
 * @returns Array of task items with completion status
 *
 * @example
 * ```typescript
 * const tasks = extractTaskList('- [x] Done\n- [ ] Todo');
 * // [{ text: 'Done', completed: true }, { text: 'Todo', completed: false }]
 * ```
 */
export function extractTaskList(
  markdown: string
): readonly { text: string; completed: boolean }[] {
  const taskRegex = /^[-*]\s+\[([ xX])\]\s+(.+)$/gm;
  const tasks: { text: string; completed: boolean }[] = [];

  let match: RegExpExecArray | null;
  while ((match = taskRegex.exec(markdown)) !== null) {
    if (match[1] !== undefined && match[2] !== undefined) {
      tasks.push({
        text: match[2].trim(),
        completed: match[1].toLowerCase() === 'x',
      });
    }
  }

  return tasks;
}

/**
 * Extract headers from markdown
 *
 * @param markdown - Markdown content
 * @returns Array of headers with level and text
 *
 * @example
 * ```typescript
 * const headers = extractHeaders('# Title\n## Subtitle');
 * // [{ level: 1, text: 'Title' }, { level: 2, text: 'Subtitle' }]
 * ```
 */
export function extractHeaders(
  markdown: string
): readonly { level: number; text: string }[] {
  const headerRegex = /^(#{1,6})\s+(.+)$/gm;
  const headers: { level: number; text: string }[] = [];

  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(markdown)) !== null) {
    if (match[1] !== undefined && match[2] !== undefined) {
      headers.push({
        level: match[1].length,
        text: match[2].trim(),
      });
    }
  }

  return headers;
}
