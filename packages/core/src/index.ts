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
} from "./types";

// Adapters
export type { StorageAdapter } from "./adapters/storage/interface";
export { NodeStorageAdapter } from "./adapters/storage/node";
export { MemoryStorageAdapter } from "./adapters/storage/memory";

export type {
  ImageAdapter,
  ImageFormat,
  ResizeOptions,
  CropOptions,
  ConvertOptions,
} from "./adapters/image/interface";
export { SharpImageAdapter, NoopImageAdapter, isSharpAvailable } from "./adapters/image/index";

export type { CSSAdapter, CSSInput, CSSOutput } from "./adapters/css/interface";
export { SassAdapter } from "./adapters/css/sass";
export type { SassAdapterOptions } from "./adapters/css/sass";
export { PassthroughCSSAdapter } from "./adapters/css/passthrough";

// Config
export { loadBookConfig, getDefaultBookConfig } from "./config/loader";
export {
  // Loader
  loadConfig,
  findConfigFile,
  // Define helpers
  defineConfig,
  defineMarkdownPlugin,
  defineCSSPlugin,
  defineImagePlugin,
  resolveConfig,
  resolveConfigExport,
  extractBookConfig,
  chainValidators,
  // Built-in validators
  createEpubCheckValidator,
  createCustomValidator,
  warningsOnly,
  ignoreErrors,
  targetOnly,
  noopValidator,
} from "./config/index";

export type {
  UserConfig,
  ResolvedConfig,
  ConfigExport,
  MarkdownPlugin,
  CSSPlugin,
  ImagePlugin,
  BuildHooks,
  Validator,
  ValidatorFactory,
  ValidatorOptions,
  ValidationMessage,
  ValidationResult,
  PluginContext,
  AdapterConfig,
  SassAdapterConfigOptions,
  ImageAdapterOptions,
  VFMOptions,
} from "./config/index";

// Utils
export { convertToXhtml } from "./utils/xhtml";
export { readFrontmatter } from "./utils/frontmatter";
export { getContentType } from "./utils/mime";

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
} from "./ssg/index";

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
} from "./ssg/index";
