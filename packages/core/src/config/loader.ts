import type { StorageAdapter } from "../adapters/storage/interface.js";
import type { BookConfig } from "../types.js";

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
      epub: { css: "epub.scss", enableImageResizing: true },
      print: { css: "print.scss", enableImageResizing: false },
      pod: { css: "pod.scss", enableImageResizing: false },
    },
  };
}
