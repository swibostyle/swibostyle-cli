import type { BuildContext } from './context.js';
import type { BuildOptions, BuildResult, ContentItem } from '../types.js';
import { clean } from './clean.js';
import { copy } from './copy.js';
import { createEpubArchive, writeEpubFile } from './archive.js';
import { processCSS } from '../processors/css.js';
import { processMarkdown } from '../processors/markdown.js';
import { processImages } from '../processors/image.js';
import { generateOPF } from '../processors/opf.js';
import { generateNavigation } from '../processors/navigation.js';
import { generatePagesFromImages } from '../processors/page-from-image.js';

/**
 * Main build pipeline
 */
export async function build(ctx: BuildContext, options: BuildOptions): Promise<BuildResult> {
  const { target, output = 'file' } = options;
  const { config, logger } = ctx;

  logger?.info('Starting build: target=%s', target);

  // Get target configuration
  const targetConfig = config.targets?.[target];
  const enableImageResizing = targetConfig?.enableImageResizing ?? (target === 'epub');

  // 1. Clean build directory
  await clean(ctx);

  // 2. Copy source files
  await copy(ctx);

  // 3. Process CSS
  await processCSS(ctx, target);

  // 4. Process images
  const images = await processImages(ctx, target, enableImageResizing);

  // 5. Process markdown
  const xhtmlContents = await processMarkdown(ctx, target);

  // 6. Generate pages from images
  const imagePages = await generatePagesFromImages(ctx, images);

  // Combine all contents
  let contents: ContentItem[] = [
    ...images.filter((img) => img.id !== 'cover'), // Exclude cover from manifest images
    ...xhtmlContents,
    ...imagePages,
  ];

  // Apply page spread defaults
  contents = applyPageSpreadDefaults(contents, config.pageDirection);

  // 7. Generate OPF
  await generateOPF(ctx, contents, target);

  // 8. Generate navigation
  await generateNavigation(ctx, contents, target);

  // 9. Create EPUB archive
  const epubData = await createEpubArchive(ctx, target);

  // 10. Write output or return data
  if (output === 'file') {
    const outputPath = await writeEpubFile(ctx, epubData, target);
    logger?.info('Build complete: %s', outputPath);
    return { outputPath, contents };
  } else {
    logger?.info('Build complete: %d bytes', epubData.length);
    return { data: epubData, contents };
  }
}

/**
 * Apply default page spread properties based on page direction
 */
function applyPageSpreadDefaults(
  contents: ContentItem[],
  pageDirection: 'ltr' | 'rtl'
): ContentItem[] {
  const pages = contents
    .filter((c) => c.type === 'xhtml')
    .sort((a, b) => {
      const aOrder = a.type === 'xhtml' ? a.displayOrder : 0;
      const bOrder = b.type === 'xhtml' ? b.displayOrder : 0;
      return aOrder - bOrder;
    });

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    if (page.type !== 'xhtml') continue;
    if (page.frontmatter.epubPageProperty) continue;

    if (pageDirection === 'rtl') {
      page.frontmatter.epubPageProperty = i % 2 === 1 ? 'page-spread-right' : 'page-spread-left';
    } else {
      page.frontmatter.epubPageProperty = i % 2 === 1 ? 'page-spread-left' : 'page-spread-right';
    }
  }

  return contents;
}
