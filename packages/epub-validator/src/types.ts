/**
 * Validation message from EPubCheck.
 */
export interface ValidationMessage {
  /** Severity level: FATAL, ERROR, WARNING, INFO */
  severity: "FATAL" | "ERROR" | "WARNING" | "INFO";
  /** EPubCheck message ID (e.g., "RSC-005") */
  id: string;
  /** Human-readable message */
  message: string;
  /** Location in the EPUB (optional) */
  location?: {
    path: string;
    line?: number;
    column?: number;
  };
}

/**
 * Result of EPUB validation.
 */
export interface ValidationResult {
  /** Whether the EPUB is valid */
  valid: boolean;
  /** List of errors (FATAL + ERROR) */
  errors: ValidationMessage[];
  /** List of warnings */
  warnings: ValidationMessage[];
  /** List of informational messages */
  infos?: ValidationMessage[];
}

/**
 * Options for EPUB validation.
 */
export interface ValidateOptions {
  /** Profile to validate against (default: "default") */
  profile?: "default" | "edupub" | "idx" | "dict";
  /** Whether to include informational messages */
  includeInfos?: boolean;
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
}

/**
 * EPUB Validator interface.
 */
export interface EpubValidator {
  /**
   * Validate an EPUB file.
   * @param epubPath - Path to the EPUB file
   * @param options - Validation options
   * @returns Validation result
   */
  validate(epubPath: string, options?: ValidateOptions): Promise<ValidationResult>;

  /**
   * Get the validator type.
   */
  readonly type: "bundled" | "system-java" | "lightweight";
}

/**
 * EPubCheck binary provider interface.
 * Implemented by platform-specific packages.
 */
export interface EpubCheckProvider {
  /**
   * Get the path to the epubcheck executable or JAR.
   */
  getExecutablePath(): string;

  /**
   * Check if this provider is available.
   */
  isAvailable(): boolean;

  /**
   * Get the command to run epubcheck.
   * Returns [command, ...args] array.
   */
  getCommand(epubPath: string, jsonOutput?: boolean): string[];
}
