import { Hono } from "hono";
import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Get path to Vivliostyle Viewer lib directory
 */
function getViewerPath(): string {
  const viewerPkgPath = require.resolve("@vivliostyle/viewer/package.json");
  return path.join(path.dirname(viewerPkgPath), "lib");
}

/**
 * Get MIME type for file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".xhtml": "application/xhtml+xml; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".opf": "application/oebps-package+xml; charset=utf-8",
    ".ncx": "application/x-dtbncx+xml; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".map": "application/json",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Create Vivliostyle Viewer server app
 */
export function createApp(bookPath: string) {
  const app = new Hono();
  const viewerPath = getViewerPath();

  // Verify book path exists
  const resolvedBookPath = path.resolve(bookPath);
  if (!fs.existsSync(resolvedBookPath)) {
    throw new Error(`Book path not found: ${resolvedBookPath}`);
  }

  // Verify OPF file exists
  const opfPath = path.join(resolvedBookPath, "item", "standard.opf");
  if (!fs.existsSync(opfPath)) {
    throw new Error(`OPF file not found: ${opfPath}`);
  }

  // Root: redirect to viewer with book URL
  app.get("/", (c) => {
    const host = c.req.header("host") || "localhost:3000";
    const protocol = c.req.header("x-forwarded-proto") || "http";
    const bookUrl = encodeURIComponent(`${protocol}://${host}/book/item/standard.opf`);
    return c.redirect(`/viewer/index.html#src=${bookUrl}&bookMode=true&renderAllPages=true`);
  });

  // Health check
  app.get("/health", (c) => {
    return c.json({ status: "ok", bookPath: resolvedBookPath });
  });

  // Serve Vivliostyle Viewer files
  app.get("/viewer/*", async (c) => {
    const reqPath = c.req.path.slice("/viewer/".length) || "index.html";
    const filePath = path.join(viewerPath, reqPath);

    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(viewerPath))) {
      return c.text("Forbidden", 403);
    }

    if (!fs.existsSync(resolved)) {
      return c.text(`Not found: ${reqPath}`, 404);
    }

    const content = fs.readFileSync(resolved);
    return c.body(content, 200, {
      "Content-Type": getMimeType(resolved),
      "Access-Control-Allow-Origin": "*",
    });
  });

  // Serve book files
  app.get("/book/*", async (c) => {
    const reqPath = c.req.path.slice("/book/".length);
    const filePath = path.join(resolvedBookPath, reqPath);

    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(resolvedBookPath)) {
      return c.text("Forbidden", 403);
    }

    if (!fs.existsSync(resolved)) {
      return c.text(`Not found: ${reqPath}`, 404);
    }

    const content = fs.readFileSync(resolved);
    return c.body(content, 200, {
      "Content-Type": getMimeType(resolved),
      "Access-Control-Allow-Origin": "*",
    });
  });

  return app;
}
