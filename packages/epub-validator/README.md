# @swibostyle/epub-validator

EPUB validation using W3C EPubCheck with automatic fallback.

## Features

- **Automatic runtime detection**: Uses bundled JRE or system Java
- **TypeScript-friendly API**: Full type definitions
- **CI-ready**: Install `@swibostyle/epub-validator-linux-x64` for Java-free CI

## Installation

```bash
# Main package (uses system Java)
bun add @swibostyle/epub-validator

# For CI/Docker (includes bundled JRE, no Java required)
bun add @swibostyle/epub-validator-linux-x64
```

## Usage

```typescript
import { validateEpub } from "@swibostyle/epub-validator";

const result = await validateEpub("book.epub");

if (result.valid) {
  console.log("EPUB is valid!");
} else {
  console.error("Validation errors:");
  for (const error of result.errors) {
    console.error(`  [${error.id}] ${error.message}`);
  }
}
```

## Resolution Order

1. **Bundled binary** (e.g., `@swibostyle/epub-validator-linux-x64`)
2. **System Java** + bundled `epubcheck.jar`

## Packages

| Package | Description | Size |
|---------|-------------|------|
| `@swibostyle/epub-validator` | Main package, requires Java | ~20KB |
| `@swibostyle/epub-validator-linux-x64` | Bundled JRE for Linux x64 | ~50MB |

## API

### `validateEpub(epubPath, options?)`

Validate an EPUB file.

```typescript
const result = await validateEpub("book.epub", {
  profile: "default",      // "default" | "edupub" | "idx" | "dict"
  includeInfos: false,     // Include INFO-level messages
  onProgress: (msg) => {}, // Progress callback
});
```

### `createValidator()`

Create a reusable validator instance.

```typescript
const validator = await createValidator();

// Reuse for multiple validations
const result1 = await validator.validate("book1.epub");
const result2 = await validator.validate("book2.epub");

console.log(`Validator type: ${validator.type}`); // "bundled" | "system-java"
```

## License

MIT (this package)

EPubCheck is licensed under BSD-3-Clause.
