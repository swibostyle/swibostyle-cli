/**
 * @swibostyle/epub-validator
 *
 * EPUB validation using W3C EPubCheck or lightweight built-in validator.
 * Automatically uses bundled binary or falls back to system Java.
 */

export { validateEpub, createValidator } from "./validator";
export { validateEpubLightweight, createLightweightValidator } from "./lightweight-validator";
export type {
  ValidationResult,
  ValidationMessage,
  ValidateOptions,
  EpubValidator,
  EpubCheckProvider,
} from "./types";
