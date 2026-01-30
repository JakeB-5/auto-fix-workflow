/**
 * @module asana/get-task/html-to-md
 * @description HTML to Markdown conversion for Asana task notes
 */

/** Conversion options */
export interface HtmlToMdOptions {
  /** Preserve line breaks */
  readonly preserveLineBreaks?: boolean;
  /** Convert Asana user mentions to @username format */
  readonly convertMentions?: boolean;
  /** Base URL for relative links */
  readonly baseUrl?: string;
}

/**
 * Convert Asana HTML notes to Markdown
 *
 * Asana uses a subset of HTML:
 * - <body> wrapper
 * - <strong>, <em> for formatting
 * - <u> for underline (converted to _text_)
 * - <s> for strikethrough
 * - <code> for inline code
 * - <a> for links
 * - <ul>, <ol>, <li> for lists
 * - <br> for line breaks
 * - <h1>-<h6> for headings (rarely used)
 *
 * @param html - Asana HTML content
 * @param options - Conversion options
 * @returns Markdown string
 */
export function htmlToMarkdown(
  html: string,
  options: HtmlToMdOptions = {}
): string {
  if (!html || html.trim() === '') {
    return '';
  }

  let result = html;

  // Remove body wrapper
  result = result.replace(/<\/?body>/gi, '');

  // Convert headings
  result = result.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  result = result.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  result = result.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  result = result.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  result = result.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
  result = result.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');

  // Convert bold
  result = result.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  result = result.replace(/<b>(.*?)<\/b>/gi, '**$1**');

  // Convert italic
  result = result.replace(/<em>(.*?)<\/em>/gi, '_$1_');
  result = result.replace(/<i>(.*?)<\/i>/gi, '_$1_');

  // Convert underline to italic (Markdown doesn't have underline)
  result = result.replace(/<u>(.*?)<\/u>/gi, '_$1_');

  // Convert strikethrough
  result = result.replace(/<s>(.*?)<\/s>/gi, '~~$1~~');
  result = result.replace(/<strike>(.*?)<\/strike>/gi, '~~$1~~');
  result = result.replace(/<del>(.*?)<\/del>/gi, '~~$1~~');

  // Convert inline code
  result = result.replace(/<code>(.*?)<\/code>/gi, '`$1`');

  // Convert preformatted text
  result = result.replace(/<pre>(.*?)<\/pre>/gis, '```\n$1\n```\n');

  // Convert links
  result = result.replace(
    /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi,
    (_, href, text) => {
      // Handle relative URLs
      if (options.baseUrl && href.startsWith('/')) {
        href = options.baseUrl + href;
      }
      // If text equals href, use auto-link format
      if (text === href) {
        return `<${href}>`;
      }
      return `[${text}](${href})`;
    }
  );

  // Convert user mentions (Asana specific)
  if (options.convertMentions) {
    result = result.replace(
      /<a\s+[^>]*data-asana-gid="[^"]*"[^>]*>@([^<]*)<\/a>/gi,
      '@$1'
    );
  }

  // Convert unordered lists
  result = convertLists(result, 'ul', '-');

  // Convert ordered lists
  result = convertOrderedLists(result);

  // Convert paragraphs
  result = result.replace(/<p>(.*?)<\/p>/gis, '$1\n\n');

  // Convert line breaks
  if (options.preserveLineBreaks) {
    result = result.replace(/<br\s*\/?>/gi, '  \n');
  } else {
    result = result.replace(/<br\s*\/?>/gi, '\n');
  }

  // Remove remaining HTML tags
  result = result.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  result = decodeHtmlEntities(result);

  // Clean up whitespace
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.trim();

  return result;
}

/**
 * Convert HTML unordered lists to Markdown
 */
function convertLists(html: string, tagName: string, marker: string): string {
  const listRegex = new RegExp(
    `<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    'gi'
  );

  return html.replace(listRegex, (_, content) => {
    const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    const mdItems = items.map((item: string) => {
      const text = item.replace(/<\/?li[^>]*>/gi, '').trim();
      return `${marker} ${text}`;
    });
    return mdItems.join('\n') + '\n\n';
  });
}

/**
 * Convert HTML ordered lists to Markdown
 */
function convertOrderedLists(html: string): string {
  const listRegex = /<ol[^>]*>([\s\S]*?)<\/ol>/gi;

  return html.replace(listRegex, (_, content) => {
    const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    const mdItems = items.map((item: string, index: number) => {
      const text = item.replace(/<\/?li[^>]*>/gi, '').trim();
      return `${index + 1}. ${text}`;
    });
    return mdItems.join('\n') + '\n\n';
  });
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&mdash;': '\u2014',
    '&ndash;': '\u2013',
    '&hellip;': '\u2026',
    '&copy;': '\u00A9',
    '&reg;': '\u00AE',
    '&trade;': '\u2122',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'gi'), char);
  }

  // Decode numeric entities
  result = result.replace(/&#(\d+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 10))
  );
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
    String.fromCharCode(parseInt(code, 16))
  );

  return result;
}

/**
 * Check if string contains HTML
 *
 * @param text - Text to check
 * @returns True if contains HTML tags
 */
export function containsHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

/**
 * Strip all HTML tags
 *
 * @param html - HTML content
 * @returns Plain text
 */
export function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ''));
}
