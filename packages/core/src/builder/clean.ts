import type { BuildContext } from "./context.js";
import { getBuildPaths } from "./context.js";

/**
 * Clean build directory and create necessary subdirectories
 */
export async function clean(ctx: BuildContext): Promise<void> {
  const { storage, paths, logger, onProgress } = ctx;
  const buildPaths = getBuildPaths(paths.build);

  onProgress?.({ phase: "clean", current: 0, total: 2, message: "Cleaning build directory" });
  logger?.debug("Cleaning build directory: %s", paths.build);

  // Clean up existing build directory
  if (await storage.exists(paths.build)) {
    const items = await storage.readDir(paths.build);
    for (const item of items) {
      const itemPath = `${paths.build}/${item}`;
      const stat = await storage.stat(itemPath);
      if (stat.isDirectory) {
        await storage.rm(itemPath, { recursive: true });
      } else {
        await storage.rm(itemPath);
      }
    }
  }

  onProgress?.({ phase: "clean", current: 1, total: 2, message: "Creating directories" });
  logger?.debug("Creating build directories");

  // Create output directories
  await storage.mkdir(buildPaths.styles, { recursive: true });
  await storage.mkdir(buildPaths.images, { recursive: true });
  await storage.mkdir(buildPaths.xhtml, { recursive: true });
  await storage.mkdir(buildPaths.metaInf, { recursive: true });

  onProgress?.({ phase: "clean", current: 2, total: 2, message: "Clean complete" });
  logger?.info("Build directory cleaned");
}
