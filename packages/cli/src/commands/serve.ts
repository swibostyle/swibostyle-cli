import * as path from "node:path";
import * as fs from "node:fs";
import * as http from "node:http";
import { Command } from "commander";
import ora from "ora";
import pc from "picocolors";
import {
  buildSSGOutputs,
  loadConfig,
  NodeStorageAdapter,
  JimpImageAdapter,
  SharpImageAdapter,
  NoopImageAdapter,
  isJimpAvailable,
  isSharpAvailable,
  SassAdapter,
  getContentType,
} from "@swibostyle/core";
import type { BuildTargetType, ResolvedConfig, SassAdapterOptions } from "@swibostyle/core";
import { createLogger } from "../ui/logger";

const SERVE_DIR = ".swibostyle/serve";

/** SSE clients waiting for reload events */
const sseClients = new Set<http.ServerResponse>();

/** Reload script injected into XHTML pages for live reload */
const RELOAD_SCRIPT = `<script type="text/javascript"><![CDATA[
(function(){var e=new EventSource("/__sse");e.onmessage=function(){location.reload()};e.onerror=function(){e.close();setTimeout(function(){location.reload()},2000)}})();
]]></script>`;

export const serveCommand = new Command("serve")
  .description("Start a development server with live reload")
  .option("-p, --port <port>", "Server port", "3000")
  .option("-t, --target <name>", "Build target name", "epub")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    const spinner = ora("Initializing...").start();

    try {
      const target = options.target as BuildTargetType;
      const port = parseInt(options.port, 10);

      const projectRoot = process.cwd();
      const srcDir = path.join(projectRoot, "src");
      const serveDir = path.join(projectRoot, SERVE_DIR);

      const storage = new NodeStorageAdapter();

      const logger = options.verbose
        ? createLogger()
        : {
            info: (msg: string) => {
              spinner.text = msg;
            },
            debug: () => {},
            warn: (msg: string) => {
              console.warn(pc.yellow(`[warn] ${msg}`));
            },
            error: (msg: string) => {
              console.error(pc.red(`[error] ${msg}`));
            },
          };

      // Load configuration
      spinner.text = "Loading configuration...";
      const config = await loadConfig(storage, projectRoot);

      // Create adapters
      const imageAdapter = await resolveImageAdapter(config);
      const cssAdapter = await resolveCSSAdapter(config);

      // Initial build
      spinner.text = `Building ${pc.cyan(target)}...`;
      const startTime = Date.now();

      const result = await buildSSGOutputs({
        storage,
        imageAdapter,
        cssAdapter,
        projectRoot,
        srcDir,
        buildDir: serveDir,
        book: config.book,
        target,
        logger,
      });

      // Write outputs to .swibostyle/serve/
      await writeOutputsToDirectory(result.files, serveDir);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const xhtmlCount = result.routes.filter((r) => r.type === "xhtml").length;
      const imageCount = result.routes.filter((r) => r.type === "image").length;

      spinner.succeed(
        pc.green(`Build complete (${elapsed}s) - ${xhtmlCount} pages, ${imageCount} images`),
      );

      // Start HTTP server
      const xhtmlPages = result.routes.filter((r) => r.type === "xhtml");
      const server = createServer(
        serveDir,
        xhtmlPages.map((r) => ({
          path: r.path,
          title: r.metadata.title || r.path,
        })),
      );

      server.listen(port, () => {
        console.log();
        console.log(`  ${pc.bold("swibostyle serve")} ${pc.dim(`v0.1.0`)}`);
        console.log();
        console.log(
          `  ${pc.green("➜")}  ${pc.bold("Local:")}   ${pc.cyan(`http://localhost:${port}/`)}`,
        );
        console.log();
        console.log(pc.dim("  Watching for changes in src/..."));
        console.log(pc.dim("  Press Ctrl+C to stop."));
        console.log();
      });

      // Watch for changes
      let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
      let isRebuilding = false;

      const watcher = fs.watch(srcDir, { recursive: true }, (_event, filename) => {
        if (!filename) return;

        // Ignore hidden files and temp files
        if (filename.startsWith(".") || filename.endsWith("~")) return;

        // Debounce rebuilds
        if (rebuildTimer) clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(async () => {
          if (isRebuilding) return;
          isRebuilding = true;

          const rebuildStart = Date.now();
          console.log(
            pc.dim(`  [${new Date().toLocaleTimeString()}] Change detected: ${filename}`),
          );

          try {
            const newResult = await buildSSGOutputs({
              storage,
              imageAdapter,
              cssAdapter,
              projectRoot,
              srcDir,
              buildDir: serveDir,
              book: config.book,
              target,
              logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
            });

            await writeOutputsToDirectory(newResult.files, serveDir);

            const rebuildElapsed = ((Date.now() - rebuildStart) / 1000).toFixed(2);
            console.log(
              pc.green(`  [${new Date().toLocaleTimeString()}] Rebuilt (${rebuildElapsed}s)`),
            );

            // Notify SSE clients to reload
            notifyReload();
          } catch (error) {
            console.error(
              pc.red(
                `  [${new Date().toLocaleTimeString()}] Rebuild failed: ${error instanceof Error ? error.message : String(error)}`,
              ),
            );
          } finally {
            isRebuilding = false;
          }
        }, 200);
      });

      // Graceful shutdown
      const shutdown = () => {
        console.log(pc.dim("\n  Shutting down..."));
        watcher.close();
        for (const client of sseClients) {
          client.end();
        }
        sseClients.clear();
        server.close(() => process.exit(0));
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    } catch (error) {
      spinner.fail(pc.red("Failed to start serve"));
      console.error(pc.red(error instanceof Error ? error.message : String(error)));
      if (options.verbose && error instanceof Error && error.stack) {
        console.error(pc.dim(error.stack));
      }
      process.exit(1);
    }
  });

