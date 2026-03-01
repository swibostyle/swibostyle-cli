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
  SSGBuildOutputs,
} from "./types";

// Router
export { createRouter, createHandler, matchRoute, findRoute, mergeRoutes } from "./router";

// Context
export { createSSGContext, raw, RawString } from "./context";
export type { SSGContextOptions } from "./context";

// Scanner
export {
  scanRoutes,
  scannedToRouteInfo,
  sortRoutesByDisplayOrder,
  loadIndexRouter,
  findIndexFiles,
} from "./scanner";
export type { ScanOptions, ScannedRoute } from "./scanner";

// Default handlers
export { createDefaultRouter } from "./handlers";

// Build
export { buildSSG, buildSSGOutputs } from "./build";
export type { SSGBuildContext } from "./build";
