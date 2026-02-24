export interface ArticleMeta {
  title: string;
  publishDate: string;
  author: string;
  description: string;
}

export interface XArticle {
  meta: ArticleMeta;
  body: string;
  charCount: number;
}

/**
 * Parse YAML frontmatter from a markdown string.
 */
function parseFrontmatter(markdown: string): {
  meta: ArticleMeta;
  content: string;
} {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return {
      meta: { title: "", publishDate: "", author: "", description: "" },
      content: markdown,
    };
  }

  const yaml = match[1];
  const content = match[2];

  const getValue = (key: string): string => {
    const line = yaml
      .split("\n")
      .find((l) => l.startsWith(`${key}:`));
    if (!line) return "";
    return line
      .slice(key.length + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  };

  return {
    meta: {
      title: getValue("title"),
      publishDate: getValue("publishDate"),
      author: getValue("author"),
      description: getValue("description"),
    },
    content,
  };
}

/**
 * Convert markdown content to clean X Article text.
 *
 * X Articles support basic rich text (bold, italic, headings, links, lists)
 * when pasted or composed in the browser. This converter produces clean,
 * readable plain text optimized for copy-pasting into X's article editor.
 */
function convertBody(content: string): string {
  let text = content;

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // Remove image references (X Article images are added via the editor)
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");

  // Remove mermaid code blocks entirely
  text = text.replace(/```mermaid\n[\s\S]*?```/g, "");

  // Convert code blocks to indented text with language label
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const label = lang ? `[${lang}]` : "[code]";
    const indented = code
      .trimEnd()
      .split("\n")
      .map((line: string) => `  ${line}`)
      .join("\n");
    return `${label}\n${indented}\n`;
  });

  // Convert inline code
  text = text.replace(/`([^`]+)`/g, "$1");

  // Convert bold
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");

  // Convert italic
  text = text.replace(/\*([^*]+)\*/g, "$1");

  // Convert links: [text](url) → text (url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // Convert headings to uppercase with separator
  text = text.replace(/^#{1,2}\s+(.+)$/gm, (_match, heading) => {
    return `\n${"—".repeat(3)}\n\n${heading.toUpperCase()}\n`;
  });

  // Convert h3+ to bold-style
  text = text.replace(/^#{3,6}\s+(.+)$/gm, "\n$1\n");

  // Convert markdown tables to aligned text
  text = text.replace(
    /(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/g,
    (_match, header, _sep, body) => {
      const parseRow = (row: string) =>
        row
          .split("|")
          .slice(1, -1)
          .map((cell: string) => cell.trim());

      const headers = parseRow(header);
      const rows = body
        .trim()
        .split("\n")
        .map(parseRow);

      // Calculate column widths
      const widths = headers.map((h: string, i: number) =>
        Math.max(
          h.length,
          ...rows.map((r: string[]) => (r[i] || "").length)
        )
      );

      const pad = (s: string, w: number) => s.padEnd(w);
      const formatRow = (cells: string[]) =>
        cells.map((c, i) => pad(c, widths[i])).join("  |  ");

      const headerLine = formatRow(headers);
      const sepLine = widths
        .map((w: number) => "-".repeat(w))
        .join("--+--");
      const bodyLines = rows
        .map((r: string[]) => formatRow(r))
        .join("\n");

      return `${headerLine}\n${sepLine}\n${bodyLines}\n`;
    }
  );

  // Convert unordered lists
  text = text.replace(/^[-*]\s+/gm, "• ");

  // Convert blockquotes
  text = text.replace(/^>\s*\*\*(.+?)\*\*:?\s*/gm, "→ $1: ");
  text = text.replace(/^>\s+/gm, "→ ");

  // Clean up horizontal rules
  text = text.replace(/^---$/gm, "———");

  // Collapse consecutive separators (e.g. --- before ## heading)
  text = text.replace(/(———\s*\n)+———/g, "———");

  // Collapse excessive blank lines (3+ → 2)
  text = text.replace(/\n{4,}/g, "\n\n\n");

  // Trim leading/trailing whitespace
  text = text.trim();

  return text;
}

/**
 * Convert a raw markdown article to an X Article.
 */
export function markdownToXArticle(markdown: string): XArticle {
  const { meta, content } = parseFrontmatter(markdown);

  const title = meta.title.toUpperCase();
  const byline = meta.author ? `by ${meta.author}` : "";
  const description = meta.description || "";

  const body = convertBody(content);

  // Build header section
  const header = [title, byline, description].filter(Boolean).join("\n");

  // Combine with body, ensuring a single separator between header and content
  const fullText = `${header}\n\n———\n\n${body.replace(/^\s*———\s*/, "")}`;

  return {
    meta,
    body: fullText,
    charCount: fullText.length,
  };
}
