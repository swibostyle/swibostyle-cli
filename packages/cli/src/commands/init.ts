import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { scaffold, runPrompts, type ProjectOptions, type TemplateType } from "../init";

export const initCommand = new Command("init")
  .description("Create a new swibostyle project")
  .argument("[project-name]", "Project name")
  .option("-t, --template <type>", "Template type (novel, manga, techbook, minimal)")
  .option("--lang <lang>", "Language code", "ja")
  .option("--direction <dir>", "Page direction (ltr, rtl)")
  .option("--writing-mode <mode>", "Writing mode (horizontal-tb, vertical-rl)")
  .option("--pm <manager>", "Package manager (bun, npm)")
  .option("-y, --yes", "Skip prompts and use defaults")
  .action(async (projectName, options) => {
    console.log();
    p.intro(pc.bgCyan(pc.black(" swibostyle init ")));

    try {
      let projectOptions: ProjectOptions;

      if (options.yes) {
        // Use defaults
        projectOptions = {
          name: projectName || "my-book",
          template: (options.template as TemplateType) || "novel",
          lang: options.lang || "ja",
          pageDirection: options.direction || "rtl",
          writingMode: options.writingMode || "vertical-rl",
          packageManager: options.pm || "bun",
        };
      } else {
        // Interactive prompts
        projectOptions = await runPrompts(projectName, options);
      }

      // Run scaffolding
      await scaffold(projectOptions);

      // Success message
      p.outro(pc.green("Project created successfully!"));

      console.log();
      console.log(pc.cyan("Next steps:"));
      console.log();
      console.log(`  cd ${projectOptions.name}`);
      console.log(`  ${projectOptions.packageManager} install`);
      console.log(`  ${projectOptions.packageManager} run build`);
      console.log();
    } catch (error) {
      if (error instanceof Error && error.message === "cancelled") {
        p.cancel("Operation cancelled");
        process.exit(0);
      }
      p.cancel(pc.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });
