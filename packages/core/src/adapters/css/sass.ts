import * as path from "node:path";
import type { CSSAdapter, CSSInput, CSSOutput } from "./interface.js";

/**
 * Sass-based CSS adapter
 */
export class SassAdapter implements CSSAdapter {
  private sass: typeof import("sass") | null = null;

  private async getSass(): Promise<typeof import("sass")> {
    if (!this.sass) {
      this.sass = await import("sass");
    }
    return this.sass;
  }

  async process(input: CSSInput): Promise<CSSOutput> {
    const sass = await this.getSass();

    const result = sass.compileString(input.content, {
      style: "expanded",
      sourceMap: input.sourceMap ?? false,
      loadPaths: input.path ? [path.dirname(input.path)] : [],
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
        style: "expanded",
      });

      return result.loadedUrls.map((url) => url.pathname).filter((p): p is string => p !== null);
    } catch {
      return [entryPath];
    }
  }
}
