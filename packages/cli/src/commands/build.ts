import { Command } from "commander";
import ora from "ora";
import pc from "picocolors";
import { createNodeContext, build } from "@swibostyle/core";
import type { BuildTargetType, ProgressEvent } from "@swibostyle/core";
import { createLogger } from "../ui/logger.js";

export const buildCommand = new Command("build")
  .description("Build EPUB from source files")
  .option("-t, --target <type>", "Build target (epub, print, pod)", "epub")
  .option("-s, --src <dir>", "Source directory", "./src")
  .option("-o, --output <dir>", "Output directory", "./_release")
  .option("-b, --build-dir <dir>", "Build directory", "./_build")
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

      // Create logger
      const logger = options.verbose ? createLogger() : undefined;

      // Progress handler
      const onProgress = (event: ProgressEvent) => {
        const phaseNames: Record<string, string> = {
          clean: "Cleaning",
          copy: "Copying files",
          css: "Processing CSS",
          image: "Processing images",
          markdown: "Processing markdown",
          opf: "Generating OPF",
          navigation: "Generating navigation",
          archive: "Creating archive",
        };

        const phaseName = phaseNames[event.phase] ?? event.phase;
        const progress = event.total > 0 ? ` (${event.current}/${event.total})` : "";
        const message = event.message ? `: ${event.message}` : "";

        spinner.text = `${phaseName}${progress}${message}`;
      };

      spinner.text = "Loading configuration...";

      // Create context
      const ctx = await createNodeContext({
        srcDir: options.src,
        buildDir: options.buildDir,
        releaseDir: options.output,
        logger,
        onProgress,
      });

      spinner.text = `Building ${pc.cyan(target)}...`;

      // Run build
      const result = await build(ctx, { target });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      spinner.succeed(pc.green(`Build complete: ${pc.bold(result.outputPath)} (${elapsed}s)`));

      // Summary
      const xhtmlCount = result.contents.filter((c) => c.type === "xhtml").length;
      const imageCount = result.contents.filter((c) => c.type === "image").length;

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
