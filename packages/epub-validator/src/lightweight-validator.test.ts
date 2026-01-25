import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createLightweightValidator, validateEpubLightweight } from "./lightweight-validator";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = join(import.meta.dirname, "..", "__test_temp__");

function createMinimalEpub(
  options: {
    skipMimetype?: boolean;
    wrongMimetype?: boolean;
    compressMimetype?: boolean;
    mimetypeNotFirst?: boolean;
    skipContainer?: boolean;
    wrongOpfPath?: boolean;
    skipOpf?: boolean;
    missingManifestFile?: boolean;
    brokenLink?: boolean;
    skipNav?: boolean;
  } = {},
): Buffer {
  const zip = new Map<string, { content: Buffer; compress: boolean }>();

  // mimetype
  if (!options.skipMimetype) {
    const mimetypeContent = options.wrongMimetype
      ? "application/octet-stream"
      : "application/epub+zip";
    zip.set("mimetype", {
      content: Buffer.from(mimetypeContent),
      compress: options.compressMimetype ?? false,
    });
  }

  // META-INF/container.xml
  if (!options.skipContainer) {
    const opfPath = options.wrongOpfPath ? "wrong/path.opf" : "OEBPS/content.opf";
    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    zip.set("META-INF/container.xml", { content: Buffer.from(containerXml), compress: true });
  }

  // OPF
  if (!options.skipOpf) {
    const manifestItems = [
      `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
      `<item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>`,
      `<item id="style" href="style.css" media-type="text/css"/>`,
    ];
    if (options.missingManifestFile) {
      manifestItems.push(
        `<item id="missing" href="missing.xhtml" media-type="application/xhtml+xml"/>`,
      );
    }
    if (options.skipNav) {
      // Remove nav properties
      manifestItems[0] = `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml"/>`;
    }

    const opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">test-epub-123</dc:identifier>
    <dc:title>Test Book</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    ${manifestItems.join("\n    ")}
  </manifest>
  <spine>
    <itemref idref="nav"/>
    <itemref idref="chapter1"/>
  </spine>
</package>`;
    zip.set("OEBPS/content.opf", { content: Buffer.from(opfContent), compress: true });
  }

  // nav.xhtml
  const navContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Navigation</title></head>
<body>
  <nav epub:type="toc">
    <ol>
      <li><a href="chapter1.xhtml">Chapter 1</a></li>
    </ol>
  </nav>
</body>
</html>`;
  zip.set("OEBPS/nav.xhtml", { content: Buffer.from(navContent), compress: true });

  // chapter1.xhtml
  let chapter1Content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title><link rel="stylesheet" href="style.css"/></head>
<body>
  <h1>Chapter 1</h1>
  <p>Hello, world!</p>`;

  if (options.brokenLink) {
    chapter1Content += `\n  <a href="nonexistent.xhtml">Broken Link</a>`;
  }

  chapter1Content += `
</body>
</html>`;
  zip.set("OEBPS/chapter1.xhtml", { content: Buffer.from(chapter1Content), compress: true });

  // style.css
  const cssContent = `body { font-family: serif; }`;
  zip.set("OEBPS/style.css", { content: Buffer.from(cssContent), compress: true });

  // Build ZIP manually
  return buildZip(zip, options.mimetypeNotFirst);
}

function buildZip(
  files: Map<string, { content: Buffer; compress: boolean }>,
  mimetypeNotFirst = false,
): Buffer {
  const { deflateRawSync } = require("node:zlib");

  interface LocalFile {
    name: string;
    content: Buffer;
    compressedContent: Buffer;
    compressionMethod: number;
    crc32: number;
    offset: number;
  }

  const localFiles: LocalFile[] = [];
  let offset = 0;

  // Order files - mimetype should be first unless mimetypeNotFirst is true
  const fileNames = Array.from(files.keys());
  if (!mimetypeNotFirst && fileNames.includes("mimetype")) {
    const idx = fileNames.indexOf("mimetype");
    fileNames.splice(idx, 1);
    fileNames.unshift("mimetype");
  } else if (mimetypeNotFirst && fileNames.includes("mimetype")) {
    // Put mimetype last
    const idx = fileNames.indexOf("mimetype");
    fileNames.splice(idx, 1);
    fileNames.push("mimetype");
  }

  // Calculate CRC32
  function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // Create local file headers
  for (const name of fileNames) {
    const file = files.get(name)!;
    const crc = crc32(file.content);
    let compressedContent: Buffer;
    let compressionMethod: number;

    if (file.compress) {
      compressedContent = deflateRawSync(file.content);
      compressionMethod = 8; // Deflate
    } else {
      compressedContent = file.content;
      compressionMethod = 0; // Stored
    }

    localFiles.push({
      name,
      content: file.content,
      compressedContent,
      compressionMethod,
      crc32: crc,
      offset,
    });

    // Local file header size: 30 + name length + compressed data length
    offset += 30 + Buffer.byteLength(name, "utf8") + compressedContent.length;
  }

  // Build the ZIP
  const chunks: Buffer[] = [];

  // Write local file headers and data
  for (const file of localFiles) {
    const nameBuffer = Buffer.from(file.name, "utf8");
    const header = Buffer.alloc(30);

    // Local file header signature
    header.writeUInt32LE(0x04034b50, 0);
    // Version needed
    header.writeUInt16LE(20, 4);
    // General purpose bit flag
    header.writeUInt16LE(0, 6);
    // Compression method
    header.writeUInt16LE(file.compressionMethod, 8);
    // Last mod time/date (zeros)
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    // CRC32
    header.writeUInt32LE(file.crc32, 14);
    // Compressed size
    header.writeUInt32LE(file.compressedContent.length, 18);
    // Uncompressed size
    header.writeUInt32LE(file.content.length, 22);
    // File name length
    header.writeUInt16LE(nameBuffer.length, 26);
    // Extra field length
    header.writeUInt16LE(0, 28);

    chunks.push(header, nameBuffer, file.compressedContent);
  }

  // Central directory start offset
  const centralDirOffset = chunks.reduce((sum, c) => sum + c.length, 0);

  // Write central directory
  for (const file of localFiles) {
    const nameBuffer = Buffer.from(file.name, "utf8");
    const header = Buffer.alloc(46);

    // Central directory file header signature
    header.writeUInt32LE(0x02014b50, 0);
    // Version made by
    header.writeUInt16LE(20, 4);
    // Version needed
    header.writeUInt16LE(20, 6);
    // General purpose bit flag
    header.writeUInt16LE(0, 8);
    // Compression method
    header.writeUInt16LE(file.compressionMethod, 10);
    // Last mod time/date (zeros)
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0, 14);
    // CRC32
    header.writeUInt32LE(file.crc32, 16);
    // Compressed size
    header.writeUInt32LE(file.compressedContent.length, 20);
    // Uncompressed size
    header.writeUInt32LE(file.content.length, 24);
    // File name length
    header.writeUInt16LE(nameBuffer.length, 28);
    // Extra field length
    header.writeUInt16LE(0, 30);
    // File comment length
    header.writeUInt16LE(0, 32);
    // Disk number start
    header.writeUInt16LE(0, 34);
    // Internal file attributes
    header.writeUInt16LE(0, 36);
    // External file attributes
    header.writeUInt32LE(0, 38);
    // Relative offset of local header
    header.writeUInt32LE(file.offset, 42);

    chunks.push(header, nameBuffer);
  }

  // End of central directory size
  const centralDirSize = chunks.reduce((sum, c) => sum + c.length, 0) - centralDirOffset;

  // Write end of central directory
  const eocd = Buffer.alloc(22);
  // End of central directory signature
  eocd.writeUInt32LE(0x06054b50, 0);
  // Disk number
  eocd.writeUInt16LE(0, 4);
  // Disk number with central directory
  eocd.writeUInt16LE(0, 6);
  // Number of entries on this disk
  eocd.writeUInt16LE(localFiles.length, 8);
  // Total number of entries
  eocd.writeUInt16LE(localFiles.length, 10);
  // Central directory size
  eocd.writeUInt32LE(centralDirSize, 12);
  // Central directory offset
  eocd.writeUInt32LE(centralDirOffset, 16);
  // Comment length
  eocd.writeUInt16LE(0, 20);

  chunks.push(eocd);

  return Buffer.concat(chunks);
}

describe("Lightweight EPUB Validator", () => {
  beforeAll(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe("createLightweightValidator", () => {
    test("returns a validator with type 'lightweight'", () => {
      const validator = createLightweightValidator();
      expect(validator.type).toBe("lightweight");
    });
  });

  describe("Valid EPUB", () => {
    test("validates a minimal valid EPUB", async () => {
      const epubData = createMinimalEpub();
      const epubPath = join(TEST_DIR, "valid.epub");
      writeFileSync(epubPath, epubData);

      const result = await validateEpubLightweight(epubPath);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("ZIP validation", () => {
    test("rejects non-existent file", async () => {
      const result = await validateEpubLightweight(join(TEST_DIR, "nonexistent.epub"));

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.id).toBe("PKG-001");
    });

    test("rejects non-ZIP file", async () => {
      const epubPath = join(TEST_DIR, "not-a-zip.epub");
      writeFileSync(epubPath, "This is not a ZIP file");

      const result = await validateEpubLightweight(epubPath);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.id).toBe("PKG-002");
    });
  });

  describe("mimetype validation", () => {
    test("rejects EPUB without mimetype", async () => {
      const epubData = createMinimalEpub({ skipMimetype: true });
      const epubPath = join(TEST_DIR, "no-mimetype.epub");
      writeFileSync(epubPath, epubData);

      const result = await validateEpubLightweight(epubPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.id === "PKG-003")).toBe(true);
    });

    test("rejects EPUB with wrong mimetype content", async () => {
      const epubData = createMinimalEpub({ wrongMimetype: true });
      const epubPath = join(TEST_DIR, "wrong-mimetype.epub");
      writeFileSync(epubPath, epubData);

      const result = await validateEpubLightweight(epubPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.id === "PKG-006")).toBe(true);
    });

    test("rejects EPUB with compressed mimetype", async () => {
      const epubData = createMinimalEpub({ compressMimetype: true });
      const epubPath = join(TEST_DIR, "compressed-mimetype.epub");
      writeFileSync(epubPath, epubData);

      const result = await validateEpubLightweight(epubPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.id === "PKG-005")).toBe(true);
    });

    test("rejects EPUB with mimetype not first", async () => {
      const epubData = createMinimalEpub({ mimetypeNotFirst: true });
      const epubPath = join(TEST_DIR, "mimetype-not-first.epub");
      writeFileSync(epubPath, epubData);

      const result = await validateEpubLightweight(epubPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.id === "PKG-004")).toBe(true);
    });
  });

  describe("container.xml validation", () => {
    test("rejects EPUB without container.xml", async () => {
      const epubData = createMinimalEpub({ skipContainer: true });
      const epubPath = join(TEST_DIR, "no-container.epub");
      writeFileSync(epubPath, epubData);

      const result = await validateEpubLightweight(epubPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.id === "PKG-007")).toBe(true);
    });

    test("rejects EPUB with wrong OPF path in container.xml", async () => {
      const epubData = createMinimalEpub({ wrongOpfPath: true });
      const epubPath = join(TEST_DIR, "wrong-opf-path.epub");
      writeFileSync(epubPath, epubData);

      const result = await validateEpubLightweight(epubPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.id === "PKG-009")).toBe(true);
    });
  });

  describe("OPF validation", () => {
    test("rejects EPUB without OPF file", async () => {
      const epubData = createMinimalEpub({ skipOpf: true });
      const epubPath = join(TEST_DIR, "no-opf.epub");
      writeFileSync(epubPath, epubData);

      const result = await validateEpubLightweight(epubPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.id === "PKG-009")).toBe(true);
    });
  });

  describe("Manifest validation", () => {
    test("reports missing manifest item", async () => {
      const epubData = createMinimalEpub({ missingManifestFile: true });
      const epubPath = join(TEST_DIR, "missing-manifest-item.epub");
      writeFileSync(epubPath, epubData);

      const result = await validateEpubLightweight(epubPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.id === "RSC-001")).toBe(true);
      expect(result.errors.some((e) => e.message.includes("missing.xhtml"))).toBe(true);
    });
  });

  describe("Link validation", () => {
    test("reports broken internal links", async () => {
      const epubData = createMinimalEpub({ brokenLink: true });
      const epubPath = join(TEST_DIR, "broken-link.epub");
      writeFileSync(epubPath, epubData);

      const result = await validateEpubLightweight(epubPath);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.id === "RSC-007")).toBe(true);
      expect(result.errors.some((e) => e.message.includes("nonexistent.xhtml"))).toBe(true);
    });
  });

  describe("Navigation document", () => {
    test("warns when nav document is missing", async () => {
      const epubData = createMinimalEpub({ skipNav: true });
      const epubPath = join(TEST_DIR, "no-nav.epub");
      writeFileSync(epubPath, epubData);

      const result = await validateEpubLightweight(epubPath);

      // Should still be valid, but with warning
      expect(result.warnings.some((w) => w.id === "RSC-002")).toBe(true);
    });
  });

  describe("Progress callback", () => {
    test("calls onProgress during validation", async () => {
      const epubData = createMinimalEpub();
      const epubPath = join(TEST_DIR, "progress-test.epub");
      writeFileSync(epubPath, epubData);

      const progressMessages: string[] = [];
      await validateEpubLightweight(epubPath, {
        onProgress: (msg) => progressMessages.push(msg),
      });

      expect(progressMessages.length).toBeGreaterThan(0);
      expect(progressMessages.some((m) => m.includes("ZIP"))).toBe(true);
      expect(progressMessages.some((m) => m.includes("mimetype"))).toBe(true);
    });
  });
});
