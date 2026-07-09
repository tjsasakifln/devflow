import type { Command } from "commander";
import { ADVERSARIAL_VECTOR_COUNT } from "../kernel/constants.js";
import { initCommand } from "./init.js";
import { installCommand } from "./install.js";
import { statusCommand } from "./status.js";
import { nextCommand } from "./next.js";
import { featureNewCommand } from "./feature.js";
import { featureComplete } from "./feature-complete.js";
import { featurePromptCommand } from "./feature-prompt.js";
import { gatekeep } from "./gatekeep.js";
import { adversarialReview } from "./adversarial-review.js";
import { reviewPrCommand } from "./review-pr.js";
import { doctorCommand } from "./doctor.js";
import { updateCockpitCommand } from "./update-cockpit.js";
import { indexProject } from "./index-project.js";
import { discoverCommand } from "./discover.js";
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
    .command("install")
    .description("Guided first-run setup — user-friendly alternative to init")
    .option("--yes", "Skip prompts and use defaults")
    .option("--mode <mode>", "Execution mode: local, experimental, strict, release")
    .option("--agent <agent>", "AI agent integration: claude, cursor, none")
    .option("--review-mode <mode>", "Review mode: independent, solo-hardened")
    .option("--non-interactive", "Skip interactive prompts")
    .option("--dry-run", "Preview without writing files")
    .action(async (options) => {
      await installCommand(process.cwd(), {
        yes: options.yes,
        mode: options.mode,
        agent: options.agent,
        reviewMode: options.reviewMode,
        nonInteractive: options.nonInteractive,
        dryRun: options.dryRun,
      });
    });

  // ── Config management ──
  const configCmd = program
    .command("config")
    .description("Manage Devflow configuration");

  configCmd
    .command("set <key> <value>")
    .description("Set a configuration value (e.g., reviewMode solo-hardened)")
    .action(async (key: string, value: string) => {
      const { ConfigManager } = await import("../config/index.js");
      const mgr = new ConfigManager(process.cwd());
      const config = await mgr.load();

      const validKeys = ["reviewMode", "executionMode", "riskTolerance"];
      if (!validKeys.includes(key)) {
        console.log(pc.yellow(`Unknown config key: ${key}`));
        console.log(pc.dim(`Valid keys: ${validKeys.join(", ")}`));
        return;
      }

      if (key === "reviewMode" && !["independent", "solo-hardened"].includes(value)) {
        console.log(pc.yellow(`Invalid value for reviewMode: ${value}`));
        console.log(pc.dim("Valid values: independent, solo-hardened"));
        return;
      }

      if (key === "executionMode" && !["local", "experimental", "strict", "release"].includes(value)) {
        console.log(pc.yellow(`Invalid value for executionMode: ${value}`));
        console.log(pc.dim("Valid values: local, experimental, strict, release"));
        return;
      }

      if (key === "riskTolerance" && !["relaxed", "moderate", "strict"].includes(value)) {
        console.log(pc.yellow(`Invalid value for riskTolerance: ${value}`));
        console.log(pc.dim("Valid values: relaxed, moderate, strict"));
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (config as any)[key] = value;
      await mgr.save(config);
      console.log(pc.green(`✅ ${key} = ${value}`));

      if (key === "reviewMode" && value === "solo-hardened") {
        console.log();
        console.log(pc.yellow("⚠️  Solo-Hardened Review Mode:"));
        console.log(pc.yellow("   - Independent human review will NOT be required"));
        console.log(pc.yellow("   - Adversarial review becomes MANDATORY for approval"));
        console.log(pc.yellow("   - All deterministic checks must pass"));
        console.log(pc.yellow("   - Gatekeep log will document this as solo-hardened approval"));
        console.log();
        console.log(pc.dim("   This is NOT equivalent to independent review."));
        console.log(pc.dim("   Consider seeking a second reviewer when possible."));
      }

      if (key === "riskTolerance") {
        console.log();
        if (value === "relaxed") {
          console.log(pc.yellow("⚠️  Relaxed Risk Tolerance:"));
          console.log(pc.yellow("   - Solo projects. Self-approval OK with compensating checks."));
          console.log(pc.yellow("   - Coverage and lint → advisory (not blocking)."));
          console.log(pc.yellow("   - Missing artifacts → warning, not block."));
          console.log(pc.yellow("   - Adversarial review remains mandatory."));
        } else if (value === "moderate") {
          console.log(pc.green("✅ Moderate Risk Tolerance (default):"));
          console.log(pc.dim("   - Standard gates. Team review expected. CI advisory."));
        } else {
          console.log(pc.red("🔒 Strict Risk Tolerance:"));
          console.log(pc.red("   - All gates blocking. CI required. Unknown actors blocked."));
          console.log(pc.red("   - Full audit trail mandatory."));
        }
        console.log();
        console.log(pc.dim("   Risk tolerance adjusts gate severity. Run `devflow doctor` to see effects."));
      }
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

  featureCmd
    .command("prompt <id>")
    .description("Generate structured implementation prompt for AI agents (Claude Code, Cursor, etc.)")
    .option("--copy", "Copy prompt to clipboard")
    .option("--output <file>", "Write prompt to a specific file")
    .option("--save", "Save prompt to feature directory as implementation-prompt.md")
    .option("--preview", "Generate prompt even if pre-code gates are not passed (for review only, NOT for implementation)")
    .action(async (id: string, options: { copy?: boolean; output?: string; save?: boolean; preview?: boolean }) => {
      await featurePromptCommand(process.cwd(), id, options);
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
    .option("--install-missing", "Auto-install missing tools via npm install --save-dev")
    .option("--non-interactive", "Skip prompts, automatically skip vectors with missing tools")
    .action(async (featureId: string, opts: { installMissing?: boolean; nonInteractive?: boolean }) => {
      await adversarialReview(featureId, process.cwd(), {
        installMissing: opts.installMissing ?? false,
        nonInteractive: opts.nonInteractive ?? false,
      });
    });

  // review-pr
  program
    .command("review-pr")
    .description("Generate PR risk report — what changed, which evidence exists, what risks remain")
    .option("--base <branch>", "Base branch to compare against", "main")
    .option("--output <file>", "Write report to file instead of stdout")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      await reviewPrCommand(process.cwd(), options);
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
        "Planned. Not built yet.",
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
    .description("[EXPERIMENTAL] Discover and document brownfield project structure, risks, testing baseline, and change zones")
    .option("--ai", "Use AI-assisted discovery (not yet available)")
    .action(async (options) => {
      if (options.ai) {
        renderPreviewStub(
          "devflow discover --ai",
          "AI-assisted brownfield discovery",
          "Planned. Not built yet.",
          "Use devflow discover (without --ai) for structural discovery — generates 4 reports.",
        );
      } else {
        await discoverCommand(process.cwd());
      }
    });

  // ── Requirements Audit [PREVIEW] ──

  program
    .command("requirements audit <featureId>")
    .description("[PREVIEW] Audit requirements completeness and quality")
    .action(async (featureId: string) => {
      renderPreviewStub(
        `devflow requirements audit ${featureId}`,
        "Requirements completeness audit",
        "Planned. Not built yet.",
        `Review _devflow/features/${featureId}/requirements.md manually. Run devflow next --diagnose for weak sections.`,
      );
    });

  // ── Design Review [PREVIEW] ──

  program
    .command("design review <featureId>")
    .description("[PREVIEW] Review architectural design")
    .action(async (featureId: string) => {
      renderPreviewStub(
        `devflow design review ${featureId}`,
        "Architectural design review",
        "Planned. Not built yet.",
        `Review _devflow/features/${featureId}/roadmap.md manually for architectural soundness.`,
      );
    });

  // ── Tests Review [PREVIEW] ──

  program
    .command("tests review <featureId>")
    .description("[PREVIEW] Review test plan completeness")
    .action(async (featureId: string) => {
      renderPreviewStub(
        `devflow tests review ${featureId}`,
        "Test plan review",
        "Planned. Not built yet.",
        `Review _devflow/features/${featureId}/test-plan.md manually for coverage gaps.`,
      );
    });

  // ── Actions Generate [PREVIEW] ──

  program
    .command("actions generate <featureId>")
    .description("[PREVIEW] Generate actions.md from design documents")
    .action(async (featureId: string) => {
      renderPreviewStub(
        `devflow actions generate ${featureId}`,
        "Generate actions from design",
        "Planned. Not built yet.",
        `Use the actions template: copy templates/actions-template.md → _devflow/features/${featureId}/actions.md and fill in tasks.`,
      );
    });

  // ── Drift Check [PREVIEW] ──

  program
    .command("drift check <featureId>")
    .description("[PREVIEW] Check code-spec divergence")
    .action(async (featureId: string) => {
      renderPreviewStub(
        `devflow drift check ${featureId}`,
        "Code-spec drift detection",
        "Planned. Not built yet.",
        `Compare _devflow/features/${featureId}/requirements.md acceptance criteria against implementation-log.jsonl manually.`,
      );
    });

  // ── AI Adversarial Review [PREVIEW] ──

  program
    .command("adversarial-review-ai <featureId>")
    .description("[PREVIEW] AI-powered adversarial review — uses LangGraph pipeline")
    .action(async (featureId: string) => {
      renderPreviewStub(
        `devflow adversarial-review-ai ${featureId}`,
        "AI-powered adversarial review (LangGraph pipeline)",
        "Planned. Not built yet.",
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
        "Planned. Not built yet.",
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
        "Planned. Not built yet.",
        "Manually copy artifacts from .devflow/ai/runs/ to _devflow/features/.",
      );
    });
}
