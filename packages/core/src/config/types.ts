/**
 * Configuration types for book.config.ts
 *
 * Provides a TypeScript-first configuration system with:
 * - Plugin system for Sass, VFM, etc.
 * - Configurable/chainable validators
 * - Adapter customization
 */

import type { BookConfig, Logger } from "../types";
import type { StorageAdapter } from "../adapters/storage/interface";
import type { ImageAdapter } from "../adapters/image/interface";
import type { CSSAdapter, CSSInput, CSSOutput } from "../adapters/css/interface";

// =============================================================================
// Plugin System
// =============================================================================

/**
 * Plugin context passed to plugin hooks
 */
export interface PluginContext {
  /** Book configuration */
  book: BookConfig;
  /** Current build target */
  target: string;
  /** Logger instance */
  logger?: Logger;
}

/**
 * Markdown plugin for processing markdown content
 */
export interface MarkdownPlugin {
  /** Plugin name */
  name: string;

  /**
   * Transform markdown content before VFM processing
   */
  beforeProcess?(content: string, ctx: PluginContext): string | Promise<string>;

  /**
   * Transform HTML content after VFM processing
   */
  afterProcess?(html: string, ctx: PluginContext): string | Promise<string>;
}

/**
 * CSS plugin for processing CSS/SCSS content
 */
export interface CSSPlugin {
  /** Plugin name */
  name: string;

  /**
   * Transform CSS input before processing
   */
  beforeProcess?(input: CSSInput, ctx: PluginContext): CSSInput | Promise<CSSInput>;

  /**
   * Transform CSS output after processing
   */
  afterProcess?(output: CSSOutput, ctx: PluginContext): CSSOutput | Promise<CSSOutput>;
}

/**
 * Image plugin for processing images
 */
export interface ImagePlugin {
  /** Plugin name */
  name: string;

  /**
   * Transform image data before processing
   */
  beforeProcess?(
    data: Uint8Array,
    path: string,
    ctx: PluginContext,
  ): Uint8Array | Promise<Uint8Array>;

  /**
   * Transform image data after processing
   */
  afterProcess?(
    data: Uint8Array,
    path: string,
    ctx: PluginContext,
  ): Uint8Array | Promise<Uint8Array>;
}

/**
 * Build lifecycle hooks
 */
export interface BuildHooks {
  /**
   * Called before build starts
   */
  beforeBuild?(ctx: PluginContext): void | Promise<void>;

  /**
   * Called after build completes successfully
   */
  afterBuild?(ctx: PluginContext, outputPath: string): void | Promise<void>;

  /**
   * Called when build fails
   */
  onError?(ctx: PluginContext, error: Error): void | Promise<void>;
}

// =============================================================================
// Validator System
// =============================================================================

/**
 * Validation message
 */
export interface ValidationMessage {
  severity: "FATAL" | "ERROR" | "WARNING" | "INFO";
  id: string;
  message: string;
  location?: {
    path: string;
    line?: number;
    column?: number;
  };
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  infos?: ValidationMessage[];
}

/**
 * Validator options
 */
export interface ValidatorOptions {
  /** EPubCheck profile */
  profile?: "default" | "edupub" | "idx" | "dict";
  /** Include informational messages */
  includeInfos?: boolean;
  /** Progress callback */
  onProgress?: (message: string) => void;
}

/**
 * EPUB Validator interface
 */
export interface Validator {
  /** Validator name */
  name: string;

  /**
   * Validate an EPUB file
   */
  validate(epubPath: string, options?: ValidatorOptions): Promise<ValidationResult>;
}

/**
 * Validator factory function
 */
export type ValidatorFactory = () => Validator | Promise<Validator>;

// =============================================================================
// Adapter Configuration
// =============================================================================

/**
 * Sass adapter options
 */
export interface SassAdapterOptions {
  /** Output style */
  style?: "expanded" | "compressed";
  /** Additional load paths */
  loadPaths?: string[];
  /** Generate source maps */
  sourceMap?: boolean;
}

/**
 * Image adapter options
 */
