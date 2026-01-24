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
  Frontmatter,
  BuildTargetType,
  Logger,
  FileStat,
} from "./types.js";

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
