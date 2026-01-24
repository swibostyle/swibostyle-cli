/**
 * Core type definitions for swibostyle
 */

// =============================================================================
// Book Configuration
// =============================================================================

export interface BookConfig {
  /** Book title */
  title: string;
  /** Title sort key for file-as */
  titleSortKey?: string;
  /** List of authors */
  authors: Author[];
  /** Publisher name */
  publisher: string;
  /** Publisher sort key for file-as */
  publisherSortKey?: string;
  /** Language code (e.g., 'ja', 'en') */
  lang: string;

  /** Book identifiers */
  bookId: {
    epub: string;
    print?: string;
  };

  /** Layout type */
  layout: "reflowable" | "pre-paginated";
  /** Page direction */
  pageDirection: "ltr" | "rtl";
  /** Primary writing mode */
  primaryWritingMode: "horizontal-tb" | "vertical-rl";

  /** Rendition orientation */
  orientation?: string;
  /** Rendition spread */
  spread?: string;
  /** Cover image file name */
  cover?: string;
  /** Book type (e.g., 'comic') */
  bookType?: string;

  /** Original image resolution (e.g., '1693x2361') */
  originalResolution?: string;

  /** Build target configurations (keyed by target name) */
  targets?: Record<string, TargetConfig>;
}

export interface Author {
  /** Author name */
  name: string;
  /** Role: aut=author, ill=illustrator, edt=editor, trl=translator */
  role: "aut" | "ill" | "edt" | "trl" | string;
  /** File-as name for sorting */
  fileAs?: string;
  /** Name sort key (Japanese style) */
  nameSortKey?: string;
}

export interface TargetConfig {
  /** Entry CSS file name (defaults to {target}.scss) */
  css?: string;
  /** Enable image resizing for this target */
  enableImageResizing?: boolean;
}

// =============================================================================
// Frontmatter
// =============================================================================

export interface Frontmatter {
  /** Page title */
  title?: string;
  /** Output file name (without extension) */
  outputFileName?: string;
  /** Display order for sorting */
  displayOrder?: number;

  /** Include in navigation */
  isNavigationItem?: boolean;
  /** Include in guide */
  isGuideItem?: boolean;
  /** Guide type */
  guideType?: "cover" | "toc" | "bodymatter" | "copyright";
  /** EPUB type for landmarks */
  epubType?: string;

  /** EPUB page spread property */
  epubPageProperty?: "page-spread-left" | "page-spread-right";

  /** Only include in this build type */
  includeIf?: BuildTargetType;
  /** Exclude from this build type */
  excludeIf?: BuildTargetType;

  /** Viewport for fixed layout */
  viewport?: string;
  /** HTML class */
  htmlClass?: string;
}

// =============================================================================
// Image Dimensions
// =============================================================================

export interface ImageDimensions {
  width: number;
  height: number;
}

// =============================================================================
// Build Configuration
// =============================================================================

/**
 * Build target type (customizable name, e.g., "epub", "print", "pod", "kindle")
 */
export type BuildTargetType = string;

// =============================================================================
// Logger
// =============================================================================

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// =============================================================================
// File Stats
// =============================================================================

export interface FileStat {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  mtime?: Date;
}
