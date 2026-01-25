import { chromium, type Browser } from "playwright";

export interface RenderOptions {
  /** Timeout in milliseconds (default: 120000) */
  timeout?: number;
  /** Output PDF file path */
  output?: string;
}

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
 * Close browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Render PDF from a running pdf-server
 *
 * @param serverUrl - URL of the pdf-server (e.g., "http://localhost:3000")
 * @param options - Render options
 * @returns PDF as Uint8Array
 */
export async function renderPDF(
  serverUrl: string,
  options: RenderOptions = {},
): Promise<Uint8Array> {
  const { timeout = 120000 } = options;

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Navigate to server root (redirects to viewer with book loaded)
    console.log(`Connecting to pdf-server: ${serverUrl}`);
    await page.goto(serverUrl, { timeout });

    // Wait for Vivliostyle to finish rendering
    // The viewer sets data-vivliostyle-viewer-status attribute
    console.log("Waiting for Vivliostyle to render...");
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

    console.log(`PDF generated: ${pdf.byteLength} bytes`);

    return new Uint8Array(pdf);
  } finally {
    await page.close();
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
