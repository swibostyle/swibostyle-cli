import type { BookConfig, BuildTargetType, XHTMLContent, ImageContent } from "../types.js";

/**
 * Extended BookConfig with optional sort keys and other metadata
 */
interface ExtendedBookConfig extends BookConfig {
  titleSortKey?: string;
  publisherSortKey?: string;
  orientation?: string;
  spread?: string;
  cover?: string;
  bookType?: string;
  authors: Array<{
    name: string;
    role: string;
    fileAs?: string;
    nameSortKey?: string;
  }>;
}

/**
 * Options for rendering OPF
 */
export interface OPFTemplateOptions {
  /** Book configuration */
  bookConfig: ExtendedBookConfig;
  /** XHTML pages sorted by display order */
  pages: XHTMLContent[];
  /** Image content items */
  images: ImageContent[];
  /** Build target type */
  buildType: BuildTargetType;
  /** Modified timestamp (ISO format) */
  modified: string;
}

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
 * Render OPF (Open Packaging Format) template
 */
export function renderOPF(options: OPFTemplateOptions): string {
  const { bookConfig, pages, images, buildType, modified } = options;

  // Build authors metadata
  const authorsMetadata = bookConfig.authors
    .map((author, index) => {
      const creatorId = `creator${index + 1}`;
      const sortKey = author.nameSortKey ?? author.fileAs ?? author.name;
      return `<dc:creator id="${creatorId}">${escapeXml(author.name)}</dc:creator>
<meta refines="#${creatorId}" property="role" scheme="marc:relators">${escapeXml(author.role)}</meta>
<meta refines="#${creatorId}" property="file-as">${escapeXml(sortKey)}</meta>
<meta refines="#${creatorId}" property="display-seq">${index + 1}</meta>`;
    })
    .join("\n\n");

  // Build image manifest items
  const imageManifest = images
    .map(
      (img) =>
        `<item media-type="${escapeXml(img.contentType)}" id="${escapeXml(img.id)}" href="image/${escapeXml(img.fileName)}"/>`,
    )
    .join("\n");

  // Build page manifest items
  const pageManifest = pages
    .map((page) => {
      const props = page.properties ? ` properties="${escapeXml(page.properties)}"` : "";
      const fallback = page.fallbackImage ? ` fallback="${escapeXml(page.fallbackImage)}"` : "";
      return `<item media-type="application/xhtml+xml" id="${escapeXml(page.id)}" href="xhtml/${escapeXml(page.fileName)}"${props}${fallback}/>`;
    })
    .join("\n");

  // Build spine items
  const spineItems = pages
    .map((page) => {
      const props = page.frontmatter.epubPageProperty
        ? ` properties="${escapeXml(page.frontmatter.epubPageProperty)}"`
        : "";
      return `<itemref linear="yes" idref="${escapeXml(page.id)}"${props}/>`;
    })
    .join("\n");

  // Get book ID for this build type
  const bookId =
    buildType === "epub"
      ? bookConfig.bookId.epub
      : bookConfig.bookId.print ?? bookConfig.bookId.epub;

  // Title sort key
  const titleSortKey = bookConfig.titleSortKey ?? bookConfig.title;
  const publisherSortKey = bookConfig.publisherSortKey ?? bookConfig.publisher;

  // Rendition properties
  const orientation = bookConfig.orientation ?? "auto";
  const spread = bookConfig.spread ?? "auto";

  // Cover image
  const coverImage = bookConfig.cover
    ? `<item media-type="image/jpeg" id="cover" href="image/${escapeXml(bookConfig.cover)}" properties="cover-image"/>`
    : "";

  // Optional metadata
  const bookTypeMetadata = bookConfig.bookType
    ? `<meta name="book-type" content="${escapeXml(bookConfig.bookType)}" />`
    : "";
  const resolutionMetadata = bookConfig.originalResolution
    ? `<meta name="original-resolution" content="${escapeXml(bookConfig.originalResolution)}"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<package
 xmlns="http://www.idpf.org/2007/opf"
 version="3.0"
 xml:lang="${escapeXml(bookConfig.lang)}"
 unique-identifier="unique-id"
 prefix="rendition: http://www.idpf.org/vocab/rendition/#
         ebpaj: http://www.ebpaj.jp/
         fixed-layout-jp: http://www.digital-comic.jp/
         ibooks: http://vocabulary.itunes.apple.com/rdf/ibooks/vocabulary-extensions-1.0/"
>

<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">

<!-- Title -->
<dc:title id="title">${escapeXml(bookConfig.title)}</dc:title>
<meta refines="#title" property="file-as">${escapeXml(titleSortKey)}</meta>

<!-- Authors -->
${authorsMetadata}

<!-- Publisher -->
<dc:publisher id="publisher">${escapeXml(bookConfig.publisher)}</dc:publisher>
<meta refines="#publisher" property="file-as">${escapeXml(publisherSortKey)}</meta>

<!-- Language -->
<dc:language>${escapeXml(bookConfig.lang)}</dc:language>

<!-- Identifier -->
<dc:identifier id="unique-id">${escapeXml(bookId)}</dc:identifier>

<!-- Modified -->
<meta property="dcterms:modified">${escapeXml(modified)}</meta>

<!-- Rendition -->
<meta property="rendition:layout">${escapeXml(bookConfig.layout)}</meta>
<meta property="rendition:orientation">${escapeXml(orientation)}</meta>
<meta property="rendition:spread">${escapeXml(spread)}</meta>

<!-- Additional metadata -->
<meta property="ebpaj:guide-version">1.1.3</meta>
<meta property="ibooks:specified-fonts">true</meta>
<meta name="primary-writing-mode" content="${escapeXml(bookConfig.primaryWritingMode)}"/>
${bookTypeMetadata}${resolutionMetadata}
</metadata>

<manifest>

<!-- Navigation -->
<item media-type="application/xhtml+xml" id="toc" href="navigation-documents.xhtml" properties="nav"/>

<!-- Style -->
<item media-type="text/css" id="style" href="style/style.css"/>

<!-- Cover Image -->
${coverImage}

<!-- Images -->
${imageManifest}

<!-- Pages -->
${pageManifest}
</manifest>

<spine page-progression-direction="${escapeXml(bookConfig.pageDirection)}">
${spineItems}
</spine>

</package>
`;
}
