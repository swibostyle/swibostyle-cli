/**
 * Configuration module
 *
 * Provides both legacy book.json support and new book.config.ts support.
 */

// Types
export type {
  UserConfig,
  ResolvedConfig,
  ConfigExport,
  MarkdownPlugin,
  CSSPlugin,
  ImagePlugin,
  BuildHooks,
  Validator,
  ValidatorFactory,
  ValidatorOptions,
  ValidationMessage,
  ValidationResult,
  PluginContext,
  AdapterConfig,
  SassAdapterOptions as SassAdapterConfigOptions,
  ImageAdapterOptions,
  VFMOptions,
} from "./types";

// Define helpers
export {
  defineConfig,
  defineMarkdownPlugin,
  defineCSSPlugin,
  defineImagePlugin,
  resolveConfig,
  resolveConfigExport,
  extractBookConfig,
  chainValidators,
} from "./define";

// Loader
export { loadBookConfig, loadConfig, findConfigFile, getDefaultBookConfig } from "./loader";

// Built-in validators
export {
  createEpubCheckValidator,
  createCustomValidator,
  warningsOnly,
  ignoreErrors,
  targetOnly,
  noopValidator,
} from "./validators";
