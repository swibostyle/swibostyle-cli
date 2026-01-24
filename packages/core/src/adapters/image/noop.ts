import type { ImageDimensions } from "../../types";
import type {
  ConvertOptions,
  CropOptions,
  ImageAdapter,
  ImageFormat,
  ResizeOptions,
} from "./interface";

/**
 * Parse PNG dimensions from header
 */
function getPngSize(data: Uint8Array): ImageDimensions | null {
  // PNG signature: 137 80 78 71 13 10 26 10
  if (data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4e || data[3] !== 0x47) {
    return null;
  }

  // Width and height are at bytes 16-23 in the IHDR chunk
  const width = (data[16]! << 24) | (data[17]! << 16) | (data[18]! << 8) | data[19]!;
  const height = (data[20]! << 24) | (data[21]! << 16) | (data[22]! << 8) | data[23]!;

  return { width, height };
}

/**
 * Parse JPEG dimensions from header
 */
function getJpegSize(data: Uint8Array): ImageDimensions | null {
  // JPEG signature: FF D8
  if (data[0] !== 0xff || data[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset < data.length) {
    // Find marker
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = data[offset + 1];
    offset += 2;

    // SOF0-SOF15 markers (except SOF4, SOF8, SOF12 which are not frame markers)
    if (
      marker !== undefined &&
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      // Skip length (2 bytes) and precision (1 byte)
      const height = (data[offset + 3]! << 8) | data[offset + 4]!;
      const width = (data[offset + 5]! << 8) | data[offset + 6]!;
      return { width, height };
    }

    // Skip to next marker
    if (marker !== undefined && marker !== 0x00 && marker !== 0xff) {
      const length = (data[offset]! << 8) | data[offset + 1]!;
      offset += length;
    }
  }

  return null;
}

/**
 * Parse GIF dimensions from header
 */
function getGifSize(data: Uint8Array): ImageDimensions | null {
  // GIF signature: GIF87a or GIF89a
  if (data[0] !== 0x47 || data[1] !== 0x49 || data[2] !== 0x46) {
    return null;
  }

  const width = data[6]! | (data[7]! << 8);
  const height = data[8]! | (data[9]! << 8);

  return { width, height };
}

/**
 * No-op image adapter that only provides dimension reading.
 * Useful for browser environments where image processing is not available
 * or when images are pre-processed.
 */
export class NoopImageAdapter implements ImageAdapter {
  async getSize(data: Uint8Array): Promise<ImageDimensions> {
    // Try PNG
    const pngSize = getPngSize(data);
    if (pngSize) return pngSize;

    // Try JPEG
    const jpegSize = getJpegSize(data);
    if (jpegSize) return jpegSize;

    // Try GIF
    const gifSize = getGifSize(data);
    if (gifSize) return gifSize;

    throw new Error("Unable to determine image dimensions: unsupported format");
  }

  async getFormat(data: Uint8Array): Promise<ImageFormat | null> {
    // Check PNG
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
      return "png";
    }

    // Check JPEG
    if (data[0] === 0xff && data[1] === 0xd8) {
      return "jpeg";
    }

    // Check GIF
    if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
      return "gif";
    }

    // Check WebP
    if (
      data[0] === 0x52 &&
      data[1] === 0x49 &&
      data[2] === 0x46 &&
      data[3] === 0x46 &&
      data[8] === 0x57 &&
      data[9] === 0x45 &&
      data[10] === 0x42 &&
      data[11] === 0x50
    ) {
      return "webp";
    }

    // Check SVG (text-based)
    const text = new TextDecoder().decode(data.slice(0, 100));
    if (text.includes("<svg") || text.includes("<?xml")) {
      return "svg";
    }

    return null;
  }

  async resize(_data: Uint8Array, _options: ResizeOptions): Promise<Uint8Array> {
    throw new Error(
      "NoopImageAdapter does not support resize. Use SharpImageAdapter or WasmImageAdapter.",
    );
  }

  async crop(_data: Uint8Array, _options: CropOptions): Promise<Uint8Array> {
    throw new Error(
      "NoopImageAdapter does not support crop. Use SharpImageAdapter or WasmImageAdapter.",
    );
  }

  async convert(
    _data: Uint8Array,
    _format: ImageFormat,
    _options?: ConvertOptions,
  ): Promise<Uint8Array> {
    throw new Error(
      "NoopImageAdapter does not support convert. Use SharpImageAdapter or WasmImageAdapter.",
    );
  }
}
