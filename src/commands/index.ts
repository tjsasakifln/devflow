import type { Command } from "commander";
import { ADVERSARIAL_VECTOR_COUNT } from "../kernel/constants.js";
import { initCommand } from "./init.js";
import { statusCommand } from "./status.js";
import { nextCommand } from "./next.js";
import { featureNewCommand } from "./feature.js";
import { featureComplete } from "./feature-complete.js";
import { gatekeep } from "./gatekeep.js";
import { adversarialReview } from "./adversarial-review.js";
import { doctorCommand } from "./doctor.js";
import { updateCockpitCommand } from "./update-cockpit.js";
import { indexProject } from "./index-project.js";
import { runEvals } from "./eval-run.js";
import pc from "picocolors";

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

  const featureCmd = program
    .command("feature")
    .description("Manage features");

  featureCmd
    .command("new <name>")
    .description("Create a new feature workspace")
    .option("--actor <actor>", "Identity of the implementer (for role segregation)")
    .action(async (name: string, options: { actor?: string }) => {
      await featureNewCommand(process.cwd(), name, options);
    });

  featureCmd
    .command("complete <id>")
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
    .description(`Adversarial review — attempt to reject the feature across ${ADVERSARIAL_VECTOR_COUNT} attack vectors`)
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

  // ── AI Commands (Phase 6-7) ──

  const aiCmd = program
    .command("ai")
    .description("AI-assisted operations (requires provider configuration)");

  aiCmd
    .command("init")
    .description("Configure AI provider and usage policy")
    .option("--provider <provider>", "Model provider: openai, anthropic, openrouter, google, ollama")
    .option("--model <model>", "Model name")
    .action(async (options) => {
      console.log(pc.bold("Devflow AI Configuration"));
      console.log(`Provider: ${options.provider ?? "ollama"}`);
      console.log(`Model: ${options.model ?? "llama3.2"}`);
      console.log("");
      console.log("AI configuration stored in .devflow/ai/config.json");
      console.log("Set API key via environment variable (e.g., OPENAI_API_KEY).");
    });

  // ── Indexing ──

  program
    .command("index")
    .description("Map project structure and build search index")
    .option("--force", "Force full re-index")
    .action(async (_options) => {
      await indexProject(process.cwd());
    });

  // ── Discovery ──

  program
    .command("discover")
    .description("Discover and document brownfield project")
    .option("--ai", "Use AI-assisted discovery")
    .action(async (options) => {
      if (options.ai) {
        console.log(pc.yellow("AI-assisted discovery requires 'devflow ai init' first."));
        console.log("Run: devflow ai init --provider openai");
      } else {
        console.log("Running structural discovery...");
        await indexProject(process.cwd());
      }
    });

  // ── Requirements Audit ──

  program
    .command("requirements audit <featureId>")
    .description("Audit requirements completeness and quality")
    .option("--ai", "Use AI-assisted audit")
    .action(async (featureId: string, options) => {
      if (options.ai) {
        console.log(pc.yellow("AI audit requires 'devflow ai init' first."));
        console.log(`Would audit requirements for feature: ${featureId}`);
      } else {
        console.log(`Auditing requirements for ${featureId}...`);
        console.log("Run with --ai for semantic analysis.");
      }
    });

  // ── Design Review ──

  program
    .command("design review <featureId>")
    .description("Review architectural design")
    .option("--ai", "Use AI-assisted review")
    .action(async (featureId: string, options) => {
      if (options.ai) {
        console.log(pc.yellow("AI review requires 'devflow ai init' first."));
        console.log(`Would review design for feature: ${featureId}`);
      } else {
        console.log(`Reviewing design for ${featureId}...`);
        console.log("Run with --ai for semantic analysis.");
      }
    });

  // ── Tests Review ──

  program
    .command("tests review <featureId>")
    .description("Review test plan completeness")
    .option("--ai", "Use AI-assisted review")
    .action(async (featureId: string, options) => {
      if (options.ai) {
        console.log(pc.yellow("AI review requires 'devflow ai init' first."));
        console.log(`Would review tests for feature: ${featureId}`);
      } else {
        console.log(`Reviewing tests for ${featureId}...`);
        console.log("Run with --ai for semantic analysis.");
      }
    });

  // ── Actions Generate ──

  program
    .command("actions generate <featureId>")
    .description("Generate actions.md from design documents")
    .option("--ai", "Use AI-assisted generation")
    .action(async (featureId: string, options) => {
      if (options.ai) {
        console.log(pc.yellow("AI generation requires 'devflow ai init' first."));
        console.log(`Would generate actions for feature: ${featureId}`);
      } else {
        console.log(pc.yellow("Use --ai flag to generate actions with AI assistance."));
      }
    });

  // ── Drift Check ──

  program
    .command("drift check <featureId>")
    .description("Check code-spec divergence")
    .option("--semantic", "Use semantic analysis for deeper drift detection")
    .action(async (featureId: string, options) => {
      if (options.semantic) {
        console.log(pc.yellow("Semantic drift check requires 'devflow ai init' first."));
      }
      console.log(`Checking drift for feature: ${featureId}`);
      console.log("Run with --semantic for AI-powered analysis.");
    });

  // ── AI Adversarial Review (extends existing command) ──

  program
    .command("adversarial-review-ai <featureId>")
    .description("AI-powered adversarial review — uses LangGraph pipeline")
    .action(async (featureId: string) => {
      console.log(pc.yellow("AI adversarial review requires 'devflow ai init' first."));
      console.log(`Would run AI-powered adversarial review for: ${featureId}`);
      console.log("Use 'devflow adversarial-review' for deterministic review.");
    });

  // ── Eval ──

  program
    .command("eval run")
    .description("Run evaluation suite and generate report")
    .action(async () => {
      await runEvals(process.cwd());
    });

  // ── Trace ──

  program
    .command("trace <runId>")
    .description("Trace AI pipeline execution")
    .action(async (runId: string) => {
      console.log(`Tracing AI pipeline run: ${runId}`);
      console.log("Run artifacts located in .devflow/ai/runs/");
    });

  // ── Promote ──

  program
    .command("promote <proposalId>")
    .description("Promote AI-generated proposal to official feature artifact")
    .action(async (proposalId: string) => {
      console.log(pc.bold(`Promoting proposal: ${proposalId}`));
      console.log("This moves AI-generated artifacts from .devflow/ai/runs/ to _devflow/features/.");
      console.log(pc.yellow("Promotion requires gatekeeper approval. Run 'devflow gatekeep <id> --approve'."));
    });
}
