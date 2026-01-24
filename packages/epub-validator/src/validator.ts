import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ValidationResult,
  ValidateOptions,
  EpubValidator,
  EpubCheckProvider,
} from "./types.js";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Try to load a bundled EPubCheck provider (e.g., linux-x64).
 */
async function tryLoadBundledProvider(): Promise<EpubCheckProvider | null> {
  // Try to import optional platform-specific package
  const platformPackages = [
    "@swibostyle/epub-validator-linux-x64",
    // Future: add more platforms
    // "@swibostyle/epub-validator-darwin-arm64",
    // "@swibostyle/epub-validator-darwin-x64",
    // "@swibostyle/epub-validator-win32-x64",
  ];

  for (const pkg of platformPackages) {
    try {
      const module = await import(pkg);
      const provider = module.default as EpubCheckProvider;
      if (provider.isAvailable()) {
        return provider;
      }
    } catch {
      // Package not installed or not available for this platform
    }
  }

  return null;
}

/**
 * Find system Java installation.
 */
async function findSystemJava(): Promise<string | null> {
  // Check JAVA_HOME
  if (process.env["JAVA_HOME"]) {
    const javaPath = resolve(process.env["JAVA_HOME"], "bin", "java");
    if (existsSync(javaPath)) {
      return javaPath;
    }
  }

  // Try to find java in PATH
  try {
    const { stdout } = await execFileAsync("which", ["java"]);
    const javaPath = stdout.trim();
    if (javaPath && existsSync(javaPath)) {
      return javaPath;
    }
  } catch {
    // which command failed or java not found
  }

  // Windows: try where command
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync("where", ["java"]);
      const javaPath = stdout.trim().split("\n")[0];
      if (javaPath && existsSync(javaPath)) {
        return javaPath;
      }
    } catch {
      // where command failed or java not found
    }
  }

  return null;
}

/**
 * Find epubcheck.jar bundled with this package or downloaded.
 */
function findEpubCheckJar(): string | null {
  const possiblePaths = [
    resolve(__dirname, "..", "bin", "epubcheck.jar"),
    resolve(__dirname, "..", "epubcheck.jar"),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Create a system Java-based validator.
 */
function createSystemJavaValidator(javaPath: string, jarPath: string): EpubValidator {
  return {
    type: "system-java",

    async validate(epubPath: string, options?: ValidateOptions): Promise<ValidationResult> {
      const args = ["-jar", jarPath, "--json", "-"];

      if (options?.profile && options.profile !== "default") {
        args.push("--profile", options.profile);
      }

      args.push(epubPath);

      options?.onProgress?.(`Running: ${javaPath} ${args.join(" ")}`);

      try {
        const { stdout, stderr } = await execFileAsync(javaPath, args, {
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large reports
        });

        options?.onProgress?.("Parsing EPubCheck output...");

        return parseEpubCheckJson(stdout || stderr, options);
      } catch (error) {
        // EPubCheck returns non-zero exit code for invalid EPUBs
        if (
          error &&
          typeof error === "object" &&
          "stdout" in error &&
          typeof error.stdout === "string"
        ) {
          return parseEpubCheckJson(error.stdout, options);
        }

        throw new Error(
          `EPubCheck execution failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
}

/**
 * Create a bundled binary-based validator.
 */
function createBundledValidator(provider: EpubCheckProvider): EpubValidator {
  return {
    type: "bundled",

    async validate(epubPath: string, options?: ValidateOptions): Promise<ValidationResult> {
      const cmdArray = provider.getCommand(epubPath, true);
      const command = cmdArray[0];
      if (!command) {
        throw new Error("Provider returned empty command array");
      }
      const args = cmdArray.slice(1);

      options?.onProgress?.(`Running: ${command} ${args.join(" ")}`);

      try {
        const { stdout, stderr } = await execFileAsync(command, args, {
          maxBuffer: 10 * 1024 * 1024,
        });

        options?.onProgress?.("Parsing EPubCheck output...");

        return parseEpubCheckJson(stdout || stderr, options);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "stdout" in error &&
          typeof error.stdout === "string"
        ) {
          return parseEpubCheckJson(error.stdout, options);
        }

        throw new Error(
          `EPubCheck execution failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };
}

/**
 * Parse EPubCheck JSON output.
 */
function parseEpubCheckJson(jsonOutput: string, options?: ValidateOptions): ValidationResult {
  try {
    const data = JSON.parse(jsonOutput) as {
      messages?: Array<{
        severity: string;
        ID: string;
        message: string;
        locations?: Array<{
          path?: string;
          line?: number;
          column?: number;
        }>;
      }>;
    };

    const errors: ValidationResult["errors"] = [];
    const warnings: ValidationResult["warnings"] = [];
    const infos: ValidationResult["infos"] = [];

    for (const msg of data.messages ?? []) {
      const severity = msg.severity.toUpperCase() as "FATAL" | "ERROR" | "WARNING" | "INFO";
      const location = msg.locations?.[0];

      const validationMsg = {
        severity,
        id: msg.ID,
        message: msg.message,
        ...(location && {
          location: {
            path: location.path ?? "",
            line: location.line,
            column: location.column,
          },
        }),
      };

      switch (severity) {
        case "FATAL":
        case "ERROR":
          errors.push(validationMsg);
          break;
        case "WARNING":
          warnings.push(validationMsg);
          break;
        case "INFO":
          if (options?.includeInfos) {
            infos.push(validationMsg);
          }
          break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      ...(options?.includeInfos && { infos }),
    };
  } catch {
    return {
      valid: false,
      errors: [
        {
          severity: "FATAL",
          id: "PARSE_ERROR",
          message: `Failed to parse EPubCheck output: ${jsonOutput.slice(0, 200)}...`,
        },
      ],
      warnings: [],
    };
  }
}

/**
 * Create an EPUB validator with automatic fallback.
 *
 * Resolution order:
 * 1. Bundled binary (e.g., @swibostyle/epub-validator-linux-x64)
 * 2. System Java + bundled epubcheck.jar
 *
 * @example
 * ```ts
 * const validator = await createValidator();
 * const result = await validator.validate("book.epub");
 * console.log(result.valid ? "Valid!" : "Invalid");
 * ```
 */
export async function createValidator(): Promise<EpubValidator> {
  // Try bundled binary first
  const bundledProvider = await tryLoadBundledProvider();
  if (bundledProvider) {
    return createBundledValidator(bundledProvider);
  }

  // Fall back to system Java
  const javaPath = await findSystemJava();
  const jarPath = findEpubCheckJar();

  if (javaPath && jarPath) {
    return createSystemJavaValidator(javaPath, jarPath);
  }

  // Neither available
  const hints: string[] = [];
  if (!javaPath) {
    hints.push("Java not found. Install Java 11+ or set JAVA_HOME.");
  }
  if (!jarPath) {
    hints.push("epubcheck.jar not found.");
  }
  hints.push("Alternatively, install @swibostyle/epub-validator-linux-x64 for bundled runtime.");

  throw new Error(`EPubCheck not available.\n${hints.join("\n")}`);
}

/**
 * Validate an EPUB file (one-shot).
 *
 * @param epubPath - Path to the EPUB file
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
  epubPath: string,
  options?: ValidateOptions,
): Promise<ValidationResult> {
  const validator = await createValidator();
  return validator.validate(epubPath, options);
}
