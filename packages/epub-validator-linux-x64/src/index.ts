import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * EPubCheck binary provider interface.
 * This is inlined to avoid build-time dependency on @swibostyle/epub-validator.
 */
interface EpubCheckProvider {
  getExecutablePath(): string;
  isAvailable(): boolean;
  getCommand(epubPath: string, jsonOutput?: boolean): string[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * EPubCheck provider for Linux x64 with bundled JRE.
 */
const provider: EpubCheckProvider = {
  getExecutablePath(): string {
    return resolve(__dirname, "..", "jre", "bin", "java");
  },

  isAvailable(): boolean {
    // Check if we're on Linux x64
    if (process.platform !== "linux" || process.arch !== "x64") {
      return false;
    }

    // Check if bundled JRE exists
    const javaPath = this.getExecutablePath();
    const jarPath = resolve(__dirname, "..", "epubcheck.jar");

    return existsSync(javaPath) && existsSync(jarPath);
  },

  getCommand(epubPath: string, jsonOutput = true): string[] {
    const javaPath = this.getExecutablePath();
    const jarPath = resolve(__dirname, "..", "epubcheck.jar");

    const args = [javaPath, "-jar", jarPath];

    if (jsonOutput) {
      args.push("--json", "-");
    }

    args.push(epubPath);

    return args;
  },
};

export default provider;
