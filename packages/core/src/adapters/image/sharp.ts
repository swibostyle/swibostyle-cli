import type { ImageDimensions } from "../../types";
import type {
  ConvertOptions,
  CropOptions,
  ImageAdapter,
  ImageFormat,
  ResizeOptions,
} from "./interface";

/**
 * Sharp-based image adapter for Node.js/Bun environments
 */
export class SharpImageAdapter implements ImageAdapter {
  private sharp: typeof import("sharp") | null = null;

  private async getSharp(): Promise<typeof import("sharp")> {
    if (!this.sharp) {
      this.sharp = (await import("sharp")).default;
    }
    return this.sharp;
  }

  async getSize(data: Uint8Array): Promise<ImageDimensions> {
    const sharp = await this.getSharp();
    const metadata = await sharp(data).metadata();
    return {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
    };
  }

  async getFormat(data: Uint8Array): Promise<ImageFormat | null> {
    const sharp = await this.getSharp();
    const metadata = await sharp(data).metadata();
    const format = metadata.format;

    switch (format) {
      case "png":
        return "png";
      case "jpeg":
        return "jpeg";
      case "webp":
        return "webp";
      case "gif":
        return "gif";
      case "svg":
        return "svg";
      default:
        return null;
    }
  }

  async resize(data: Uint8Array, options: ResizeOptions): Promise<Uint8Array> {
    const sharp = await this.getSharp();
    let image = sharp(data);

    image = image.resize({
      width: options.width,
      height: options.height,
      fit: options.fit ?? "inside",
    });

    const format = await this.getFormat(data);
    if (format === "jpeg" && options.quality) {
      image = image.jpeg({ quality: options.quality });
    } else if (format === "png") {
      image = image.png();
    } else if (format === "webp" && options.quality) {
      image = image.webp({ quality: options.quality });
    }

    const buffer = await image.toBuffer();
    return new Uint8Array(buffer);
  }

  async crop(data: Uint8Array, options: CropOptions): Promise<Uint8Array> {
    const sharp = await this.getSharp();
    const buffer = await sharp(data)
      .extract({
        left: options.left,
        top: options.top,
        width: options.width,
        height: options.height,
      })
      .toBuffer();

    return new Uint8Array(buffer);
  }

  async convert(
    data: Uint8Array,
    format: ImageFormat,
    options?: ConvertOptions,
  ): Promise<Uint8Array> {
    const sharp = await this.getSharp();
    let image = sharp(data);

    switch (format) {
      case "png":
        image = image.png();
        break;
      case "jpeg":
        image = image.jpeg({ quality: options?.quality ?? 90 });
        break;
      case "webp":
        image = image.webp({ quality: options?.quality ?? 90 });
        break;
      default:
        throw new Error(`Unsupported output format: ${format}`);
    }

    const buffer = await image.toBuffer();
    return new Uint8Array(buffer);
  }

  async convertPsdToPng(data: Uint8Array): Promise<Uint8Array> {
    // PSD conversion requires the 'psd' package
    const PSD = (await import("psd")).default;
    const psd = new PSD(data);
    await psd.parse();

    // Get the composite image as PNG
    const png = await psd.image.toPng();
    return new Uint8Array(png.data);
  }
}
