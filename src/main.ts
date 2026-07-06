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
  // Handle --list-tiers before full parse
  if (process.argv.includes("--list-tiers")) {
    printTierList();
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

function printTierList(): void {
  console.log(pc.bold("\nDevflow Command Tiers\n"));
  console.log("Commands are classified by implementation maturity:\n");

  const tiers = [
    {
      label: pc.green("STABLE      "),
      desc: "Fully implemented and tested.",
      commands: [
        "init", "status", "next",
        "feature new", "feature complete",
        "gatekeep", "adversarial-review",
        "doctor", "update-cockpit", "index",
      ],
    },
    {
      label: pc.yellow("EXPERIMENTAL"),
      desc: "Partial implementation. May have rough edges.",
      commands: ["discover", "eval run"],
    },
    {
      label: pc.red("PREVIEW     "),
      desc: "Placeholder. Prints intention but does not execute real logic.",
      commands: [
        "ai init",
        "requirements audit",
        "design review",
        "tests review",
        "actions generate",
        "drift check",
        "adversarial-review-ai",
        "trace",
        "promote",
      ],
    },
  ];

  for (const tier of tiers) {
    console.log(`  ${tier.label}  ${tier.desc}`);
    for (const cmd of tier.commands) {
      console.log(`              devflow ${cmd}`);
    }
    console.log("");
  }

  console.log(pc.dim("Preview commands will be implemented in Phase 3 of the Devflow roadmap."));
  console.log(pc.dim("Use 'devflow next' to see the recommended workflow for your current state.\n"));
}
