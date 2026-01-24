import * as path from "node:path";
import { Command } from "commander";
import ora from "ora";
import pc from "picocolors";
import {
  buildSSG,
  loadBookConfig,
  NodeStorageAdapter,
  SharpImageAdapter,
  SassAdapter,
} from "@swibostyle/core";
import type { BuildTargetType } from "@swibostyle/core";
import { createLogger } from "../ui/logger.js";

export const buildCommand = new Command("build")
  .description("Build EPUB from source files")
  .option("-t, --target <type>", "Build target (epub, print, pod)", "epub")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    const spinner = ora("Initializing...").start();
    const startTime = Date.now();

    try {
      const target = options.target as BuildTargetType;

      // Validate target
      if (!["epub", "print", "pod"].includes(target)) {
        spinner.fail(pc.red(`Invalid target: ${target}`));
        process.exit(1);
      }

      // Create adapters
      const storage = new NodeStorageAdapter();
      const imageAdapter = new SharpImageAdapter();
      const cssAdapter = new SassAdapter();

      // Resolve project root
      const projectRoot = process.cwd();
      const srcDir = path.join(projectRoot, "src");
      const buildDir = path.join(projectRoot, "_build");

      // Create logger
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

      spinner.text = "Loading configuration...";

      // Load book config
      const book = await loadBookConfig(storage, path.join(projectRoot, "book.json"));

      spinner.text = `Building ${pc.cyan(target)}...`;

      // Run SSG build
      const result = await buildSSG({
        storage,
        imageAdapter,
        cssAdapter,
        projectRoot,
        srcDir,
        buildDir,
        book,
        target,
        logger,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      spinner.succeed(pc.green(`Build complete: ${pc.bold(result.outputPath)} (${elapsed}s)`));

      // Summary
      const xhtmlCount = result.routes.filter((r) => r.type === "xhtml").length;
      const imageCount = result.routes.filter((r) => r.type === "image").length;

      console.log(pc.dim(`  ${xhtmlCount} pages, ${imageCount} images`));
    } catch (error) {
      spinner.fail(pc.red("Build failed"));
      console.error(pc.red(error instanceof Error ? error.message : String(error)));
      if (options.verbose && error instanceof Error && error.stack) {
        console.error(pc.dim(error.stack));
      }
      process.exit(1);
    }
  });
