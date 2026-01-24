import { describe, test, expect } from "bun:test";
import * as path from "node:path";
import {
  NodeStorageAdapter,
  scanRoutes,
  scannedToRouteInfo,
  sortRoutesByDisplayOrder,
  createRouter,
  createHandler,
  createSSGContext,
  createDefaultRouter,
} from "../../packages/core/src/index.js";
import type { RouteInfo, ImageInfo } from "../../packages/core/src/index.js";

const SSG_FIXTURES_DIR = path.resolve(__dirname, "../fixtures/sample-project-ssg");

describe("SSG Scanner", () => {
  test("should scan SSG project structure", async () => {
    const storage = new NodeStorageAdapter();
    const srcDir = path.join(SSG_FIXTURES_DIR, "src");

    const scannedRoutes = await scanRoutes({
      storage,
      srcDir,
      target: "epub",
    });

    // Convert to RouteInfo
    const routes = scannedToRouteInfo(scannedRoutes);

    // Should find markdown files in item/xhtml/
    const xhtmlRoutes = routes.filter((r) => r.type === "xhtml");
    expect(xhtmlRoutes.length).toBeGreaterThan(0);

    // Should find style files in item/style/
    const cssRoutes = routes.filter((r) => r.type === "css");
    expect(cssRoutes.length).toBeGreaterThan(0);

    // Should find image files in item/image/
    const imageRoutes = routes.filter((r) => r.type === "image");
    expect(imageRoutes.length).toBeGreaterThan(0);

    console.log(`Scanned ${routes.length} routes:`);
    console.log(`  - ${xhtmlRoutes.length} XHTML pages`);
    console.log(`  - ${cssRoutes.length} CSS files`);
    console.log(`  - ${imageRoutes.length} images`);
  });

  test("should filter routes by target (epub)", async () => {
    const storage = new NodeStorageAdapter();
    const srcDir = path.join(SSG_FIXTURES_DIR, "src");

    const scannedRoutes = await scanRoutes({
      storage,
      srcDir,
      target: "epub",
    });

    const routes = scannedToRouteInfo(scannedRoutes);
    const xhtmlRoutes = routes.filter((r) => r.type === "xhtml");

    // Should include p-000-cover-epub.md (includeIf: epub)
    const coverEpub = xhtmlRoutes.find((r) => r.path.includes("p-cover"));
    expect(coverEpub).toBeDefined();

    // Should NOT include p-000-cover-print.md (includeIf: print)
    const coverPrint = xhtmlRoutes.find((r) => r.sourcePath?.includes("p-000-cover-print.md"));
    expect(coverPrint).toBeUndefined();

    // Should include p-900-colophon-epub.md, not p-900-colophon-print.md
    const colophonEpub = xhtmlRoutes.find((r) => r.sourcePath?.includes("p-900-colophon-epub.md"));
    expect(colophonEpub).toBeDefined();
    const colophonPrint = xhtmlRoutes.find((r) =>
      r.sourcePath?.includes("p-900-colophon-print.md"),
    );
    expect(colophonPrint).toBeUndefined();
  });

  test("should filter routes by target (print)", async () => {
    const storage = new NodeStorageAdapter();
    const srcDir = path.join(SSG_FIXTURES_DIR, "src");

    const scannedRoutes = await scanRoutes({
      storage,
      srcDir,
      target: "print",
    });

    const routes = scannedToRouteInfo(scannedRoutes);
    const xhtmlRoutes = routes.filter((r) => r.type === "xhtml");

    // Should include p-000-cover-print.md (includeIf: print)
    const coverPrint = xhtmlRoutes.find((r) => r.sourcePath?.includes("p-000-cover-print.md"));
    expect(coverPrint).toBeDefined();

    // Should NOT include p-000-cover-epub.md (includeIf: epub)
    const coverEpub = xhtmlRoutes.find((r) => r.sourcePath?.includes("p-000-cover-epub.md"));
    expect(coverEpub).toBeUndefined();

    // Should NOT include epub-only pages (like p-310-special1.md with includeIf: epub)
    const special1 = xhtmlRoutes.find((r) => r.sourcePath?.includes("p-310-special1.md"));
    expect(special1).toBeUndefined();
  });

  test("should apply outputFileName transformation", async () => {
    const storage = new NodeStorageAdapter();
    const srcDir = path.join(SSG_FIXTURES_DIR, "src");

    const scannedRoutes = await scanRoutes({
      storage,
      srcDir,
      target: "epub",
    });

    const routes = scannedToRouteInfo(scannedRoutes);

    // p-010-toc.md has outputFileName: p-toc
    const tocRoute = routes.find((r) => r.sourcePath?.includes("p-010-toc.md"));
    expect(tocRoute).toBeDefined();
    expect(tocRoute?.path).toContain("p-toc.xhtml");

    // p-000-cover-epub.md has outputFileName: p-cover
    const coverRoute = routes.find((r) => r.sourcePath?.includes("p-000-cover-epub.md"));
    expect(coverRoute).toBeDefined();
    expect(coverRoute?.path).toContain("p-cover.xhtml");
  });

  test("should extract frontmatter metadata", async () => {
    const storage = new NodeStorageAdapter();
    const srcDir = path.join(SSG_FIXTURES_DIR, "src");

    const scannedRoutes = await scanRoutes({
      storage,
      srcDir,
      target: "epub",
    });

    const routes = scannedToRouteInfo(scannedRoutes);

    // Find cover page
    const coverRoute = routes.find((r) => r.sourcePath?.includes("p-000-cover-epub.md"));
    expect(coverRoute).toBeDefined();
    expect(coverRoute?.metadata.title).toBe("表紙");
    expect(coverRoute?.metadata.displayOrder).toBe(0);
    expect(coverRoute?.metadata.viewport).toBe("width=1815, height=2580");
    expect(coverRoute?.metadata.htmlClass).toBe("horizontal fixed-layout page-cover page-color");
    expect(coverRoute?.metadata.epubPageProperty).toBe("page-spread-left");
    expect(coverRoute?.metadata.isGuideItem).toBe(true);
    expect(coverRoute?.metadata.isNavigationItem).toBe(true);
    expect(coverRoute?.metadata.epubType).toBe("cover");

    // Find TOC page
    const tocRoute = routes.find((r) => r.sourcePath?.includes("p-010-toc.md"));
    expect(tocRoute).toBeDefined();
    expect(tocRoute?.metadata.title).toBe("目次");
    expect(tocRoute?.metadata.epubType).toBe("toc");
  });

  test("should sort routes by displayOrder", async () => {
    const storage = new NodeStorageAdapter();
    const srcDir = path.join(SSG_FIXTURES_DIR, "src");

    const scannedRoutes = await scanRoutes({
      storage,
      srcDir,
      target: "epub",
    });

    const routes = scannedToRouteInfo(scannedRoutes);
    const xhtmlRoutes = routes.filter((r) => r.type === "xhtml");
    const sortedRoutes = sortRoutesByDisplayOrder(xhtmlRoutes);

    // First should be displayOrder 0 (cover)
    expect(sortedRoutes[0]?.metadata.displayOrder).toBe(0);

    // Verify order is ascending
    for (let i = 1; i < sortedRoutes.length; i++) {
      const prevOrder = sortedRoutes[i - 1]?.metadata.displayOrder ?? 0;
      const currOrder = sortedRoutes[i]?.metadata.displayOrder ?? Number.MAX_SAFE_INTEGER;
      expect(currOrder).toBeGreaterThanOrEqual(prevOrder);
    }
  });
});

