#!/usr/bin/env node

import { Command } from "commander";
import { registerCommands } from "./commands/index.js";
import pc from "picocolors";

const program = new Command();

program
  .name("devflow")
  .description(
    "fool-resistant, evidence-driven, engineered-by-default: state-aware workflow harness for AI-assisted software development"
  )
  .version("0.1.0")
  .option("--cwd <path>", "Working directory", process.cwd())
  .option("--mode <mode>", "Execution mode: local, experimental, strict, release", "local")
  .option("--verbose", "Verbose output")
  .option("--no-color", "Disable color output")
  .addHelpCommand("help [command]", "Show help for a command");

registerCommands(program);

// Default behavior: run status if no command given
program.action(async (options) => {
  // Delegate to status command
  const { statusCommand } = await import("./commands/status.js");
  await statusCommand(options.cwd || process.cwd(), {
    json: false,
    verbose: options.verbose || false,
  });
});

// Parse and handle errors gracefully
try {
  await program.parseAsync(process.argv);
} catch (err: unknown) {
  const message =
    err instanceof Error ? err.message : String(err);
  console.error(pc.red(`\nError: ${message}\n`));
  console.error(pc.dim("Run `devflow doctor` to diagnose issues.\n"));
  process.exit(1);
}
