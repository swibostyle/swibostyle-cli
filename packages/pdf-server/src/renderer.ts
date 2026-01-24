import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';

interface RenderOptions {
  format?: 'A4' | 'A5' | 'B5' | 'Letter';
  timeout?: number;
}

const PAGE_SIZES = {
  A4: { width: '210mm', height: '297mm' },
  A5: { width: '148mm', height: '210mm' },
  B5: { width: '182mm', height: '257mm' },
  Letter: { width: '8.5in', height: '11in' },
};

let browser: Browser | null = null;

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
 * Create a simple HTTP server to serve files
 */
function createFileServer(basePath: string): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url || '/';
      const filePath = path.join(basePath, url);

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        const indexPath = path.join(filePath, 'index.html');
        if (fs.existsSync(indexPath)) {
          serveFile(indexPath, res);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      } else {
        serveFile(filePath, res);
      }
    });

    server.listen(0, 'localhost', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        resolve({ server, port: address.port });
      } else {
        reject(new Error('Failed to get server port'));
      }
    });
  });
}

function serveFile(filePath: string, res: http.ServerResponse): void {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.html': 'text/html',
    '.xhtml': 'application/xhtml+xml',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
  };

  const contentType = contentTypes[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);

  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

/**
 * Render PDF from EPUB or build directory using Vivliostyle
 */
export async function renderPDF(
  source: string,
  options: RenderOptions = {}
): Promise<Uint8Array> {
  const { format = 'A5', timeout = 60000 } = options;
  const pageSize = PAGE_SIZES[format];

  // Determine source type
  let buildPath: string;

  if (source.endsWith('.epub')) {
    // TODO: Extract EPUB to temp directory
    throw new Error('EPUB source is not yet supported. Use build directory path.');
  } else {
    buildPath = source;
  }

  // Verify build path exists
  if (!fs.existsSync(buildPath)) {
    throw new Error(`Build path not found: ${buildPath}`);
  }

  // Start file server
  const { server, port } = await createFileServer(buildPath);

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    // Generate Vivliostyle viewer URL
    // Note: This requires Vivliostyle Viewer to be available
    const viewerUrl = `http://localhost:${port}/item/standard.opf`;

    // For now, we'll render the HTML directly
    // In production, this should use Vivliostyle Viewer for proper CSS Paged Media support

    // Navigate to the first page
    await page.goto(viewerUrl, {
      waitUntil: 'networkidle',
      timeout,
    });

    // Wait for rendering
    await page.waitForTimeout(1000);

    // Generate PDF
    const pdf = await page.pdf({
      width: pageSize.width,
      height: pageSize.height,
      printBackground: true,
      preferCSSPageSize: true,
    });

    await page.close();

    return new Uint8Array(pdf);
  } finally {
    server.close();
  }
}

/**
 * Cleanup browser on exit
 */
process.on('exit', () => {
  browser?.close();
});

process.on('SIGINT', () => {
  browser?.close();
  process.exit();
});
