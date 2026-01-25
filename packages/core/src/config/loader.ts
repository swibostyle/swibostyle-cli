import type { StorageAdapter } from "../adapters/storage/interface";
import type { BookConfig } from "../types";
import type { UserConfig, ResolvedConfig, ConfigExport } from "./types";
import { resolveConfig, resolveConfigExport } from "./define";

/**
 * Load book configuration from book.json
 */
export async function loadBookConfig(
  storage: StorageAdapter,
  configPath: string,
): Promise<BookConfig> {
  const content = await storage.readTextFile(configPath);

  // Support JSON with comments (simple strip)
  const jsonContent = stripJsonComments(content);
  const config = JSON.parse(jsonContent) as BookConfig;

  // Validate required fields
  validateBookConfig(config);

  return config;
}

/**
 * Configuration file names to search for (in priority order)
 */
const CONFIG_FILES = [
  "book.config.ts",
  "book.config.js",
  "book.config.mts",
  "book.config.mjs",
  "book.json",
] as const;

/**
 * Find the configuration file in the project root
 */
export async function findConfigFile(
  storage: StorageAdapter,
  projectRoot: string,
): Promise<{ path: string; type: "ts" | "json" } | null> {
  for (const fileName of CONFIG_FILES) {
    const filePath = `${projectRoot}/${fileName}`;
    try {
      const exists = await storage.exists(filePath);
      if (exists) {
        const type = fileName.endsWith(".json") ? "json" : "ts";
        return { path: filePath, type };
      }
    } catch {
      // File doesn't exist, continue
    }
  }
  return null;
}

/**
 * Load TypeScript/JavaScript configuration file
 */
async function loadTSConfig(configPath: string): Promise<ConfigExport> {
  // Bun and modern Node.js can import .ts files directly
  // For Node.js without native TS support, we rely on tsx or ts-node
  try {
    const module = await import(configPath);
    return module.default as ConfigExport;
  } catch (error) {
    throw new Error(
      `Failed to load config file: ${configPath}\n` +
        `Make sure you're running with Bun or have tsx/ts-node installed.\n` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Load and resolve configuration from book.config.ts or book.json
 *
 * @example
 * ```ts
 * const config = await loadConfig(storage, "/path/to/project");
 *
 * // Access book metadata
 * console.log(config.book.title);
 *
 * // Use plugins
 * for (const plugin of config.markdownPlugins) {
 *   content = await plugin.beforeProcess?.(content, ctx) ?? content;
 * }
 * ```
 */
export async function loadConfig(
  storage: StorageAdapter,
  projectRoot: string,
): Promise<ResolvedConfig> {
  const configFile = await findConfigFile(storage, projectRoot);

  if (!configFile) {
    throw new Error(
      `No configuration file found in ${projectRoot}.\n` +
        `Create one of: ${CONFIG_FILES.join(", ")}`,
    );
  }

  if (configFile.type === "json") {
    // Legacy book.json support
    const bookConfig = await loadBookConfig(storage, configFile.path);
    return resolveConfig(userConfigFromBookConfig(bookConfig));
  }

  // Load TypeScript/JavaScript config
  const configExport = await loadTSConfig(configFile.path);
  return resolveConfigExport(configExport);
}

/**
 * Convert legacy BookConfig to UserConfig
 */
function userConfigFromBookConfig(book: BookConfig): UserConfig {
  return {
    title: book.title,
    titleSortKey: book.titleSortKey,
    authors: book.authors,
    publisher: book.publisher,
    publisherSortKey: book.publisherSortKey,
    lang: book.lang,
    bookId: book.bookId,
    layout: book.layout,
    pageDirection: book.pageDirection,
    primaryWritingMode: book.primaryWritingMode,
    orientation: book.orientation,
    spread: book.spread,
    cover: book.cover,
    bookType: book.bookType,
    originalResolution: book.originalResolution,
    targets: book.targets,
  };
}

/**
 * Strip comments from JSON (simple implementation)
 */
function stripJsonComments(json: string): string {
  // Remove single-line comments
  let result = json.replace(/\/\/.*$/gm, "");
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  return result;
}

/**
 * Validate book configuration
 */
function validateBookConfig(config: unknown): asserts config is BookConfig {
  if (typeof config !== "object" || config === null) {
    throw new Error("Invalid book configuration: must be an object");
  }

  const c = config as Record<string, unknown>;

  if (typeof c.title !== "string" || c.title.length === 0) {
    throw new Error("Invalid book configuration: title is required");
  }

  if (!Array.isArray(c.authors) || c.authors.length === 0) {
    throw new Error("Invalid book configuration: authors is required");
  }

  if (typeof c.publisher !== "string") {
    throw new Error("Invalid book configuration: publisher is required");
  }

  if (typeof c.lang !== "string") {
    throw new Error("Invalid book configuration: lang is required");
  }

  if (typeof c.bookId !== "object" || c.bookId === null) {
    throw new Error("Invalid book configuration: bookId is required");
  }
}

/**
 * Get default book configuration
 */
export function getDefaultBookConfig(): Partial<BookConfig> {
  return {
    layout: "reflowable",
    pageDirection: "ltr",
    primaryWritingMode: "horizontal-tb",
    targets: {
      // Default target: epub with image resizing enabled
      epub: { enableImageResizing: true },
    },
  };
}
