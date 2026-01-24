import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import * as path from "node:path";
import * as fs from "node:fs";
import {
  NodeStorageAdapter,
  SharpImageAdapter,
  SassAdapter,
  loadBookConfig,
  buildSSG,
} from "../../packages/core/src/index.js";
import type { BookConfig } from "../../packages/core/src/index.js";

const SSG_FIXTURES_DIR = path.resolve(__dirname, "../fixtures/sample-project-ssg");

describe("SSG Build", () => {
  let book: BookConfig;

  beforeAll(async () => {
    // Load book config
    const storage = new NodeStorageAdapter();
    book = await loadBookConfig(storage, path.join(SSG_FIXTURES_DIR, "book.json"));
  });

  afterAll(() => {
    // Clean up release directory
    const releaseDir = path.join(SSG_FIXTURES_DIR, "_release");
    if (fs.existsSync(releaseDir)) {
      fs.rmSync(releaseDir, { recursive: true });
    }
  });

  test("should build EPUB from SSG project", async () => {
    const storage = new NodeStorageAdapter();
    const imageAdapter = new SharpImageAdapter();
    const cssAdapter = new SassAdapter();

    const result = await buildSSG({
      storage,
      imageAdapter,
      cssAdapter,
      projectRoot: SSG_FIXTURES_DIR,
      srcDir: path.join(SSG_FIXTURES_DIR, "src"),
      buildDir: path.join(SSG_FIXTURES_DIR, "_build"),
      book,
      target: "epub",
      logger: {
        info: (msg) => console.log(`[INFO] ${msg}`),
        debug: (msg) => console.log(`[DEBUG] ${msg}`),
        warn: (msg) => console.warn(`[WARN] ${msg}`),
        error: (msg) => console.error(`[ERROR] ${msg}`),
      },
    });

    // Check result
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBeGreaterThan(0);
    expect(result.outputPath).toContain("book-epub.epub");
    expect(result.routes.length).toBeGreaterThan(0);

    console.log(`Built EPUB: ${result.routes.length} routes, ${result.data!.length} bytes`);

    // Verify EPUB file exists
    expect(fs.existsSync(result.outputPath!)).toBe(true);

    // Check EPUB structure (ZIP header)
    const header = result.data!.slice(0, 4);
    expect(header[0]).toBe(0x50); // P
    expect(header[1]).toBe(0x4b); // K
    expect(header[2]).toBe(0x03);
    expect(header[3]).toBe(0x04);
  });

  test("should include XHTML pages", async () => {
    const storage = new NodeStorageAdapter();
    const imageAdapter = new SharpImageAdapter();
    const cssAdapter = new SassAdapter();

    const result = await buildSSG({
      storage,
      imageAdapter,
      cssAdapter,
      projectRoot: SSG_FIXTURES_DIR,
      srcDir: path.join(SSG_FIXTURES_DIR, "src"),
      buildDir: path.join(SSG_FIXTURES_DIR, "_build"),
      book,
      target: "epub",
    });

    // Check for XHTML routes
    const xhtmlRoutes = result.routes.filter((r) => r.type === "xhtml");
    expect(xhtmlRoutes.length).toBeGreaterThan(0);

    // Should have cover page
    const coverRoute = xhtmlRoutes.find((r) => r.path.includes("p-cover"));
    expect(coverRoute).toBeDefined();

    // Should have TOC page
    const tocRoute = xhtmlRoutes.find((r) => r.path.includes("p-toc"));
    expect(tocRoute).toBeDefined();

    console.log(`XHTML pages: ${xhtmlRoutes.length}`);
  });

  test("should include images", async () => {
    const storage = new NodeStorageAdapter();
    const imageAdapter = new SharpImageAdapter();
    const cssAdapter = new SassAdapter();

    const result = await buildSSG({
      storage,
      imageAdapter,
      cssAdapter,
      projectRoot: SSG_FIXTURES_DIR,
      srcDir: path.join(SSG_FIXTURES_DIR, "src"),
      buildDir: path.join(SSG_FIXTURES_DIR, "_build"),
      book,
      target: "epub",
    });

    // Check for image routes
    const imageRoutes = result.routes.filter((r) => r.type === "image");
    expect(imageRoutes.length).toBeGreaterThan(0);

    console.log(`Images: ${imageRoutes.length}`);
  });

  test("should include CSS", async () => {
    const storage = new NodeStorageAdapter();
    const imageAdapter = new SharpImageAdapter();
    const cssAdapter = new SassAdapter();

    const result = await buildSSG({
      storage,
      imageAdapter,
      cssAdapter,
      projectRoot: SSG_FIXTURES_DIR,
      srcDir: path.join(SSG_FIXTURES_DIR, "src"),
      buildDir: path.join(SSG_FIXTURES_DIR, "_build"),
      book,
      target: "epub",
    });

    // Check for CSS routes
    const cssRoutes = result.routes.filter((r) => r.type === "css");
    expect(cssRoutes.length).toBeGreaterThan(0);

    console.log(`CSS files: ${cssRoutes.length}`);
  });
});
