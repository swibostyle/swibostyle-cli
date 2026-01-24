import * as fs from "node:fs";
import * as path from "node:path";
import * as p from "@clack/prompts";
import type { ProjectOptions } from "./types.js";

/**
 * Scaffold a new project
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

  // Create directory structure
  const dirs = ["src", "src/markdown", "src/style", "src/image", "src/META-INF"];

  for (const dir of dirs) {
    fs.mkdirSync(path.join(projectDir, dir), { recursive: true });
  }

  // Generate files
  await generatePackageJson(projectDir, options);
  await generateBookJson(projectDir, options);
  await generateStyles(projectDir, options);
  await generateSampleContent(projectDir, options);
  await generateMetaInf(projectDir);
  await generateMimetype(projectDir);
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
    },
  };

  fs.writeFileSync(
    path.join(projectDir, "package.json"),
    JSON.stringify(packageJson, null, 2) + "\n",
  );
}

async function generateBookJson(projectDir: string, options: ProjectOptions): Promise<void> {
  const bookJson = {
    title: options.name,
    authors: [
      {
        name: "Author Name",
        role: "aut",
      },
    ],
    publisher: "Publisher",
    lang: options.lang,
    bookId: {
      epub: "00000000000000000000",
    },
    layout: options.template === "manga" ? "pre-paginated" : "reflowable",
    pageDirection: options.pageDirection,
    primaryWritingMode: options.writingMode,
    targets: {
      epub: {
        css: "epub.scss",
        enableImageResizing: true,
      },
      print: {
        css: "print.scss",
        enableImageResizing: false,
      },
      pod: {
        css: "pod.scss",
        enableImageResizing: false,
      },
    },
    epubImageCrops: [],
    pagesToBeGeneratedFromImage: [],
  };

  fs.writeFileSync(
    path.join(projectDir, "src/book.json"),
    JSON.stringify(bookJson, null, 2) + "\n",
  );
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

  fs.writeFileSync(path.join(projectDir, "src/style/base.scss"), baseScss);
  fs.writeFileSync(path.join(projectDir, "src/style/epub.scss"), epubScss);
  fs.writeFileSync(path.join(projectDir, "src/style/print.scss"), printScss);
  fs.writeFileSync(path.join(projectDir, "src/style/pod.scss"), podScss);
}

async function generateSampleContent(projectDir: string, options: ProjectOptions): Promise<void> {
  const isVertical = options.writingMode === "vertical-rl";

  const sampleMd = `---
title: ${isVertical ? "はじめに" : "Introduction"}
displayOrder: 1
isNavigationItem: true
---

# ${isVertical ? "はじめに" : "Introduction"}

${
  isVertical
    ? "これはswibostyleで作成されたサンプルです。\n\nこのファイルを編集して、あなたの本を作成してください。"
    : "This is a sample created with swibostyle.\n\nEdit this file to create your book."
}
`;

  fs.writeFileSync(path.join(projectDir, "src/markdown/p-001-intro.md"), sampleMd);
}

async function generateMetaInf(projectDir: string): Promise<void> {
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="item/standard.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>
`;

  fs.writeFileSync(path.join(projectDir, "src/META-INF/container.xml"), containerXml);
}

async function generateMimetype(projectDir: string): Promise<void> {
  fs.writeFileSync(path.join(projectDir, "src/mimetype"), "application/epub+zip");
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
├── src/
│   ├── book.json          # Book configuration
│   ├── markdown/          # Content (Markdown files)
│   ├── style/             # Stylesheets (SCSS)
│   ├── image/             # Images
│   └── META-INF/          # EPUB metadata
├── _build/                # Build output (generated)
└── _release/              # Final EPUB (generated)
\`\`\`

## Commands

- \`${options.packageManager} run build\` - Build EPUB
- \`${options.packageManager} run build:print\` - Build for print
- \`${options.packageManager} run build:pod\` - Build for print-on-demand
- \`${options.packageManager} run preview\` - Preview in browser
`;

  fs.writeFileSync(path.join(projectDir, "README.md"), readme);
}
