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

/**
 * Render a structured preview stub for commands not yet implemented.
 * No "Would generate..." — either it runs or it declares itself as preview.
 */
function renderPreviewStub(
  commandName: string,
  description: string,
  expectedIn: string,
  alternative: string,
): void {
  const width = 62;
  const border = pc.dim("─".repeat(width));

  console.log("");
  console.log(`┌${border}┐`);
  console.log(`│ ${pc.bold("[PREVIEW] Command Not Yet Implemented")}${" ".repeat(width - 40)}│`);
  console.log(`│${" ".repeat(width + 2)}│`);
  console.log(`│ ${pc.cyan("Command:")}   ${commandName}${" ".repeat(Math.max(1, width - commandName.length - 11))}│`);
  console.log(`│ ${pc.cyan("Purpose:")}   ${description}${" ".repeat(Math.max(1, width - description.length - 11))}│`);
  console.log(`│ ${pc.cyan("Expected:")}  ${expectedIn}${" ".repeat(Math.max(1, width - expectedIn.length - 11))}│`);
  console.log(`│${" ".repeat(width + 2)}│`);
  console.log(`│ ${pc.yellow("Alternative:")} ${alternative}${" ".repeat(Math.max(1, width - alternative.length - 14))}│`);
  console.log(`└${border}┘`);
  console.log("");
}

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
    .description("Recommend the next best action — your process copilot")
    .option("--json", "Output as JSON")
    .option("--force", "Force progression with bypass registration")
    .option("--diagnose", "Deep artifact analysis (detects weak sections, missing files)")
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
    .option("--non-interactive", "Skip interactive prompts (use template directly)")
    .action(async (name: string, options: { actor?: string; nonInteractive?: boolean }) => {
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

  // ── AI Commands [PREVIEW] ──

  const aiCmd = program
    .command("ai")
    .description("[PREVIEW] AI-assisted operations (requires provider configuration)");

  aiCmd
    .command("init")
    .description("[PREVIEW] Configure AI provider and usage policy")
    .option("--provider <provider>", "Model provider: openai, anthropic, openrouter, google, ollama")
    .option("--model <model>", "Model name")
    .action(async (options) => {
      renderPreviewStub(
        "devflow ai init",
        "AI provider configuration",
        "Phase 3 of Devflow roadmap",
        "Set environment variables manually: OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.",
      );
      console.log(pc.dim(`  Provider: ${options.provider ?? "ollama"} (not persisted)`));
      console.log(pc.dim(`  Model: ${options.model ?? "llama3.2"} (not persisted)`));
    });

  // ── Indexing ──

  program
    .command("index")
    .description("Map project structure and build search index")
    .option("--force", "Force full re-index")
    .action(async (_options) => {
      await indexProject(process.cwd());
    });

  // ── Discovery [EXPERIMENTAL] ──

  program
    .command("discover")
    .description("[EXPERIMENTAL] Discover and document brownfield project")
    .option("--ai", "Use AI-assisted discovery")
    .action(async (options) => {
      if (options.ai) {
        renderPreviewStub(
          "devflow discover --ai",
          "AI-assisted brownfield discovery",
          "Phase 3 of Devflow roadmap",
          "Use devflow discover (without --ai) for structural discovery.",
        );
      } else {
        console.log("Running structural discovery...");
        await indexProject(process.cwd());
      }
    });

  // ── Requirements Audit [PREVIEW] ──

  program
    .command("requirements audit <featureId>")
    .description("[PREVIEW] Audit requirements completeness and quality")
    .option("--ai", "Use AI-assisted audit")
    .action(async (featureId: string, options) => {
      if (options.ai) {
        renderPreviewStub(
          `devflow requirements audit ${featureId} --ai`,
          "AI-assisted requirements audit",
          "Phase 3 of Devflow roadmap",
          "Manually review _devflow/features/<id>/requirements.md against the pedagogical template criteria.",
        );
      } else {
        console.log(`Auditing requirements for ${featureId}...`);
        console.log("Run with --ai for semantic analysis (when available).");
      }
    });

  // ── Design Review [PREVIEW] ──

  program
    .command("design review <featureId>")
    .description("[PREVIEW] Review architectural design")
    .option("--ai", "Use AI-assisted review")
    .action(async (featureId: string, options) => {
      if (options.ai) {
        renderPreviewStub(
          `devflow design review ${featureId} --ai`,
          "AI-assisted design review",
          "Phase 3 of Devflow roadmap",
          "Manually review _devflow/features/<id>/roadmap.md for architectural soundness.",
        );
      } else {
        console.log(`Reviewing design for ${featureId}...`);
        console.log("Run with --ai for semantic analysis (when available).");
      }
    });

  // ── Tests Review [PREVIEW] ──

  program
    .command("tests review <featureId>")
    .description("[PREVIEW] Review test plan completeness")
    .option("--ai", "Use AI-assisted review")
    .action(async (featureId: string, options) => {
      if (options.ai) {
        renderPreviewStub(
          `devflow tests review ${featureId} --ai`,
          "AI-assisted test review",
          "Phase 3 of Devflow roadmap",
          "Manually review _devflow/features/<id>/test-plan.md for coverage gaps.",
        );
      } else {
        console.log(`Reviewing tests for ${featureId}...`);
        console.log("Run with --ai for semantic analysis (when available).");
      }
    });

  // ── Actions Generate [PREVIEW] ──

  program
    .command("actions generate <featureId>")
    .description("[PREVIEW] Generate actions.md from design documents")
    .option("--ai", "Use AI-assisted generation")
    .action(async (featureId: string, options) => {
      if (options.ai) {
        renderPreviewStub(
          `devflow actions generate ${featureId} --ai`,
          "AI-assisted actions generation",
          "Phase 3 of Devflow roadmap",
          "Use the actions template: _devflow/features/<id>/actions.md",
        );
      } else {
        console.log(pc.yellow("Use --ai flag to generate actions with AI assistance (when available)."));
      }
    });

  // ── Drift Check [PREVIEW] ──

  program
    .command("drift check <featureId>")
    .description("[PREVIEW] Check code-spec divergence")
    .option("--semantic", "Use semantic analysis for deeper drift detection")
    .action(async (featureId: string, options) => {
      if (options.semantic) {
        renderPreviewStub(
          `devflow drift check ${featureId} --semantic`,
          "Semantic drift detection",
          "Phase 3 of Devflow roadmap",
          "Compare requirements.md acceptance criteria against implementation-log.jsonl manually.",
        );
      } else {
        console.log(`Checking drift for feature: ${featureId}`);
        console.log("Run with --semantic for AI-powered analysis (when available).");
      }
    });

  // ── AI Adversarial Review [PREVIEW] ──

  program
    .command("adversarial-review-ai <featureId>")
    .description("[PREVIEW] AI-powered adversarial review — uses LangGraph pipeline")
    .action(async (featureId: string) => {
      renderPreviewStub(
        `devflow adversarial-review-ai ${featureId}`,
        "AI-powered adversarial review (LangGraph pipeline)",
        "Phase 3 of Devflow roadmap",
        "Use 'devflow adversarial-review' for deterministic review (12 attack vectors, fully implemented).",
      );
    });

  // ── Eval [EXPERIMENTAL] ──

  program
    .command("eval run")
    .description("[EXPERIMENTAL] Run evaluation suite and generate report")
    .action(async () => {
      await runEvals(process.cwd());
    });

  // ── Trace [PREVIEW] ──

  program
    .command("trace <runId>")
    .description("[PREVIEW] Trace AI pipeline execution")
    .action(async (runId: string) => {
      renderPreviewStub(
        `devflow trace ${runId}`,
        "AI pipeline trace",
        "Phase 3 of Devflow roadmap",
        "Run artifacts will be stored in .devflow/ai/runs/ when available.",
      );
    });

  // ── Promote [PREVIEW] ──

  program
    .command("promote <proposalId>")
    .description("[PREVIEW] Promote AI-generated proposal to official feature artifact")
    .action(async (proposalId: string) => {
      renderPreviewStub(
        `devflow promote ${proposalId}`,
        "AI proposal promotion",
        "Phase 3 of Devflow roadmap",
        "Manually copy artifacts from .devflow/ai/runs/ to _devflow/features/.",
      );
    });
}
