import type { BuildContext } from "../builder/context.js";
import { getBuildPaths } from "../builder/context.js";
import type { BuildTargetType, ContentItem, XHTMLContent } from "../types.js";

/**
 * Generate Navigation Documents (EPUB 3 nav)
 */
export async function generateNavigation(
  ctx: BuildContext,
  contents: ContentItem[],
  targetType: BuildTargetType,
): Promise<void> {
  const { storage, paths, config, logger, onProgress } = ctx;
  const buildPaths = getBuildPaths(paths.build);

  onProgress?.({ phase: "navigation", current: 0, total: 1, message: "Generating navigation" });
  logger?.debug("Generating navigation documents");

  const ejs = await import("ejs");

  // Read template
  const templatePath = `${paths.templates}/navigation-documents.ejs`;
  const template = await storage.readTextFile(templatePath);

  // Get pages sorted by display order
  const pages = contents
    .filter((c): c is XHTMLContent => c.type === "xhtml")
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // Filter navigation and guide items
  const navigationItems = pages.filter((p) => p.frontmatter.isNavigationItem);
  const guideItems = pages.filter((p) => p.frontmatter.isGuideItem);

  // Render navigation document
  const nav = await ejs.render(
    template,
    {
      bookConfig: config,
      pages,
      navigationItems,
      guideItems,
      buildType: targetType,
    },
    { async: true },
  );

  // Write navigation document
  const outputPath = `${buildPaths.item}/navigation-documents.xhtml`;
  await storage.writeFile(outputPath, nav);

  onProgress?.({ phase: "navigation", current: 1, total: 1, message: "Navigation complete" });
  logger?.info("Generated navigation: %s", outputPath);
}
