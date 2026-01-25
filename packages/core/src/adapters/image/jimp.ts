import type { ImageDimensions } from "../../types";
import type {
  ConvertOptions,
  CropOptions,
  ImageAdapter,
  ImageFormat,
  ResizeOptions,
} from "./interface";

/**
 * Jimp-based image adapter for pure JavaScript image processing.
 * Works in compiled binaries without native dependencies.
 */
export class JimpImageAdapter implements ImageAdapter {
  private jimpModule: typeof import("jimp") | null = null;

  private async getJimp(): Promise<typeof import("jimp")> {
    if (!this.jimpModule) {
      this.jimpModule = await import("jimp");
    }
    return this.jimpModule;
  }

  async getSize(data: Uint8Array): Promise<ImageDimensions> {
    const { Jimp } = await this.getJimp();
    const image = await Jimp.read(Buffer.from(data));
    return {
      width: image.width,
      height: image.height,
    };
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

    // Check BMP (Jimp supports BMP)
    if (data[0] === 0x42 && data[1] === 0x4d) {
      // BMP is not in our format list, treat as null
      return null;
    }

    // Check SVG (text-based)
    const text = new TextDecoder().decode(data.slice(0, 100));
    if (text.includes("<svg") || text.includes("<?xml")) {
      return "svg";
    }

    return null;
  }

  async resize(data: Uint8Array, options: ResizeOptions): Promise<Uint8Array> {
    const { Jimp } = await this.getJimp();
    const image = await Jimp.read(Buffer.from(data));

    const originalWidth = image.width;
    const originalHeight = image.height;

    let targetWidth = options.width ?? originalWidth;
    let targetHeight = options.height ?? originalHeight;

    // Calculate dimensions based on fit mode
    const fit = options.fit ?? "inside";
    if (options.width && options.height) {
      const scaleX = options.width / originalWidth;
      const scaleY = options.height / originalHeight;

      switch (fit) {
        case "contain":
        case "inside": {
          // Scale to fit within the bounds while maintaining aspect ratio
          const scale = Math.min(scaleX, scaleY);
          targetWidth = Math.round(originalWidth * scale);
          targetHeight = Math.round(originalHeight * scale);
          break;
        }
        case "cover":
        case "outside": {
          // Scale to cover the bounds while maintaining aspect ratio
          const scale = Math.max(scaleX, scaleY);
          targetWidth = Math.round(originalWidth * scale);
          targetHeight = Math.round(originalHeight * scale);
          break;
        }
        case "fill":
          // Use exact dimensions (stretch)
          targetWidth = options.width;
          targetHeight = options.height;
          break;
      }
    } else if (options.width && !options.height) {
      // Maintain aspect ratio based on width
      const scale = options.width / originalWidth;
      targetWidth = options.width;
      targetHeight = Math.round(originalHeight * scale);
    } else if (!options.width && options.height) {
      // Maintain aspect ratio based on height
      const scale = options.height / originalHeight;
      targetWidth = Math.round(originalWidth * scale);
      targetHeight = options.height;
    }

    // Perform resize
    image.resize({ w: targetWidth, h: targetHeight });

    // Get output format and buffer
    const format = await this.getFormat(data);
    const buffer = await this.getOutputBuffer(image, format, options.quality);
    return new Uint8Array(buffer);
  }

  async crop(data: Uint8Array, options: CropOptions): Promise<Uint8Array> {
    const { Jimp } = await this.getJimp();
    const image = await Jimp.read(Buffer.from(data));

    image.crop({ x: options.left, y: options.top, w: options.width, h: options.height });

    const format = await this.getFormat(data);
    const buffer = await this.getOutputBuffer(image, format);
    return new Uint8Array(buffer);
  }

  async convert(
    data: Uint8Array,
    format: ImageFormat,
    options?: ConvertOptions,
  ): Promise<Uint8Array> {
    const { Jimp } = await this.getJimp();
    const image = await Jimp.read(Buffer.from(data));

    const buffer = await this.getOutputBuffer(image, format, options?.quality);
    return new Uint8Array(buffer);
  }

  private async getOutputBuffer(
    image: Awaited<ReturnType<typeof import("jimp").Jimp.read>>,
    format: ImageFormat | null,
    quality?: number,
  ): Promise<Buffer> {
    const { JimpMime } = await this.getJimp();

    switch (format) {
      case "jpeg":
        return image.getBuffer(JimpMime.jpeg, { quality: quality ?? 90 });
      case "png":
        return image.getBuffer(JimpMime.png);
      case "gif":
        return image.getBuffer(JimpMime.gif);
      default:
        // Default to PNG for unknown formats
        return image.getBuffer(JimpMime.png);
    }
  }
}
