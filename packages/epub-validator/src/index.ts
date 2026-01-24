/**
 * @swibostyle/epub-validator
 *
 * EPUB validation using W3C EPubCheck.
 * Automatically uses bundled binary or falls back to system Java.
 */

export { validateEpub, createValidator } from "./validator";
export type {
  ValidationResult,
  ValidationMessage,
  ValidateOptions,
  EpubValidator,
  EpubCheckProvider,
} from "./types";