describe("SSG Router", () => {
  test("should create router and register routes", () => {
    const router = createRouter();

    router.get("p-cover.xhtml", (c) => {
      return c.html`<html><body>Cover</body></html>`;
    });

    router.get("p-intro.xhtml", (c) => {
      return c.html`<html><body>Intro</body></html>`;
    });

    const routes = router.getRoutes();
    expect(routes.length).toBe(2);
    expect(routes[0].pattern).toBe("p-cover.xhtml");
    expect(routes[1].pattern).toBe("p-intro.xhtml");
  });

  test("should create handler with metadata", () => {
    const handler = createHandler((c) => c.html`<html></html>`, {
      title: "Test Page",
      displayOrder: 100,
    });

    expect(handler.metadata?.title).toBe("Test Page");
    expect(handler.metadata?.displayOrder).toBe(100);
  });
});

describe("SSG Context", () => {
  test("should create context with template helpers", () => {
    const imageInfoMap = new Map<string, ImageInfo>();
    imageInfoMap.set("cover.jpg", { width: 1815, height: 2580, format: "jpeg" });

    const routes: RouteInfo[] = [];

    const ctx = createSSGContext({
      book: {
        title: "Test Book",
        authors: [{ name: "Test Author", role: "aut" }],
        publisher: "Test Publisher",
        lang: "ja",
        bookId: { epub: "1234567890" },
        layout: "reflowable",
        pageDirection: "rtl",
        primaryWritingMode: "vertical-rl",
      },
      target: "epub",
      path: "item/xhtml/p-cover.xhtml",
      routes,
      imageInfoMap,
    });

    // Test xml helper
    const xmlResponse = ctx.xml`<?xml version="1.0"?><root>${ctx.book.title}</root>`;
    expect(xmlResponse.type).toBe("xml");
    expect(xmlResponse.content).toContain("Test Book");

    // Test html helper
    const htmlResponse = ctx.html`<html><body>${ctx.book.title}</body></html>`;
    expect(htmlResponse.type).toBe("html");
    expect(htmlResponse.content).toContain("Test Book");

    // Test text helper
    const textResponse = ctx.text("plain text");
    expect(textResponse.type).toBe("text");
    expect(textResponse.content).toBe("plain text");

    // Test notFound helper
    const notFoundResponse = ctx.notFound();
    expect(notFoundResponse.type).toBe("notFound");

    // Test getImage helper
    const imageInfo = ctx.getImage("image/cover.jpg");
    expect(imageInfo).toBeDefined();
    expect(imageInfo?.width).toBe(1815);
    expect(imageInfo?.height).toBe(2580);
  });

  test("should escape XML special characters", () => {
    const ctx = createSSGContext({
      book: {
        title: "Test & Book <1>",
        authors: [{ name: 'Test "Author"', role: "aut" }],
        publisher: "Publisher",
        lang: "en",
        bookId: { epub: "123" },
        layout: "reflowable",
        pageDirection: "ltr",
        primaryWritingMode: "horizontal-tb",
      },
      target: "epub",
      path: "test.xhtml",
      routes: [],
      imageInfoMap: new Map(),
    });

    const response = ctx.xml`<title>${ctx.book.title}</title>`;
    expect(response.content).toContain("&amp;");
    expect(response.content).toContain("&lt;");
    expect(response.content).toContain("&gt;");
  });
});

