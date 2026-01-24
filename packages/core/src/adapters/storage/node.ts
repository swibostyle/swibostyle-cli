import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import type { FileStat } from '../../types.js';
import type { StorageAdapter } from './interface.js';

/**
 * Node.js file system storage adapter
 */
export class NodeStorageAdapter implements StorageAdapter {
  async readFile(filePath: string): Promise<Uint8Array> {
    const buffer = await fsp.readFile(filePath);
    return new Uint8Array(buffer);
  }

  async readTextFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    return fsp.readFile(filePath, { encoding });
  }

  async readDir(dirPath: string): Promise<string[]> {
    return fsp.readdir(dirPath);
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async stat(filePath: string): Promise<FileStat> {
    const stats = await fsp.stat(filePath);
    return {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      mtime: stats.mtime,
    };
  }

  async writeFile(filePath: string, data: Uint8Array | string): Promise<void> {
    await fsp.writeFile(filePath, data);
  }

  async mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    await fsp.mkdir(dirPath, options);
  }

  async rm(filePath: string, options?: { recursive?: boolean }): Promise<void> {
    await fsp.rm(filePath, options);
  }

  async copyFile(src: string, dest: string): Promise<void> {
    await fsp.copyFile(src, dest);
  }

  createReadStream(filePath: string): ReadableStream<Uint8Array> {
    const nodeStream = fs.createReadStream(filePath);
    return new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        nodeStream.on('end', () => {
          controller.close();
        });
        nodeStream.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        nodeStream.destroy();
      },
    });
  }

  createWriteStream(filePath: string): WritableStream<Uint8Array> {
    const nodeStream = fs.createWriteStream(filePath);
    return new WritableStream({
      write(chunk) {
        return new Promise((resolve, reject) => {
          nodeStream.write(chunk, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      },
      close() {
        return new Promise((resolve) => {
          nodeStream.end(resolve);
        });
      },
      abort(err) {
        nodeStream.destroy(err);
      },
    });
  }
}
