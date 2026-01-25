import { readFileSync } from "node:fs";
import { dirname, posix } from "node:path";
import type { ValidationResult, ValidationMessage, ValidateOptions, EpubValidator } from "./types";

interface ZipEntry {
  fileName: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
}

interface ZipReader {
  entries: Map<string, ZipEntry>;
  buffer: Buffer;
  mimetypeEntry: ZipEntry | null;
  firstEntryName: string | null;
}

const ZIP_LOCAL_HEADER_SIG = 0x04034b50;
const ZIP_CENTRAL_DIR_SIG = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIR_SIG = 0x06054b50;

/**
 * Read ZIP file and extract entries metadata
 */
function readZipFile(buffer: Buffer): ZipReader {
  const entries = new Map<string, ZipEntry>();
  let mimetypeEntry: ZipEntry | null = null;
  let firstEntryName: string | null = null;

  // Find End of Central Directory
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === ZIP_END_OF_CENTRAL_DIR_SIG) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("Not a valid ZIP file: End of Central Directory not found");
  }

  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirEntries = buffer.readUInt16LE(eocdOffset + 10);

  // Read Central Directory
  let offset = centralDirOffset;
  for (let i = 0; i < centralDirEntries; i++) {
    if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIR_SIG) {
      throw new Error("Invalid Central Directory entry");
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);

    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    const entry: ZipEntry = {
      fileName,
      compressedSize,
      uncompressedSize,
      compressionMethod,
      localHeaderOffset,
    };

    entries.set(fileName, entry);

    if (fileName === "mimetype") {
      mimetypeEntry = entry;
    }

    if (firstEntryName === null) {
      // Track the first entry by local header offset
      firstEntryName = fileName;
    }

    offset += 46 + fileNameLength + extraFieldLength + commentLength;
  }

  // Determine actual first entry by local header offset
  let minOffset = Number.POSITIVE_INFINITY;
  for (const entry of entries.values()) {
    if (entry.localHeaderOffset < minOffset) {
      minOffset = entry.localHeaderOffset;
      firstEntryName = entry.fileName;
    }
  }

  return { entries, buffer, mimetypeEntry, firstEntryName };
}

/**
 * Read file content from ZIP
 */
function readFileFromZip(zip: ZipReader, fileName: string): Buffer {
  const entry = zip.entries.get(fileName);
  if (!entry) {
    throw new Error(`File not found in ZIP: ${fileName}`);
  }

  const { buffer } = zip;
  const localOffset = entry.localHeaderOffset;

  // Verify local header
  if (buffer.readUInt32LE(localOffset) !== ZIP_LOCAL_HEADER_SIG) {
    throw new Error(`Invalid local header for ${fileName}`);
  }

  const localFileNameLength = buffer.readUInt16LE(localOffset + 26);
  const localExtraFieldLength = buffer.readUInt16LE(localOffset + 28);
  const dataOffset = localOffset + 30 + localFileNameLength + localExtraFieldLength;

  const compressedData = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    // Stored (no compression)
    return compressedData;
  } else if (entry.compressionMethod === 8) {
    // Deflate
    const { inflateRawSync } = require("node:zlib");
    return inflateRawSync(compressedData);
  } else {
    throw new Error(`Unsupported compression method: ${entry.compressionMethod}`);
  }
}

/**
 * Extract all href/src attributes from XHTML content
 */
function extractLinks(xhtml: string): string[] {
  const links: string[] = [];

  // href attributes
  const hrefRegex = /\shref=["']([^"'#][^"']*)["']/gi;
  let match;
  while ((match = hrefRegex.exec(xhtml)) !== null) {
    if (
      match[1] &&
      !match[1].startsWith("http://") &&
      !match[1].startsWith("https://") &&
      !match[1].startsWith("mailto:")
    ) {
      links.push(match[1]);
    }
  }

  // src attributes
  const srcRegex = /\ssrc=["']([^"'#][^"']*)["']/gi;
  while ((match = srcRegex.exec(xhtml)) !== null) {
    if (
      match[1] &&
      !match[1].startsWith("http://") &&
      !match[1].startsWith("https://") &&
      !match[1].startsWith("data:")
    ) {
      links.push(match[1]);
    }
  }

  return links;
}

/**
 * Parse OPF manifest items
 */
interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
}

