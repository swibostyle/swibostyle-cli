/**
 * Built-in validator factories for book.config.ts
 */

import type { Validator, ValidatorFactory, ValidatorOptions, ValidationResult } from "./types";

/**
 * Create an EPubCheck validator using @swibostyle/epub-validator
 *
 * @example
 * ```ts
 * import { defineConfig, createEpubCheckValidator } from "@swibostyle/core";
 *
 * export default defineConfig({
 *   // ...
 *   validators: [
 *     createEpubCheckValidator({ profile: "default" }),
 *   ],
 * });
 * ```
 */
export function createEpubCheckValidator(options?: Partial<ValidatorOptions>): ValidatorFactory {
  return async () => {
    // Dynamically import epub-validator to avoid hard dependency
    // Use unknown type since this is an optional peer dependency
    interface EpubValidatorInstance {
      validate(path: string, opts?: ValidatorOptions): Promise<ValidationResult>;
    }

    let epubValidatorModule: unknown;

    try {
      // Dynamic import - package may not be installed
      // Use a variable to prevent static analysis of the module path
      const moduleName = "@swibostyle/epub-validator";
      epubValidatorModule = await import(moduleName);
    } catch {
      throw new Error(
        "EPubCheck validator requires @swibostyle/epub-validator.\n" +
          "Install it with: bun add @swibostyle/epub-validator",
      );
    }

    const mod = epubValidatorModule as { createValidator: () => Promise<EpubValidatorInstance> };
    const validator = await mod.createValidator();

    return {
      name: "epubcheck",
      async validate(epubPath, runtimeOptions) {
        const mergedOptions = { ...options, ...runtimeOptions };
        return validator.validate(epubPath, mergedOptions);
      },
    };
  };
}

/**
 * Create a custom validator from a function
 *
 * @example
 * ```ts
 * import { defineConfig, createCustomValidator } from "@swibostyle/core";
 *
 * export default defineConfig({
 *   // ...
 *   validators: [
 *     createCustomValidator("my-validator", async (epubPath) => {
 *       // Custom validation logic
 *       return { valid: true, errors: [], warnings: [] };
 *     }),
 *   ],
 * });
 * ```
 */
export function createCustomValidator(
  name: string,
  validateFn: (epubPath: string, options?: ValidatorOptions) => Promise<ValidationResult>,
): ValidatorFactory {
  return async () => ({
    name,
    validate: validateFn,
  });
}

/**
 * Create a validator that only runs warnings (never fails)
 *
 * Wraps another validator but converts all errors to warnings.
 *
 * @example
 * ```ts
 * import { defineConfig, createEpubCheckValidator, warningsOnly } from "@swibostyle/core";
 *
 * export default defineConfig({
 *   // ...
 *   validators: [
 *     warningsOnly(createEpubCheckValidator()),
 *   ],
 * });
 * ```
 */
export function warningsOnly(factory: ValidatorFactory): ValidatorFactory {
  return async () => {
    const validator = await factory();

    return {
      name: `warnings-only(${validator.name})`,
      async validate(epubPath, options) {
        const result = await validator.validate(epubPath, options);

        return {
          valid: true,
          errors: [],
          warnings: [
            ...result.errors.map((e) => ({ ...e, severity: "WARNING" as const })),
            ...result.warnings,
          ],
          infos: result.infos,
        };
      },
    };
  };
}

/**
 * Create a validator that ignores specific error IDs
 *
 * @example
 * ```ts
 * import { defineConfig, createEpubCheckValidator, ignoreErrors } from "@swibostyle/core";
 *
 * export default defineConfig({
 *   // ...
 *   validators: [
 *     ignoreErrors(createEpubCheckValidator(), ["CSS-008", "CSS-010"]),
 *   ],
 * });
 * ```
 */
export function ignoreErrors(factory: ValidatorFactory, errorIds: string[]): ValidatorFactory {
  return async () => {
    const validator = await factory();
    const ignoreSet = new Set(errorIds);

    return {
      name: `ignore(${validator.name}, [${errorIds.join(", ")}])`,
      async validate(epubPath, options) {
        const result = await validator.validate(epubPath, options);

        const filteredErrors = result.errors.filter((e) => !ignoreSet.has(e.id));
        const filteredWarnings = result.warnings.filter((e) => !ignoreSet.has(e.id));

        return {
          valid: filteredErrors.length === 0,
          errors: filteredErrors,
          warnings: filteredWarnings,
          infos: result.infos?.filter((e) => !ignoreSet.has(e.id)),
        };
      },
    };
  };
}

/**
 * Create a validator that only runs for specific targets
 *
 * @example
 * ```ts
 * import { defineConfig, createEpubCheckValidator, targetOnly } from "@swibostyle/core";
 *
 * export default defineConfig({
 *   // ...
 *   validators: [
 *     targetOnly(createEpubCheckValidator(), ["epub", "pod"]),
 *   ],
 * });
 * ```
 */
export function targetOnly(factory: ValidatorFactory, targets: string[]): ValidatorFactory {
  // Store target context - this will be set by the build system
  let currentTarget: string | undefined;

  return async () => {
    const validator = await factory();

    return {
      name: `target-only(${validator.name}, [${targets.join(", ")}])`,
      async validate(epubPath, options) {
        // Skip validation if current target is not in the list
        if (currentTarget && !targets.includes(currentTarget)) {
          return { valid: true, errors: [], warnings: [] };
        }

        return validator.validate(epubPath, options);
      },
      // Allow setting target from build context
      setTarget(target: string) {
        currentTarget = target;
      },
    } as Validator & { setTarget(target: string): void };
  };
}

/**
 * No-op validator that always passes
 *
 * Useful for disabling validation or as a placeholder
 *
 * @example
 * ```ts
 * import { defineConfig, noopValidator } from "@swibostyle/core";
 *
 * export default defineConfig({
 *   // ...
 *   validators: [noopValidator()],
 * });
 * ```
 */
export function noopValidator(): ValidatorFactory {
  return async () => ({
    name: "noop",
    async validate() {
      return { valid: true, errors: [], warnings: [] };
    },
  });
}