describe("SSG Default Router", () => {
  test("should create default router with built-in handlers", () => {
    const router = createDefaultRouter();
    const routes = router.getRoutes();

    // Should have mimetype, container.xml, OPF, and navigation handlers
    expect(routes.length).toBe(4);

    const patterns = routes.map((r) => r.pattern);
    expect(patterns).toContain("mimetype");
    expect(patterns).toContain("META-INF/container.xml");
    expect(patterns).toContain("item/standard.opf");
    expect(patterns).toContain("item/navigation-documents.xhtml");
  });

  test("should generate mimetype", () => {
    const router = createDefaultRouter();
    const routes = router.getRoutes();
    const mimetypeRoute = routes.find((r) => r.pattern === "mimetype");
    expect(mimetypeRoute).toBeDefined();

    const ctx = createSSGContext({
      book: {
        title: "Test",
        authors: [],
        publisher: "Pub",
        lang: "en",
        bookId: { epub: "123" },
        layout: "reflowable",
        pageDirection: "ltr",
        primaryWritingMode: "horizontal-tb",
      },
      target: "epub",
      path: "mimetype",
      routes: [],
      imageInfoMap: new Map(),
    });

    const response = mimetypeRoute!.handler(ctx);
    expect(response).toHaveProperty("type", "text");
    expect(response).toHaveProperty("content", "application/epub+zip");
  });
});
