import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { ValidationResult, ValidateOptions } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * WASM module interface for EPubCheck.
 */
interface EpubCheckWasm {
  validate: () => void;
}

/**
 * Validator instance that can be reused for multiple validations.
 */
export interface EpubValidator {
  /**
   * Validate an EPUB file.
   * @param epub - EPUB data as Uint8Array or path to EPUB file
   * @param options - Validation options
   * @returns Validation result
   */
  validate(epub: Uint8Array | string, options?: ValidateOptions): Promise<ValidationResult>;

  /**
   * Check if the WASM module is loaded.
   */
  isReady(): boolean;
}

/**
 * Shared state for WASM communication.
 */
let epubData: Uint8Array | null = null;
let validationResult: ValidationResult | null = null;
let logCallback: ((message: string) => void) | null = null;

/**
 * Create import object for WASM module.
 */
function createImportObject(): WebAssembly.Imports {
  return {
    env: {
      getEpubData: (): Uint8Array => {
        return epubData ?? new Uint8Array(0);
      },
      getEpubDataLength: (): number => {
        return epubData?.length ?? 0;
      },
      setResult: (json: string): void => {
        try {
          validationResult = JSON.parse(json) as ValidationResult;
        } catch {
          validationResult = {
            valid: false,
            errors: [{ severity: "ERROR", id: "PARSE", message: "Failed to parse result" }],
            warnings: [],
          };
        }
      },
      logMessage: (message: string): void => {
        logCallback?.(message);
      },
    },
  };
}

/**
 * Load the WASM module.
 */
async function loadWasmModule(): Promise<EpubCheckWasm> {
  const wasmPath = join(__dirname, "..", "wasm", "epubcheck.wasm");

  try {
    const wasmBuffer = await readFile(wasmPath);
    const wasmModule = await WebAssembly.compile(wasmBuffer);
    const instance = await WebAssembly.instantiate(wasmModule, createImportObject());

    return {
      validate: instance.exports["validate"] as () => void,
    };
  } catch (error) {
    throw new Error(
      `Failed to load EPubCheck WASM module: ${error instanceof Error ? error.message : String(error)}\n` +
        `Make sure to run 'bun run build:wasm' first to compile the WASM module.`,
    );
  }
}

/**
 * Create a reusable validator instance.
 *
 * @example
 * ```ts
 * const validator = await createValidator();
 * const result = await validator.validate("book.epub");
 * console.log(result.valid ? "Valid!" : "Invalid");
 * ```
 */
export async function createValidator(): Promise<EpubValidator> {
  const wasm = await loadWasmModule();
  let ready = true;

  return {
    async validate(
      epub: Uint8Array | string,
      options?: ValidateOptions,
    ): Promise<ValidationResult> {
      // Load EPUB data
      if (typeof epub === "string") {
        epubData = new Uint8Array(await readFile(epub));
      } else {
        epubData = epub;
      }

      // Set up logging
      logCallback = options?.onProgress ?? null;

      // Reset result
      validationResult = null;

      // Run validation
      try {
        wasm.validate();
      } catch (error) {
        return {
          valid: false,
          errors: [
            {
              severity: "FATAL",
              id: "WASM",
              message: `WASM execution error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          warnings: [],
        };
      }

      // Return result
      if (!validationResult) {
        return {
          valid: false,
          errors: [
            { severity: "ERROR", id: "NO_RESULT", message: "No validation result received" },
          ],
          warnings: [],
        };
      }

      // Copy to local variable with explicit type assertion
      // (TypeScript can't narrow global variables across async boundaries)
      const result: ValidationResult = validationResult;

      // Filter out infos if not requested
      if (!options?.includeInfos && result.infos) {
        delete result.infos;
      }

      return result;
    },

    isReady(): boolean {
      return ready;
    },
  };
}

/**
 * Validate an EPUB file (one-shot).
 *
 * For multiple validations, use `createValidator()` instead to avoid
 * reloading the WASM module each time.
 *
 * @param epub - EPUB data as Uint8Array or path to EPUB file
 * @param options - Validation options
 * @returns Validation result
 *
 * @example
 * ```ts
 * import { validateEpub } from "@swibostyle/epub-validator";
 *
 * const result = await validateEpub("book.epub");
 * if (result.valid) {
 *   console.log("EPUB is valid!");
 * } else {
 *   console.error("Errors:", result.errors);
 * }
 * ```
 */
export async function validateEpub(
  epub: Uint8Array | string,
  options?: ValidateOptions,
): Promise<ValidationResult> {
  const validator = await createValidator();
  return validator.validate(epub, options);
}
