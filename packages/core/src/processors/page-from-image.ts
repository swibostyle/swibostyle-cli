import type { BuildContext } from "../builder/context.js";
import { getBuildPaths } from "../builder/context.js";
import type { ImageContent, XHTMLContent, Frontmatter } from "../types.js";

/**
 * Generate XHTML pages from images (for cover pages, illustrations, etc.)
 */
export async function generatePagesFromImages(
  ctx: BuildContext,
  images: ImageContent[],
): Promise<XHTMLContent[]> {
  const { storage, paths, config, logger } = ctx;
  const buildPaths = getBuildPaths(paths.build);

  const pageConfigs = config.pagesToBeGeneratedFromImage ?? [];
  if (pageConfigs.length === 0) {
    return [];
  }

  logger?.debug("Generating %d pages from images", pageConfigs.length);

  const ejsModule = await import("ejs");
  const ejs = ejsModule.default ?? ejsModule;
  const templatePath = `${paths.templates}/xhtml.ejs`;
  const template = await storage.readTextFile(templatePath);

  const contents: XHTMLContent[] = [];

  for (const pageConfig of pageConfigs) {
    const targetImage = images.find((img) => img.fileName === pageConfig.fileName);
    if (!targetImage) {
      logger?.warn("Image not found for page: %s", pageConfig.fileName);
      continue;
    }

    const { width, height } = targetImage.dimensions;
    const title = pageConfig.title ?? config.title;

    // Build frontmatter with defaults for fixed layout
    const frontmatter: Frontmatter = {
      viewport: `width=${width}, height=${height}`,
      htmlClass: "horizontal fixed-layout",
      displayOrder: 0,
      ...pageConfig.frontmatter,
    };

    // Generate SVG-based HTML for fixed layout
    const htmlPartial = `<p><svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" height="100%" viewBox="0 0 ${width} ${height}"><image width="${width}" height="${height}" xlink:href="../image/${targetImage.fileName}"/></svg></p>`;

    // Render with template
    const html = await ejs.render(
      template,
      {
        body: htmlPartial,
        frontmatter,
        title,
      },
      { async: true },
    );

    const content: XHTMLContent = {
      type: "xhtml",
      id: pageConfig.id,
      fileName: `${pageConfig.id}.xhtml`,
      title,
      html,
      frontmatter,
      properties: "svg",
      displayOrder: frontmatter.displayOrder ?? 0,
      fallbackImage: targetImage.id,
    };

    // Write XHTML file
    await storage.writeFile(`${buildPaths.xhtml}/${content.fileName}`, html);
    contents.push(content);

    logger?.debug("Generated page from image: %s -> %s", pageConfig.fileName, content.fileName);
  }

  logger?.info("Generated %d pages from images", contents.length);
  return contents;
}
