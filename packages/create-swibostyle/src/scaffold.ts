import * as fs from "node:fs";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { ProjectOptions } from "./types";

/**
 * Scaffold a new project using SSG format
 */
export async function scaffold(options: ProjectOptions): Promise<void> {
  const projectDir = path.resolve(process.cwd(), options.name);

  // Check if directory exists
  if (fs.existsSync(projectDir)) {
    const files = fs.readdirSync(projectDir);
    if (files.length > 0) {
      const overwrite = await p.confirm({
        message: `Directory ${options.name} is not empty. Continue?`,
        initialValue: false,
      });

      if (p.isCancel(overwrite) || !overwrite) {
        throw new Error("cancelled");
      }
    }
  }

  const spinner = p.spinner();
  spinner.start("Creating project...");

  // Create project directory
  fs.mkdirSync(projectDir, { recursive: true });

  // Create SSG directory structure
  const dirs = ["src", "src/item", "src/item/xhtml", "src/item/style", "src/item/image"];

  for (const dir of dirs) {
    fs.mkdirSync(path.join(projectDir, dir), { recursive: true });
  }

  // Generate files
  await generatePackageJson(projectDir, options);
  await generateBookConfig(projectDir, options);
  await generateStyles(projectDir, options);
  await generateSampleContent(projectDir, options);
  await generateGitignore(projectDir);
  await generateReadme(projectDir, options);

  spinner.stop("Project created");
}

async function generatePackageJson(projectDir: string, options: ProjectOptions): Promise<void> {
  const packageJson = {
    name: options.name,
    version: "1.0.0",
    type: "module",
    private: true,
    scripts: {
      build: "swibostyle build",
      "build:print": "swibostyle build --target print",
      "build:pod": "swibostyle build --target pod",
      preview: "swibostyle preview",
    },
    dependencies: {
      "@swibostyle/cli": "^0.1.0",
      "@swibostyle/core": "^0.1.0",
    },
  };

  fs.writeFileSync(
    path.join(projectDir, "package.json"),
    JSON.stringify(packageJson, null, 2) + "\n",
  );
}

async function generateBookConfig(projectDir: string, options: ProjectOptions): Promise<void> {
  const layout = options.template === "manga" ? "pre-paginated" : "reflowable";

  const bookConfig = `import { defineConfig } from "@swibostyle/core";

export default defineConfig({
  title: "${options.name}",
  authors: [
    {
      name: "Author Name",
      role: "aut",
    },
  ],
  publisher: "Publisher",
  lang: "${options.lang}",
  bookId: {
    epub: "urn:uuid:00000000-0000-0000-0000-000000000000",
  },
  layout: "${layout}",
  pageDirection: "${options.pageDirection}",
  primaryWritingMode: "${options.writingMode}",
});
`;

  fs.writeFileSync(path.join(projectDir, "book.config.ts"), bookConfig);
}

async function generateStyles(projectDir: string, options: ProjectOptions): Promise<void> {
  const isVertical = options.writingMode === "vertical-rl";

  // base.scss
  const baseScss = `// Base styles for ${options.name}

:root {
  --font-family-main: ${
    isVertical
      ? '"BIZ UDMincho", "Hiragino Mincho ProN", serif'
      : '"BIZ UDGothic", "Hiragino Sans", sans-serif'
  };
}

html {
  writing-mode: ${options.writingMode};
}

body {
  font-family: var(--font-family-main);
  line-height: 1.8;
  ${isVertical ? "text-orientation: mixed;" : ""}
}

h1 {
  font-size: 1.5em;
  font-weight: bold;
  margin: 1em 0;
}

h2 {
  font-size: 1.3em;
  font-weight: bold;
  margin: 0.8em 0;
}

p {
  margin: 0;
  text-indent: 1em;
}

p + p {
  margin-${isVertical ? "right" : "top"}: 0;
}
`;

  // epub.scss
  const epubScss = `// EPUB-specific styles
@import 'base';

.print-only {
  display: none;
}
`;

  // print.scss
  const printScss = `// Print-specific styles
@import 'base';

@page {
  size: 128mm 182mm;
  margin: 15mm;
  marks: crop cross;
  bleed: 3mm;
}

.epub-only {
  display: none;
}
`;

  // pod.scss (Print on Demand)
  const podScss = `// POD-specific styles
@import 'base';

@page {
  size: 128mm 182mm;
  margin: 15mm;
}

.epub-only {
  display: none;
}
`;

  fs.writeFileSync(path.join(projectDir, "src/item/style/base.scss"), baseScss);
  fs.writeFileSync(path.join(projectDir, "src/item/style/epub.scss"), epubScss);
  fs.writeFileSync(path.join(projectDir, "src/item/style/print.scss"), printScss);
  fs.writeFileSync(path.join(projectDir, "src/item/style/pod.scss"), podScss);
}