function parseOPFManifest(opfContent: string): ManifestItem[] {
  const items: ManifestItem[] = [];
  const itemRegex = /<item\s+([^>]*)\/?>|<item\s+([^>]*)>[^<]*<\/item>/gi;

  let match;
  while ((match = itemRegex.exec(opfContent)) !== null) {
    const attrs = match[1] || match[2] || "";

    const idMatch = attrs.match(/\bid=["']([^"']*)["']/i);
    const hrefMatch = attrs.match(/\bhref=["']([^"']*)["']/i);
    const mediaTypeMatch = attrs.match(/\bmedia-type=["']([^"']*)["']/i);

    if (idMatch && hrefMatch && mediaTypeMatch) {
      items.push({
        id: idMatch[1] ?? "",
        href: decodeURIComponent(hrefMatch[1] ?? ""),
        mediaType: mediaTypeMatch[1] ?? "",
      });
    }
  }

  return items;
}

/**
 * Parse container.xml to get OPF path
 */
function parseContainerXml(content: string): string | null {
  const match = content.match(/<rootfile[^>]+full-path=["']([^"']*)["']/i);
  return match ? (match[1] ?? null) : null;
}

/**
 * Normalize path for ZIP lookup
 */
function normalizePath(basePath: string, href: string): string {
  // Handle URL-encoded paths
  const decoded = decodeURIComponent(href);

  // Remove fragment
  const withoutFragment = decoded.split("#")[0] ?? decoded;

  // Resolve relative path
  const baseDir = dirname(basePath);
  const resolved = posix.normalize(posix.join(baseDir, withoutFragment));

  // Remove leading slash if present
  return resolved.startsWith("/") ? resolved.slice(1) : resolved;
}

/**
 * Create a lightweight EPUB validator
 */
