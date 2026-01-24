/**
 * SSG File Scanner
 *
 * Scans the source directory to collect routes from:
 * - File-based routes (*.md, *.ts, *.js, images, etc.)
 * - Dynamic routes from index.ts files
 */

import type { StorageAdapter } from "../adapters/storage/interface.js";
import type { BuildTargetType, Frontmatter } from "../types.js";
import type {
  RouteInfo,
  RouteMetadata,
  RouteType,
  Router,
} from "./types.js";
import { readFrontmatter } from "../utils/frontmatter.js";

/**
 * Scanner options
 */
export interface ScanOptions {
  /** Storage adapter */
  storage: StorageAdapter;
  /** Source directory (e.g., "/project/src") */
  srcDir: string;
  /** Build target for includeIf/excludeIf filtering */
  target: BuildTargetType;
}

/**
 * Scanned route entry before handler resolution
 */
export interface ScannedRoute {
  /** Output path (e.g., "item/xhtml/p-cover.xhtml") */
  path: string;
  /** Source path (e.g., "src/item/xhtml/p-000-cover-epub.md") */
  sourcePath: string;
  /** Route type */
  type: RouteType;
  /** Route metadata from frontmatter */
  metadata: RouteMetadata;
  /** Is this from an index.ts dynamic route */
  isDynamic: boolean;
}

/**
 * Get route type from file extension
 */
function getRouteType(path: string): RouteType {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "xhtml":
    case "html":
      return "xhtml";
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
    case "svg":
      return "image";
    case "css":
    case "scss":
      return "css";
    case "opf":
      return "opf";
    default:
      if (path.includes("navigation")) {
        return "navigation";
      }
      return "other";
  }
}

/**
 * Convert frontmatter to route metadata
 */
function frontmatterToMetadata(fm: Frontmatter): RouteMetadata {
  return {
    title: fm.title,
    displayOrder: fm.displayOrder,
    viewport: fm.viewport,
    htmlClass: fm.htmlClass,
    epubPageProperty: fm.epubPageProperty,
    includeIf: fm.includeIf,
    excludeIf: fm.excludeIf,
    isGuideItem: fm.isGuideItem,
    isNavigationItem: fm.isNavigationItem,
    epubType: fm.epubType,
    outputFileName: fm.outputFileName,
  };
}

/**
 * Check if a file should be included for the target
 */
function shouldIncludeForTarget(
  metadata: RouteMetadata,
  target: BuildTargetType,
): boolean {
  if (metadata.includeIf && metadata.includeIf !== target) {
    return false;
  }
  if (metadata.excludeIf && metadata.excludeIf === target) {
    return false;
  }
  return true;
}

/**
 * Convert source path to output path
 */
function sourceToOutputPath(
  sourcePath: string,
  srcDir: string,
  metadata: RouteMetadata,
): string {
  // Remove src dir prefix
  let path = sourcePath;
  if (path.startsWith(srcDir)) {
    path = path.substring(srcDir.length);
  }
  if (path.startsWith("/")) {
    path = path.substring(1);
  }

  // Handle outputFileName override
  if (metadata.outputFileName) {
    const dir = path.substring(0, path.lastIndexOf("/") + 1);
    const ext = path.endsWith(".md") ? ".xhtml" : path.substring(path.lastIndexOf("."));
    path = `${dir}${metadata.outputFileName}${ext}`;
  }

  // Convert extensions
  if (path.endsWith(".md")) {
    path = path.replace(/\.md$/, ".xhtml");
  } else if (path.endsWith(".scss")) {
    path = path.replace(/\.scss$/, ".css");
  } else if (path.endsWith(".ts") || path.endsWith(".js")) {
    // Handler files - remove extension
    path = path.replace(/\.(ts|js)$/, "");
  }

  return path;
}

/**
 * Scan a directory recursively for routes
 */
