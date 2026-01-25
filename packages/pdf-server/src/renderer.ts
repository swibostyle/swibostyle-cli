import { chromium, type Browser } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export interface RenderOptions {
  timeout?: number;
}

let browser: Browser | null = null;

/**
 * Get path to Vivliostyle Viewer lib directory
 */
function getViewerPath(): string {
  const viewerPkgPath = require.resolve("@vivliostyle/viewer/package.json");
  return path.join(path.dirname(viewerPkgPath), "lib");
}

/**
 * Get or create browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
    });
  }
  return browser;
}

/**
 * Create an HTTP server to serve Vivliostyle Viewer and book files
 */
function createServer(
  viewerPath: string,
  bookPath: string,
): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", "http://localhost");
      const pathname = decodeURIComponent(url.pathname);

      // Route: /viewer/* -> Vivliostyle Viewer
      // Route: /book/* -> Book files
      let filePath: string;
      if (pathname.startsWith("/viewer/")) {
        filePath = path.join(viewerPath, pathname.slice("/viewer".length));
      } else if (pathname.startsWith("/book/")) {
        filePath = path.join(bookPath, pathname.slice("/book".length));
      } else if (pathname === "/") {
        // Redirect to viewer
        res.writeHead(302, { Location: "/viewer/index.html" });
        res.end();
        return;
      } else {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end(`Not found: ${pathname}`);
        return;
      }

      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        const indexPath = path.join(filePath, "index.html");
        if (fs.existsSync(indexPath)) {
          serveFile(indexPath, res);
        } else {
          res.writeHead(404);
          res.end("Not found");
        }
      } else {
        serveFile(filePath, res);
      }
    });

    server.listen(0, "localhost", () => {
      const address = server.address();
      if (address && typeof address === "object") {
        resolve({ server, port: address.port });
      } else {
        reject(new Error("Failed to get server port"));
      }
    });
  });
}

function serveFile(filePath: string, res: http.ServerResponse): void {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
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

  const contentType = contentTypes[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);

  res.writeHead(200, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
  });
  res.end(content);
}

/**
 * Render PDF from build directory using Vivliostyle Viewer
 *
 * @param source - Path to EPUB build directory (containing item/standard.opf)
 * @param options - Render options
 * @returns PDF as Uint8Array
 */
export async function renderPDF(source: string, options: RenderOptions = {}): Promise<Uint8Array> {
  const { timeout = 120000 } = options;

  // Determine source type
  let buildPath: string;

  if (source.endsWith(".epub")) {
    // TODO: Extract EPUB to temp directory
    throw new Error("EPUB source is not yet supported. Use build directory path.");
  } else {
    buildPath = path.resolve(source);
  }

  // Verify build path exists
  if (!fs.existsSync(buildPath)) {
    throw new Error(`Build path not found: ${buildPath}`);
  }

  // Verify OPF file exists
  const opfPath = path.join(buildPath, "item", "standard.opf");
  if (!fs.existsSync(opfPath)) {
    throw new Error(`OPF file not found: ${opfPath}`);
  }

  // Get Vivliostyle Viewer path
  const viewerPath = getViewerPath();

  // Start server
  const { server, port } = await createServer(viewerPath, buildPath);

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    // Build Vivliostyle Viewer URL with book source
    const bookUrl = encodeURIComponent(`http://localhost:${port}/book/item/standard.opf`);
    const viewerUrl = `http://localhost:${port}/viewer/index.html#src=${bookUrl}&bookMode=true&renderAllPages=true`;

    console.log(`Loading Vivliostyle Viewer: ${viewerUrl}`);

    // Navigate to viewer
    await page.goto(viewerUrl, {
      timeout,
    });

    // Wait for Vivliostyle to finish rendering
    // The viewer sets data-vivliostyle-viewer-status attribute
    await page.waitForFunction(
      `(() => {
        const body = document.body;
        const status = body.getAttribute("data-vivliostyle-viewer-status");
        // Status can be: loading, interactive, complete
        return status === "complete" || status === "interactive";
      })()`,
      { timeout },
    );

    // Additional wait to ensure all pages are rendered
    await page.waitForTimeout(1000);

    console.log("Vivliostyle rendering complete, generating PDF...");

    // Generate PDF using CSS page size (defined in the document)
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
    });

    await page.close();

    console.log(`PDF generated: ${pdf.byteLength} bytes`);

    return new Uint8Array(pdf);
  } finally {
    server.close();
  }
}

/**
 * Cleanup browser on exit
 */
process.on("exit", () => {
  browser?.close();
});

process.on("SIGINT", () => {
  browser?.close();
  process.exit();
});
