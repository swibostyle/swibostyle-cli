/**
 * CSS processing input
 */
export interface CSSInput {
  /** CSS/SCSS content */
  content: string;
  /** File path (for resolving imports) */
  path?: string;
  /** Generate source map */
  sourceMap?: boolean;
}

/**
 * CSS processing output
 */
export interface CSSOutput {
  /** Processed CSS */
  css: string;
  /** Source map (if requested) */
  sourceMap?: string;
  /** List of dependencies (imported files) */
  dependencies?: string[];
}

/**
 * CSS adapter interface for abstracting CSS processing.
 * Implementations can use Sass, PostCSS, or pass-through.
 */
export interface CSSAdapter {
  /**
   * Process CSS/SCSS content
   */
  process(input: CSSInput): Promise<CSSOutput>;

  /**
   * Resolve dependencies (optional)
   */
  resolveDependencies?(entryPath: string): Promise<string[]>;
}
