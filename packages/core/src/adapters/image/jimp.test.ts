import { describe, test, expect } from "bun:test";
import { JimpImageAdapter } from "./jimp.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const FIXTURES_DIR = path.join(
  import.meta.dir,
  "../../../../../tests/fixtures/sample-project-ssg/src/item/image",
);

describe("JimpImageAdapter", () => {
  const adapter = new JimpImageAdapter();

  describe("getFormat", () => {
    test("should detect PNG format", async () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const format = await adapter.getFormat(png);
      expect(format).toBe("png");
    });

    test("should detect JPEG format", async () => {
      const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const format = await adapter.getFormat(jpeg);
      expect(format).toBe("jpeg");
    });

    test("should detect GIF format", async () => {
      const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      const format = await adapter.getFormat(gif);
      expect(format).toBe("gif");
    });

    test("should detect WebP format", async () => {
      const webp = new Uint8Array([
        0x52,
        0x49,
        0x46,
        0x46, // RIFF
        0x00,
        0x00,
        0x00,
        0x00, // size
        0x57,
        0x45,
        0x42,
        0x50, // WEBP
      ]);
      const format = await adapter.getFormat(webp);
      expect(format).toBe("webp");
    });

    test("should return null for unknown format", async () => {
      const unknown = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const format = await adapter.getFormat(unknown);
      expect(format).toBeNull();
    });
  });

  describe("getSize", () => {
    test("should get PNG dimensions from real file", async () => {
      const pngPath = path.join(FIXTURES_DIR, "chapter1.png");
      const data = await fs.readFile(pngPath);

      const size = await adapter.getSize(new Uint8Array(data));
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    });

    test("should get JPEG dimensions from real file", async () => {
      const jpegPath = path.join(FIXTURES_DIR, "cover.jpg");
      const data = await fs.readFile(jpegPath);

      const size = await adapter.getSize(new Uint8Array(data));
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    });
  });

  describe("resize", () => {
    test("should resize PNG image maintaining aspect ratio", async () => {
      const pngPath = path.join(FIXTURES_DIR, "chapter1.png");
      const data = await fs.readFile(pngPath);
      const originalSize = await adapter.getSize(new Uint8Array(data));

      // Resize to max width of 100px
      const resized = await adapter.resize(new Uint8Array(data), {
        width: 100,
        fit: "inside",
      });

      const newSize = await adapter.getSize(resized);
      expect(newSize.width).toBeLessThanOrEqual(100);
      // Aspect ratio should be maintained
      const originalRatio = originalSize.width / originalSize.height;
      const newRatio = newSize.width / newSize.height;
      expect(Math.abs(originalRatio - newRatio)).toBeLessThan(0.1);
    });

    test("should resize JPEG image with quality option", async () => {
      const jpegPath = path.join(FIXTURES_DIR, "cover.jpg");
      const data = await fs.readFile(jpegPath);

      const resized = await adapter.resize(new Uint8Array(data), {
        width: 200,
        height: 200,
        fit: "inside",
        quality: 80,
      });

      expect(resized.length).toBeGreaterThan(0);
      const format = await adapter.getFormat(resized);
      expect(format).toBe("jpeg");
    });

    test("should resize with fit: cover", async () => {
      const pngPath = path.join(FIXTURES_DIR, "chapter1.png");
      const data = await fs.readFile(pngPath);

      const resized = await adapter.resize(new Uint8Array(data), {
        width: 100,
        height: 100,
        fit: "cover",
      });

      const newSize = await adapter.getSize(resized);
      // Cover should ensure at least one dimension meets or exceeds target
      expect(newSize.width >= 100 || newSize.height >= 100).toBe(true);
    });
  });

  describe("crop", () => {
    test("should crop PNG image", async () => {
      const pngPath = path.join(FIXTURES_DIR, "chapter1.png");
      const data = await fs.readFile(pngPath);
      const originalSize = await adapter.getSize(new Uint8Array(data));

      // Crop a 50x50 region from top-left
      const cropWidth = Math.min(50, originalSize.width);
      const cropHeight = Math.min(50, originalSize.height);

      const cropped = await adapter.crop(new Uint8Array(data), {
        left: 0,
        top: 0,
        width: cropWidth,
        height: cropHeight,
      });

      const newSize = await adapter.getSize(cropped);
      expect(newSize.width).toBe(cropWidth);
      expect(newSize.height).toBe(cropHeight);
    });
  });

  describe("convert", () => {
    test("should convert PNG to JPEG", async () => {
      const pngPath = path.join(FIXTURES_DIR, "chapter1.png");
      const data = await fs.readFile(pngPath);

      const converted = await adapter.convert(new Uint8Array(data), "jpeg", {
        quality: 85,
      });

      const format = await adapter.getFormat(converted);
      expect(format).toBe("jpeg");
    });

    test("should convert JPEG to PNG", async () => {
      const jpegPath = path.join(FIXTURES_DIR, "cover.jpg");
      const data = await fs.readFile(jpegPath);

      const converted = await adapter.convert(new Uint8Array(data), "png");

      const format = await adapter.getFormat(converted);
      expect(format).toBe("png");
    });
  });
});
