/**
 * @swibostyle/epub-validator
 *
 * EPUB validation using W3C EPubCheck compiled to WebAssembly via TeaVM.
 * Runs entirely in Node.js/Bun without requiring Java.
 */

export { validateEpub, createValidator } from "./validator.js";
export type { ValidationResult, ValidationMessage, ValidateOptions } from "./types.js";
