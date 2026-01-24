import { describe, test, expect } from 'bun:test';
import { NoopImageAdapter } from './noop.js';

describe('NoopImageAdapter', () => {
  const adapter = new NoopImageAdapter();

  describe('getFormat', () => {
    test('should detect PNG format', async () => {
      // PNG magic bytes: 89 50 4E 47
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const format = await adapter.getFormat(png);
      expect(format).toBe('png');
    });

    test('should detect JPEG format', async () => {
      // JPEG magic bytes: FF D8
      const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const format = await adapter.getFormat(jpeg);
      expect(format).toBe('jpeg');
    });

    test('should detect GIF format', async () => {
      // GIF magic bytes: GIF89a
      const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      const format = await adapter.getFormat(gif);
      expect(format).toBe('gif');
    });

    test('should detect WebP format', async () => {
      // WebP: RIFF....WEBP
      const webp = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // size
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      const format = await adapter.getFormat(webp);
      expect(format).toBe('webp');
    });

    test('should return null for unknown format', async () => {
      const unknown = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      const format = await adapter.getFormat(unknown);
      expect(format).toBeNull();
    });
  });

  describe('getSize', () => {
    test('should get PNG dimensions', async () => {
      // Minimal valid PNG header with 100x200 dimensions
      const png = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
        0x00, 0x00, 0x00, 0x0d, // IHDR chunk length
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x64, // width: 100
        0x00, 0x00, 0x00, 0xc8, // height: 200
        0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, etc.
      ]);

      const size = await adapter.getSize(png);
      expect(size.width).toBe(100);
      expect(size.height).toBe(200);
    });

    test('should get GIF dimensions', async () => {
      // GIF header with 320x240 dimensions
      const gif = new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
        0x40, 0x01, // width: 320 (little endian)
        0xf0, 0x00, // height: 240 (little endian)
      ]);

      const size = await adapter.getSize(gif);
      expect(size.width).toBe(320);
      expect(size.height).toBe(240);
    });

    test('should throw for unsupported format', async () => {
      const unknown = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
      await expect(adapter.getSize(unknown)).rejects.toThrow('unsupported format');
    });
  });

  describe('unsupported operations', () => {
    test('resize should throw', async () => {
      const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      await expect(adapter.resize(data, { width: 100 })).rejects.toThrow(
        'NoopImageAdapter does not support resize'
      );
    });

    test('crop should throw', async () => {
      const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      await expect(
        adapter.crop(data, { left: 0, top: 0, width: 100, height: 100 })
      ).rejects.toThrow('NoopImageAdapter does not support crop');
    });

    test('convert should throw', async () => {
      const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      await expect(adapter.convert(data, 'jpeg')).rejects.toThrow(
        'NoopImageAdapter does not support convert'
      );
    });
  });
});
