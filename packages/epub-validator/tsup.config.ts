import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Platform-specific packages are loaded dynamically
  external: ["@swibostyle/epub-validator-linux-x64"],
});
