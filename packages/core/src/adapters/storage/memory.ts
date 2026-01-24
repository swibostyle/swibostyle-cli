import type { FileStat } from '../../types.js';
import type { StorageAdapter } from './interface.js';

interface MemoryFile {
  type: 'file';
  data: Uint8Array;
  mtime: Date;
}

interface MemoryDirectory {
  type: 'directory';
  mtime: Date;
}

type MemoryEntry = MemoryFile | MemoryDirectory;

/**
 * In-memory storage adapter for browser environments and testing.
 * Can be pre-populated with data from Object Storage or other sources.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private files: Map<string, MemoryEntry> = new Map();

  constructor(initialFiles?: Map<string, Uint8Array | string>) {
    // Always create root directory
    this.files.set('/', { type: 'directory', mtime: new Date() });

    if (initialFiles) {
      for (const [path, data] of initialFiles) {
        this.setFile(path, data);
      }
    }
  }

  /**
   * Set a file in memory (for initialization)
   */
  setFile(path: string, data: Uint8Array | string): void {
    const normalizedPath = this.normalizePath(path);
    const uint8Data = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.files.set(normalizedPath, {
      type: 'file',
      data: uint8Data,
      mtime: new Date(),
    });

    // Ensure parent directories exist
    this.ensureParentDirs(normalizedPath);
  }

  /**
   * Create a directory synchronously (for initialization)
   */
  mkdirSync(path: string): void {
    const normalizedPath = this.normalizePath(path);
    this.ensureParentDirs(normalizedPath + '/dummy');
    this.files.set(normalizedPath, { type: 'directory', mtime: new Date() });
  }

  /**
   * Get all file paths (for debugging/export)
   */
  getAllPaths(): string[] {
    return Array.from(this.files.keys());
  }

  /**
   * Export all files as a Map
   */
  exportFiles(): Map<string, Uint8Array> {
    const result = new Map<string, Uint8Array>();
    for (const [path, entry] of this.files) {
      if (entry.type === 'file') {
        result.set(path, entry.data);
      }
    }
    return result;
  }

  private normalizePath(path: string): string {
    // Normalize path separators and remove trailing slashes
    let normalized = path.replace(/\\/g, '/');
    if (normalized !== '/' && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    return normalized;
  }

  private ensureParentDirs(path: string): void {
    const parts = path.split('/').filter(Boolean);
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += '/' + parts[i];
      if (!this.files.has(currentPath)) {
        this.files.set(currentPath, { type: 'directory', mtime: new Date() });
      }
    }
  }

  private getParentPath(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash <= 0) return '/';
    return path.slice(0, lastSlash);
  }

  async readFile(path: string): Promise<Uint8Array> {
    const normalizedPath = this.normalizePath(path);
    const entry = this.files.get(normalizedPath);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    if (entry.type !== 'file') {
      throw new Error(`EISDIR: illegal operation on a directory: ${path}`);
    }
    return entry.data;
  }

  async readTextFile(path: string, _encoding?: string): Promise<string> {
    const data = await this.readFile(path);
    return new TextDecoder().decode(data);
  }

  async readDir(path: string): Promise<string[]> {
    const normalizedPath = this.normalizePath(path);
    const entry = this.files.get(normalizedPath);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }
    if (entry.type !== 'directory') {
      throw new Error(`ENOTDIR: not a directory: ${path}`);
    }

    const prefix = normalizedPath === '/' ? '/' : normalizedPath + '/';
    const results: string[] = [];

    for (const filePath of this.files.keys()) {
      if (filePath === normalizedPath) continue;
      if (!filePath.startsWith(prefix)) continue;

      const relativePath = filePath.slice(prefix.length);
      const firstSlash = relativePath.indexOf('/');
      const name = firstSlash === -1 ? relativePath : relativePath.slice(0, firstSlash);

      if (name && !results.includes(name)) {
        results.push(name);
      }
    }

    return results;
  }

  async exists(path: string): Promise<boolean> {
    const normalizedPath = this.normalizePath(path);
    return this.files.has(normalizedPath);
  }

  async stat(path: string): Promise<FileStat> {
    const normalizedPath = this.normalizePath(path);
    const entry = this.files.get(normalizedPath);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }

    return {
      isFile: entry.type === 'file',
      isDirectory: entry.type === 'directory',
      size: entry.type === 'file' ? entry.data.length : 0,
      mtime: entry.mtime,
    };
  }

  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    const uint8Data = typeof data === 'string' ? new TextEncoder().encode(data) : data;

    this.ensureParentDirs(normalizedPath);
    this.files.set(normalizedPath, {
      type: 'file',
      data: uint8Data,
      mtime: new Date(),
    });
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const normalizedPath = this.normalizePath(path);

    if (options?.recursive) {
      this.ensureParentDirs(normalizedPath + '/dummy');
      this.files.set(normalizedPath, { type: 'directory', mtime: new Date() });
    } else {
      const parent = this.getParentPath(normalizedPath);
      if (!this.files.has(parent)) {
        throw new Error(`ENOENT: no such file or directory: ${parent}`);
      }
      this.files.set(normalizedPath, { type: 'directory', mtime: new Date() });
    }
  }

  async rm(path: string, options?: { recursive?: boolean }): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    const entry = this.files.get(normalizedPath);

    if (!entry) {
      throw new Error(`ENOENT: no such file or directory: ${path}`);
    }

    if (entry.type === 'directory' && options?.recursive) {
      // Remove all files under this directory
      const prefix = normalizedPath === '/' ? '/' : normalizedPath + '/';
      const toDelete: string[] = [];

      for (const filePath of this.files.keys()) {
        if (filePath === normalizedPath || filePath.startsWith(prefix)) {
          toDelete.push(filePath);
        }
      }

      for (const filePath of toDelete) {
        this.files.delete(filePath);
      }
    } else {
      this.files.delete(normalizedPath);
    }
  }

  async copyFile(src: string, dest: string): Promise<void> {
    const data = await this.readFile(src);
    await this.writeFile(dest, data);
  }
}
