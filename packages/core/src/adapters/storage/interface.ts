import type { FileStat } from "../../types";

/**
 * Storage adapter interface for abstracting file system operations.
 * Implementations can target local file systems, memory, or object storage (S3, R2, GCS).
 */
export interface StorageAdapter {
  // =========================================================================
  // Read Operations
  // =========================================================================

  /**
   * Read file as binary data
   */
  readFile(path: string): Promise<Uint8Array>;

  /**
   * Read file as text
   */
  readTextFile(path: string, encoding?: string): Promise<string>;

  /**
   * Read directory contents
   */
  readDir(path: string): Promise<string[]>;

  /**
   * Check if file or directory exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file/directory stats
   */
  stat(path: string): Promise<FileStat>;

  // =========================================================================
  // Write Operations
  // =========================================================================

  /**
   * Write data to file
   */
  writeFile(path: string, data: Uint8Array | string): Promise<void>;

  /**
   * Create directory
   */
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;

  /**
   * Remove file or directory
   */
  rm(path: string, options?: { recursive?: boolean }): Promise<void>;

  /**
   * Copy file
   */
  copyFile(src: string, dest: string): Promise<void>;

  // =========================================================================
  // Streaming Operations (Optional)
  // =========================================================================

  /**
   * Create readable stream (optional, for large files)
   */
  createReadStream?(path: string): ReadableStream<Uint8Array>;

  /**
   * Create writable stream (optional, for large files)
   */
  createWriteStream?(path: string): WritableStream<Uint8Array>;
}
