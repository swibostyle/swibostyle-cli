#!/usr/bin/env bun
/**
 * CLI script to validate EPUB files using the TeaVM-compiled EPubCheck.
 *
 * Usage: bun validate.ts <epub-file> [epub-file...]
 */

import { readFile, readdir } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { existsSync } from "node:fs";

// ANSI colors for output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
};

interface ValidationMessage {
  severity: string;
  id: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  infos?: ValidationMessage[];
}

/**
 * Load and initialize the TeaVM-compiled WASM module.
 */
async function loadValidator(): Promise<{
  validate: (epubData: Uint8Array) => ValidationResult;
}> {
  const wasmDir = resolve(import.meta.dirname, "..", "wasm");

  // Check if WASM files exist
  if (!existsSync(wasmDir)) {
    throw new Error(
      `WASM directory not found: ${wasmDir}\n` +
        "Run 'bun run build:wasm' first to compile the validator.",
    );
  }

  const files = await readdir(wasmDir);
  console.log(`${colors.gray}WASM directory contents: ${files.join(", ")}${colors.reset}`);

  // TeaVM generates multiple files - look for the main JS entry point
  const jsFile = files.find((f) => f.endsWith(".js") && !f.includes("runtime"));
  const wasmFile = files.find((f) => f.endsWith(".wasm"));

  if (!wasmFile) {
    throw new Error(
      `No .wasm file found in ${wasmDir}\n` +
        "TeaVM compilation may have failed. Check the build logs.",
    );
  }

  // For now, we'll try to load the WASM directly
  // TeaVM's WASM output may require additional JavaScript glue code
  const wasmPath = resolve(wasmDir, wasmFile);
  const wasmBuffer = await readFile(wasmPath);

  console.log(
    `${colors.gray}Loading WASM: ${wasmFile} (${wasmBuffer.length} bytes)${colors.reset}`,
  );

  // Shared state for WASM communication
  let currentEpubData: Uint8Array | null = null;
  let validationResult: ValidationResult | null = null;

  // Create import object for WASM
  const importObject: WebAssembly.Imports = {
    env: {
      // Called by WASM to get EPUB data
      getEpubData: (): Uint8Array => {
        return currentEpubData ?? new Uint8Array(0);
      },
      getEpubDataLength: (): number => {
        return currentEpubData?.length ?? 0;
      },
      // Called by WASM to return result
      setResult: (json: string): void => {
        try {
          validationResult = JSON.parse(json);
        } catch {
          validationResult = {
            valid: false,
            errors: [{ severity: "ERROR", id: "PARSE", message: "Failed to parse result JSON" }],
            warnings: [],
          };
        }
      },
      // Called by WASM for logging
      logMessage: (message: string): void => {
        console.log(`${colors.gray}[WASM] ${message}${colors.reset}`);
      },
    },
    // TeaVM may require additional imports
    teavm: {
      currentTimeMillis: (): bigint => BigInt(Date.now()),
      isnan: (v: number): number => (Number.isNaN(v) ? 1 : 0),
      isinf: (v: number): number => (!Number.isFinite(v) ? 1 : 0),
    },
  };

  try {
    const wasmModule = await WebAssembly.compile(wasmBuffer);
    const instance = await WebAssembly.instantiate(wasmModule, importObject);

    // Get the validate export
    const validateFn = instance.exports["validate"] as (() => void) | undefined;

    if (!validateFn) {
      // List available exports for debugging
      const exports = Object.keys(instance.exports);
      throw new Error(
        `'validate' function not found in WASM exports.\n` +
          `Available exports: ${exports.join(", ")}`,
      );
    }

    return {
      validate: (epubData: Uint8Array): ValidationResult => {
        currentEpubData = epubData;
        validationResult = null;

        try {
          validateFn();
        } catch (error) {
          return {
            valid: false,
            errors: [
              {
                severity: "FATAL",
                id: "WASM_ERROR",
                message: `WASM execution error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            warnings: [],
          };
        }

        return (
          validationResult ?? {
            valid: false,
            errors: [
              { severity: "ERROR", id: "NO_RESULT", message: "No result returned from validator" },
            ],
            warnings: [],
          }
        );
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to instantiate WASM module: ${error instanceof Error ? error.message : String(error)}\n` +
        "TeaVM WASM may require browser-specific APIs not available in Node.js/Bun.",
    );
  }
}

/**
 * Format validation result for console output.
 */
function formatResult(file: string, result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push(`${colors.green}✓ ${basename(file)}: Valid${colors.reset}`);
  } else {
    lines.push(`${colors.red}✗ ${basename(file)}: Invalid${colors.reset}`);
  }

  for (const error of result.errors) {
    lines.push(`  ${colors.red}ERROR [${error.id}]: ${error.message}${colors.reset}`);
  }

  for (const warning of result.warnings) {
    lines.push(`  ${colors.yellow}WARN [${warning.id}]: ${warning.message}${colors.reset}`);
  }

  return lines.join("\n");
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: bun validate.ts <epub-file> [epub-file...]");
    process.exit(1);
  }

  console.log(`${colors.blue}EPUB Validator (TeaVM/EPubCheck)${colors.reset}\n`);

  let validator: Awaited<ReturnType<typeof loadValidator>>;

  try {
    validator = await loadValidator();
    console.log(`${colors.green}Validator loaded successfully${colors.reset}\n`);
  } catch (error) {
    console.error(`${colors.red}Failed to load validator:${colors.reset}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  let hasErrors = false;

  for (const arg of args) {
    const filePath = resolve(arg);

    if (!existsSync(filePath)) {
      console.error(`${colors.red}File not found: ${filePath}${colors.reset}`);
      hasErrors = true;
      continue;
    }

    try {
      const epubData = new Uint8Array(await readFile(filePath));
      console.log(`Validating: ${basename(filePath)} (${epubData.length} bytes)`);

      const result = validator.validate(epubData);
      console.log(formatResult(filePath, result));
      console.log();

      if (!result.valid) {
        hasErrors = true;
      }
    } catch (error) {
      console.error(`${colors.red}Error validating ${filePath}:${colors.reset}`);
      console.error(error instanceof Error ? error.message : String(error));
      hasErrors = true;
    }
  }

  process.exit(hasErrors ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
