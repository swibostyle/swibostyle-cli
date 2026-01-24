import { describe, test, expect, beforeEach } from "bun:test";
import { MemoryStorageAdapter } from "../adapters/storage/memory.js";
import { loadBookConfig, getDefaultBookConfig } from "./loader.js";

describe("loadBookConfig", () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
  });

  test("should load valid book config", async () => {
    const config = {
      title: "Test Book",
      authors: [{ name: "Author Name", role: "aut" }],
      publisher: "Test Publisher",
      lang: "ja",
      bookId: { epub: "123456789" },
      layout: "reflowable",
      pageDirection: "rtl",
      primaryWritingMode: "vertical-rl",
    };

    storage.setFile("/book.json", JSON.stringify(config));
    const loaded = await loadBookConfig(storage, "/book.json");

    expect(loaded.title).toBe("Test Book");
    expect(loaded.authors[0]?.name).toBe("Author Name");
    expect(loaded.publisher).toBe("Test Publisher");
    expect(loaded.lang).toBe("ja");
  });

  test("should strip JSON comments", async () => {
    const configWithComments = `{
      // This is a comment
      "title": "Book with Comments",
      "authors": [{ "name": "Author", "role": "aut" }],
      "publisher": "Publisher",
      /* Multi-line
         comment */
      "lang": "en",
      "bookId": { "epub": "123" }
    }`;

    storage.setFile("/book.json", configWithComments);
    const loaded = await loadBookConfig(storage, "/book.json");

    expect(loaded.title).toBe("Book with Comments");
  });

  test("should throw on missing title", async () => {
    const config = {
      authors: [{ name: "Author", role: "aut" }],
      publisher: "Publisher",
      lang: "en",
      bookId: { epub: "123" },
    };

    storage.setFile("/book.json", JSON.stringify(config));

    await expect(loadBookConfig(storage, "/book.json")).rejects.toThrow("title is required");
  });

  test("should throw on missing authors", async () => {
    const config = {
      title: "Book",
      publisher: "Publisher",
      lang: "en",
      bookId: { epub: "123" },
    };

    storage.setFile("/book.json", JSON.stringify(config));

    await expect(loadBookConfig(storage, "/book.json")).rejects.toThrow("authors is required");
  });

  test("should throw on empty authors array", async () => {
    const config = {
      title: "Book",
      authors: [],
      publisher: "Publisher",
      lang: "en",
      bookId: { epub: "123" },
    };

    storage.setFile("/book.json", JSON.stringify(config));

    await expect(loadBookConfig(storage, "/book.json")).rejects.toThrow("authors is required");
  });
});

describe("getDefaultBookConfig", () => {
  test("should return default values", () => {
    const defaults = getDefaultBookConfig();

    expect(defaults.layout).toBe("reflowable");
    expect(defaults.pageDirection).toBe("ltr");
    expect(defaults.primaryWritingMode).toBe("horizontal-tb");
    expect(defaults.targets?.epub?.enableImageResizing).toBe(true);
  });
});
