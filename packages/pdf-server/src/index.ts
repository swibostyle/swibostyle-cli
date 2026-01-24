#!/usr/bin/env node

/**
 * @swibostyle/pdf-server
 *
 * PDF generation server for swibostyle.
 * This package is licensed under AGPL-3.0 due to Vivliostyle dependency.
 */

import { serve } from "@hono/node-server";
import { createApp } from "./server";

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
