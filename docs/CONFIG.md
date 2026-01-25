# Configuration Guide

swibostyle supports TypeScript-first configuration with `book.config.ts`, providing full IDE support, type safety, and extensibility through plugins and validators.

## Configuration Files

Configuration files are searched in the following order:

1. `book.config.ts`
2. `book.config.js`
3. `book.config.mts`
4. `book.config.mjs`
5. `book.json` (legacy)

## Basic Configuration

```ts
// book.config.ts
import { defineConfig } from "@swibostyle/core";

export default defineConfig({
  // Required fields
  title: "My Book",
  authors: [{ name: "Author Name", role: "aut" }],
  publisher: "Publisher Name",
  lang: "ja",
  bookId: { epub: "urn:uuid:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },

  // Optional layout settings
  layout: "reflowable", // or "pre-paginated"
  pageDirection: "rtl", // or "ltr"
  primaryWritingMode: "vertical-rl", // or "horizontal-tb"
  cover: "cover.jpg",

  // Target-specific settings
  targets: {
    epub: { css: "epub.scss", enableImageResizing: true },
    print: { css: "print.scss", enableImageResizing: false },
  },
});
```

## Adapter Configuration

### Sass Adapter

Configure Sass compilation options:

```ts
export default defineConfig({
  // ...
  adapters: {
    css: {
      // Output style: "expanded" (default) or "compressed"
      style: "compressed",

      // Additional load paths for @import/@use resolution
      loadPaths: ["./src/styles", "./node_modules"],

      // Enable source maps
      sourceMap: true,
    },
  },
});
```

### Custom Adapters

You can provide custom adapter instances:

```ts
import { defineConfig, SassAdapter, PassthroughCSSAdapter } from "@swibostyle/core";

export default defineConfig({
  // ...
  adapters: {
    // Use a pre-configured adapter instance
    css: new SassAdapter({ style: "compressed" }),

    // Or a factory function for lazy initialization
    css: () => new PassthroughCSSAdapter(),
  },
});
```

## Plugin System

### Markdown Plugins

Process markdown content before/after VFM transformation:

```ts
import { defineConfig, defineMarkdownPlugin } from "@swibostyle/core";

const rubyPlugin = defineMarkdownPlugin({
  name: "ruby-syntax",
  beforeProcess(content, ctx) {
    // Convert {漢字|かんじ} to ruby markup
    return content.replace(/\{([^|]+)\|([^}]+)\}/g, "<ruby>$1<rt>$2</rt></ruby>");
  },
});

export default defineConfig({
  // ...
  markdownPlugins: [rubyPlugin],
});
```

### CSS Plugins

Process CSS before/after Sass compilation:

```ts
import { defineConfig, defineCSSPlugin } from "@swibostyle/core";

const autoprefixPlugin = defineCSSPlugin({
  name: "autoprefix",
  async afterProcess(output, ctx) {
    const autoprefixer = await import("autoprefixer");
    const postcss = await import("postcss");
    const result = await postcss([autoprefixer()]).process(output.css);
    return { ...output, css: result.css };
  },
});

export default defineConfig({
  // ...
  cssPlugins: [autoprefixPlugin],
});
```

### Image Plugins

Process images before/after transformation:

```ts
import { defineConfig, defineImagePlugin } from "@swibostyle/core";

const watermarkPlugin = defineImagePlugin({
  name: "watermark",
  async afterProcess(data, path, ctx) {
    // Add watermark to images
    return data;
  },
});

export default defineConfig({
  // ...
  imagePlugins: [watermarkPlugin],
});
```

## Validators

### EPubCheck Validator

Use the W3C EPubCheck validator:

```ts
import { defineConfig, createEpubCheckValidator } from "@swibostyle/core";

export default defineConfig({
  // ...
  validators: [
    createEpubCheckValidator({
      profile: "default", // "default" | "edupub" | "idx" | "dict"
      includeInfos: false,
    }),
  ],
});
```

### Custom Validators

Create your own validators:

