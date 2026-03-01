import { Command } from "commander";
import pc from "picocolors";

export const previewCommand = new Command("preview")
  .description("Start a preview server (alias for 'serve')")
  .option("-p, --port <port>", "Server port", "3000")
  .option("-t, --target <name>", "Build target name", "epub")
  .option("-v, --verbose", "Verbose output")
  .action(async () => {
    console.log(pc.yellow("'preview' has been renamed to 'serve'."));
    console.log(pc.dim("  Please use: swibostyle serve"));
    process.exit(0);
  });
