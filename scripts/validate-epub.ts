#!/usr/bin/env bun
/**
 * EPUB validation script using @swibostyle/epub-validator
 * Usage: bun scripts/validate-epub.ts <epub-file> [<epub-file>...]
 */

import { validateEpub } from "@swibostyle/epub-validator";

async function main() {
  const files = process.argv.slice(2);

  if (files.length === 0) {
    console.error("Usage: bun scripts/validate-epub.ts <epub-file> [<epub-file>...]");
    process.exit(1);
  }

  let hasErrors = false;

  for (const file of files) {
    console.log(`\nValidating: ${file}`);

    try {
      const result = await validateEpub(file, {
        onProgress: (msg) => console.log(`  ${msg}`),
      });

      if (result.valid) {
        console.log(`  ✓ Valid`);
      } else {
        hasErrors = true;
        console.log(`  ✗ Invalid (${result.errors.length} errors, ${result.warnings.length} warnings)`);

        for (const error of result.errors) {
          const loc = error.location ? ` at ${error.location.path}:${error.location.line ?? "?"}` : "";
          console.log(`    ERROR [${error.id}]${loc}: ${error.message}`);
        }

        for (const warning of result.warnings) {
          const loc = warning.location ? ` at ${warning.location.path}:${warning.location.line ?? "?"}` : "";
          console.log(`    WARN [${warning.id}]${loc}: ${warning.message}`);
        }
      }
    } catch (error) {
      hasErrors = true;
      console.error(`  ✗ Failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log("\nAll EPUBs validated successfully");
}

main();
