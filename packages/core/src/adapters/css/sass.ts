import * as path from "node:path";
import type { CSSAdapter, CSSInput, CSSOutput } from "./interface";

/**
 * Sass adapter options
 */
export interface SassAdapterOptions {
  /** Output style (default: "expanded") */
  style?: "expanded" | "compressed";
  /** Additional load paths for @import resolution */
  loadPaths?: string[];
  /** Enable source maps (default: false) */
  sourceMap?: boolean;
}

/**
 * Sass-based CSS adapter
 */
export class SassAdapter implements CSSAdapter {
  private sass: typeof import("sass") | null = null;
  private options: SassAdapterOptions;

  constructor(options: SassAdapterOptions = {}) {
    this.options = options;
  }

  private async getSass(): Promise<typeof import("sass")> {
    if (!this.sass) {
      this.sass = await import("sass");
    }
    return this.sass;
  }

  async process(input: CSSInput): Promise<CSSOutput> {
    const sass = await this.getSass();

    const loadPaths = [
      ...(input.path ? [path.dirname(input.path)] : []),
      ...(this.options.loadPaths ?? []),
    ];

    const result = sass.compileString(input.content, {
      style: this.options.style ?? "expanded",
      sourceMap: input.sourceMap ?? this.options.sourceMap ?? false,
      loadPaths,
    });

    return {
      css: result.css,
      sourceMap: result.sourceMap ? JSON.stringify(result.sourceMap) : undefined,
      dependencies: result.loadedUrls
        .map((url) => url.pathname)
        .filter((p): p is string => p !== null),
    };
  }

  async resolveDependencies(entryPath: string): Promise<string[]> {
    const sass = await this.getSass();

    try {
      const result = sass.compile(entryPath, {
        style: this.options.style ?? "expanded",
        loadPaths: this.options.loadPaths,
      });

      return result.loadedUrls.map((url) => url.pathname).filter((p): p is string => p !== null);
    } catch {
      return [entryPath];
    }
  }
}
