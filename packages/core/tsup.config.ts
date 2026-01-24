import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Native modules and optional dependencies should remain external
  external: ["sharp", "sass", "psd"],
});
