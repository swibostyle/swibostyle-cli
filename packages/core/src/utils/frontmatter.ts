import type { Frontmatter } from "../types.js";

/**
 * Read frontmatter from markdown content
 */
export async function readFrontmatter(mdContent: string): Promise<Frontmatter> {
  const { unified } = await import("unified");
  const remarkParse = (await import("remark-parse")).default;
  const remarkFrontmatter = (await import("remark-frontmatter")).default;
  const yaml = await import("yaml");

  let frontmatter: Frontmatter = {};

  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(() => (tree: any, file: any) => {
      if (tree.children.length > 0 && tree.children[0].type === "yaml") {
        file.data = yaml.parse(tree.children[0].value);
      }
    })
    .use(function () {
      Object.assign(this, {
        Compiler: () => {},
      });
    });

  const result = await processor.process(mdContent);
  frontmatter = (result.data as Frontmatter) ?? {};

  return frontmatter;
}
