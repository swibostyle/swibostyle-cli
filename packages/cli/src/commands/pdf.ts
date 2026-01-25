import { Command } from "commander";
import ora from "ora";
import pc from "picocolors";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import * as fflate from "fflate";

// Type definitions for optional dependencies
type RenderPDF = (serverUrl: string, options?: { timeout?: number }) => Promise<Uint8Array>;
type CloseBrowser = () => Promise<void>;
type CreateApp = (bookPath: string) => { fetch: (req: Request) => Response | Promise<Response> };

export const pdfCommand = new Command("pdf")
  .description("Generate PDF from EPUB file (requires @swibostyle/pdf-renderer)")
  .argument("[epub]", "EPUB file to convert (default: ./_release/book-epub.epub)")
  .option("-o, --output <file>", "Output PDF file")
  .option("-t, --timeout <ms>", "Render timeout in milliseconds", "120000")
  .option("-p, --port <port>", "Port for internal pdf-server", "13370")
  .action(async (epubArg, options) => {
    const spinner = ora("Initializing PDF renderer...").start();

    let tempDir: string | null = null;

    try {
      // Try to import pdf-renderer (optional dependency)
      let renderPDF: RenderPDF;
      let closeBrowser: CloseBrowser;

      try {
        // @ts-expect-error - Optional dependency, may not be installed
        const pdfRenderer = await import("@swibostyle/pdf-renderer").catch(() => null);
        if (!pdfRenderer) throw new Error("Not found");
        renderPDF = pdfRenderer.renderPDF as RenderPDF;
        closeBrowser = pdfRenderer.closeBrowser as CloseBrowser;
      } catch {
        spinner.fail(pc.red("@swibostyle/pdf-renderer is not installed"));
        console.log();
        console.log(pc.yellow("To generate PDFs, install the required packages:"));
        console.log();
        console.log(pc.cyan("  npm install @swibostyle/pdf-renderer @swibostyle/pdf-server"));
        console.log(pc.cyan("  npx playwright install chromium"));
        console.log();
        console.log(pc.dim("Note: PDF rendering requires Chromium browser (~150MB download)"));
        process.exit(1);
      }

      // Resolve paths
      const epubPath = path.resolve(epubArg || "./_release/book-epub.epub");
      const timeout = parseInt(options.timeout, 10);
      const port = parseInt(options.port, 10);

      // Verify EPUB file exists
      if (!fs.existsSync(epubPath)) {
        spinner.fail(pc.red(`EPUB file not found: ${epubPath}`));
        console.log();
        console.log(pc.yellow("Run 'swibostyle build' first to create the EPUB."));
        process.exit(1);
      }

      // Determine output path
      const outputPath = options.output
        ? path.resolve(options.output)
        : epubPath.replace(/\.epub$/i, ".pdf");

      // Try to import pdf-server (optional dependency)
      let createApp: CreateApp;
      try {
        // @ts-expect-error - Optional dependency, may not be installed
        const pdfServer = await import("@swibostyle/pdf-server").catch(() => null);
        if (!pdfServer) throw new Error("Not found");
        createApp = pdfServer.createApp as CreateApp;
      } catch {
        spinner.fail(pc.red("@swibostyle/pdf-server is not installed"));
        console.log();
        console.log(pc.yellow("Install pdf-server:"));
        console.log(pc.cyan("  npm install @swibostyle/pdf-server"));
        process.exit(1);
      }

      // Extract EPUB to temp directory
      spinner.text = "Extracting EPUB...";
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "swibostyle-pdf-"));

      const epubData = fs.readFileSync(epubPath);
      const unzipped = fflate.unzipSync(new Uint8Array(epubData));

      // Write extracted files
      for (const [filePath, data] of Object.entries(unzipped)) {
        const fullPath = path.join(tempDir, filePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, data);
      }

      // Verify OPF file exists
      const opfPath = path.join(tempDir, "item", "standard.opf");
      if (!fs.existsSync(opfPath)) {
        spinner.fail(pc.red(`Invalid EPUB: missing item/standard.opf`));
        process.exit(1);
      }

      spinner.text = "Starting internal pdf-server...";

      // Start internal server
      // @ts-expect-error - Dynamic import
      const honoServer = await import("@hono/node-server").catch(() => null);
      if (!honoServer) {
        spinner.fail(pc.red("@hono/node-server is not available"));
        process.exit(1);
      }

      const app = createApp(tempDir);
      const server = honoServer.serve({
        fetch: app.fetch,
        port,
      });

      const serverUrl = `http://localhost:${port}`;

      try {
        spinner.text = `Rendering PDF from ${path.basename(epubPath)}...`;

        const pdf = await renderPDF(serverUrl, { timeout });

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Write PDF
        fs.writeFileSync(outputPath, pdf);

        spinner.succeed(pc.green(`PDF saved: ${outputPath}`));
        console.log(pc.dim(`  Size: ${(pdf.byteLength / 1024).toFixed(1)} KB`));
      } finally {
        // Cleanup
        await closeBrowser();
        server.close();
      }
    } catch (error) {
      spinner.fail(pc.red("PDF generation failed"));
      console.error(pc.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    } finally {
      // Clean up temp directory
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });
