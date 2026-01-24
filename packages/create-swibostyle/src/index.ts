#!/usr/bin/env node

import { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { scaffold } from "./scaffold.js";
import type { ProjectOptions, TemplateType } from "./types.js";

const program = new Command();

program
  .name("create-swibostyle")
  .description("Create a new swibostyle project")
  .version("0.1.0")
  .argument("[project-name]", "Project name")
  .option("-t, --template <type>", "Template type (novel, manga, techbook, minimal)")
  .option("--lang <lang>", "Language code", "ja")
  .option("--direction <dir>", "Page direction (ltr, rtl)")
  .option("--writing-mode <mode>", "Writing mode (horizontal-tb, vertical-rl)")
  .option("--pm <manager>", "Package manager (bun, npm)")
  .option("-y, --yes", "Skip prompts and use defaults")
  .action(async (projectName, options) => {
    console.log();
    p.intro(pc.bgCyan(pc.black(" create-swibostyle ")));

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

async function runPrompts(
  projectName: string | undefined,
  cliOptions: Record<string, unknown>,
): Promise<ProjectOptions> {
  // Project name
  const name =
    projectName ||
    (await p.text({
      message: "Project name:",
      placeholder: "my-book",
      defaultValue: "my-book",
      validate: (value) => {
        if (!value) return "Project name is required";
        if (!/^[a-z0-9-_]+$/i.test(value)) return "Invalid project name";
        return;
      },
    }));

  if (p.isCancel(name)) throw new Error("cancelled");

  // Template
  const template =
    cliOptions.template ||
    (await p.select({
      message: "Select a template:",
      options: [
        { value: "novel", label: "novel", hint: "Japanese novel (vertical writing, RTL)" },
        { value: "manga", label: "manga", hint: "Manga/comic (fixed layout, RTL)" },
        { value: "techbook", label: "techbook", hint: "Technical book (horizontal, LTR)" },
        { value: "minimal", label: "minimal", hint: "Minimal template" },
      ],
      initialValue: "novel",
    }));

  if (p.isCancel(template)) throw new Error("cancelled");

  // Get template defaults
  const templateDefaults = getTemplateDefaults(template as TemplateType);

  // Language
  const lang =
    cliOptions.lang ||
    (await p.text({
      message: "Language code:",
      placeholder: "ja",
      defaultValue: "ja",
    }));

  if (p.isCancel(lang)) throw new Error("cancelled");

  // Page direction
  const pageDirection =
    cliOptions.direction ||
    (await p.select({
      message: "Page direction:",
      options: [
        { value: "rtl", label: "RTL", hint: "Right to left (Japanese, Arabic)" },
        { value: "ltr", label: "LTR", hint: "Left to right (English, etc.)" },
      ],
      initialValue: templateDefaults.pageDirection,
    }));

  if (p.isCancel(pageDirection)) throw new Error("cancelled");

  // Writing mode
  const writingMode =
    cliOptions.writingMode ||
    (await p.select({
      message: "Writing mode:",
      options: [
        { value: "vertical-rl", label: "Vertical", hint: "Top to bottom, right to left" },
        { value: "horizontal-tb", label: "Horizontal", hint: "Left to right, top to bottom" },
      ],
      initialValue: templateDefaults.writingMode,
    }));

  if (p.isCancel(writingMode)) throw new Error("cancelled");

  // Package manager
  const packageManager =
    cliOptions.pm ||
    (await p.select({
      message: "Package manager:",
      options: [
        { value: "bun", label: "bun", hint: "Fast JavaScript runtime and package manager" },
        { value: "npm", label: "npm", hint: "Node.js package manager" },
      ],
      initialValue: "bun",
    }));

  if (p.isCancel(packageManager)) throw new Error("cancelled");

  return {
    name: name as string,
    template: template as TemplateType,
    lang: lang as string,
    pageDirection: pageDirection as "ltr" | "rtl",
    writingMode: writingMode as "horizontal-tb" | "vertical-rl",
    packageManager: packageManager as "bun" | "npm",
  };
}

function getTemplateDefaults(template: TemplateType): {
  pageDirection: "ltr" | "rtl";
  writingMode: "horizontal-tb" | "vertical-rl";
} {
  switch (template) {
    case "novel":
      return { pageDirection: "rtl", writingMode: "vertical-rl" };
    case "manga":
      return { pageDirection: "rtl", writingMode: "horizontal-tb" };
    case "techbook":
      return { pageDirection: "ltr", writingMode: "horizontal-tb" };
    case "minimal":
    default:
      return { pageDirection: "ltr", writingMode: "horizontal-tb" };
  }
}

program.parse();
