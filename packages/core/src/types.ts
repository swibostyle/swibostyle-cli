/**
 * Core type definitions for swibostyle
 */

// =============================================================================
// Book Configuration
// =============================================================================

export interface BookConfig {
  /** Book title */
  title: string;
  /** List of authors */
  authors: Author[];
  /** Publisher name */
  publisher: string;
  /** Language code (e.g., 'ja', 'en') */
  lang: string;

  /** Book identifiers */
  bookId: {
    epub: string;
    print?: string;
  };

  /** Layout type */
  layout: 'reflowable' | 'pre-paginated';
  /** Page direction */
  pageDirection: 'ltr' | 'rtl';
  /** Primary writing mode */
  primaryWritingMode: 'horizontal-tb' | 'vertical-rl';

  /** Original image resolution (e.g., '1693x2361') */
  originalResolution?: string;
  /** Image crop configurations for EPUB */
  epubImageCrops?: ImageCropConfig[];

  /** Pages to be generated from images */
  pagesToBeGeneratedFromImage?: PageFromImageConfig[];

  /** Build target configurations */
  targets?: {
    epub?: TargetConfig;
    print?: TargetConfig;
    pod?: TargetConfig;
  };
}

export interface Author {
  /** Author name */
  name: string;
  /** Role: aut=author, ill=illustrator, edt=editor, trl=translator */
  role: 'aut' | 'ill' | 'edt' | 'trl';
  /** File-as name for sorting */
  fileAs?: string;
}

export interface TargetConfig {
  /** Entry CSS file name */
  css: string;
  /** Enable image resizing for this target */
  enableImageResizing?: boolean;
  /** Enable image cropping for this target */
  enableImageCrop?: boolean;
}

export interface ImageCropConfig {
  /** File name pattern (regex) */
  fileNamePattern: string;
  /** Bleed amounts to crop */
  bleed: { x: number; y: number };
}

export interface PageFromImageConfig {
  /** Page ID */
  id: string;
  /** Source image file name */
  fileName: string;
  /** Page title */
  title?: string;
  /** Additional frontmatter */
  frontmatter?: Partial<Frontmatter>;
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
  guideType?: 'cover' | 'toc' | 'bodymatter' | 'copyright';

  /** EPUB page spread property */
  epubPageProperty?: 'page-spread-left' | 'page-spread-right';

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
// Content Items
// =============================================================================

export type ContentItem = XHTMLContent | ImageContent;

export interface XHTMLContent {
  type: 'xhtml';
  id: string;
  fileName: string;
  title: string;
  html: string;
  frontmatter: Frontmatter;
  properties?: string;
  displayOrder: number;
  fallbackImage?: string;
}

export interface ImageContent {
  type: 'image';
  id: string;
  fileName: string;
  dimensions: ImageDimensions;
  contentType: string;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

// =============================================================================
// Build Configuration
// =============================================================================

export type BuildTargetType = 'epub' | 'print' | 'pod';

export interface BuildTarget {
  type: BuildTargetType;
  css: string;
  enableImageResizing: boolean;
  enableImageCrop: boolean;
}

export interface BuildOptions {
  /** Build target type */
  target: BuildTargetType;
  /** Output mode */
  output?: 'file' | 'memory';
}

export interface BuildResult {
  /** Output file path (when output mode is 'file') */
  outputPath?: string;
  /** Output data (when output mode is 'memory') */
  data?: Uint8Array;
  /** List of generated content items */
  contents: ContentItem[];
}

// =============================================================================
// Path Configuration
// =============================================================================

export interface PathConfig {
  /** Source directory */
  src: string;
  /** Build directory */
  build: string;
  /** Release directory */
  release: string;
  /** Markdown source directory */
  markdown: string;
  /** Styles directory */
  styles: string;
  /** Images directory */
  images: string;
  /** Templates directory */
  templates: string;
  /** META-INF directory */
  metaInf: string;
}

// =============================================================================
// Progress Events
// =============================================================================

export type BuildPhase =
  | 'clean'
  | 'copy'
  | 'css'
  | 'image'
  | 'markdown'
  | 'opf'
  | 'navigation'
  | 'archive';

export interface ProgressEvent {
  phase: BuildPhase;
  current: number;
  total: number;
  message?: string;
}

export type ProgressCallback = (event: ProgressEvent) => void;

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
