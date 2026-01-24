import type { BuildContext } from '../builder/context.js';
import { getBuildPaths } from '../builder/context.js';
import type { BuildTargetType, ContentItem, XHTMLContent, ImageContent } from '../types.js';

/**
 * Generate OPF (Open Packaging Format) file
 */
export async function generateOPF(
  ctx: BuildContext,
  contents: ContentItem[],
  targetType: BuildTargetType
): Promise<void> {
  const { storage, paths, config, logger, onProgress } = ctx;
  const buildPaths = getBuildPaths(paths.build);

  onProgress?.({ phase: 'opf', current: 0, total: 1, message: 'Generating OPF' });
  logger?.debug('Generating OPF');

  const ejs = await import('ejs');

  // Read template
  const templatePath = `${paths.templates}/standard.opf.ejs`;
  const template = await storage.readTextFile(templatePath);

  // Separate content types
  const pages = contents
    .filter((c): c is XHTMLContent => c.type === 'xhtml')
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const images = contents.filter((c): c is ImageContent => c.type === 'image');

  // Generate modified timestamp
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  // Render OPF
  const opf = await ejs.render(
    template,
    {
      pages,
      images,
      bookConfig: config,
      buildType: targetType,
      modified,
    },
    { async: true }
  );

  // Write OPF file
  const outputPath = `${buildPaths.item}/standard.opf`;
  await storage.writeFile(outputPath, opf);

  onProgress?.({ phase: 'opf', current: 1, total: 1, message: 'OPF complete' });
  logger?.info('Generated OPF: %s', outputPath);
}
