/**
 * SSG Router implementation
 *
 * Provides Hono-style routing for EPUB generation.
 */

import type {
  Router,
  RouteHandler,
  RouteOptions,
  RegisteredRoute,
  Handler,
  RouteMetadata,
} from "./types";

/**
 * Create a new router instance
 *
 * @param basePath - Base path for routes registered with this router
 * @returns Router instance
 *
 * @example
 * ```typescript
 * // src/item/xhtml/index.ts
 * import { createRouter } from "@swibostyle/core";
 *
 * const app = createRouter();
 *
 * app.get("p-cover.xhtml", (c) => {
 *   return c.html`<html>...</html>`;
 * });
 *
 * export default app;
 * ```
 */
export function createRouter(basePath: string = ""): Router {
  const routes: RegisteredRoute[] = [];

  const router: Router = {
    basePath,

    get(pattern: string, handler: RouteHandler, options?: RouteOptions): Router {
      routes.push({ pattern, handler, options });
      return router;
    },

    getRoutes(): RegisteredRoute[] {
      return [...routes];
    },
  };

  return router;
}

/**
 * Create a handler for a single file
 *
 * @param handler - Route handler function
 * @param metadata - Optional metadata for the route
 * @returns Handler wrapper
 *
 * @example
 * ```typescript
 * // src/item/standard.opf.ts
 * import { createHandler } from "@swibostyle/core";
 *
 * export default createHandler((c) => {
 *   return c.xml`<?xml version="1.0"?>...`;
 * });
 * ```
 */
export function createHandler(handler: RouteHandler, metadata?: RouteMetadata): Handler {
  return { handler, metadata };
}

/**
 * Check if a path matches a route pattern
 *
 * Supports:
 * - Exact match: "p-cover.xhtml"
 * - Wildcard: "*.md", "*.xhtml"
 * - Directory wildcard: "image/*"
 *
 * @param pattern - Route pattern
 * @param path - Path to match
 * @returns true if path matches pattern
 */
export function matchRoute(pattern: string, path: string): boolean {
  // Exact match
  if (pattern === path) {
    return true;
  }

  // Wildcard pattern
  if (pattern.includes("*")) {
    const regexPattern = pattern
      // Escape special regex characters except *
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      // Convert * to regex
      .replace(/\*/g, "[^/]*");

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  return false;
}

/**
 * Find a matching route handler for a path
 *
 * @param routes - List of registered routes
 * @param path - Path to find handler for
 * @returns Matching route or undefined
 */
export function findRoute(routes: RegisteredRoute[], path: string): RegisteredRoute | undefined {
  // First try exact matches
  for (const route of routes) {
    if (route.pattern === path) {
      return route;
    }
  }

  // Then try wildcard matches (most specific first)
  const wildcardRoutes = routes.filter((r) => r.pattern.includes("*"));
  // Sort by specificity (longer patterns first)
  wildcardRoutes.sort((a, b) => b.pattern.length - a.pattern.length);

  for (const route of wildcardRoutes) {
    if (matchRoute(route.pattern, path)) {
      return route;
    }
  }

  return undefined;
}

/**
 * Merge routes from child router into parent
 *
 * Child routes take priority over parent routes for the same pattern.
 *
 * @param parent - Parent router routes
 * @param child - Child router routes
 * @param childBasePath - Base path for child routes
 * @returns Merged routes with child priority
 */
export function mergeRoutes(
  parent: RegisteredRoute[],
  child: RegisteredRoute[],
  childBasePath: string,
): RegisteredRoute[] {
  // Prefix child routes with base path
  const prefixedChild = child.map((route) => ({
    ...route,
    pattern: childBasePath ? `${childBasePath}/${route.pattern}` : route.pattern,
  }));

  // Create a map of patterns to routes (child overwrites parent)
  const routeMap = new Map<string, RegisteredRoute>();

  // Add parent routes first
  for (const route of parent) {
    routeMap.set(route.pattern, route);
  }

  // Child routes overwrite parent
  for (const route of prefixedChild) {
    routeMap.set(route.pattern, route);
  }

  return Array.from(routeMap.values());
}
