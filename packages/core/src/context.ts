import type { BuildContext, BuildContextOptions, NodeContextOptions } from './builder/context.js';
import { getDefaultPaths } from './builder/context.js';
import { NodeStorageAdapter } from './adapters/storage/node.js';
import { SharpImageAdapter } from './adapters/image/sharp.js';
import { SassAdapter } from './adapters/css/sass.js';
import { loadBookConfig } from './config/loader.js';
import type { BookConfig } from './types.js';

/**
 * Create a build context for Node.js/Bun environment
 */
export async function createNodeContext(options: NodeContextOptions): Promise<BuildContext> {
  const srcDir = options.srcDir ?? './src';
  const buildDir = options.buildDir ?? './_build';
  const releaseDir = options.releaseDir ?? './_release';

  const storage = new NodeStorageAdapter();
  const imageAdapter = new SharpImageAdapter();
  const cssAdapter = new SassAdapter();

  // Load config
  let config: BookConfig;
  if (typeof options.config === 'string') {
    config = await loadBookConfig(storage, options.config);
  } else if (options.config) {
    config = options.config;
  } else {
    config = await loadBookConfig(storage, `${srcDir}/book.json`);
  }

  return {
    storage,
    imageAdapter,
    cssAdapter,
    paths: getDefaultPaths(srcDir, buildDir, releaseDir),
    config,
    logger: options.logger,
    onProgress: options.onProgress,
  };
}

/**
 * Create a build context with custom adapters
 */
export function createBuildContext(options: BuildContextOptions): BuildContext {
  const srcDir = options.paths?.src ?? './src';
  const buildDir = options.paths?.build ?? './_build';
  const releaseDir = options.paths?.release ?? './_release';

  return {
    storage: options.storage,
    imageAdapter: options.imageAdapter,
    cssAdapter: options.cssAdapter,
    paths: {
      ...getDefaultPaths(srcDir, buildDir, releaseDir),
      ...options.paths,
    },
    config: options.config,
    logger: options.logger,
    onProgress: options.onProgress,
  };
}
