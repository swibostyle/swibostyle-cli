#!/usr/bin/env node

import { Command } from "commander";
import { buildCommand } from "./commands/build";
import { initCommand } from "./commands/init";
import { previewCommand } from "./commands/preview";
import { pdfCommand } from "./commands/pdf";

const program = new Command();

program.name("swibostyle").description("CSS typesetting CLI for EPUB generation").version("0.1.0");

// Register commands
program.addCommand(buildCommand);
program.addCommand(initCommand);
program.addCommand(previewCommand);
program.addCommand(pdfCommand);

// Default command is build
program.action(() => {
  program.help();
});

program.parse();
