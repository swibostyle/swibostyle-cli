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
  const dirs = ["src", "src/markdown", "src/style", "src/templates", "src/image", "src/META-INF"];

  for (const dir of dirs) {
    fs.mkdirSync(path.join(projectDir, dir), { recursive: true });
  }

  // Generate files
  await generatePackageJson(projectDir, options);
  await generateBookJson(projectDir, options);
  await generateStyles(projectDir, options);
  await generateTemplates(projectDir, options);
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

async function generateTemplates(projectDir: string, options: ProjectOptions): Promise<void> {
  // xhtml.ejs
  const xhtmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${options.lang}" lang="${options.lang}"<% if (frontmatter.htmlClass) { %> class="<%= frontmatter.htmlClass %>"<% } %>>
<head>
  <meta charset="UTF-8" />
  <title><%= title %></title>
<% if (frontmatter.viewport) { %>
  <meta name="viewport" content="<%= frontmatter.viewport %>" />
<% } %>
  <link rel="stylesheet" type="text/css" href="../style/style.css" />
</head>
<body>
<%- body %>
</body>
</html>
`;

  // navigation-documents.ejs
  const navTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${options.lang}" lang="${options.lang}">
<head>
  <meta charset="UTF-8" />
  <title>Navigation</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
<% for (const item of navigationItems) { %>
      <li><a href="xhtml/<%= item.fileName %>"><%= item.title %></a></li>
<% } %>
    </ol>
  </nav>
</body>
</html>
`;

  // standard.opf.ejs
  const opfTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" xml:lang="${options.lang}" unique-identifier="unique-id" prefix="ebpaj: http://www.ebpaj.jp/">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title><%= bookConfig.title %></dc:title>
    <dc:language><%= bookConfig.lang %></dc:language>
    <dc:identifier id="unique-id"><%= bookConfig.bookId.epub %></dc:identifier>
<% for (const author of bookConfig.authors) { %>
    <dc:creator><%= author.name %></dc:creator>
<% } %>
    <dc:publisher><%= bookConfig.publisher %></dc:publisher>
    <meta property="dcterms:modified"><%= modified %></meta>
<% if (bookConfig.layout === 'pre-paginated') { %>
    <meta property="rendition:layout">pre-paginated</meta>
    <meta property="rendition:spread">landscape</meta>
<% } %>
  </metadata>

  <manifest>
    <item id="nav" href="navigation-documents.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="style" href="style/style.css" media-type="text/css" />
<% for (const page of pages) { %>
    <item id="<%= page.id %>" href="xhtml/<%= page.fileName %>" media-type="application/xhtml+xml"<% if (page.properties) { %> properties="<%= page.properties %>"<% } %> />
<% } %>
<% for (const image of images) { %>
    <item id="<%= image.id %>" href="image/<%= image.fileName %>" media-type="<%= image.contentType %>" />
<% } %>
  </manifest>

  <spine page-progression-direction="<%= bookConfig.pageDirection %>">
<% for (const page of pages) { %>
    <itemref idref="<%= page.id %>"<% if (page.frontmatter.epubPageProperty) { %> properties="<%= page.frontmatter.epubPageProperty %>"<% } %> />
<% } %>
  </spine>
</package>
`;

  fs.writeFileSync(path.join(projectDir, "src/templates/xhtml.ejs"), xhtmlTemplate);
  fs.writeFileSync(path.join(projectDir, "src/templates/navigation-documents.ejs"), navTemplate);
  fs.writeFileSync(path.join(projectDir, "src/templates/standard.opf.ejs"), opfTemplate);
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
│   ├── templates/         # EJS templates
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
