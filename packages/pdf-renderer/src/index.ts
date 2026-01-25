#!/usr/bin/env node

/**
 * @swibostyle/pdf-renderer
 *
 * PDF renderer for swibostyle using Playwright.
 * Connects to a pdf-server instance to render PDFs.
 *
 * Usage:
 *   swibostyle-pdf-renderer --server <url> --output <path>
 *   swibostyle-pdf-renderer --book <path> --output <path>
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { renderPDF, closeBrowser } from "./renderer";

// Re-export for library usage
export { renderPDF, closeBrowser, type RenderOptions } from "./renderer";

interface CLIOptions {
  server?: string;
  bookPath?: string;
  output: string;
  port: number;
  timeout: number;
}

function printUsage() {
  console.log(`
Usage: swibostyle-pdf-renderer [options]

Options:
  --server, -s <url>    URL of running pdf-server (e.g., http://localhost:3000)
  --book, -b <path>     Path to EPUB build directory (starts pdf-server automatically)
  --output, -o <path>   Output PDF file path (required)
  --port, -p <port>     Port for auto-started pdf-server (default: 13370)
  --timeout, -t <ms>    Render timeout in milliseconds (default: 120000)
  --help, -h            Show this help message

Examples:
  # Connect to running pdf-server
  swibostyle-pdf-renderer --server http://localhost:3000 --output book.pdf

  # Auto-start pdf-server with book path
  swibostyle-pdf-renderer --book ./_build --output book.pdf
`);
}

function parseArgs(args: string[]): CLIOptions | null {
  let server: string | undefined;
  let bookPath: string | undefined;
  let output: string | undefined;
  let port = 13370;
  let timeout = 120000;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--server" || arg === "-s") {
      server = args[++i];
      continue;
    }

    if (arg === "--book" || arg === "-b") {
      bookPath = args[++i];
      continue;
    }

    if (arg === "--output" || arg === "-o") {
      output = args[++i];
      continue;
    }

    if (arg === "--port" || arg === "-p") {
      const portStr = args[++i];
      if (portStr) {
        port = parseInt(portStr, 10);
      }
      continue;
    }

    if (arg === "--timeout" || arg === "-t") {
      const timeoutStr = args[++i];
      if (timeoutStr) {
        timeout = parseInt(timeoutStr, 10);
      }
      continue;
    }

    if (arg.startsWith("-")) {
      console.error(`Error: Unknown option: ${arg}`);
      return null;
    }
  }

  if (!output) {
    console.error("Error: --output is required");
    return null;
  }

  if (!server && !bookPath) {
    console.error("Error: Either --server or --book is required");
    return null;
  }

  return { server, bookPath, output, port, timeout };
}

/**
 * Start pdf-server as child process
 */
async function startServer(bookPath: string, port: number): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    // Try to find pdf-server binary
    const serverBin = findPdfServerBin();
    if (!serverBin) {
      reject(new Error("pdf-server not found. Install @swibostyle/pdf-server package."));
      return;
    }

    console.log(`Starting pdf-server on port ${port}...`);

    const child = spawn("node", [serverBin, bookPath, "--port", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let started = false;

    child.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      if (!started && text.includes("Starting server on")) {
        started = true;
        // Give server a moment to fully start
        setTimeout(() => resolve(child), 500);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      console.error(`pdf-server stderr: ${data}`);
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to start pdf-server: ${err.message}`));
    });

    child.on("exit", (code) => {
      if (!started) {
        reject(new Error(`pdf-server exited with code ${code}`));
      }
    });

    // Timeout for server start
    setTimeout(() => {
      if (!started) {
        child.kill();
        reject(new Error("Timeout waiting for pdf-server to start"));
      }
    }, 10000);
  });
}

/**
 * Find pdf-server binary
 */
function findPdfServerBin(): string | null {
  // Check common locations
  const candidates = [
    // Same node_modules
    path.resolve(__dirname, "../../pdf-server/dist/index.js"),
    // Global or local node_modules
    require.resolve("@swibostyle/pdf-server/dist/index.js", { paths: [process.cwd()] }),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Continue to next candidate
    }
  }

  return null;
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const options = parseArgs(args);
  if (!options) {
    printUsage();
    process.exit(1);
  }

  let serverProcess: ChildProcess | null = null;
  let serverUrl = options.server;

  try {
    // Start server if book path provided
    if (options.bookPath) {
      serverProcess = await startServer(options.bookPath, options.port);
      serverUrl = `http://localhost:${options.port}`;
    }

    if (!serverUrl) {
      throw new Error("No server URL available");
    }

    // Render PDF
    const pdf = await renderPDF(serverUrl, { timeout: options.timeout });

    // Ensure output directory exists
    const outputDir = path.dirname(options.output);
    if (outputDir && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write PDF
    fs.writeFileSync(options.output, pdf);
    console.log(`PDF saved to: ${options.output}`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    // Cleanup
    await closeBrowser();

    if (serverProcess) {
      console.log("Stopping pdf-server...");
      serverProcess.kill();
    }
  }
}

main();
