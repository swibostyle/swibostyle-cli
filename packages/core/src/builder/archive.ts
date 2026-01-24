import type { BuildContext } from "./context.js";
import { getBuildPaths } from "./context.js";
import type { BuildTargetType } from "../types.js";

/**
 * Create EPUB archive from build directory
 */
export async function createEpubArchive(
  ctx: BuildContext,
  _targetType: BuildTargetType,
): Promise<Uint8Array> {
  const { storage, paths, logger, onProgress } = ctx;
  const buildPaths = getBuildPaths(paths.build);

  logger?.debug("Creating EPUB archive");
  onProgress?.({ phase: "archive", current: 0, total: 3, message: "Preparing archive" });

  // Use fflate for cross-platform ZIP creation
  const fflate = await import("fflate");

  // Use fflate's Zippable type for proper typing
  const files: import("fflate").Zippable = {};

  // 1. Add mimetype (must be first and uncompressed - EPUB requirement)
  const mimetypeData = await storage.readFile(`${paths.build}/mimetype`);
  files["mimetype"] = [mimetypeData, { level: 0 as const }];

  onProgress?.({ phase: "archive", current: 1, total: 3, message: "Adding META-INF" });

  // 2. Add META-INF directory
  const metaInfFiles = await storage.readDir(buildPaths.metaInf);
  for (const file of metaInfFiles) {
    const data = await storage.readFile(`${buildPaths.metaInf}/${file}`);
    files[`META-INF/${file}`] = data;
  }

  onProgress?.({ phase: "archive", current: 2, total: 3, message: "Adding content" });

  // 3. Add item directory
  await addDirectoryToArchive(storage, buildPaths.item, "item", files);

  logger?.debug("Compressing %d files", Object.keys(files).length);

  // Create ZIP (mimetype already marked as uncompressed in files object)
  const zipData = fflate.zipSync(files);

  onProgress?.({ phase: "archive", current: 3, total: 3, message: "Archive complete" });
  logger?.info("Created EPUB archive: %d bytes", zipData.length);

  return zipData;
}

/**
 * Recursively add directory contents to archive files object
 */
async function addDirectoryToArchive(
  storage: import("../adapters/storage/interface.js").StorageAdapter,
  dirPath: string,
  archivePath: string,
  files: import("fflate").Zippable,
): Promise<void> {
  const items = await storage.readDir(dirPath);

  for (const item of items) {
    const fullPath = `${dirPath}/${item}`;
    const archiveFullPath = `${archivePath}/${item}`;
    const stat = await storage.stat(fullPath);

    if (stat.isDirectory) {
      await addDirectoryToArchive(storage, fullPath, archiveFullPath, files);
    } else {
      const data = await storage.readFile(fullPath);
      files[archiveFullPath] = data;
    }
  }
}

/**
 * Write EPUB file to release directory
 */
export async function writeEpubFile(
  ctx: BuildContext,
  data: Uint8Array,
  targetType: BuildTargetType,
): Promise<string> {
  const { storage, paths, logger } = ctx;

  // Ensure release directory exists
  await storage.mkdir(paths.release, { recursive: true });

  const outputPath = `${paths.release}/book-${targetType}.epub`;
  await storage.writeFile(outputPath, data);

  logger?.info("Written EPUB: %s", outputPath);
  return outputPath;
}
