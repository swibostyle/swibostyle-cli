/**
 * SSG (Swibo Style Generator) type definitions
 */

import type { BookConfig, BuildTargetType } from "../types.js";

// =============================================================================
// Route Types
// =============================================================================

/**
 * Route metadata - used for OPF/Navigation generation
 */
export interface RouteMetadata {
  /** Page title */
  title?: string;
  /** Display order for sorting (OPF spine order) */
  displayOrder?: number;
  /** Viewport for fixed layout pages */
  viewport?: string;
  /** CSS class for html element */
  htmlClass?: string;
  /** EPUB page property (page-spread-left, page-spread-right, etc.) */
  epubPageProperty?: string;
  /** Only include for this target */
  includeIf?: BuildTargetType;
  /** Exclude from this target */
  excludeIf?: BuildTargetType;
  /** Include in EPUB guide */
  isGuideItem?: boolean;
  /** Include in navigation */
  isNavigationItem?: boolean;
  /** EPUB semantic type (cover, toc, etc.) */
  epubType?: string;
  /** Override output file name */
  outputFileName?: string;
  /** Content contains SVG elements (auto-detected) */
  containsSvg?: boolean;
}

/**
 * Route type classification
 */
export type RouteType = "xhtml" | "image" | "css" | "opf" | "navigation" | "other";

/**
 * Route information for a single route
 */
export interface RouteInfo {
  /** Output path (e.g., "item/xhtml/p-cover.xhtml") */
  path: string;
  /** Source path (e.g., "src/item/xhtml/p-000-cover-epub.md") */
  sourcePath?: string;
  /** Route type */
  type: RouteType;
  /** Route metadata */
  metadata: RouteMetadata;
}

// =============================================================================
// Response Types
// =============================================================================

/**
 * Response type enumeration
 */
export type ResponseType = "xml" | "html" | "text" | "binary" | "notFound";

/**
 * Response from a route handler
 */
export interface SSGResponse {
  type: ResponseType;
  content?: string;
  data?: Uint8Array;
}

// =============================================================================
// Context Types
// =============================================================================

/**
 * Image information returned by getImage()
 */
export interface ImageInfo {
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp" | "gif" | "svg";
}

/**
 * SSG Context - passed to route handlers
 */
export interface SSGContext {
  /** Book configuration from book.json */
  book: BookConfig;
  /** Current build target */
  target: BuildTargetType;
  /** Current route path */
  path: string;
  /** All registered routes (for OPF/Navigation generation) */
  routes: RouteInfo[];

  // Response helpers
  /** Return XML response */
  xml(strings: TemplateStringsArray, ...values: unknown[]): SSGResponse;
  /** Return HTML/XHTML response */
  html(strings: TemplateStringsArray, ...values: unknown[]): SSGResponse;
  /** Return plain text response */
  text(content: string): SSGResponse;
  /** Return binary response */
  binary(data: Uint8Array): SSGResponse;
  /** Return not found (skip file generation) */
  notFound(): SSGResponse;

  // Utilities
  /** Get image dimensions */
  getImage(path: string): ImageInfo | null;

  // Source file (for file-based handlers)
  /** Source file content (if file-based handler) */
  file?: Uint8Array;
}

// =============================================================================
// Handler Types
// =============================================================================

/**
 * Route handler function
 */
export type RouteHandler = (context: SSGContext) => SSGResponse | Promise<SSGResponse>;

/**
 * Route registration options
 */
export interface RouteOptions {
  /** Route metadata */
  metadata?: RouteMetadata;
}

/**
 * Registered route entry
 */
export interface RegisteredRoute {
  /** Route pattern (e.g., "p-cover.xhtml" or "*.md") */
  pattern: string;
  /** Route handler */
  handler: RouteHandler;
  /** Route options */
  options?: RouteOptions;
}

// =============================================================================
// Router Types
// =============================================================================

/**
 * Router instance
 */
export interface Router {
  /** Register a GET route */
  get(pattern: string, handler: RouteHandler, options?: RouteOptions): Router;
  /** Get all registered routes */
  getRoutes(): RegisteredRoute[];
  /** Base path for this router */
  basePath: string;
}

/**
 * Handler wrapper for single-file handlers
 */
export interface Handler {
  /** The handler function */
  handler: RouteHandler;
  /** Handler metadata */
  metadata?: RouteMetadata;
}

// =============================================================================
// Scanner Types
// =============================================================================

/**
 * Scanned file entry
 */
export interface ScannedFile {
  /** Relative path from src */
  path: string;
  /** Absolute path */
  absolutePath: string;
  /** File extension */
  extension: string;
  /** Is this an index.ts file */
  isIndex: boolean;
  /** Is this a handler file (.ts/.js) */
  isHandler: boolean;
}

/**
 * Scanner options
 */
export interface ScannerOptions {
  /** Source directory */
  srcDir: string;
  /** Build target (for includeIf/excludeIf filtering) */
  target: BuildTargetType;
}

// =============================================================================
// Build Types
// =============================================================================

/**
 * SSG build options
 */
export interface SSGBuildOptions {
  /** Project root directory */
  projectRoot: string;
  /** Build target */
  target: BuildTargetType;
  /** Output mode */
  output?: "file" | "memory";
}

/**
 * SSG build result
 */
export interface SSGBuildResult {
  /** Output file path (when output mode is 'file') */
  outputPath?: string;
  /** Output data (when output mode is 'memory') */
  data?: Uint8Array;
  /** Generated routes */
  routes: RouteInfo[];
}
