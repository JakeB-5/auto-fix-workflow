/**
 * @module asana/update-task/md-to-html
 * @description Markdown to HTML conversion for Asana task notes
 */

/** Conversion options */
export interface MdToHtmlOptions {
  /** Wrap output in <body> tags (Asana format) */
  readonly wrapInBody?: boolean;
  /** Convert @mentions to Asana user links (requires user GID lookup) */
  readonly convertMentions?: boolean;
}

/**
 * Convert Markdown to Asana-compatible HTML
 *
 * Asana supports a subset of HTML:
 * - <body> wrapper
 * - <strong>, <em> for formatting
 * - <u> for underline
 * - <s> for strikethrough
 * - <code> for inline code
 * - <a> for links
 * - <ul>, <ol>, <li> for lists
 * - <br> for line breaks
 *
 * @param markdown - Markdown content
 * @param options - Conversion options
 * @returns HTML string
 */
export function markdownToHtml(
  markdown: string,
  options: MdToHtmlOptions = {}
): string {
  if (!markdown || markdown.trim() === '') {
    return options.wrapInBody ? '<body></body>' : '';
  }

  let result = markdown;

  // Escape HTML entities first
  result = escapeHtml(result);

  // Convert headings to bold (Asana doesn't support headings well)
  result = result.replace(/^######\s+(.+)$/gm, '<strong>$1</strong>\n');
  result = result.replace(/^#####\s+(.+)$/gm, '<strong>$1</strong>\n');
  result = result.replace(/^####\s+(.+)$/gm, '<strong>$1</strong>\n');
  result = result.replace(/^###\s+(.+)$/gm, '<strong>$1</strong>\n');
  result = result.replace(/^##\s+(.+)$/gm, '<strong>$1</strong>\n');
  result = result.replace(/^#\s+(.+)$/gm, '<strong>$1</strong>\n');

  // Convert code blocks
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.slice(3, -3).replace(/^\w*\n/, ''); // Remove language identifier
    return `<code>${code}</code>`;
  });

  // Convert inline code
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Convert bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Convert italic
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  result = result.replace(/_(.+?)_/g, '<em>$1</em>');

  // Convert strikethrough
  result = result.replace(/~~(.+?)~~/g, '<s>$1</s>');

  // Convert links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Convert auto-links
  result = result.replace(/<(https?:\/\/[^>]+)>/g, '<a href="$1">$1</a>');

  // Convert unordered lists
  result = convertUnorderedLists(result);

  // Convert ordered lists
  result = convertOrderedLists(result);

  // Convert horizontal rules
  result = result.replace(/^---+$/gm, '<hr/>');
  result = result.replace(/^\*\*\*+$/gm, '<hr/>');

  // Convert line breaks (two spaces or backslash at end of line)
  result = result.replace(/  \n/g, '<br/>\n');
  result = result.replace(/\\\n/g, '<br/>\n');

  // Convert paragraph breaks (double newlines)
  result = result.replace(/\n\n+/g, '</p><p>');

  // Wrap paragraphs if not already wrapped
  if (!result.startsWith('<')) {
    result = `<p>${result}</p>`;
  }

  // Clean up empty paragraphs
  result = result.replace(/<p>\s*<\/p>/g, '');

  // Wrap in body if requested
  if (options.wrapInBody) {
    result = `<body>${result}</body>`;
  }

  return result;
}

/**
 * Convert unordered lists
 */
function convertUnorderedLists(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const listMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);

    if (listMatch) {
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      result.push(`<li>${listMatch[2]}</li>`);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      result.push(line);
    }
  }

  if (inList) {
    result.push('</ul>');
  }

  return result.join('\n');
}

/**
 * Convert ordered lists
 */
function convertOrderedLists(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const listMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);

    if (listMatch) {
      if (!inList) {
        result.push('<ol>');
        inList = true;
      }
      result.push(`<li>${listMatch[2]}</li>`);
    } else {
      if (inList) {
        result.push('</ol>');
        inList = false;
      }
      result.push(line);
    }
  }

  if (inList) {
    result.push('</ol>');
  }

  return result.join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const escapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    // Don't escape quotes as we need them for attributes
  };

  return text.replace(/[&<>]/g, (char) => escapes[char] ?? char);
}

/**
 * Strip Markdown formatting
 *
 * @param markdown - Markdown text
 * @returns Plain text
 */
export function stripMarkdown(markdown: string): string {
  let result = markdown;

  // Remove code blocks
  result = result.replace(/```[\s\S]*?```/g, '');

  // Remove inline code
  result = result.replace(/`([^`]+)`/g, '$1');

  // Remove bold/italic
  result = result.replace(/\*\*(.+?)\*\*/g, '$1');
  result = result.replace(/__(.+?)__/g, '$1');
  result = result.replace(/\*(.+?)\*/g, '$1');
  result = result.replace(/_(.+?)_/g, '$1');

  // Remove strikethrough
  result = result.replace(/~~(.+?)~~/g, '$1');

  // Convert links to just text
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove headings
  result = result.replace(/^#+\s+/gm, '');

  // Remove list markers
  result = result.replace(/^[\s]*[-*+]\s+/gm, '');
  result = result.replace(/^[\s]*\d+\.\s+/gm, '');

  // Remove horizontal rules
  result = result.replace(/^---+$/gm, '');
  result = result.replace(/^\*\*\*+$/gm, '');

  return result.trim();
}

/**
 * Check if text contains Markdown
 *
 * @param text - Text to check
 * @returns True if contains Markdown syntax
 */
export function containsMarkdown(text: string): boolean {
  // Check for common Markdown patterns
  const patterns = [
    /\*\*.+?\*\*/, // Bold
    /__.+?__/, // Bold
    /\*.+?\*/, // Italic
    /_.+?_/, // Italic
    /~~.+?~~/, // Strikethrough
    /`[^`]+`/, // Inline code
    /```[\s\S]*?```/, // Code block
    /\[.+?\]\(.+?\)/, // Link
    /^#+\s+/m, // Heading
    /^[-*+]\s+/m, // Unordered list
    /^\d+\.\s+/m, // Ordered list
  ];

  return patterns.some((pattern) => pattern.test(text));
}
