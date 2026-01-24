/**
 * @swibostyle/core
 *
 * Core library for CSS typesetting and EPUB generation.
 * Designed to work in Node.js, Bun, and browser environments.
 */

// Types
export type {
  BookConfig,
  Author,
  TargetConfig,
  ImageCropConfig,
  PageFromImageConfig,
  Frontmatter,
  ContentItem,
  XHTMLContent,
  ImageContent,
  ImageDimensions,
  BuildTargetType,
  BuildTarget,
  BuildOptions,
  BuildResult,
  PathConfig,
  BuildPhase,
  ProgressEvent,
  ProgressCallback,
  Logger,
  FileStat,
} from "./types.js";

// Builder
export { build } from "./builder/pipeline.js";
export { clean } from "./builder/clean.js";
export { copy } from "./builder/copy.js";
export { createEpubArchive, writeEpubFile } from "./builder/archive.js";
export type {
  BuildContext,
  BuildContextOptions,
  NodeContextOptions,
  BuildPaths,
} from "./builder/context.js";
export { getDefaultPaths, getBuildPaths } from "./builder/context.js";

// Context factories
export { createNodeContext, createBuildContext } from "./context.js";

// Adapters
export type { StorageAdapter } from "./adapters/storage/interface.js";
export { NodeStorageAdapter } from "./adapters/storage/node.js";
export { MemoryStorageAdapter } from "./adapters/storage/memory.js";

export type {
  ImageAdapter,
  ImageFormat,
  ResizeOptions,
  CropOptions,
  ConvertOptions,
} from "./adapters/image/interface.js";
export { SharpImageAdapter } from "./adapters/image/sharp.js";
export { NoopImageAdapter } from "./adapters/image/noop.js";

export type { CSSAdapter, CSSInput, CSSOutput } from "./adapters/css/interface.js";
export { SassAdapter } from "./adapters/css/sass.js";
export { PassthroughCSSAdapter } from "./adapters/css/passthrough.js";

// Config
export { loadBookConfig, getDefaultBookConfig } from "./config/loader.js";

// Processors (for advanced use)
export { processCSS } from "./processors/css.js";
export { processMarkdown } from "./processors/markdown.js";
export { processImages } from "./processors/image.js";
export { generateOPF } from "./processors/opf.js";
export { generateNavigation } from "./processors/navigation.js";
export { generatePagesFromImages } from "./processors/page-from-image.js";

// Utils
export { convertToXhtml } from "./utils/xhtml.js";
export { readFrontmatter } from "./utils/frontmatter.js";
export { getContentType } from "./utils/mime.js";

// SSG (Swibo Style Generator)
export {
  // Router
  createRouter,
  createHandler,
  matchRoute,
  findRoute,
  mergeRoutes,
  // Context
  createSSGContext,
  raw,
  RawString,
  // Scanner
  scanRoutes,
  scannedToRouteInfo,
  sortRoutesByDisplayOrder,
  loadIndexRouter,
  findIndexFiles,
  // Default handlers
  createDefaultRouter,
  // Build
  buildSSG,
} from "./ssg/index.js";

export type {
  // Route types
  RouteMetadata,
  RouteType,
  RouteInfo,
  ResponseType,
  SSGResponse,
  ImageInfo,
  SSGContext,
  RouteHandler,
  RouteOptions,
  RegisteredRoute,
  Router,
  Handler,
  // Scanner types
  ScannedFile,
  ScannerOptions,
  ScanOptions,
  ScannedRoute,
  // Build types
  SSGBuildOptions,
  SSGBuildResult,
  SSGBuildContext,
  // Context types
  SSGContextOptions,
} from "./ssg/index.js";
