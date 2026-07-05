import type { Command } from "commander";
import { initCommand } from "./init.js";
import { statusCommand } from "./status.js";
import { nextCommand } from "./next.js";
import { featureNewCommand } from "./feature.js";
import { doctorCommand } from "./doctor.js";
import { updateCockpitCommand } from "./update-cockpit.js";

export function registerCommands(program: Command): void {
  program
    .command("init")
    .description("Initialize Devflow in the current directory")
    .option("-y, --yes", "Auto-confirm prompts")
    .action(async (_options) => {
      await initCommand(process.cwd());
    });

  program
    .command("status")
    .description("Show current project state and status")
    .option("--json", "Output as JSON")
    .option("--verbose", "Show detailed evidence")
    .action(async (options) => {
      await statusCommand(process.cwd(), options);
    });

  program
    .command("next")
    .description("Recommend the next best action")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      await nextCommand(process.cwd(), options);
    });

  program
    .command("feature")
    .description("Manage features")
    .command("new")
    .description("Create a new feature workspace")
    .argument("<name>", "Feature name (slugified automatically)")
    .action(async (name: string) => {
      await featureNewCommand(process.cwd(), name);
    });

  program
    .command("doctor")
    .description("Diagnose and fix common issues")
    .option("--fix", "Auto-fix detected issues")
    .action(async (options) => {
      await doctorCommand(process.cwd(), options);
    });

  program
    .command("update-cockpit")
    .description("Regenerate DEVFLOW.md from current state")
    .action(async () => {
      await updateCockpitCommand(process.cwd());
    });
}
