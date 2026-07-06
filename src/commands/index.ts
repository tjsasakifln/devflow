import type { Command } from "commander";
import { initCommand } from "./init.js";
import { statusCommand } from "./status.js";
import { nextCommand } from "./next.js";
import { featureNewCommand } from "./feature.js";
import { featureComplete } from "./feature-complete.js";
import { gatekeep } from "./gatekeep.js";
import { adversarialReview } from "./adversarial-review.js";
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
    .option("--actor <actor>", "Identity of the implementer (for role segregation)")
    .action(async (name: string, options: { actor?: string }) => {
      await featureNewCommand(process.cwd(), name, options);
    });

  // feature complete
  program
    .command("feature complete <id>")
    .description("Verify feature completion — runs 25 Definition of Done checks")
    .action(async (id: string) => {
      await featureComplete(id, process.cwd());
    });

  // gatekeep
  program
    .command("gatekeep <featureId>")
    .description("Independent gatekeeper review — approve or reject feature completion")
    .option("--approve", "Approve the feature")
    .option("--reject", "Reject the feature (requires fixes)")
    .option("--reason <reason>", "Reason for approval or rejection")
    .option("--actor <actor>", "Gatekeeper identity")
    .action(async (featureId: string, options: { approve?: boolean; reject?: boolean; reason?: string; actor?: string }) => {
      await gatekeep(featureId, process.cwd(), options);
    });

  // adversarial-review
  program
    .command("adversarial-review <featureId>")
    .description("Adversarial review — attempt to reject the feature across 8 attack vectors")
    .action(async (featureId: string) => {
      await adversarialReview(featureId, process.cwd());
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
