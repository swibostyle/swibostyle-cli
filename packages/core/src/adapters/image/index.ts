export type {
  ImageAdapter,
  ImageFormat,
  ResizeOptions,
  CropOptions,
  ConvertOptions,
} from "./interface";
export { SharpImageAdapter } from "./sharp";
export { JimpImageAdapter } from "./jimp";
export { NoopImageAdapter } from "./noop";

/**
 * Check if sharp is available at runtime.
 * Used to detect compiled binary environment where sharp is externalized.
 */
export async function isSharpAvailable(): Promise<boolean> {
  try {
    await import("sharp");
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if jimp is available at runtime.
 * Jimp is a pure JavaScript image library that works in compiled binaries.
 */
export async function isJimpAvailable(): Promise<boolean> {
  try {
    await import("jimp");
    return true;
  } catch {
    return false;
  }
}
