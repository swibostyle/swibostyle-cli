import { chromium, type Browser } from "playwright";

export interface RenderOptions {
  /** Timeout in milliseconds (default: 120000) */
  timeout?: number;
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
    // Construct viewer URL with book source
    // Vivliostyle auto-detects OPF when given the EPUB root directory
    const bookUrl = `${serverUrl}/book/`;
    const viewerUrl = `${serverUrl}/viewer/index.html#src=${bookUrl}&bookMode=true&renderAllPages=true`;

    await page.goto(viewerUrl, { timeout, waitUntil: "networkidle" });

    // Wait for body to exist
    await page.waitForSelector("body", { timeout });

    // Wait for Vivliostyle rendering to complete
    // The viewer sets data-vivliostyle-viewer-status attribute
    await page.waitForFunction(
      `(() => {
        const body = document.body;
        if (!body) return false;
        const status = body.getAttribute("data-vivliostyle-viewer-status");
        return status === "complete" || status === "interactive";
      })()`,
      { timeout },
    );

    // Additional wait to ensure all pages are rendered
    await page.waitForTimeout(2000);

    // Generate PDF using CSS page size (defined in the document)
    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
    });

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
