import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Keep workspace and optional dependencies external
  external: [
    "@swibostyle/core",
    "@swibostyle/pdf-renderer",
    "@swibostyle/pdf-server",
    "playwright",
    "playwright-core",
  ],
});
