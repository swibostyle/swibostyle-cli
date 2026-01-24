import type { BuildContext } from '../builder/context.js';
import { getBuildPaths } from '../builder/context.js';
import type { BuildTargetType } from '../types.js';

/**
 * Process CSS/SCSS files and write to build directory
 */
export async function processCSS(
  ctx: BuildContext,
  targetType: BuildTargetType
): Promise<void> {
  const { storage, paths, cssAdapter, config, logger, onProgress } = ctx;
  const buildPaths = getBuildPaths(paths.build);

  onProgress?.({ phase: 'css', current: 0, total: 2, message: 'Processing CSS' });

  // Determine CSS entry file based on target
  const targetConfig = config.targets?.[targetType];
  const cssFile = targetConfig?.css ?? `${targetType}.scss`;
  const cssPath = `${paths.styles}/${cssFile}`;

  logger?.debug('Processing CSS: %s', cssPath);

  // Read CSS/SCSS content
  const content = await storage.readTextFile(cssPath);

  onProgress?.({ phase: 'css', current: 1, total: 2, message: 'Compiling CSS' });

  // Process with CSS adapter
  const result = await cssAdapter.process({
    content,
    path: cssPath,
    sourceMap: false,
  });

  // Write output
  const outputPath = `${buildPaths.styles}/style.css`;
  await storage.writeFile(outputPath, result.css);

  onProgress?.({ phase: 'css', current: 2, total: 2, message: 'CSS complete' });
  logger?.info('CSS processed: %s -> %s', cssPath, outputPath);
}
