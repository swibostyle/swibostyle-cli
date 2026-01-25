# swibostyle

An **EPUB-first SSG** for CSS typesetting.

"SSG" is a double meaning: **Static Site Generator** and **Swibo Style(sheet-based) Generator**. "Swibo" (水母, suibo) means jellyfish in Japanese.

This tool was originally created for typesetting [SWIBO Fictions](https://github.com/kyoki-railway), the sci-fi label of Kyoki Railway Publishing (京姫鉄道出版).

## Philosophy

Unlike traditional CSS typesetting tools that focus on PDF output, swibostyle takes an **EPUB-first** approach:

| | Vivliostyle CLI | swibostyle |
|------|-----------------|------------|
| Primary output | PDF | **EPUB** |
| Print support | Direct generation | CSS delta from EPUB |
| License | AGPL | **MIT** (core) + AGPL (PDF server isolated) |
| PDF generation | Built-in | Via Playwright (AGPL isolated) |
| Runtime | Node.js | **Node.js / Bun** |

## Installation

```bash
bun install
```

## Usage

```bash
# Build EPUB
bun run swibo build

# Build for print (PDF conversion)
bun run swibo build --target print

# Start preview server
bun run swibo preview

# Generate PDF (requires pdf-server)
bun run swibo pdf
```

## Development

```bash
# Build all packages
bun run build

# Type check
bun run typecheck

# Lint
bun run lint
bun run lint:fix

# Format
bun run format
bun run format:check

# Run all checks (typecheck + lint + format:check)
bun run check

# Test
bun test                    # All tests
bun test packages/core/src  # Unit tests
bun test tests/integration  # Integration tests
```

## Package Structure

```
swibostyle-cli/
├── packages/
│   ├── core/                        # MIT - Core logic (environment-agnostic)
│   ├── cli/                         # MIT - CLI interface
│   ├── create-swibostyle/           # MIT - Project scaffolding
│   ├── epub-validator/              # MIT - EPUB validation (EPubCheck)
│   ├── epub-validator-linux-x64/    # MIT - Bundled JRE for Linux x64
│   └── pdf-server/                  # AGPL - PDF generation server (Vivliostyle)
├── tests/
│   ├── fixtures/                    # Test fixtures
│   └── integration/                 # Integration tests
└── docs/
    ├── ARCHITECTURE.md              # Architecture documentation
    └── SSG.md                       # SSG design document
```

### Packages

| Package | License | Description |
|---------|---------|-------------|
| `@swibostyle/core` | MIT | Build pipeline, adapter layer |
| `@swibostyle/cli` | MIT | Command-line interface |
| `create-swibostyle` | MIT | Project scaffolding |
| `@swibostyle/epub-validator` | MIT | EPUB validation with W3C EPubCheck |
| `@swibostyle/epub-validator-linux-x64` | MIT | Bundled JRE version (no Java required) |
| `@swibostyle/pdf-server` | AGPL-3.0 | Vivliostyle + Playwright PDF generation |

## Architecture

### Adapter Pattern

Swappable implementations for different environments:

| Adapter | Implementation | Use Case |
|---------|----------------|----------|
| StorageAdapter | NodeStorageAdapter | Node.js/Bun filesystem |
| | MemoryStorageAdapter | Testing/Browser |
| ImageAdapter | SharpImageAdapter | Production image processing |
| | NoopImageAdapter | Testing/size detection only |
| CSSAdapter | SassAdapter | Sass processing |
| | PassthroughCSSAdapter | Plain CSS |

### Build Flow

```
Clean → Copy → CSS → Image → Markdown → OPF → Navigation → Archive
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## book.json

Project metadata is configured in `book.json` (JSON5 format):

```json5
{
  "title": "Book Title",
  "authors": [
    { "name": "Author Name", "role": "aut" }
  ],
  "publisher": "Publisher",
  "lang": "ja",
  "bookId": {
    "epub": "urn:uuid:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  },
  "layout": "pre-paginated",
  "pageDirection": "rtl",
  "primaryWritingMode": "vertical-rl",
  "targets": {
    "epub": { "css": "epub.scss" },
    "print": { "css": "print.scss" }
  }
}
```

## License

- `core`, `cli`, `create-swibostyle`, `epub-validator`: MIT
- `pdf-server`: AGPL-3.0 (isolated due to Vivliostyle dependency)

## Credits

- **Core logic (original gulp version)**: [@butameron](https://github.com/butameron)
- **CLI implementation**: Primarily built with [Claude Code](https://claude.ai/code)

---

*This project utilizes [Vivliostyle](https://vivliostyle.org/)'s CSS typesetting technology.*
