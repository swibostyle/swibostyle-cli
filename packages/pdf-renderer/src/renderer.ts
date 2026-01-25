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
    // Construct viewer URL with book source
    // Vivliostyle auto-detects OPF when given the EPUB root directory
    // HTTP redirects don't preserve URL fragments (#hash), so we navigate directly
    const bookUrl = encodeURIComponent(`${serverUrl}/book/`);
    const viewerUrl = `${serverUrl}/viewer/index.html#src=${bookUrl}&bookMode=true&renderAllPages=true`;

    console.log(`Connecting to pdf-server: ${serverUrl}`);
    console.log(`Book URL: ${serverUrl}/book/`);
    console.log(`Viewer URL: ${viewerUrl}`);

    // Listen for console messages
    page.on("console", (msg) => {
      console.log(`[Browser ${msg.type()}] ${msg.text()}`);
    });

    // Listen for page errors
    page.on("pageerror", (error) => {
      console.log(`[Browser error] ${error.message}`);
    });

    await page.goto(viewerUrl, { timeout, waitUntil: "networkidle" });

    // Log current page info
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`Current URL: ${currentUrl}`);
    console.log(`Page title: ${pageTitle}`);

    // Wait for Vivliostyle to finish rendering
    // The viewer sets data-vivliostyle-viewer-status attribute
    console.log("Waiting for Vivliostyle to render...");

    // First wait for body to exist
    await page.waitForSelector("body", { timeout });

    // Log current status for debugging
    const initialStatus = await page.evaluate(
      `document.body?.getAttribute("data-vivliostyle-viewer-status") || "not-set"`,
    );
    console.log(`Initial Vivliostyle status: ${initialStatus}`);

    // Log body attributes for debugging
    const bodyAttrs = await page.evaluate(
      `Array.from(document.body.attributes).map(a => a.name + '=' + a.value).join(', ')`,
    );
    console.log(`Body attributes: ${bodyAttrs}`);

    // Wait for rendering to complete
    await page.waitForFunction(
      `(() => {
        const body = document.body;
        if (!body) return false;
        const status = body.getAttribute("data-vivliostyle-viewer-status");
        // Status can be: loading, interactive, complete
        return status === "complete" || status === "interactive";
      })()`,
      { timeout },
    );

    // Log final status
    const finalStatus = await page.evaluate(
      `document.body?.getAttribute("data-vivliostyle-viewer-status") || "not-set"`,
    );
    console.log(`Final Vivliostyle status: ${finalStatus}`);

    // Additional wait to ensure all pages are rendered
    await page.waitForTimeout(2000);

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
