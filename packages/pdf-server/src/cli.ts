#!/usr/bin/env node

/**
 * @swibostyle/pdf-server CLI
 *
 * Command-line interface for the Vivliostyle Viewer server.
 *
 * Usage:
 *   swibostyle-pdf-server <book-path> [--port <port>]
 *
 * Example:
 *   swibostyle-pdf-server ./_build --port 3000
 */

import { serve } from "@hono/node-server";
import { createApp } from "./server";

function printUsage() {
  console.log(`
Usage: swibostyle-pdf-server <book-path> [options]

Arguments:
  book-path    Path to EPUB build directory (containing item/standard.opf)

Options:
  --port, -p   Port number (default: 3000)
  --help, -h   Show this help message

Example:
  swibostyle-pdf-server ./_build --port 3000
  swibostyle-pdf-server /path/to/epub/build
`);
}

function parseArgs(args: string[]): { bookPath: string; port: number } | null {
  let bookPath: string | null = null;
  let port = 3000;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--port" || arg === "-p") {
      const portStr = args[++i];
      if (!portStr) {
        console.error("Error: --port requires a value");
        return null;
      }
      port = parseInt(portStr, 10);
      if (isNaN(port)) {
        console.error(`Error: Invalid port number: ${portStr}`);
        return null;
      }
      continue;
    }

    if (arg.startsWith("-")) {
      console.error(`Error: Unknown option: ${arg}`);
      return null;
    }

    if (!bookPath) {
      bookPath = arg;
    }
  }

  if (!bookPath) {
    console.error("Error: book-path is required");
    return null;
  }

  return { bookPath, port };
}

// CLI entry point
const args = process.argv.slice(2);

if (args.length === 0) {
  printUsage();
  process.exit(1);
}

const parsed = parseArgs(args);
if (!parsed) {
  printUsage();
  process.exit(1);
}

const { bookPath, port } = parsed;

try {
  const app = createApp(bookPath);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  swibostyle PDF Server (Vivliostyle Viewer)                   ║
║                                                               ║
║  This software is licensed under AGPL-3.0                     ║
║  due to Vivliostyle Viewer dependency.                        ║
╚═══════════════════════════════════════════════════════════════╝
`);

  console.log(`Book path: ${bookPath}`);
  console.log(`Starting server on http://localhost:${port}`);
  console.log(`Open in browser to preview the book.\n`);

  serve({
    fetch: app.fetch,
    port,
  });
} catch (error) {
  console.error("Error:", error instanceof Error ? error.message : error);
  process.exit(1);
}
