import { describe, test, expect } from 'bun:test';
import { getContentType } from './mime.js';

describe('getContentType', () => {
  describe('image formats', () => {
    test('should return correct type for PNG', () => {
      expect(getContentType('image.png')).toBe('image/png');
      expect(getContentType('IMAGE.PNG')).toBe('image/png');
    });

    test('should return correct type for JPEG', () => {
      expect(getContentType('photo.jpg')).toBe('image/jpeg');
      expect(getContentType('photo.jpeg')).toBe('image/jpeg');
    });

    test('should return correct type for GIF', () => {
      expect(getContentType('animation.gif')).toBe('image/gif');
    });

    test('should return correct type for WebP', () => {
      expect(getContentType('image.webp')).toBe('image/webp');
    });

    test('should return correct type for SVG', () => {
      expect(getContentType('icon.svg')).toBe('image/svg+xml');
    });
  });

  describe('document formats', () => {
    test('should return correct type for XHTML', () => {
      expect(getContentType('page.xhtml')).toBe('application/xhtml+xml');
    });

    test('should return correct type for HTML', () => {
      expect(getContentType('index.html')).toBe('text/html');
    });

    test('should return correct type for CSS', () => {
      expect(getContentType('style.css')).toBe('text/css');
    });

    test('should return correct type for JavaScript', () => {
      expect(getContentType('script.js')).toBe('application/javascript');
    });

    test('should return correct type for JSON', () => {
      expect(getContentType('data.json')).toBe('application/json');
    });
  });

  describe('font formats', () => {
    test('should return correct type for OTF', () => {
      expect(getContentType('font.otf')).toBe('font/otf');
    });

    test('should return correct type for TTF', () => {
      expect(getContentType('font.ttf')).toBe('font/ttf');
    });

    test('should return correct type for WOFF', () => {
      expect(getContentType('font.woff')).toBe('font/woff');
    });

    test('should return correct type for WOFF2', () => {
      expect(getContentType('font.woff2')).toBe('font/woff2');
    });
  });

  describe('unknown formats', () => {
    test('should return octet-stream for unknown extension', () => {
      expect(getContentType('file.xyz')).toBe('application/octet-stream');
    });

    test('should handle file without extension', () => {
      expect(getContentType('noextension')).toBe('application/octet-stream');
    });
  });
});