export interface ImageAdapterOptions {
  /** Maximum dimension for resizing (default: 3200) */
  maxDimension?: number;
  /** Maximum pixels for resizing (default: 4_000_000) */
  maxPixels?: number;
  /** JPEG quality (0-100) */
  jpegQuality?: number;
  /** PNG compression level (0-9) */
  pngCompression?: number;
}

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  /**
   * Storage adapter (default: NodeStorageAdapter)
   * Can be a class or instance
   */
  storage?: StorageAdapter | (() => StorageAdapter | Promise<StorageAdapter>);

  /**
   * Image adapter (default: SharpImageAdapter)
   * Can be a class or instance, or options for the default adapter
   */
  image?: ImageAdapter | ImageAdapterOptions | (() => ImageAdapter | Promise<ImageAdapter>);

  /**
   * CSS adapter (default: SassAdapter)
   * Can be a class or instance, or options for the default adapter
   */
  css?: CSSAdapter | SassAdapterOptions | (() => CSSAdapter | Promise<CSSAdapter>);
}

// =============================================================================
// VFM Configuration
// =============================================================================

/**
 * VFM (Vivliostyle Flavored Markdown) options
 */
export interface VFMOptions {
  /** Enable hard line breaks */
  hardLineBreaks?: boolean;
  /** Enable partial mode (no full HTML document) */
  partial?: boolean;
  /** Custom remark plugins */
  remarkPlugins?: unknown[];
  /** Custom rehype plugins */
  rehypePlugins?: unknown[];
}

// =============================================================================
// User Configuration
// =============================================================================

/**
 * Full user configuration for book.config.ts
 */
export interface UserConfig {
  // Book metadata (same as BookConfig)
  /** Book title */
  title: string;
  /** Title sort key */
  titleSortKey?: string;
  /** Authors */
  authors: BookConfig["authors"];
  /** Publisher */
  publisher: string;
  /** Publisher sort key */
  publisherSortKey?: string;
  /** Language code */
  lang: string;
  /** Book identifiers */
  bookId: BookConfig["bookId"];
  /** Layout type */
  layout?: BookConfig["layout"];
  /** Page direction */
  pageDirection?: BookConfig["pageDirection"];
  /** Primary writing mode */
  primaryWritingMode?: BookConfig["primaryWritingMode"];
  /** Orientation */
  orientation?: string;
  /** Spread */
  spread?: string;
  /** Cover image */
  cover?: string;
  /** Book type */
  bookType?: string;
  /** Original resolution */
  originalResolution?: string;
  /** Target configurations */
  targets?: BookConfig["targets"];

  // Extended configuration
  /** Adapter configuration */
  adapters?: AdapterConfig;

  /** VFM options */
  vfm?: VFMOptions;

  /** Markdown plugins (processed in order) */
  markdownPlugins?: MarkdownPlugin[];

  /** CSS plugins (processed in order) */
  cssPlugins?: CSSPlugin[];

  /** Image plugins (processed in order) */
  imagePlugins?: ImagePlugin[];

  /** Build lifecycle hooks */
  hooks?: BuildHooks;

  /** Validators (executed in order, all must pass) */
  validators?: ValidatorFactory[];

  /** Skip validation after build */
  skipValidation?: boolean;
}

/**
 * Resolved configuration with defaults applied
 */
export interface ResolvedConfig {
  /** Book configuration (legacy format) */
  book: BookConfig;

  /** Adapter configuration */
  adapters: AdapterConfig;

  /** VFM options */
  vfm: VFMOptions;

  /** Markdown plugins */
  markdownPlugins: MarkdownPlugin[];

  /** CSS plugins */
  cssPlugins: CSSPlugin[];

  /** Image plugins */
  imagePlugins: ImagePlugin[];

  /** Build hooks */
  hooks: BuildHooks;

  /** Validators */
  validators: ValidatorFactory[];

  /** Skip validation */
  skipValidation: boolean;
}

// =============================================================================
// Helper Types
// =============================================================================

/**
 * Configuration that can be exported from book.config.ts
 */
export type ConfigExport = UserConfig | (() => UserConfig | Promise<UserConfig>);
