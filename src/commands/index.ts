import type { Command } from "commander";
import { initCommand } from "./init.js";
import { statusCommand } from "./status.js";
import { nextCommand } from "./next.js";
import { featureNewCommand } from "./feature.js";
import { featureComplete } from "./feature-complete.js";
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
    .option("--force", "Force progression with bypass registration")
    .action(async (options) => {
      await nextCommand(process.cwd(), options);
    });

  program
    .command("feature")
    .description("Manage features");

  // feature new
  program
    .command("feature new <name>")
    .description("Create a new feature workspace")
    .action(async (name: string) => {
      await featureNewCommand(process.cwd(), name);
    });

  // feature complete
  program
    .command("feature complete <id>")
    .description("Verify feature completion — runs Definition of Done checks")
    .action(async (id: string) => {
      await featureComplete(id, process.cwd());
    });

  program
    .command("doctor")
    .description("Diagnose and fix common issues")
    .option("--fix", "Auto-fix detected issues")
    .option("--dry-run", "Preview changes without applying")
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