async function scanDirectory(
  storage: StorageAdapter,
  dir: string,
  srcDir: string,
  target: BuildTargetType,
): Promise<ScannedRoute[]> {
  const routes: ScannedRoute[] = [];

  const entries = await storage.readDir(dir);

  for (const entry of entries) {
    const fullPath = `${dir}/${entry}`;
    const stat = await storage.stat(fullPath);

    if (stat.isDirectory) {
      // Recurse into subdirectory
      const subRoutes = await scanDirectory(storage, fullPath, srcDir, target);
      routes.push(...subRoutes);
    } else if (stat.isFile) {
      // Skip index.ts files (handled separately)
      if (entry === "index.ts" || entry === "index.js") {
        continue;
      }

      // Skip hidden files
      if (entry.startsWith(".")) {
        continue;
      }

      // Process file based on extension
      const ext = entry.split(".").pop()?.toLowerCase();

      if (ext === "md") {
        // Markdown file - read frontmatter
        const content = await storage.readTextFile(fullPath);
        const frontmatter = await readFrontmatter(content);
        const metadata = frontmatterToMetadata(frontmatter);

        // Check target filter
        if (!shouldIncludeForTarget(metadata, target)) {
          continue;
        }

        const outputPath = sourceToOutputPath(fullPath, srcDir, metadata);
        routes.push({
          path: outputPath,
          sourcePath: fullPath,
          type: "xhtml",
          metadata,
          isDynamic: false,
        });
      } else if (ext === "ts" || ext === "js") {
        // Handler file (not index.ts)
        const outputPath = sourceToOutputPath(fullPath, srcDir, {});
        routes.push({
          path: outputPath,
          sourcePath: fullPath,
          type: getRouteType(outputPath),
          metadata: {},
          isDynamic: false,
        });
      } else if (ext === "scss" || ext === "css") {
        // Style file
        const outputPath = sourceToOutputPath(fullPath, srcDir, {});
        routes.push({
          path: outputPath,
          sourcePath: fullPath,
          type: "css",
          metadata: {},
          isDynamic: false,
        });
      } else if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "")) {
        // Image file
        const outputPath = sourceToOutputPath(fullPath, srcDir, {});
        routes.push({
          path: outputPath,
          sourcePath: fullPath,
          type: "image",
          metadata: {},
          isDynamic: false,
        });
      } else {
        // Other files - copy as-is
        const outputPath = sourceToOutputPath(fullPath, srcDir, {});
        routes.push({
          path: outputPath,
          sourcePath: fullPath,
          type: "other",
          metadata: {},
          isDynamic: false,
        });
      }
    }
  }

  return routes;
}

/**
 * Find all index.ts files in the source directory
 */
export async function findIndexFiles(
  storage: StorageAdapter,
  dir: string,
): Promise<string[]> {
  const indexFiles: string[] = [];

  const entries = await storage.readDir(dir);

  for (const entry of entries) {
    const fullPath = `${dir}/${entry}`;
    const stat = await storage.stat(fullPath);

    if (stat.isDirectory) {
      const subIndexFiles = await findIndexFiles(storage, fullPath);
      indexFiles.push(...subIndexFiles);
    } else if (entry === "index.ts" || entry === "index.js") {
      indexFiles.push(fullPath);
    }
  }

  // Sort by depth (deepest first) for proper priority
  indexFiles.sort((a, b) => {
    const depthA = a.split("/").length;
    const depthB = b.split("/").length;
    return depthB - depthA;
  });

  return indexFiles;
}

/**
 * Load and execute an index.ts file to get dynamic routes
 *
 * @param indexPath - Path to index.ts file
 * @param _basePath - Base path for routes (relative to src) - reserved for future use
 * @returns Router with registered routes
 */
export async function loadIndexRouter(
  indexPath: string,
  _basePath: string,
): Promise<Router | null> {
  try {
    // Dynamic import the index file
    const module = await import(indexPath);
    const exported = module.default;

    if (exported && typeof exported === "object" && "getRoutes" in exported) {
      // It's a Router
      return exported as Router;
    }

    return null;
  } catch (error) {
    console.warn(`Failed to load index file: ${indexPath}`, error);
    return null;
  }
}

/**
 * Scan source directory for all routes
 */
export async function scanRoutes(options: ScanOptions): Promise<ScannedRoute[]> {
  const { storage, srcDir, target } = options;

  // 1. Scan for file-based routes
  const fileRoutes = await scanDirectory(storage, srcDir, srcDir, target);

  // 2. Find and load index.ts files (deepest first)
  // Note: Dynamic imports require Node.js/Bun runtime
  // For now, we'll just collect file-based routes
  // Index.ts loading will be added in the build phase

  return fileRoutes;
}

/**
 * Convert scanned routes to RouteInfo
 */
export function scannedToRouteInfo(scanned: ScannedRoute[]): RouteInfo[] {
  return scanned.map((s) => ({
    path: s.path,
    sourcePath: s.sourcePath,
    type: s.type,
    metadata: s.metadata,
  }));
}

/**
 * Sort routes by display order
 */
export function sortRoutesByDisplayOrder(routes: RouteInfo[]): RouteInfo[] {
  return [...routes].sort((a, b) => {
    const orderA = a.metadata.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.metadata.displayOrder ?? Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // Secondary sort by path
    return a.path.localeCompare(b.path);
  });
}
