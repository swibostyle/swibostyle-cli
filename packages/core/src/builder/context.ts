import type { StorageAdapter } from '../adapters/storage/interface.js';
import type { ImageAdapter } from '../adapters/image/interface.js';
import type { CSSAdapter } from '../adapters/css/interface.js';
import type { BookConfig, Logger, PathConfig, ProgressCallback } from '../types.js';

/**
 * Build context containing all dependencies and configuration
 */
export interface BuildContext {
  /** Storage adapter for file operations */
  storage: StorageAdapter;
  /** Image adapter for image processing */
  imageAdapter: ImageAdapter;
  /** CSS adapter for CSS processing */
  cssAdapter: CSSAdapter;
  /** Path configuration */
  paths: PathConfig;
  /** Book configuration */
  config: BookConfig;
  /** Logger instance (optional) */
  logger?: Logger;
  /** Progress callback (optional) */
  onProgress?: ProgressCallback;
}

/**
 * Options for creating a build context with custom adapters
 */
export interface BuildContextOptions {
  storage: StorageAdapter;
  imageAdapter: ImageAdapter;
  cssAdapter: CSSAdapter;
  paths?: Partial<PathConfig>;
  config: BookConfig;
  logger?: Logger;
  onProgress?: ProgressCallback;
}

/**
 * Options for creating a Node.js build context
 */
export interface NodeContextOptions {
  /** Source directory (default: './src') */
  srcDir?: string;
  /** Build directory (default: './_build') */
  buildDir?: string;
  /** Release directory (default: './_release') */
  releaseDir?: string;
  /** Book configuration (or path to book.json) */
  config?: BookConfig | string;
  /** Logger instance */
  logger?: Logger;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Default path configuration
 */
export function getDefaultPaths(srcDir: string, buildDir: string, releaseDir: string): PathConfig {
  return {
    src: srcDir,
    build: buildDir,
    release: releaseDir,
    markdown: `${srcDir}/markdown`,
    styles: `${srcDir}/style`,
    images: `${srcDir}/image`,
    templates: `${srcDir}/templates`,
    metaInf: `${srcDir}/META-INF`,
  };
}

/**
 * Build paths for the build directory structure
 */
export interface BuildPaths {
  root: string;
  metaInf: string;
  item: string;
  styles: string;
  images: string;
  xhtml: string;
}

/**
 * Get build directory paths
 */
export function getBuildPaths(buildDir: string): BuildPaths {
  return {
    root: buildDir,
    metaInf: `${buildDir}/META-INF`,
    item: `${buildDir}/item`,
    styles: `${buildDir}/item/style`,
    images: `${buildDir}/item/image`,
    xhtml: `${buildDir}/item/xhtml`,
  };
}