```ts
import { defineConfig, createCustomValidator } from "@swibostyle/core";

export default defineConfig({
  // ...
  validators: [
    createCustomValidator("my-validator", async (epubPath, options) => {
      // Your validation logic
      return {
        valid: true,
        errors: [],
        warnings: [],
      };
    }),
  ],
});
```

### Validator Modifiers

#### warnings-only

Convert all errors to warnings (validation never fails):

```ts
import { defineConfig, createEpubCheckValidator, warningsOnly } from "@swibostyle/core";

export default defineConfig({
  // ...
  validators: [
    warningsOnly(createEpubCheckValidator()),
  ],
});
```

#### ignoreErrors

Ignore specific error IDs:

```ts
import { defineConfig, createEpubCheckValidator, ignoreErrors } from "@swibostyle/core";

export default defineConfig({
  // ...
  validators: [
    ignoreErrors(createEpubCheckValidator(), [
      "CSS-008", // Ignore specific CSS errors
      "CSS-010",
    ]),
  ],
});
```

#### targetOnly

Run validator only for specific targets:

```ts
import { defineConfig, createEpubCheckValidator, targetOnly } from "@swibostyle/core";

export default defineConfig({
  // ...
  validators: [
    targetOnly(createEpubCheckValidator(), ["epub", "pod"]),
  ],
});
```

#### chainValidators

Run multiple validators in sequence:

```ts
import {
  defineConfig,
  createEpubCheckValidator,
  createCustomValidator,
  chainValidators,
} from "@swibostyle/core";

export default defineConfig({
  // ...
  validators: [
    chainValidators([
      createEpubCheckValidator(),
      createCustomValidator("custom", async () => ({ valid: true, errors: [], warnings: [] })),
    ]),
  ],
});
```

### Skip Validation

Disable validation entirely:

```ts
export default defineConfig({
  // ...
  skipValidation: true,
});
```

Or via CLI:

```bash
bun run swibo build --skip-validation
```

## VFM Options

Configure Vivliostyle Flavored Markdown:

```ts
export default defineConfig({
  // ...
  vfm: {
    hardLineBreaks: true,  // Convert line breaks to <br>
    partial: true,         // Output partial HTML (no <html>, <head>, <body>)
    remarkPlugins: [],     // Custom remark plugins
    rehypePlugins: [],     // Custom rehype plugins
  },
});
```

## Build Hooks

Execute custom logic during the build lifecycle:

```ts
export default defineConfig({
  // ...
  hooks: {
    async beforeBuild(ctx) {
      console.log(`Building ${ctx.target}...`);
    },
    async afterBuild(ctx, outputPath) {
      console.log(`Built: ${outputPath}`);
    },
    async onError(ctx, error) {
      console.error(`Build failed: ${error.message}`);
    },
  },
});
```

## Dynamic Configuration

Export a function for dynamic configuration:

```ts
import { defineConfig } from "@swibostyle/core";

export default async () => {
  const version = await getVersionFromGit();

  return defineConfig({
    title: `My Book v${version}`,
    // ...
  });
};
```

## Type Reference

### UserConfig

```ts
interface UserConfig {
  // Book metadata
  title: string;
  authors: Author[];
  publisher: string;
  lang: string;
  bookId: { epub: string; print?: string };
  layout?: "reflowable" | "pre-paginated";
  pageDirection?: "ltr" | "rtl";
  primaryWritingMode?: "horizontal-tb" | "vertical-rl";
  cover?: string;
  targets?: Record<string, TargetConfig>;

  // Extended configuration
  adapters?: AdapterConfig;
  vfm?: VFMOptions;
  markdownPlugins?: MarkdownPlugin[];
  cssPlugins?: CSSPlugin[];
  imagePlugins?: ImagePlugin[];
  hooks?: BuildHooks;
  validators?: ValidatorFactory[];
  skipValidation?: boolean;
}
```

### Author

```ts
interface Author {
  name: string;
  role: "aut" | "edt" | "trl" | "ill" | string;
  sortKey?: string;
}
```

### TargetConfig

```ts
interface TargetConfig {
  css?: string;
  enableImageResizing?: boolean;
}
```
