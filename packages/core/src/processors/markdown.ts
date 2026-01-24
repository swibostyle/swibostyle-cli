import type { BuildContext } from "../builder/context.js";
import { getBuildPaths } from "../builder/context.js";
import type { BuildTargetType, Frontmatter, XHTMLContent } from "../types.js";
import { convertToXhtml } from "../utils/xhtml.js";
import { readFrontmatter } from "../utils/frontmatter.js";
import { renderXHTML } from "../templates/xhtml.js";

/**
 * Process markdown files and generate XHTML
 */
export async function processMarkdown(
  ctx: BuildContext,
  targetType: BuildTargetType,
): Promise<XHTMLContent[]> {
  const { storage, paths, config, logger, onProgress } = ctx;
  const buildPaths = getBuildPaths(paths.build);

  // Get list of markdown files
  const markdownFiles = (await storage.readDir(paths.markdown))
    .filter((f) => f.endsWith(".md"))
    .sort();

  logger?.debug("Processing %d markdown files", markdownFiles.length);
  onProgress?.({ phase: "markdown", current: 0, total: markdownFiles.length, message: "Starting" });

  const contents: XHTMLContent[] = [];

  // Dynamically import VFM
  const vfm = await import("@vivliostyle/vfm");

  for (let i = 0; i < markdownFiles.length; i++) {
    const file = markdownFiles[i]!;
    const filePath = `${paths.markdown}/${file}`;

    logger?.debug("Processing: %s", file);
    onProgress?.({ phase: "markdown", current: i, total: markdownFiles.length, message: file });

    // Read markdown content
    const mdContent = await storage.readTextFile(filePath);

    // Parse frontmatter
    const frontmatter = await readFrontmatter(mdContent);

    // Check if should be included in this build
    if (!isIncluded(targetType, frontmatter)) {
      logger?.debug("Skipping (excluded): %s", file);
      continue;
    }

    // Process with VFM
    const processor = vfm.VFM({ partial: true, hardLineBreaks: true });
    const result = await processor.process(mdContent);
    const metadata = vfm.readMetadata(mdContent);

    // Convert to XHTML
    const htmlPartial = convertToXhtml(result.toString());
    const title = metadata.title ?? frontmatter.title ?? "";

    // Render with template function
    const html = renderXHTML({
      body: htmlPartial,
      frontmatter,
      title,
      lang: config.lang,
    });

    // Determine output filename
    let fileName = file.replace(/\.md$/, "");
    if (frontmatter.outputFileName) {
      fileName = frontmatter.outputFileName;
    }

    // Check for SVG content
    const hasSvg = /.*<svg .*/g.test(htmlPartial);

    const content: XHTMLContent = {
      type: "xhtml",
      id: fileName,
      fileName: `${fileName}.xhtml`,
      title,
      html,
      frontmatter,
      properties: hasSvg ? "svg" : undefined,
      displayOrder: frontmatter.displayOrder ?? 0,
    };

    // Write XHTML file
    await storage.writeFile(`${buildPaths.xhtml}/${content.fileName}`, html);
    contents.push(content);
  }

  onProgress?.({
    phase: "markdown",
    current: markdownFiles.length,
    total: markdownFiles.length,
    message: "Complete",
  });
  logger?.info("Processed %d markdown files", contents.length);

  return contents;
}

/**
 * Check if content should be included in the build
 */
function isIncluded(buildType: BuildTargetType, frontmatter: Frontmatter): boolean {
  if (frontmatter.excludeIf === buildType) {
    return false;
  }
  if (frontmatter.includeIf && frontmatter.includeIf !== buildType) {
    return false;
  }
  return true;
}
