import type { BuildTargetType, Frontmatter } from "../types";

/**
 * Options for rendering XHTML page
 */
export interface XHTMLTemplateOptions {
  /** Page title */
  title: string;
  /** Body content (XHTML fragment) */
  body: string;
  /** Frontmatter metadata */
  frontmatter: Frontmatter;
  /** Language code (default: 'ja') */
  lang?: string;
  /** Build target name for CSS reference */
  target?: BuildTargetType;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Render XHTML page template
 *
 * CSS loading order:
 * 1. base.css - Common styles shared across all targets
 * 2. {target}.css - Target-specific styles (e.g., epub.css, print.css)
 */
export function renderXHTML(options: XHTMLTemplateOptions): string {
  const { title, body, frontmatter, lang = "ja", target = "epub" } = options;

  const htmlClass = frontmatter.htmlClass ?? "vertical";
  const viewport = frontmatter.viewport;

  // CSS references: base.css first, then target-specific CSS
  const cssLinks = [
    `<link rel="stylesheet" type="text/css" href="../style/base.css" />`,
    `<link rel="stylesheet" type="text/css" href="../style/${escapeXml(target)}.css" />`,
  ].join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(lang)}" lang="${escapeXml(lang)}" class="${escapeXml(htmlClass)}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeXml(title)}</title>${viewport ? `\n  <meta name="viewport" content="${escapeXml(viewport)}" />` : ""}
  ${cssLinks}
</head>
<body>
  <div class="main">
${body}
  </div>
</body>
</html>
`;
}
