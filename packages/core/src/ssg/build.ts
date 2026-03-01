/**
 * SSG Build Pipeline
 *
 * Builds an EPUB using the SSG router system.
 */

import type { StorageAdapter } from "../adapters/storage/interface";
import type { ImageAdapter } from "../adapters/image/interface";
import type { CSSAdapter } from "../adapters/css/interface";
import type { BookConfig, BuildTargetType } from "../types";
import type {
  RouteInfo,
  SSGResponse,
  Router,
  ImageInfo,
  SSGBuildResult,
  SSGBuildOutputs,
  RegisteredRoute,
} from "./types";
import {
  scanRoutes,
  scannedToRouteInfo,
  findIndexFiles,
  sortRoutesByDisplayOrder,
} from "./scanner";
import { createSSGContext } from "./context";
import { createDefaultRouter } from "./handlers";
import { convertToXhtml } from "../utils/xhtml";
import { readFrontmatter } from "../utils/frontmatter";
import { renderXHTML } from "../templates/xhtml";

/**
 * SSG Build Context
 */
export interface SSGBuildContext {
  /** Storage adapter */
  storage: StorageAdapter;
  /** Image adapter */
  imageAdapter: ImageAdapter;
  /** CSS adapter */
  cssAdapter: CSSAdapter;
  /** Project root directory */
  projectRoot: string;
  /** Source directory */
  srcDir: string;
  /** Build directory */
  buildDir: string;
  /** Book configuration */
  book: BookConfig;
  /** Build target */
  target: BuildTargetType;
  /** Logger */
  logger?: {
    info(message: string): void;
    debug(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  };
}

/**
 * Build SSG outputs (intermediate result before archiving)
 *
 * This produces a Map of output path to file content, which can be:
 * - Archived into an EPUB (via buildSSG)
 * - Written to a directory (for serve/preview)
 */
export async function buildSSGOutputs(ctx: SSGBuildContext): Promise<SSGBuildOutputs> {
  const { storage, imageAdapter, srcDir, book, target, logger } = ctx;

  logger?.info(`Building ${target} with SSG...`);

  // 1. Scan for file-based routes
  logger?.debug("Scanning source directory...");
  const scannedRoutes = await scanRoutes({
    storage,
    srcDir,
    target,
  });
  let routes = scannedToRouteInfo(scannedRoutes);
  logger?.debug(`Found ${routes.length} file-based routes`);

  // 2. Find and load index.ts files
  logger?.debug("Loading index.ts routers...");
  const indexFiles = await findIndexFiles(storage, srcDir);
  const userRoutes: RegisteredRoute[] = [];

  for (const indexPath of indexFiles) {
    try {
      const router = await loadIndexRouterSafe(indexPath);
      if (router) {
        const registeredRoutes = router.getRoutes();
        // Prefix routes with base path
        const basePath = getBasePath(indexPath, srcDir);
        for (const route of registeredRoutes) {
          userRoutes.push({
            ...route,
            pattern: basePath ? `${basePath}/${route.pattern}` : route.pattern,
          });
        }
        logger?.debug(`Loaded ${registeredRoutes.length} routes from ${indexPath}`);
      }
    } catch (error) {
      logger?.warn(`Failed to load ${indexPath}: ${error}`);
    }
  }

  // 3. Pre-load image dimensions
  logger?.debug("Loading image dimensions...");
  const imageInfoMap = new Map<string, ImageInfo>();
  const imageRoutes = routes.filter((r) => r.type === "image");

  for (const route of imageRoutes) {
    if (route.sourcePath) {
      try {
        const data = await storage.readFile(route.sourcePath);
        const dimensions = await imageAdapter.getSize(data);
        const format = await imageAdapter.getFormat(data);
        const fileName = route.path.split("/").pop() || "";
        imageInfoMap.set(fileName, {
          width: dimensions.width,
          height: dimensions.height,
          format: format || "jpeg",
        });
      } catch {
        // Skip images that can't be read
      }
    }
  }
  logger?.debug(`Loaded ${imageInfoMap.size} image dimensions`);

  // 4. Get default router
  const defaultRouter = createDefaultRouter();
  const defaultRoutes = defaultRouter.getRoutes();

  // 5. Add routes for dynamic handlers from index.ts
  for (const userRoute of userRoutes) {
    const metadata = userRoute.options?.metadata || {};
    routes.push({
      path: `item/${userRoute.pattern}`,
      type: "xhtml",
      metadata,
    });
  }

  // 6. Sort routes
  routes = sortRoutesByDisplayOrder(routes);

  // 7. Process each route
  logger?.info(`Processing ${routes.length} routes...`);
  const outputs = new Map<string, Uint8Array>();

  // Process default routes first (mimetype, container.xml, etc.)
  for (const defaultRoute of defaultRoutes) {
    // Skip if user has a custom route
    const hasCustom =
      routes.some((r) => r.path === defaultRoute.pattern) ||
      userRoutes.some(
        (r) => `item/${r.pattern}` === defaultRoute.pattern || r.pattern === defaultRoute.pattern,
      );

    if (
      !hasCustom ||
      defaultRoute.pattern === "item/standard.opf" ||
      defaultRoute.pattern === "item/navigation-documents.xhtml"
    ) {
      const context = createSSGContext({
        book,
        target,
        path: defaultRoute.pattern,
        routes,
        imageInfoMap,
      });

      const response = await defaultRoute.handler(context);
      if (response.type !== "notFound") {
        const content = responseToBytes(response);
        outputs.set(defaultRoute.pattern, content);
      }
    }
  }

  // Process file-based routes
  for (const route of routes) {
    // Skip if already processed as default
    if (outputs.has(route.path)) {
      continue;
    }

    // Check for user-defined handler
    const userHandler = userRoutes.find((r) => `item/${r.pattern}` === route.path);
    if (userHandler) {
      const context = createSSGContext({
        book,
        target,
        path: route.path,
        routes,
        imageInfoMap,
      });

      const response = await userHandler.handler(context);
      if (response.type !== "notFound") {
        const content = responseToBytes(response);
        outputs.set(route.path, content);
      }
      continue;
    }

    // Process based on route type
    if (route.sourcePath) {
      try {
        const content = await processRoute(route, ctx);
        if (content) {
          outputs.set(route.path, content);
        }
      } catch (error) {
        logger?.error(`Failed to process ${route.path}: ${error}`);
      }
    }
  }

  return { files: outputs, routes };
}

/**
 * Build an EPUB using the SSG router system
 */
export async function buildSSG(ctx: SSGBuildContext): Promise<SSGBuildResult> {
  const { storage, projectRoot, target, logger } = ctx;

  const { files, routes } = await buildSSGOutputs(ctx);

  // Create EPUB archive
  logger?.info(`Creating EPUB archive with ${files.size} files...`);
  const epubData = await createEpubArchiveFromMap(files);

  // Write output file
  const outputPath = `${projectRoot}/_release/book-${target}.epub`;
  await storage.mkdir(`${projectRoot}/_release`, { recursive: true });
  await storage.writeFile(outputPath, epubData);

  logger?.info(`EPUB written to ${outputPath} (${epubData.length} bytes)`);

  return {
    outputPath,
    data: epubData,
    routes,
  };
}

/**
 * Safely load an index.ts router
 */
async function loadIndexRouterSafe(indexPath: string): Promise<Router | null> {
  try {
    const module = await import(indexPath);
    const exported = module.default;

    if (exported && typeof exported === "object" && "getRoutes" in exported) {
      return exported as Router;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get base path for routes from an index.ts file
 */
function getBasePath(indexPath: string, srcDir: string): string {
  // Remove srcDir prefix and /index.ts suffix
  let path = indexPath;
  if (path.startsWith(srcDir)) {
    path = path.substring(srcDir.length);
  }
  if (path.startsWith("/")) {
    path = path.substring(1);
  }
  if (path.endsWith("/index.ts") || path.endsWith("/index.js")) {
    path = path.replace(/\/index\.(ts|js)$/, "");
  }
  return path;
}

/**
 * Create EPUB archive from a Map of path -> content
 */
async function createEpubArchiveFromMap(files: Map<string, Uint8Array>): Promise<Uint8Array> {
  const fflate = await import("fflate");
  const zippable: import("fflate").Zippable = {};

  // Mimetype must be first and uncompressed
  const mimetype = files.get("mimetype");
  if (mimetype) {
    zippable["mimetype"] = [mimetype, { level: 0 as const }];
  }

  // Add other files
  for (const [path, data] of files) {
    if (path !== "mimetype") {
      zippable[path] = data;
    }
  }

  return fflate.zipSync(zippable);
}

/**
 * Convert SSGResponse to bytes
 */
function responseToBytes(response: SSGResponse): Uint8Array {
  if (response.data) {
    return response.data;
  }
  if (response.content) {
    return new TextEncoder().encode(response.content);
  }
  return new Uint8Array();
}

/**
 * Process a single route
 */
async function processRoute(route: RouteInfo, ctx: SSGBuildContext): Promise<Uint8Array | null> {
  const { storage, imageAdapter, cssAdapter, book, target } = ctx;

  if (!route.sourcePath) {
    return null;
  }

  switch (route.type) {
    case "xhtml": {
      // Markdown to XHTML
      const mdContent = await storage.readTextFile(route.sourcePath);
      const frontmatter = await readFrontmatter(mdContent);

      // Process with VFM
      const vfm = await import("@vivliostyle/vfm");
      const processor = vfm.VFM({ partial: true, hardLineBreaks: true });
      const result = await processor.process(mdContent);
      const metadata = vfm.readMetadata(mdContent);

      // Convert to XHTML
      const htmlPartial = convertToXhtml(result.toString());
      const title = metadata.title ?? frontmatter.title ?? "";

      // Render with template function
      const html = renderXHTML({
        body: htmlPartial,
        frontmatter,
        title,
        lang: book.lang,
        target,
      });

      return new TextEncoder().encode(html);
    }

    case "css": {
      // SCSS to CSS
      const cssContent = await storage.readTextFile(route.sourcePath);
      const result = await cssAdapter.process({
        content: cssContent,
        path: route.sourcePath,
      });
      return new TextEncoder().encode(result.css);
    }

    case "image": {
      // Copy or resize image
      const imageData = await storage.readFile(route.sourcePath);

      // Check if image resizing is enabled for this target
      const targetConfig = book.targets?.[target];
      const enableImageResizing = targetConfig?.enableImageResizing ?? target === "epub";

      if (enableImageResizing) {
        // Resize for EPUB (Apple Books: 4MP max, Google: 3200px max)
        const dimensions = await imageAdapter.getSize(imageData);
        const maxDimension = 3200;
        const maxPixels = 4_000_000;

        const currentPixels = dimensions.width * dimensions.height;
        const needsResize =
          dimensions.width > maxDimension ||
          dimensions.height > maxDimension ||
          currentPixels > maxPixels;

        if (needsResize) {
          return await imageAdapter.resize(imageData, {
            width: Math.min(dimensions.width, maxDimension),
            height: Math.min(dimensions.height, maxDimension),
            fit: "inside",
          });
        }
      }

      return imageData;
    }

    default:
      // Copy as-is
      return await storage.readFile(route.sourcePath);
  }
}
