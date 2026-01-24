import { describe, test, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  build,
  createBuildContext,
  MemoryStorageAdapter,
  NoopImageAdapter,
  PassthroughCSSAdapter,
} from "../../packages/core/src/index.js";
import type { BookConfig } from "../../packages/core/src/types.js";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures/sample-project/src");

// Strip JSON comments from a string (single-line // and multi-line)
function stripJsonComments(json: string): string {
  return json.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

describe("Memory Storage Build", () => {
  test("should build EPUB entirely in memory", async () => {
    // Load sample project files into memory
    const storage = new MemoryStorageAdapter();

    // Helper to load directory recursively
    const loadDir = (dirPath: string, basePath: string) => {
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relativePath = path.join(basePath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Create directory in memory storage
          storage.mkdirSync(relativePath);
          loadDir(fullPath, relativePath);
        } else {
          const content = fs.readFileSync(fullPath);
          storage.setFile(relativePath, new Uint8Array(content));
        }
      }
    };

    // Load fixtures into memory
    storage.mkdirSync("/src");
    loadDir(FIXTURES_DIR, "/src");

    // Load and parse config (handle JSON comments)
    const configContent = await storage.readTextFile("/src/book.json");
    const config: BookConfig = JSON.parse(stripJsonComments(configContent));
    // Disable image resizing for NoopImageAdapter
    config.targets = {
      epub: { css: "epub.scss", enableImageResizing: false },
    };

    // Create context with memory storage
    const ctx = createBuildContext({
      storage,
      imageAdapter: new NoopImageAdapter(),
      cssAdapter: new PassthroughCSSAdapter(), // Use passthrough since we don't have Sass in memory
      paths: {
        src: "/src",
        build: "/_build",
        release: "/_release",
        markdown: "/src/markdown",
        styles: "/src/style",
        images: "/src/image",
        templates: "/src/templates",
        metaInf: "/src/META-INF",
      },
      config,
    });

    // Need to provide pre-compiled CSS for passthrough adapter
    // In real browser scenario, CSS would be pre-compiled or use WASM Sass
    const baseCss = await storage.readTextFile("/src/style/base.scss");
    const epubCss = await storage.readTextFile("/src/style/epub.scss");

    // Write combined CSS (simulating pre-compilation)
    await storage.writeFile("/src/style/epub.scss", baseCss + "\n" + epubCss);

    // Build in memory
    const result = await build(ctx, { target: "epub", output: "memory" });

    // Verify result
    expect(result.data).toBeDefined();
    expect(result.data!.length).toBeGreaterThan(0);

    // Verify it's a valid ZIP
    const zipMagic = result.data!.slice(0, 4);
    expect(zipMagic[0]).toBe(0x50); // P
    expect(zipMagic[1]).toBe(0x4b); // K

    // Verify all files are in memory storage
    const allPaths = storage.getAllPaths();
    expect(allPaths.some((p) => p.includes("/_build/"))).toBe(true);

    console.log(
      `Memory build complete: ${result.contents.length} items, ${result.data!.length} bytes`,
    );
  });
});

describe("Minimal Memory Build", () => {
  test("should build minimal EPUB from scratch in memory", async () => {
    const storage = new MemoryStorageAdapter();

    // Create minimal book structure in memory
    const config: BookConfig = {
      title: "Memory Test Book",
      authors: [{ name: "Test Author", role: "aut" }],
      publisher: "Test Publisher",
      lang: "en",
      bookId: { epub: "1234567890" },
      layout: "reflowable",
      pageDirection: "ltr",
      primaryWritingMode: "horizontal-tb",
      targets: {
        epub: { css: "epub.scss", enableImageResizing: false },
      },
    };

    // Create directories first
    storage.mkdirSync("/src");
    storage.mkdirSync("/src/META-INF");
    storage.mkdirSync("/src/markdown");
    storage.mkdirSync("/src/style");
    storage.mkdirSync("/src/templates");
    storage.mkdirSync("/src/image");

    // Create files
    storage.setFile("/src/book.json", JSON.stringify(config));
    storage.setFile("/src/mimetype", "application/epub+zip");
    storage.setFile(
      "/src/META-INF/container.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="item/standard.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`,
    );

    // Create minimal markdown
    storage.setFile(
      "/src/markdown/p-001-intro.md",
      `---
title: Introduction
displayOrder: 1
isNavigationItem: true
---

# Introduction

This is a test book built entirely in memory.`,
    );

    // Create minimal CSS
    storage.setFile(
      "/src/style/epub.scss",
      `body { font-family: sans-serif; }
h1 { font-size: 1.5em; }
p { margin: 1em 0; }`,
    );

    // Create templates
    storage.setFile(
      "/src/templates/xhtml.ejs",
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<head>
  <meta charset="UTF-8" />
  <title><%= title %></title>
  <link rel="stylesheet" type="text/css" href="../style/style.css" />
</head>
<body>
<%- body %>
</body>
</html>`,
    );

    storage.setFile(
      "/src/templates/navigation-documents.ejs",
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
<% for (const item of navigationItems) { %>
      <li><a href="xhtml/<%= item.fileName %>"><%= item.title %></a></li>
<% } %>
    </ol>
  </nav>
</body>
</html>`,
    );

    storage.setFile(
      "/src/templates/standard.opf.ejs",
      `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" xml:lang="en" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid"><%= bookConfig.bookId.epub %></dc:identifier>
    <dc:title><%= bookConfig.title %></dc:title>
    <dc:language><%= bookConfig.lang %></dc:language>
<% for (const author of bookConfig.authors) { %>
    <dc:creator><%= author.name %></dc:creator>
<% } %>
    <meta property="dcterms:modified"><%= modified %></meta>
  </metadata>
  <manifest>
    <item id="nav" href="navigation-documents.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="style" href="style/style.css" media-type="text/css" />
<% for (const page of pages) { %>
    <item id="<%= page.id %>" href="xhtml/<%= page.fileName %>" media-type="application/xhtml+xml" />
<% } %>
  </manifest>
  <spine>
<% for (const page of pages) { %>
    <itemref idref="<%= page.id %>" />
<% } %>
  </spine>
</package>`,
    );

    // Build
    const ctx = createBuildContext({
      storage,
      imageAdapter: new NoopImageAdapter(),
      cssAdapter: new PassthroughCSSAdapter(),
      paths: {
        src: "/src",
        build: "/_build",
        release: "/_release",
        markdown: "/src/markdown",
        styles: "/src/style",
        images: "/src/image",
        templates: "/src/templates",
        metaInf: "/src/META-INF",
      },
      config,
    });

    const result = await build(ctx, { target: "epub", output: "memory" });

    expect(result.data).toBeDefined();
    expect(result.data!.length).toBeGreaterThan(0);
    expect(result.contents.length).toBe(1); // 1 XHTML page

    console.log(`Minimal memory build: ${result.data!.length} bytes`);
  });
});
