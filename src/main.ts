#!/usr/bin/env node

import { Command } from "commander";
import { registerCommands } from "./cli/index.js";
import { getVersion } from "./kernel/utils/version.js";
import pc from "picocolors";

const program = new Command();

program
  .name("devflow")
  .description(
    "PR governance for AI-generated code — enforce evidence, run adversarial review, produce auditable PR risk reports"
  )
  .version(getVersion())
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
  // Handle --list-tiers (deprecated as of v1.0.0)
  if (process.argv.includes("--list-tiers")) {
    console.log(pc.bold("\nDevflow Command Tiers"));
    console.log(pc.dim("\nAll commands are STABLE as of v1.0.0."));
    console.log(pc.dim("The tier system (PREVIEW/EXPERIMENTAL/STABLE) has been eliminated.\n"));
    console.log(pc.dim("Run `devflow --help` to see all available commands.\n"));
    process.exit(0);
  }
  await program.parseAsync(process.argv);
} catch (err: unknown) {
  const message =
    err instanceof Error ? err.message : String(err);
  console.error(pc.red(`\nError: ${message}\n`));
  console.error(pc.dim("Run `devflow doctor` to diagnose issues.\n"));
  process.exit(1);
}
