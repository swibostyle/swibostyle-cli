/**
 * SSG (Swibo Style Generator) Module
 *
 * File-based routing for EPUB generation with Hono-style API.
 */

// Types
export type {
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
  ScannedFile,
  ScannerOptions,
  SSGBuildOptions,
  SSGBuildResult,
} from "./types.js";

// Router
export { createRouter, createHandler, matchRoute, findRoute, mergeRoutes } from "./router.js";

// Context
export { createSSGContext, raw, RawString } from "./context.js";
export type { SSGContextOptions } from "./context.js";

// Scanner
export {
  scanRoutes,
  scannedToRouteInfo,
  sortRoutesByDisplayOrder,
  loadIndexRouter,
  findIndexFiles,
} from "./scanner.js";
export type { ScanOptions, ScannedRoute } from "./scanner.js";

// Default handlers
export { createDefaultRouter } from "./handlers.js";

// Build
export { buildSSG } from "./build.js";
export type { SSGBuildContext } from "./build.js";
