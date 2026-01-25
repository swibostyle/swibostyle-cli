import { Command } from "commander";
import ora from "ora";
import pc from "picocolors";
import * as path from "node:path";
import * as fs from "node:fs";

// Type definitions for optional dependencies
type RenderPDF = (serverUrl: string, options?: { timeout?: number }) => Promise<Uint8Array>;
type CloseBrowser = () => Promise<void>;
type CreateApp = (bookPath: string) => { fetch: (req: Request) => Response | Promise<Response> };

export const pdfCommand = new Command("pdf")
  .description("Generate PDF from EPUB build (requires @swibostyle/pdf-renderer)")
  .option("-b, --build <dir>", "EPUB build directory", "./_build")
  .option("-o, --output <file>", "Output PDF file", "./output.pdf")
  .option("-t, --timeout <ms>", "Render timeout in milliseconds", "120000")
  .option("-p, --port <port>", "Port for internal pdf-server", "13370")
  .action(async (options) => {
    const spinner = ora("Initializing PDF renderer...").start();

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
      const buildPath = path.resolve(options.build);
      const outputPath = path.resolve(options.output);
      const timeout = parseInt(options.timeout, 10);
      const port = parseInt(options.port, 10);

      // Verify build directory exists
      if (!fs.existsSync(buildPath)) {
        spinner.fail(pc.red(`Build directory not found: ${buildPath}`));
        console.log();
        console.log(pc.yellow("Run 'swibostyle build' first to create the EPUB build."));
        process.exit(1);
      }

      // Verify OPF file exists
      const opfPath = path.join(buildPath, "item", "standard.opf");
      if (!fs.existsSync(opfPath)) {
        spinner.fail(pc.red(`Not a valid EPUB build: ${buildPath}`));
        console.log(pc.dim(`Expected OPF file at: ${opfPath}`));
        process.exit(1);
      }

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

      spinner.text = "Starting internal pdf-server...";

      // Start internal server
      // @ts-expect-error - Dynamic import
      const honoServer = await import("@hono/node-server").catch(() => null);
      if (!honoServer) {
        spinner.fail(pc.red("@hono/node-server is not available"));
        process.exit(1);
      }

      const app = createApp(buildPath);
      const server = honoServer.serve({
        fetch: app.fetch,
        port,
      });

      const serverUrl = `http://localhost:${port}`;

      try {
        spinner.text = `Rendering PDF from ${path.basename(buildPath)}...`;

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
    }
  });
