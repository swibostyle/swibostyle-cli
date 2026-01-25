import * as path from "node:path";
import { Command } from "commander";
import ora from "ora";
import pc from "picocolors";
import {
  buildSSG,
  loadConfig,
  NodeStorageAdapter,
  JimpImageAdapter,
  SharpImageAdapter,
  NoopImageAdapter,
  isJimpAvailable,
  isSharpAvailable,
  SassAdapter,
} from "@swibostyle/core";
import type { BuildTargetType, ResolvedConfig, SassAdapterOptions } from "@swibostyle/core";
import { createLogger } from "../ui/logger";

export const buildCommand = new Command("build")
  .description("Build EPUB from source files")
  .option("-t, --target <name>", "Build target name (default: epub)", "epub")
  .option("-v, --verbose", "Verbose output")
  .option("--skip-validation", "Skip EPUB validation after build")
  .action(async (options) => {
    const spinner = ora("Initializing...").start();
    const startTime = Date.now();

    try {
      const target = options.target as BuildTargetType;

      // Validate target name (must be non-empty)
      if (!target || target.trim().length === 0) {
        spinner.fail(pc.red("Invalid target: target name cannot be empty"));
        process.exit(1);
      }

      // Resolve project root
      const projectRoot = process.cwd();
      const srcDir = path.join(projectRoot, "src");
      const buildDir = path.join(projectRoot, "_build");

      // Create storage adapter (needed to load config)
      const storage = new NodeStorageAdapter();

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

      // Load configuration (supports both book.config.ts and book.json)
      const config = await loadConfig(storage, projectRoot);

      // Create adapters (with configuration)
      const imageAdapter = await resolveImageAdapter(config);
      const cssAdapter = await resolveCSSAdapter(config);

      // Call beforeBuild hook
      if (config.hooks.beforeBuild) {
        await config.hooks.beforeBuild({ book: config.book, target, logger });
      }

      spinner.text = `Building ${pc.cyan(target)}...`;

      // Run SSG build
      const result = await buildSSG({
        storage,
        imageAdapter,
        cssAdapter,
        projectRoot,
        srcDir,
        buildDir,
        book: config.book,
        target,
        logger,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      spinner.succeed(pc.green(`Build complete: ${pc.bold(result.outputPath)} (${elapsed}s)`));

      // Summary
      const xhtmlCount = result.routes.filter((r) => r.type === "xhtml").length;
      const imageCount = result.routes.filter((r) => r.type === "image").length;

      console.log(pc.dim(`  ${xhtmlCount} pages, ${imageCount} images`));

      // Run validators (unless skipped)
      const skipValidation = options.skipValidation || config.skipValidation;
      if (!skipValidation && config.validators.length > 0 && result.outputPath) {
        spinner.start("Validating EPUB...");

        let hasErrors = false;
        for (const validatorFactory of config.validators) {
          const validator = await validatorFactory();
          const validationResult = await validator.validate(result.outputPath, {
            onProgress: (msg) => {
              spinner.text = `Validating (${validator.name}): ${msg}`;
            },
          });

          if (!validationResult.valid) {
            hasErrors = true;
            spinner.fail(pc.red(`Validation failed (${validator.name})`));

            for (const error of validationResult.errors) {
              const location = error.location
                ? ` at ${error.location.path}:${error.location.line ?? "?"}`
                : "";
              console.error(pc.red(`  [${error.id}] ${error.message}${location}`));
            }
          }

          for (const warning of validationResult.warnings) {
            const location = warning.location
              ? ` at ${warning.location.path}:${warning.location.line ?? "?"}`
              : "";
            console.warn(pc.yellow(`  [${warning.id}] ${warning.message}${location}`));
          }
        }

        if (!hasErrors) {
          spinner.succeed(pc.green("Validation passed"));
        }
      }

      // Call afterBuild hook
      if (config.hooks.afterBuild && result.outputPath) {
        await config.hooks.afterBuild({ book: config.book, target, logger }, result.outputPath);
      }
    } catch (error) {
      spinner.fail(pc.red("Build failed"));
      console.error(pc.red(error instanceof Error ? error.message : String(error)));
      if (options.verbose && error instanceof Error && error.stack) {
        console.error(pc.dim(error.stack));
      }
      process.exit(1);
    }
  });

/**
 * Resolve image adapter from config
 * Priority: Jimp (pure JS, works in compiled binary) > Sharp (native, faster) > Noop (fallback)
 */
async function resolveImageAdapter(config: ResolvedConfig) {
  const adapterConfig = config.adapters.image;

  // If it's already an adapter instance
  if (adapterConfig && typeof adapterConfig === "object" && "getSize" in adapterConfig) {
    return adapterConfig;
  }

  // If it's a factory function
  if (typeof adapterConfig === "function") {
    return adapterConfig();
  }

  // Default: try Jimp first (pure JS, works in compiled binary)
  if (await isJimpAvailable()) {
    return new JimpImageAdapter();
  }

  // Fallback to Sharp if available
  if (await isSharpAvailable()) {
    return new SharpImageAdapter();
  }

  // Last resort: NoopImageAdapter (no image processing)
  console.warn(
    "[warn] No image adapter available, using NoopImageAdapter (image processing disabled)",
  );
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

  // If it's already an adapter instance
  if (typeof adapterConfig === "object" && "process" in adapterConfig) {
    return adapterConfig;
  }

  // If it's a factory function
  if (typeof adapterConfig === "function") {
    return adapterConfig();
  }

  // It's options for the SassAdapter
  return new SassAdapter(adapterConfig as SassAdapterOptions);
}
