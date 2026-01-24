import type { XHTMLContent } from "../types.js";

/**
 * Options for rendering navigation document
 */
export interface NavigationTemplateOptions {
  /** Navigation items (pages with isNavigationItem: true) */
  navigationItems: XHTMLContent[];
  /** Guide items (pages with isGuideItem: true) */
  guideItems: XHTMLContent[];
  /** Language code (default: 'ja') */
  lang?: string;
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
 * Render EPUB 3 Navigation Document
 */
export function renderNavigation(options: NavigationTemplateOptions): string {
  const { navigationItems, guideItems, lang = "ja" } = options;

  // Build TOC list items
  const tocItems = navigationItems
    .map(
      (item) =>
        `            <li><a href="xhtml/${escapeXml(item.fileName)}">${escapeXml(item.title)}</a></li>`,
    )
    .join("\n");

  // Build guide/landmarks list items
  const landmarkItems = guideItems
    .map((item) => {
      const epubType = item.frontmatter.epubType ?? "chapter";
      return `            <li><a epub:type="${escapeXml(epubType)}" href="xhtml/${escapeXml(item.fileName)}">${escapeXml(item.title)}</a></li>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(lang)}">

<head>
    <meta charset="UTF-8" />
    <title>Navigation</title>
</head>

<body>

    <nav epub:type="toc" id="toc">
        <h1>Navigation</h1>
        <ol>
${tocItems}
        </ol>
    </nav>

    <nav epub:type="landmarks" id="guide">
        <h1>Guide</h1>
        <ol>
${landmarkItems}
        </ol>
    </nav>

</body>

</html>
`;
}
