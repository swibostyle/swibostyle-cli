import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  build,
  createBuildContext,
  NodeStorageAdapter,
  NoopImageAdapter,
  SassAdapter,
  loadBookConfig,
  getDefaultPaths,
} from "../../packages/core/src/index.js";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/sample-project");
const TEMP_BUILD_DIR = path.resolve(__dirname, "../fixtures/sample-project/_build");
const TEMP_RELEASE_DIR = path.resolve(__dirname, "../fixtures/sample-project/_release");

/**
 * Helper to disable image resizing for NoopImageAdapter tests
 */
function disableImageResizing(
  config: ReturnType<
    typeof loadBookConfig extends (...args: never[]) => Promise<infer R> ? R : never
  >,
) {
  config.targets = {
    epub: { css: "epub.scss", enableImageResizing: false },
    print: { css: "print.scss", enableImageResizing: false },
    pod: { css: "pod.scss", enableImageResizing: false },
  };
  return config;
}

describe("Build Pipeline Integration", () => {
  let storage: NodeStorageAdapter;

  beforeAll(() => {
    storage = new NodeStorageAdapter();
  });

  afterAll(async () => {
    // Cleanup build directories
    if (fs.existsSync(TEMP_BUILD_DIR)) {
      fs.rmSync(TEMP_BUILD_DIR, { recursive: true });
    }
    if (fs.existsSync(TEMP_RELEASE_DIR)) {
      fs.rmSync(TEMP_RELEASE_DIR, { recursive: true });
    }
  });

  test("should load book.json from sample project", async () => {
    const configPath = path.join(FIXTURES_DIR, "src/book.json");
    const config = await loadBookConfig(storage, configPath);

    expect(config.title).toBeDefined();
    expect(config.authors).toBeInstanceOf(Array);
    expect(config.authors.length).toBeGreaterThan(0);
    expect(config.lang).toBe("ja");
  });

  test("should build EPUB from sample project", async () => {
    const srcDir = path.join(FIXTURES_DIR, "src");
    const configPath = path.join(srcDir, "book.json");

    const config = disableImageResizing(await loadBookConfig(storage, configPath));
    const paths = getDefaultPaths(srcDir, TEMP_BUILD_DIR, TEMP_RELEASE_DIR);

    const ctx = createBuildContext({
      storage,
      imageAdapter: new NoopImageAdapter(),
      cssAdapter: new SassAdapter(),
      paths,
      config,
    });

    const result = await build(ctx, { target: "epub", output: "memory" });

    // Verify result
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBeGreaterThan(0);
    expect(result.contents.length).toBeGreaterThan(0);

    // Verify EPUB structure (check ZIP magic bytes)
    const zipMagic = result.data!.slice(0, 4);
    expect(zipMagic[0]).toBe(0x50); // P
    expect(zipMagic[1]).toBe(0x4b); // K
    expect(zipMagic[2]).toBe(0x03);
    expect(zipMagic[3]).toBe(0x04);

    // Verify content types
    const xhtmlCount = result.contents.filter((c) => c.type === "xhtml").length;
    const imageCount = result.contents.filter((c) => c.type === "image").length;

    expect(xhtmlCount).toBeGreaterThan(0);
    console.log(
      `Built EPUB: ${xhtmlCount} pages, ${imageCount} images, ${result.data!.length} bytes`,
    );
  });

  test("should build and write EPUB file", async () => {
    const srcDir = path.join(FIXTURES_DIR, "src");
    const configPath = path.join(srcDir, "book.json");

    const config = disableImageResizing(await loadBookConfig(storage, configPath));
    const paths = getDefaultPaths(srcDir, TEMP_BUILD_DIR, TEMP_RELEASE_DIR);

    const ctx = createBuildContext({
      storage,
      imageAdapter: new NoopImageAdapter(),
      cssAdapter: new SassAdapter(),
      paths,
      config,
    });

    const result = await build(ctx, { target: "epub", output: "file" });

    // Verify output file exists
    expect(result.outputPath).toBeDefined();
    expect(fs.existsSync(result.outputPath!)).toBe(true);

    const fileStats = fs.statSync(result.outputPath!);
    expect(fileStats.size).toBeGreaterThan(0);

    console.log(`Written EPUB: ${result.outputPath} (${fileStats.size} bytes)`);
  });

  test("should build print target", async () => {
    const srcDir = path.join(FIXTURES_DIR, "src");
    const configPath = path.join(srcDir, "book.json");

    const config = disableImageResizing(await loadBookConfig(storage, configPath));
    const paths = getDefaultPaths(srcDir, TEMP_BUILD_DIR, TEMP_RELEASE_DIR);

    const ctx = createBuildContext({
      storage,
      imageAdapter: new NoopImageAdapter(),
      cssAdapter: new SassAdapter(),
      paths,
      config,
    });

    const result = await build(ctx, { target: "print", output: "memory" });

    expect(result.data).toBeDefined();
    expect(result.data!.length).toBeGreaterThan(0);
    console.log(`Built print EPUB: ${result.data!.length} bytes`);
  });
});

describe("Build Directory Structure", () => {
  test("should create correct directory structure", async () => {
    const srcDir = path.join(FIXTURES_DIR, "src");
    const configPath = path.join(srcDir, "book.json");

    const storage = new NodeStorageAdapter();
    const config = disableImageResizing(await loadBookConfig(storage, configPath));
    const paths = getDefaultPaths(srcDir, TEMP_BUILD_DIR, TEMP_RELEASE_DIR);

    const ctx = createBuildContext({
      storage,
      imageAdapter: new NoopImageAdapter(),
      cssAdapter: new SassAdapter(),
      paths,
      config,
    });

    await build(ctx, { target: "epub", output: "file" });

    // Verify directory structure
    expect(fs.existsSync(TEMP_BUILD_DIR)).toBe(true);
    expect(fs.existsSync(path.join(TEMP_BUILD_DIR, "META-INF"))).toBe(true);
    expect(fs.existsSync(path.join(TEMP_BUILD_DIR, "item"))).toBe(true);
    expect(fs.existsSync(path.join(TEMP_BUILD_DIR, "item/style"))).toBe(true);
    expect(fs.existsSync(path.join(TEMP_BUILD_DIR, "item/xhtml"))).toBe(true);

    // Verify key files exist
    expect(fs.existsSync(path.join(TEMP_BUILD_DIR, "mimetype"))).toBe(true);
    expect(fs.existsSync(path.join(TEMP_BUILD_DIR, "META-INF/container.xml"))).toBe(true);
    expect(fs.existsSync(path.join(TEMP_BUILD_DIR, "item/standard.opf"))).toBe(true);
    expect(fs.existsSync(path.join(TEMP_BUILD_DIR, "item/navigation-documents.xhtml"))).toBe(true);
    expect(fs.existsSync(path.join(TEMP_BUILD_DIR, "item/style/style.css"))).toBe(true);
  });
});
