# @swibostyle/epub-validator

EPUB validation using W3C EPubCheck compiled to WebAssembly via TeaVM.

**Status: Experimental**

This package attempts to compile the official W3C EPubCheck to WebAssembly,
allowing EPUB validation without requiring a Java runtime.

## Goals

- Run EPubCheck entirely in Node.js/Bun (no Java required)
- Provide TypeScript-friendly API
- Support both CLI and programmatic usage

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  TypeScript/JavaScript                                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  validateEpub(epub: Uint8Array)                 │   │
│  │       ↓                                          │   │
│  │  WebAssembly.instantiate(epubcheck.wasm)        │   │
│  │       ↓                                          │   │
│  │  wasm.validate() → ValidationResult (JSON)      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↑
                    WASM boundary
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Java (compiled to WASM via TeaVM)                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │  EpubValidatorMain.validate()                   │   │
│  │       ↓                                          │   │
│  │  com.adobe.epubcheck.api.EpubCheck              │   │
│  │       ↓                                          │   │
│  │  ValidationReport → JSON string                 │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Prerequisites

To build the WASM module, you need:

- Java 11+ (JDK)
- Maven 3.6+

## Building

```bash
# Build WASM module (requires Java + Maven)
bun run build:wasm

# Build TypeScript
bun run build:ts

# Build everything
bun run build
```

## Usage

```typescript
import { validateEpub } from "@swibostyle/epub-validator";

// Validate from file path
const result = await validateEpub("book.epub");

// Validate from Uint8Array
const epubData = await fs.readFile("book.epub");
const result = await validateEpub(new Uint8Array(epubData));

// Check result
if (result.valid) {
  console.log("EPUB is valid!");
} else {
  console.error("Errors found:");
  for (const error of result.errors) {
    console.error(`  [${error.id}] ${error.message}`);
  }
}
```

## Known Limitations

TeaVM may not support all Java APIs used by EPubCheck. Potential issues:

1. **XML parsing** - Saxon-HE, Jing may use unsupported APIs
2. **File I/O** - Must be adapted for WASM memory model
3. **Reflection** - Limited support in TeaVM
4. **Native code** - JNI not available

This package is experimental. If WASM compilation fails, consider:

- Using the Java JAR directly (requires JRE)
- Using a lightweight JavaScript-based validator (less complete)

## License

MIT (this package)

Note: EPubCheck itself is licensed under BSD-3-Clause.
