#!/usr/bin/env node

/**
 * @swibostyle/pdf-server
 *
 * PDF generation server for swibostyle.
 * This package is licensed under AGPL-3.0 due to Vivliostyle dependency.
 */

// Re-export for library usage
export { renderPDF, type RenderOptions } from "./renderer";
export { createApp } from "./server";

// Only start server when run directly as CLI
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("pdf-server") ||
    process.argv[1].endsWith("index.js") ||
    process.argv[1].endsWith("index.ts"));

if (isMain) {
  const { serve } = await import("@hono/node-server");
  const { createApp } = await import("./server");

  const port = parseInt(process.env.PORT || "3000", 10);

  const app = createApp();

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  swibostyle PDF Server                                        ║
║                                                               ║
║  This software is licensed under AGPL-3.0                    ║
║  due to Vivliostyle Viewer dependency.                       ║
╚═══════════════════════════════════════════════════════════════╝
`);

  console.log(`Starting server on http://localhost:${port}`);

  serve({
    fetch: app.fetch,
    port,
  });
}
