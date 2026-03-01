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

export const serveCommand = new Command("serve")
  .description("Build and serve book files over HTTP")
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

      // Build
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
      const server = createStaticServer(serveDir);

      server.listen(port, () => {
        console.log();
        console.log(`  ${pc.bold("swibostyle serve")} ${pc.dim(`v0.1.0`)}`);
        console.log();
        console.log(
          `  ${pc.green("➜")}  ${pc.bold("Local:")}   ${pc.cyan(`http://localhost:${port}/`)}`,
        );
        console.log(pc.dim(`  Serving from ${SERVE_DIR}/`));
        console.log(pc.dim("  Press Ctrl+C to stop."));
        console.log();
      });

      // Graceful shutdown
      const shutdown = () => {
        console.log(pc.dim("\n  Shutting down..."));
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
 * Collect all files recursively under a directory, returning relative paths sorted alphabetically.
 */
function collectFilesRecursively(dir: string, base: string = ""): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const relPath = base ? `${base}/${entry}` : entry;
    if (fs.statSync(fullPath).isDirectory()) {
      results.push(...collectFilesRecursively(fullPath, relPath));
    } else {
      results.push(relPath);
    }
  }
  return results.sort();
}

/**
 * Create a simple static file server
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createStaticServer(serveDir: string): http.Server {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    // Resolve file path
    const filePath = pathname === "/" ? "" : pathname.startsWith("/") ? pathname.slice(1) : pathname;
    const fullPath = pathname === "/" ? serveDir : path.join(serveDir, filePath);

    const corsHeaders = { "Access-Control-Allow-Origin": "*" };

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    // Security: prevent path traversal
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(serveDir))) {
      res.writeHead(403, { "Content-Type": "text/plain", ...corsHeaders });
      res.end("Forbidden");
      return;
    }

    if (!fs.existsSync(resolved)) {
      res.writeHead(404, { "Content-Type": "text/plain", ...corsHeaders });
      res.end(`Not found: ${filePath}`);
      return;
    }

    // Directory listing
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      const isRoot = pathname === "/";
      let links: string;

      if (isRoot) {
        // Root: show all files recursively
        const allFiles = collectFilesRecursively(serveDir);
        links = allFiles
          .map((relPath) => {
            const safeHref = encodeURI(`/${relPath}`);
            const safeLabel = escapeHtml(relPath);
            return `<li><a href="${safeHref}">${safeLabel}</a></li>`;
          })
          .join("\n");
      } else {
        // Subdirectory: show immediate entries
        const entries = fs.readdirSync(resolved);
        links = entries
          .map((entry) => {
            const entryPath = path.join(resolved, entry);
            const isDir = fs.statSync(entryPath).isDirectory();
            const hrefPath = `/${path.relative(serveDir, entryPath)}${isDir ? "/" : ""}`;
            const safeHref = encodeURI(hrefPath);
            const safeLabel = escapeHtml(`${entry}${isDir ? "/" : ""}`);
            return `<li><a href="${safeHref}">${safeLabel}</a></li>`;
          })
          .join("\n");
      }

      const safeFilePath = escapeHtml(filePath || "/");

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", ...corsHeaders });
      res.end(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Index of /${safeFilePath}</title>
<style>body{font-family:monospace;margin:2em}a{text-decoration:none}a:hover{text-decoration:underline}li{padding:2px 0}</style>
</head><body><h1>Index of /${safeFilePath}</h1><ul>${links}</ul></body></html>`);
      return;
    }

    // Serve file
    const content = fs.readFileSync(resolved);
    const contentType = getContentType(resolved);

    res.writeHead(200, {
      "Content-Type": contentType,
      ...corsHeaders,
    });
    res.end(content);
  });
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