async function generateSampleContent(projectDir: string, options: ProjectOptions): Promise<void> {
  const isVertical = options.writingMode === "vertical-rl";

  // Cover page
  const coverMd = `---
title: ${isVertical ? "表紙" : "Cover"}
epubType: cover
isGuideItem: true
---

# ${options.name}
`;

  // TOC page
  const tocMd = `---
title: ${isVertical ? "目次" : "Table of Contents"}
epubType: toc
isNavigationItem: true
---

# ${isVertical ? "目次" : "Table of Contents"}

${isVertical ? "目次はビルド時に自動生成されます。" : "Table of contents will be auto-generated during build."}
`;

  // Introduction page
  const introMd = `---
title: ${isVertical ? "はじめに" : "Introduction"}
isNavigationItem: true
---

# ${isVertical ? "はじめに" : "Introduction"}

${
  isVertical
    ? "これはswibostyleで作成されたサンプルです。\n\nこのファイルを編集して、あなたの本を作成してください。"
    : "This is a sample created with swibostyle.\n\nEdit this file to create your book."
}
`;

  // Colophon page
  const colophonMd = `---
title: ${isVertical ? "奥付" : "Colophon"}
epubType: colophon
---

# ${isVertical ? "奥付" : "Colophon"}

**${options.name}**

${isVertical ? "著者：Author Name\n出版：Publisher" : "Author: Author Name\nPublisher: Publisher"}
`;

  // SSG uses numeric prefix for display order (p-XXX-name.md)
  fs.writeFileSync(path.join(projectDir, "src/item/xhtml/p-000-cover.md"), coverMd);
  fs.writeFileSync(path.join(projectDir, "src/item/xhtml/p-010-toc.md"), tocMd);
  fs.writeFileSync(path.join(projectDir, "src/item/xhtml/p-100-intro.md"), introMd);
  fs.writeFileSync(path.join(projectDir, "src/item/xhtml/p-900-colophon.md"), colophonMd);
}

async function generateGitignore(projectDir: string): Promise<void> {
  const gitignore = `# Build outputs
_build/
_release/
_temp/

# Dependencies
node_modules/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
`;

  fs.writeFileSync(path.join(projectDir, ".gitignore"), gitignore);
}

async function generateReadme(projectDir: string, options: ProjectOptions): Promise<void> {
  const readme = `# ${options.name}

A book project created with [swibostyle](https://github.com/swibostyle/swibostyle).

## Getting Started

\`\`\`bash
# Install dependencies
${options.packageManager} install

# Build EPUB
${options.packageManager} run build

# Build for print
${options.packageManager} run build:print
\`\`\`

## Project Structure

\`\`\`
${options.name}/
├── book.config.ts         # Book configuration (TypeScript)
├── src/
│   └── item/
│       ├── xhtml/         # Content (Markdown files)
│       ├── style/         # Stylesheets (SCSS)
│       └── image/         # Images
└── _release/              # Final EPUB (generated)
\`\`\`

## File Naming Convention

Markdown files in \`src/item/xhtml/\` use numeric prefixes to control display order:

- \`p-000-cover.md\` - Cover page
- \`p-010-toc.md\` - Table of contents
- \`p-100-chapter1.md\` - Chapter 1
- \`p-900-colophon.md\` - Colophon

The numeric prefix (000, 010, 100, etc.) determines the order in the EPUB spine.

## Commands

- \`${options.packageManager} run build\` - Build EPUB
- \`${options.packageManager} run build:print\` - Build for print
- \`${options.packageManager} run build:pod\` - Build for print-on-demand
- \`${options.packageManager} run preview\` - Preview in browser
`;

  fs.writeFileSync(path.join(projectDir, "README.md"), readme);
}
