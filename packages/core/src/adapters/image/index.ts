export type {
  ImageAdapter,
  ImageFormat,
  ResizeOptions,
  CropOptions,
  ConvertOptions,
} from "./interface";
export { SharpImageAdapter } from "./sharp";
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