/**
 * Write build outputs to a directory on disk
 */
async function writeOutputsToDirectory(
  files: Map<string, Uint8Array>,
  outDir: string,
): Promise<void> {
  // Clean output directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  for (const [filePath, data] of files) {
    const fullPath = path.join(outDir, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, data);
  }
}

/**
 * Create HTTP server for serving build outputs
 */
function createServer(
  serveDir: string,
  pages: Array<{ path: string; title: string }>,
): http.Server {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    // SSE endpoint for live reload
    if (pathname === "/__sse") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write("data: connected\n\n");
      sseClients.add(res);
      req.on("close", () => sseClients.delete(res));
      return;
    }

    // Index page
    if (pathname === "/") {
      const html = generateIndexPage(pages);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    // Serve static files from serveDir
    // Strip leading slash
    const filePath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
    const fullPath = path.join(serveDir, filePath);

    // Security check: prevent path traversal
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(serveDir))) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    if (!fs.existsSync(resolved)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`Not found: ${filePath}`);
      return;
    }

    const content = fs.readFileSync(resolved);
    const contentType = getContentType(resolved);

    // Inject live reload script into XHTML pages
    if (resolved.endsWith(".xhtml")) {
      const text = content.toString("utf-8");
      const injected = text.replace("</body>", `${RELOAD_SCRIPT}</body>`);
      res.writeHead(200, {
        "Content-Type": "application/xhtml+xml; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(injected);
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(content);
  });
}

/**
 * Generate index page listing all XHTML pages
 */
function generateIndexPage(pages: Array<{ path: string; title: string }>): string {
  const pageLinks = pages
    .map(
      (p) =>
        `      <li><a href="/${p.path}">${escapeHtml(p.title)}</a> <span style="color:#888">${escapeHtml(p.path)}</span></li>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>swibostyle serve</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }
    h1 { font-size: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: 8px; }
    ul { list-style: none; padding: 0; }
    li { padding: 6px 0; border-bottom: 1px solid #f5f5f5; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    span { font-size: 0.85em; margin-left: 8px; }
  </style>
</head>
<body>
  <h1>swibostyle serve</h1>
  <p>Pages:</p>
  <ul>
${pageLinks}
  </ul>
  <script>
    var e = new EventSource("/__sse");
    e.onmessage = function() { location.reload(); };
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Notify all SSE clients to reload
 */
function notifyReload(): void {
  for (const client of sseClients) {
    client.write("data: reload\n\n");
  }
}

/**
 * Resolve image adapter from config
 */
async function resolveImageAdapter(config: ResolvedConfig) {
  const adapterConfig = config.adapters.image;

  if (adapterConfig && typeof adapterConfig === "object" && "getSize" in adapterConfig) {
    return adapterConfig;
  }

  if (typeof adapterConfig === "function") {
    return adapterConfig();
  }

  if (await isJimpAvailable()) {
    return new JimpImageAdapter();
  }

  if (await isSharpAvailable()) {
    return new SharpImageAdapter();
  }

  return new NoopImageAdapter();
}

/**
 * Resolve CSS adapter from config
 */
async function resolveCSSAdapter(config: ResolvedConfig) {
  const adapterConfig = config.adapters.css;

  if (!adapterConfig) {
    return new SassAdapter();
  }

  if (typeof adapterConfig === "object" && "process" in adapterConfig) {
    return adapterConfig;
  }

  if (typeof adapterConfig === "function") {
    return adapterConfig();
  }

  return new SassAdapter(adapterConfig as SassAdapterOptions);
}
