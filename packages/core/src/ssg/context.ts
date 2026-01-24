/**
 * SSG Context implementation
 *
 * The context object passed to route handlers.
 */

import type { BookConfig, BuildTargetType } from "../types.js";
import type { SSGContext, SSGResponse, RouteInfo, ImageInfo } from "./types.js";

/**
 * Options for creating an SSG context
 */
export interface SSGContextOptions {
  /** Book configuration */
  book: BookConfig;
  /** Build target */
  target: BuildTargetType;
  /** Current route path */
  path: string;
  /** All registered routes */
  routes: RouteInfo[];
  /** Pre-loaded image info map (path -> ImageInfo) */
  imageInfoMap: Map<string, ImageInfo>;
  /** Source file content (for file-based handlers) */
  file?: Uint8Array;
}

/**
 * Escape HTML/XML special characters
 */
function escapeXml(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Raw string wrapper to skip escaping
 */
export class RawString {
  constructor(public readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

/**
 * Mark a string as raw (no escaping)
 */
export function raw(value: string): RawString {
  return new RawString(value);
}

/**
 * Process template literal with values
 */
function processTemplate(
  strings: TemplateStringsArray,
  values: unknown[],
  escape: boolean = true,
): string {
  let result = "";
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      const value = values[i];
      // Don't escape RawString values
      if (value instanceof RawString) {
        result += value.value;
      } else if (escape) {
        result += escapeXml(value);
      } else {
        result += String(value ?? "");
      }
    }
  }
  return result;
}

/**
 * Normalize image path for lookup
 */
function normalizeImagePath(imagePath: string): string {
  let path = imagePath;

  // Handle relative paths like "../image/cover.jpg" or "./image/cover.jpg"
  if (path.startsWith("../")) {
    path = path.replace(/^\.\.\//, "");
  } else if (path.startsWith("./")) {
    path = path.replace(/^\.\//, "");
  }

  // Normalize to just the filename if it starts with "image/"
  if (path.startsWith("image/")) {
    path = path.substring(6); // Remove "image/"
  }

  return path;
}

/**
 * Create an SSG context for a route handler
 */
export function createSSGContext(options: SSGContextOptions): SSGContext {
  const { book, target, path, routes, imageInfoMap, file } = options;

  const context: SSGContext = {
    book,
    target,
    path,
    routes,
    file,

    xml(strings: TemplateStringsArray, ...values: unknown[]): SSGResponse {
      return {
        type: "xml",
        content: processTemplate(strings, values, true),
      };
    },

    html(strings: TemplateStringsArray, ...values: unknown[]): SSGResponse {
      return {
        type: "html",
        content: processTemplate(strings, values, true),
      };
    },

    text(content: string): SSGResponse {
      return {
        type: "text",
        content,
      };
    },

    binary(data: Uint8Array): SSGResponse {
      return {
        type: "binary",
        data,
      };
    },

    notFound(): SSGResponse {
      return {
        type: "notFound",
      };
    },

    getImage(imagePath: string): ImageInfo | null {
      const normalizedPath = normalizeImagePath(imagePath);

      // Look up in pre-loaded image info map
      const info = imageInfoMap.get(normalizedPath);
      if (info) {
        return info;
      }

      // Try with different path variations
      // e.g., "cover.jpg" might be stored as "image/cover.jpg"
      const withPrefix = `image/${normalizedPath}`;
      const infoWithPrefix = imageInfoMap.get(withPrefix);
      if (infoWithPrefix) {
        return infoWithPrefix;
      }

      return null;
    },
  };

  return context;
}
