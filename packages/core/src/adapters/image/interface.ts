import type { ImageDimensions } from "../../types";

export type ImageFormat = "png" | "jpeg" | "webp" | "svg" | "gif";

export interface ResizeOptions {
  width?: number;
  height?: number;
  fit?: "contain" | "cover" | "fill" | "inside" | "outside";
  quality?: number;
}

export interface CropOptions {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ConvertOptions {
  quality?: number;
}

/**
 * Image adapter interface for abstracting image processing operations.
 * Implementations can use Sharp (Node.js), Canvas API (Browser), or WASM libraries.
 */
export interface ImageAdapter {
  /**
   * Get image dimensions
   */
  getSize(data: Uint8Array): Promise<ImageDimensions>;

  /**
   * Get image format
   */
  getFormat(data: Uint8Array): Promise<ImageFormat | null>;

  /**
   * Resize image
   */
  resize(data: Uint8Array, options: ResizeOptions): Promise<Uint8Array>;

  /**
   * Crop image
   */
  crop(data: Uint8Array, options: CropOptions): Promise<Uint8Array>;

  /**
   * Convert image format
   */
  convert(data: Uint8Array, format: ImageFormat, options?: ConvertOptions): Promise<Uint8Array>;

  /**
   * Convert PSD to PNG (optional capability)
   */
  convertPsdToPng?(data: Uint8Array): Promise<Uint8Array>;
}
