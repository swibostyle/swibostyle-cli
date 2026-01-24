/**
 * SSG Default Handlers
 *
 * Built-in handlers that are used as fallbacks when users don't provide
 * custom handlers for routes.
 */

import type { Router, SSGContext, SSGResponse } from "./types";
import { createRouter } from "./router";

/**
 * Escape XML special characters
 */
function escapeXml(str: string | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Get current timestamp in ISO format
 */
function getModifiedTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Create the default router with built-in handlers
 */
export function createDefaultRouter(): Router {
  const router = createRouter();

  // ===== EPUB Required Files =====

  // mimetype
  router.get("mimetype", (c) => {
    return c.text("application/epub+zip");
  });

  // META-INF/container.xml
  router.get("META-INF/container.xml", (c) => {
    return c.xml`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="item/standard.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`;
  });

  // OPF
  router.get("item/standard.opf", (c) => {
    return renderDefaultOPF(c);
  });

  // Navigation
  router.get("item/navigation-documents.xhtml", (c) => {
    return renderDefaultNavigation(c);
  });

  return router;
}

/**
 * Render default OPF from context
 */
function renderDefaultOPF(c: SSGContext): SSGResponse {
  const { book, routes, target } = c;

  // Filter and sort XHTML routes
  const xhtmlRoutes = routes
    .filter((r) => r.type === "xhtml")
    .sort((a, b) => {
      const orderA = a.metadata.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.metadata.displayOrder ?? Number.MAX_SAFE_INTEGER;
      return orderA !== orderB ? orderA - orderB : a.path.localeCompare(b.path);
    });

  // Filter image routes
  const imageRoutes = routes.filter((r) => r.type === "image");

  // Build authors metadata
  const authorsMetadata = book.authors
    .map((author, index) => {
      const creatorId = `creator${index + 1}`;
      const sortKey = author.nameSortKey ?? author.fileAs ?? author.name;
      return `<dc:creator id="${creatorId}">${escapeXml(author.name)}</dc:creator>
<meta refines="#${creatorId}" property="role" scheme="marc:relators">${escapeXml(author.role)}</meta>
<meta refines="#${creatorId}" property="file-as">${escapeXml(sortKey)}</meta>
<meta refines="#${creatorId}" property="display-seq">${index + 1}</meta>`;
    })
    .join("\n\n");

  // Build image manifest
  const imageManifest = imageRoutes
    .map((img) => {
      const fileName = img.path.split("/").pop() || "";
      const id = fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      const mediaType = getImageMediaType(fileName);
      const props = img.path.includes(book.cover || "") ? ' properties="cover-image"' : "";
      return `<item media-type="${mediaType}" id="${escapeXml(id)}" href="${escapeXml(img.path.replace(/^item\//, ""))}"${props}/>`;
    })
    .join("\n");

  // Build page manifest
  const pageManifest = xhtmlRoutes
    .map((page) => {
      const fileName = page.path.split("/").pop() || "";
      const id = fileName.replace(/\.xhtml$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      // Note: "nav" property should only be on the navigation document, not content pages
      // Add "svg" property if the page contains SVG content
      const props = page.metadata.containsSvg ? ' properties="svg"' : "";
      return `<item media-type="application/xhtml+xml" id="${escapeXml(id)}" href="${escapeXml(page.path.replace(/^item\//, ""))}"${props}/>`;
    })
    .join("\n");

  // Build spine
  const spineItems = xhtmlRoutes
    .map((page) => {
      const fileName = page.path.split("/").pop() || "";
      const id = fileName.replace(/\.xhtml$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      const props = page.metadata.epubPageProperty
        ? ` properties="${escapeXml(page.metadata.epubPageProperty)}"`
        : "";
      return `<itemref linear="yes" idref="${escapeXml(id)}"${props}/>`;
    })
    .join("\n");

  // Get book ID
  const bookId = target === "epub" ? book.bookId.epub : (book.bookId.print ?? book.bookId.epub);

  // Metadata
  const titleSortKey = book.titleSortKey ?? book.title;
  const publisherSortKey = book.publisherSortKey ?? book.publisher;
  const orientation = book.orientation ?? "auto";
  const spread = book.spread ?? "auto";
  const modified = getModifiedTimestamp();

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<package
 xmlns="http://www.idpf.org/2007/opf"
 version="3.0"
 xml:lang="${escapeXml(book.lang)}"
 unique-identifier="unique-id"
 prefix="rendition: http://www.idpf.org/vocab/rendition/#
         ebpaj: http://www.ebpaj.jp/
         fixed-layout-jp: http://www.digital-comic.jp/
         ibooks: http://vocabulary.itunes.apple.com/rdf/ibooks/vocabulary-extensions-1.0/"
>

<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">

<!-- Title -->
<dc:title id="title">${escapeXml(book.title)}</dc:title>
<meta refines="#title" property="file-as">${escapeXml(titleSortKey)}</meta>

<!-- Authors -->
${authorsMetadata}

<!-- Publisher -->
<dc:publisher id="publisher">${escapeXml(book.publisher)}</dc:publisher>
<meta refines="#publisher" property="file-as">${escapeXml(publisherSortKey)}</meta>

<!-- Language -->
<dc:language>${escapeXml(book.lang)}</dc:language>

<!-- Identifier -->
<dc:identifier id="unique-id">${escapeXml(bookId)}</dc:identifier>

<!-- Modified -->
<meta property="dcterms:modified">${escapeXml(modified)}</meta>

<!-- Rendition -->
<meta property="rendition:layout">${escapeXml(book.layout)}</meta>
<meta property="rendition:orientation">${escapeXml(orientation)}</meta>
<meta property="rendition:spread">${escapeXml(spread)}</meta>

<!-- Additional metadata -->
<meta property="ebpaj:guide-version">1.1.3</meta>
<meta property="ibooks:specified-fonts">true</meta>
<meta name="primary-writing-mode" content="${escapeXml(book.primaryWritingMode)}"/>
</metadata>

<manifest>

<!-- Navigation -->
<item media-type="application/xhtml+xml" id="toc" href="navigation-documents.xhtml" properties="nav"/>

<!-- Styles -->
<item media-type="text/css" id="style-base" href="style/base.css"/>
<item media-type="text/css" id="style-target" href="style/${escapeXml(target)}.css"/>

<!-- Images -->
${imageManifest}

<!-- Pages -->
${pageManifest}
</manifest>

<spine page-progression-direction="${escapeXml(book.pageDirection)}">
${spineItems}
</spine>

</package>
`;

  return { type: "xml", content };
}

/**
 * Render default navigation document
 */
function renderDefaultNavigation(c: SSGContext): SSGResponse {
  const { book, routes } = c;

  // Filter navigation items
  const navItems = routes
    .filter((r) => r.type === "xhtml" && r.metadata.isNavigationItem)
    .sort((a, b) => {
      const orderA = a.metadata.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.metadata.displayOrder ?? Number.MAX_SAFE_INTEGER;
      return orderA !== orderB ? orderA - orderB : a.path.localeCompare(b.path);
    });

  // Filter guide items
  const guideItems = routes
    .filter((r) => r.type === "xhtml" && r.metadata.isGuideItem)
    .sort((a, b) => {
      const orderA = a.metadata.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.metadata.displayOrder ?? Number.MAX_SAFE_INTEGER;
      return orderA !== orderB ? orderA - orderB : a.path.localeCompare(b.path);
    });

  // Build TOC list
  const tocItems = navItems
    .map((item) => {
      const href = item.path.replace(/^item\//, "");
      const title = item.metadata.title || href;
      return `<li><a href="${escapeXml(href)}">${escapeXml(title)}</a></li>`;
    })
    .join("\n");

  // Build landmarks
  const landmarks = guideItems
    .map((item) => {
      const href = item.path.replace(/^item\//, "");
      const title = item.metadata.title || href;
      const epubType = item.metadata.epubType || "bodymatter";
      return `<li><a epub:type="${escapeXml(epubType)}" href="${escapeXml(href)}">${escapeXml(title)}</a></li>`;
    })
    .join("\n");

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(book.lang)}" lang="${escapeXml(book.lang)}">
<head>
<meta charset="UTF-8"/>
<title>Navigation</title>
</head>
<body>
<nav epub:type="toc" id="toc">
<h1>目次</h1>
<ol>
${tocItems}
</ol>
</nav>

<nav epub:type="landmarks" id="landmarks" hidden="">
<h1>Landmarks</h1>
<ol>
${landmarks}
</ol>
</nav>
</body>
</html>
`;

  return { type: "html", content };
}

/**
 * Get media type for image file
 */
function getImageMediaType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}