export function createLightweightValidator(): EpubValidator {
  return {
    type: "lightweight",

    async validate(epubPath: string, options?: ValidateOptions): Promise<ValidationResult> {
      const errors: ValidationMessage[] = [];
      const warnings: ValidationMessage[] = [];

      options?.onProgress?.("Reading EPUB file...");

      let buffer: Buffer;
      try {
        buffer = readFileSync(epubPath);
      } catch (e) {
        return {
          valid: false,
          errors: [
            {
              severity: "FATAL",
              id: "PKG-001",
              message: `Cannot read EPUB file: ${e instanceof Error ? e.message : String(e)}`,
            },
          ],
          warnings: [],
        };
      }

      // 1. Check if it's a valid ZIP file
      options?.onProgress?.("Checking ZIP structure...");
      let zip: ZipReader;
      try {
        zip = readZipFile(buffer);
      } catch (e) {
        return {
          valid: false,
          errors: [
            {
              severity: "FATAL",
              id: "PKG-002",
              message: `Not a valid ZIP archive: ${e instanceof Error ? e.message : String(e)}`,
            },
          ],
          warnings: [],
        };
      }

      // 2. Check mimetype entry
      options?.onProgress?.("Checking mimetype...");

      if (!zip.mimetypeEntry) {
        errors.push({
          severity: "ERROR",
          id: "PKG-003",
          message: "Missing required 'mimetype' file",
        });
      } else {
        // Check if mimetype is the first entry
        if (zip.firstEntryName !== "mimetype") {
          errors.push({
            severity: "ERROR",
            id: "PKG-004",
            message: `'mimetype' must be the first file in the archive (found: ${zip.firstEntryName})`,
          });
        }

        // Check compression method (must be stored, not compressed)
        if (zip.mimetypeEntry.compressionMethod !== 0) {
          errors.push({
            severity: "ERROR",
            id: "PKG-005",
            message: "'mimetype' must be stored uncompressed (compression method 0)",
          });
        }

        // Check mimetype content
        try {
          const mimetypeContent = readFileFromZip(zip, "mimetype").toString("utf8").trim();
          if (mimetypeContent !== "application/epub+zip") {
            errors.push({
              severity: "ERROR",
              id: "PKG-006",
              message: `Invalid mimetype content: expected 'application/epub+zip', got '${mimetypeContent}'`,
            });
          }
        } catch (e) {
          errors.push({
            severity: "ERROR",
            id: "PKG-006",
            message: `Cannot read mimetype: ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      }

      // 3. Check META-INF/container.xml
      options?.onProgress?.("Checking container.xml...");

      if (!zip.entries.has("META-INF/container.xml")) {
        errors.push({
          severity: "ERROR",
          id: "PKG-007",
          message: "Missing required 'META-INF/container.xml'",
        });
        return { valid: errors.length === 0, errors, warnings };
      }

      let opfPath: string | null = null;
      try {
        const containerContent = readFileFromZip(zip, "META-INF/container.xml").toString("utf8");
        opfPath = parseContainerXml(containerContent);

        if (!opfPath) {
          errors.push({
            severity: "ERROR",
            id: "PKG-008",
            message: "Cannot find rootfile in container.xml",
          });
          return { valid: errors.length === 0, errors, warnings };
        }
      } catch (e) {
        errors.push({
          severity: "ERROR",
          id: "PKG-008",
          message: `Cannot parse container.xml: ${e instanceof Error ? e.message : String(e)}`,
        });
        return { valid: errors.length === 0, errors, warnings };
      }

      // 4. Check OPF file exists
      options?.onProgress?.("Checking OPF package document...");

      if (!zip.entries.has(opfPath)) {
        errors.push({
          severity: "ERROR",
          id: "PKG-009",
          message: `OPF file not found: ${opfPath}`,
          location: { path: opfPath },
        });
        return { valid: errors.length === 0, errors, warnings };
      }

      let opfContent: string;
      let manifestItems: ManifestItem[];
      try {
        opfContent = readFileFromZip(zip, opfPath).toString("utf8");
        manifestItems = parseOPFManifest(opfContent);
      } catch (e) {
        errors.push({
          severity: "ERROR",
          id: "PKG-010",
          message: `Cannot parse OPF: ${e instanceof Error ? e.message : String(e)}`,
          location: { path: opfPath },
        });
        return { valid: errors.length === 0, errors, warnings };
      }

      // 5. Check all manifest items exist
      options?.onProgress?.("Checking manifest items...");

      const opfDir = dirname(opfPath);
      const manifestPaths = new Set<string>();

      for (const item of manifestItems) {
        const itemPath = opfDir ? posix.normalize(posix.join(opfDir, item.href)) : item.href;
        manifestPaths.add(itemPath);

        if (!zip.entries.has(itemPath)) {
          errors.push({
            severity: "ERROR",
            id: "RSC-001",
            message: `Referenced file not found: ${item.href}`,
            location: { path: opfPath },
          });
        }
      }

      // 6. Check for nav document (required in EPUB 3)
      const navMatch =
        opfContent.match(
          /<item[^>]+properties=["'][^"']*nav[^"']*["'][^>]*href=["']([^"']*)["']/i,
        ) ||
        opfContent.match(/<item[^>]+href=["']([^"']*)["'][^>]*properties=["'][^"']*nav[^"']*["']/i);

      if (!navMatch) {
        warnings.push({
          severity: "WARNING",
          id: "RSC-002",
          message: "No navigation document found (EPUB 3 requires nav document)",
          location: { path: opfPath },
        });
      }

      // 7. Check links in XHTML pages
      options?.onProgress?.("Checking internal links...");

      const xhtmlItems = manifestItems.filter((item) => item.mediaType === "application/xhtml+xml");

      for (const item of xhtmlItems) {
        const itemPath = opfDir ? posix.normalize(posix.join(opfDir, item.href)) : item.href;

        if (!zip.entries.has(itemPath)) {
          continue; // Already reported as missing
        }

        try {
          const content = readFileFromZip(zip, itemPath).toString("utf8");
          const links = extractLinks(content);

          for (const link of links) {
            const linkPath = normalizePath(itemPath, link);

            // Check if link target exists
            if (!zip.entries.has(linkPath) && !manifestPaths.has(linkPath)) {
              errors.push({
                severity: "ERROR",
                id: "RSC-007",
                message: `Broken link: ${link}`,
                location: { path: itemPath },
              });
            }
          }
        } catch (e) {
          warnings.push({
            severity: "WARNING",
            id: "RSC-003",
            message: `Cannot check links in ${item.href}: ${e instanceof Error ? e.message : String(e)}`,
            location: { path: itemPath },
          });
        }
      }

      options?.onProgress?.("Validation complete");

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    },
  };
}

/**
 * Validate an EPUB file using the lightweight validator.
 *
 * @param epubPath - Path to the EPUB file
 * @param options - Validation options
 * @returns Validation result
 *
 * @example
 * ```ts
 * import { validateEpubLightweight } from "@swibostyle/epub-validator";
 *
 * const result = await validateEpubLightweight("book.epub");
 * if (result.valid) {
 *   console.log("EPUB passes basic validation!");
 * } else {
 *   console.error("Errors:", result.errors);
 * }
 * ```
 */
export async function validateEpubLightweight(
  epubPath: string,
  options?: ValidateOptions,
): Promise<ValidationResult> {
  const validator = createLightweightValidator();
  return validator.validate(epubPath, options);
}
