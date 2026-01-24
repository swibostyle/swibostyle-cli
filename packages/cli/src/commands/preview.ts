import { Command } from "commander";
import ora from "ora";
import pc from "picocolors";

export const previewCommand = new Command("preview")
  .description("Start a preview server")
  .option("-p, --port <port>", "Server port", "8080")
  .option("-s, --src <dir>", "Source directory", "./src")
  .option("-b, --build-dir <dir>", "Build directory", "./_build")
  .action(async (options) => {
    const spinner = ora("Starting preview server...").start();

    try {
      // TODO: Implement preview server
      // This would serve the built EPUB content for browser preview

      spinner.info(pc.yellow("Preview server is not yet implemented"));
      console.log(pc.dim("  This feature will be available in a future release."));
      console.log(pc.dim(`  For now, you can use: npx http-server ${options.buildDir}`));
    } catch (error) {
      spinner.fail(pc.red("Failed to start preview server"));
      console.error(pc.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });
