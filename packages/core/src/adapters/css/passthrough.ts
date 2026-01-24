import type { CSSAdapter, CSSInput, CSSOutput } from "./interface.js";

/**
 * Pass-through CSS adapter that performs no processing.
 * Useful for pre-processed CSS or when no CSS processing is needed.
 */
export class PassthroughCSSAdapter implements CSSAdapter {
  async process(input: CSSInput): Promise<CSSOutput> {
    return {
      css: input.content,
      sourceMap: undefined,
      dependencies: input.path ? [input.path] : [],
    };
  }
}
