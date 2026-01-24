import type { BuildContext } from "../builder/context.js";
import { getBuildPaths } from "../builder/context.js";
import type { BuildTargetType, ImageContent, ImageDimensions } from "../types.js";
import { getContentType } from "../utils/mime.js";

/**
 * Process images: convert PSD, resize, crop
 */
export async function processImages(
  ctx: BuildContext,
  _targetType: BuildTargetType,
  enableResizing: boolean,
): Promise<ImageContent[]> {
  const { storage, paths, imageAdapter, config, logger, onProgress } = ctx;
  const buildPaths = getBuildPaths(paths.build);

  // Get list of image files from build directory (already copied)
  const imageFiles = await storage.readDir(buildPaths.images);
  const supportedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

  logger?.debug("Processing %d images", imageFiles.length);
  onProgress?.({ phase: "image", current: 0, total: imageFiles.length, message: "Starting" });

  const contents: ImageContent[] = [];

  // First, convert any PSD files
  const psdFiles = (await storage.readDir(paths.images)).filter((f) =>
    f.toLowerCase().endsWith(".psd"),
  );

  if (psdFiles.length > 0 && imageAdapter.convertPsdToPng) {
    logger?.debug("Converting %d PSD files", psdFiles.length);
    for (const psdFile of psdFiles) {
      const psdPath = `${paths.images}/${psdFile}`;
      const pngName = psdFile.replace(/\.psd$/i, ".png");
      const pngPath = `${buildPaths.images}/${pngName}`;

      const psdData = await storage.readFile(psdPath);
      const pngData = await imageAdapter.convertPsdToPng(psdData);
      await storage.writeFile(pngPath, pngData);

      logger?.debug("Converted: %s -> %s", psdFile, pngName);
    }
  }

  // Re-read image files after PSD conversion
  const allImageFiles = await storage.readDir(buildPaths.images);

  for (let i = 0; i < allImageFiles.length; i++) {
    const file = allImageFiles[i]!;
    const ext = file.toLowerCase().slice(file.lastIndexOf("."));

    if (!supportedExtensions.includes(ext)) {
      continue;
    }

    const filePath = `${buildPaths.images}/${file}`;
    onProgress?.({ phase: "image", current: i, total: allImageFiles.length, message: file });

    // Read image data
    let imageData = await storage.readFile(filePath);
    let dimensions = await imageAdapter.getSize(imageData);

    // Apply crop if configured
    const cropConfig = config.epubImageCrops?.find((c) => new RegExp(c.fileNamePattern).test(file));

    if (cropConfig && enableResizing) {
      logger?.debug("Cropping: %s", file);
      const bleed = cropConfig.bleed;
      const newWidth = dimensions.width - bleed.x * 2;
      const newHeight = dimensions.height - bleed.y * 2;

      imageData = await imageAdapter.crop(imageData, {
        left: bleed.x,
        top: bleed.y,
        width: newWidth,
        height: newHeight,
      });
      dimensions = { width: newWidth, height: newHeight };
    }

    // Resize if needed (for EPUB store requirements)
    if (enableResizing) {
      const resizedData = await resizeForEpubStores(imageAdapter, imageData, dimensions, ext);
      if (resizedData) {
        imageData = resizedData;
        dimensions = await imageAdapter.getSize(imageData);
      }
    }

    // Write processed image
    await storage.writeFile(filePath, imageData);

    const id = file.slice(0, file.lastIndexOf("."));
    contents.push({
      type: "image",
      id,
      fileName: file,
      dimensions,
      contentType: getContentType(file),
    });
  }

  onProgress?.({
    phase: "image",
    current: allImageFiles.length,
    total: allImageFiles.length,
    message: "Complete",
  });
  logger?.info("Processed %d images", contents.length);

  return contents;
}

/**
 * Resize image to meet EPUB store requirements
 * - Kindle: min 1200x1920 (portrait) or 1920x1200 (landscape)
 * - Apple Books: max 4,000,000 pixels
 * - Google Play: max 3200x3200
 */
async function resizeForEpubStores(
  imageAdapter: import("../adapters/image/interface.js").ImageAdapter,
  data: Uint8Array,
  dimensions: ImageDimensions,
  ext: string,
): Promise<Uint8Array | null> {
  const { width, height } = dimensions;

  const isAppleBooksOk = width * height <= 4000000;
  const isGoogleOk = width <= 3200 && height <= 3200;

  if (isAppleBooksOk && isGoogleOk) {
    return null; // No resize needed
  }

  const scale = Math.min(Math.sqrt(4000000 / (width * height)), 3200 / width, 3200 / height, 1.0);

  if (Math.abs(1.0 - scale) <= 0.00001) {
    return null; // Scale too close to 1.0
  }

  const newWidth = Math.floor(width * scale);
  const newHeight = Math.floor(height * scale);

  return imageAdapter.resize(data, {
    width: newWidth,
    height: newHeight,
    fit: "inside",
    quality: ext === ".jpg" || ext === ".jpeg" ? 90 : undefined,
  });
}
