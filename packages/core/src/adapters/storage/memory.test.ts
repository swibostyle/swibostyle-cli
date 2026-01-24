import { describe, test, expect, beforeEach } from "bun:test";
import { MemoryStorageAdapter } from "./memory.js";

describe("MemoryStorageAdapter", () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
  });

  describe("writeFile / readFile", () => {
    test("should write and read text file", async () => {
      await storage.writeFile("/test.txt", "hello world");
      const content = await storage.readTextFile("/test.txt");
      expect(content).toBe("hello world");
    });

    test("should write and read binary file", async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      await storage.writeFile("/test.bin", data);
      const result = await storage.readFile("/test.bin");
      expect(result).toEqual(data);
    });

    test("should throw on non-existent file", async () => {
      await expect(storage.readFile("/nonexistent.txt")).rejects.toThrow("ENOENT");
    });
  });

  describe("mkdir / readDir", () => {
    test("should create directory and list contents", async () => {
      await storage.mkdir("/mydir", { recursive: true });
      await storage.writeFile("/mydir/file1.txt", "content1");
      await storage.writeFile("/mydir/file2.txt", "content2");

      const files = await storage.readDir("/mydir");
      expect(files.sort()).toEqual(["file1.txt", "file2.txt"]);
    });

    test("should create nested directories with recursive", async () => {
      await storage.mkdir("/a/b/c", { recursive: true });
      const exists = await storage.exists("/a/b/c");
      expect(exists).toBe(true);
    });
  });

  describe("exists", () => {
    test("should return true for existing file", async () => {
      await storage.writeFile("/exists.txt", "content");
      expect(await storage.exists("/exists.txt")).toBe(true);
    });

    test("should return false for non-existing file", async () => {
      expect(await storage.exists("/notexists.txt")).toBe(false);
    });
  });

  describe("stat", () => {
    test("should return file stats", async () => {
      await storage.writeFile("/file.txt", "hello");
      const stat = await storage.stat("/file.txt");
      expect(stat.isFile).toBe(true);
      expect(stat.isDirectory).toBe(false);
      expect(stat.size).toBe(5);
    });

    test("should return directory stats", async () => {
      await storage.mkdir("/dir", { recursive: true });
      const stat = await storage.stat("/dir");
      expect(stat.isFile).toBe(false);
      expect(stat.isDirectory).toBe(true);
    });
  });

  describe("rm", () => {
    test("should remove file", async () => {
      await storage.writeFile("/todelete.txt", "content");
      await storage.rm("/todelete.txt");
      expect(await storage.exists("/todelete.txt")).toBe(false);
    });

    test("should remove directory recursively", async () => {
      await storage.mkdir("/dir", { recursive: true });
      await storage.writeFile("/dir/file.txt", "content");
      await storage.rm("/dir", { recursive: true });
      expect(await storage.exists("/dir")).toBe(false);
      expect(await storage.exists("/dir/file.txt")).toBe(false);
    });
  });

  describe("copyFile", () => {
    test("should copy file", async () => {
      await storage.writeFile("/source.txt", "copy me");
      await storage.copyFile("/source.txt", "/dest.txt");
      const content = await storage.readTextFile("/dest.txt");
      expect(content).toBe("copy me");
    });
  });

  describe("initialization", () => {
    test("should accept initial files", () => {
      const initial = new Map<string, Uint8Array | string>([
        ["/file1.txt", "content1"],
        ["/file2.txt", new Uint8Array([1, 2, 3])],
      ]);
      const storageWithFiles = new MemoryStorageAdapter(initial);

      expect(storageWithFiles.getAllPaths()).toContain("/file1.txt");
      expect(storageWithFiles.getAllPaths()).toContain("/file2.txt");
    });
  });

  describe("exportFiles", () => {
    test("should export all files", async () => {
      await storage.writeFile("/a.txt", "a");
      await storage.writeFile("/b.txt", "b");
      await storage.mkdir("/dir", { recursive: true });

      const exported = storage.exportFiles();
      expect(exported.size).toBe(2);
      expect(exported.has("/a.txt")).toBe(true);
      expect(exported.has("/b.txt")).toBe(true);
    });
  });
});
