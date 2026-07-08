/**
 * Devflow CLI — Command Registration
 *
 * Thin CLI wrappers registered here. Commands import from ./<name>.js
 * for migrated CLI commands, and from ../commands/<name>.js for
 * commands still living in the old commands directory.
 */

import type { Command } from "commander";
import { ADVERSARIAL_VECTOR_COUNT } from "../kernel/constants.js";
import { initCommand } from "../commands/init.js";
import { installCommand } from "../commands/install.js";
import { statusCommand } from "../commands/status.js";
import { nextCommand } from "../commands/next.js";
import { featureNewCommand } from "../commands/feature.js";
import { featureComplete } from "../commands/feature-complete.js";
import { featurePromptCommand } from "../commands/feature-prompt.js";
import { gatekeep } from "../commands/gatekeep.js";
import { adversarialReview } from "../commands/adversarial-review.js";
import { adversarialReviewAI } from "../commands/adversarial-review-ai.js";
import { traceCommand } from "../commands/trace.js";
import { promoteCommand } from "../commands/promote.js";
import { reviewPrCommand } from "./review-pr.js";
import { doctorCommand } from "../commands/doctor.js";
import { updateCockpitCommand } from "../commands/update-cockpit.js";
import { indexProject } from "../commands/index-project.js";
import { discoverCommand } from "../commands/discover.js";
import { runEvals } from "../commands/eval-run.js";
import { auditCommand } from "./audit.js";
import { aiInitCommand } from "../commands/ai-init.js";
import { requirementsAuditCommand } from "../commands/requirements-audit.js";
import { designReviewCommand } from "../commands/design-review.js";
import { testsReviewCommand } from "../commands/tests-review.js";
import { actionsGenerateCommand } from "../commands/actions-generate.js";
import { driftCheckCommand } from "../commands/drift-check.js";
import { analyzeCommand } from "../commands/analyze.js";
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
  console.log(`│ ${pc.bold("[STUB] Command Not Yet Implemented")}${" ".repeat(width - 40)}│`);
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

   // ── Audit ──

  program
    .command("audit")
    .description("Audit local changes for AI-generated code risks — no feature setup required")
    .option("--staged", "Audit staged changes only")
    .option("--working-tree", "Include unstaged working tree changes")
    .option("--base <branch>", "Base branch to compare against", "main")
    .option("--format <format>", "Output format: markdown, html, json", "markdown")
    .option("--output <file>", "Write report to file")
    .option("--risk-tolerance <level>", "Risk tolerance: relaxed, moderate, strict")
    .action(async (options) => {
      await auditCommand(process.cwd(), options);
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
    .option("--verify-mode <mode>", "Verification mode: deterministic (default) or adversarial (multi-agent)", "deterministic")
    .action(async (featureId: string, options: { verifyMode?: string }) => {
      const verifyMode = options.verifyMode === "adversarial" ? "adversarial" : "deterministic";
      await adversarialReview(featureId, process.cwd(), { verifyMode });
    });

  // review-pr
  program
    .command("review-pr")
    .description("Generate PR risk report — what changed, which evidence exists, what risks remain")
    .option("--base <branch>", "Base branch to compare against", "main")
    .option("--output <file>", "Write report to file instead of stdout")
    .option("--json", "Output as JSON (shorthand for --format json)")
    .option("--format <format>", "Output format: markdown, html, json", "markdown")
    .option("--risk-tolerance <level>", "Risk tolerance: relaxed, moderate, strict")
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

  // ── AI Commands  ──

  const aiCmd = program
    .command("ai")
    .description(" AI-assisted operations — configure and manage AI providers");

  aiCmd
    .command("init")
    .description("Configure AI provider connections (Anthropic, OpenAI, Ollama) and save to .env")
    .option("--provider <provider>", "Specific provider to configure: anthropic, openai, ollama (omit for all)")
    .option("-y, --yes", "Skip prompts — validate existing keys only")
    .action(async (options) => {
      const providers = options.provider ? [options.provider] : undefined;
      await aiInitCommand(process.cwd(), { providers, yes: options.yes ?? false });
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
    .description("Discover and document brownfield project structure, risks, testing baseline, and change zones")
    .option("--ai", "Use AI-assisted discovery (not yet available)")
    .option("--phase <name>", "Run a specific discovery phase: scout, archaeologist, detective, architect, writer")
    .action(async (options) => {
      if (options.ai) {
        renderPreviewStub(
          "devflow discover --ai",
          "AI-assisted brownfield discovery",
          "Planned. Not built yet.",
          "Use devflow discover (without --ai) for structural discovery — generates 4 reports.",
        );
      } else {
        await discoverCommand(process.cwd(), { phase: options.phase });
      }
    });

  // ── Requirements Audit  ──

  const requirementsCmd = program
    .command("requirements")
    .description("Manage and audit feature requirements");

  requirementsCmd
    .command("audit <featureId>")
    .description("Audit requirements completeness and quality")
    .action(async (featureId: string) => {
      await requirementsAuditCommand(process.cwd(), { featureId });
    });

  // ── Design Review  ──

  const designCmd = program
    .command("design")
    .description("Review feature architecture and design");

  designCmd
    .command("review <featureId>")
    .description("Review architectural design — detect over-engineering and missing layers")
    .action(async (featureId: string) => {
      await designReviewCommand(process.cwd(), { featureId });
    });

  // ── Tests Review  ──

  const testsCmd = program
    .command("tests")
    .description("Test and coverage commands");

  testsCmd
    .command("review <featureId>")
    .description("Review test plan completeness — detect gaps between test-plan.md and actual test files")
    .action(async (featureId: string) => {
      await testsReviewCommand(process.cwd(), featureId);
    });

  // ── Actions Generate  ──

  const actionsCmd = program
    .command("actions")
    .description("Actions and workflow generation commands");

  actionsCmd
    .command("generate <featureId>")
    .description("Generate GitHub Actions workflow from project config")
    .option("--write", "Write the workflow file to .github/workflows/devflow-governance.yml")
    .action(async (featureId: string, options: { write?: boolean }) => {
      await actionsGenerateCommand(process.cwd(), featureId, options);
    });

  // ── Drift Check  ──

  const driftCmd = program
    .command("drift")
    .description("Drift detection between specs and implementation");

  driftCmd
    .command("check <featureId>")
    .description("Check code-spec divergence — compare requirements.md vs implementation-log.jsonl")
    .option("--strict", "Deterministic exact matching (no false positives)")
    .option("--heuristic", "Fuzzy keyword matching (catches more, may have false positives)")
    .action(async (featureId: string, options: { strict?: boolean; heuristic?: boolean }) => {
      await driftCheckCommand(process.cwd(), featureId, options);
    });

  // ── AI Adversarial Review ──

  program
    .command("adversarial-review-ai <featureId>")
    .description("AI-powered adversarial review — complements deterministic review with LLM analysis (falls back to deterministic if no AI provider)")
    .action(async (featureId: string) => {
      await adversarialReviewAI(featureId, process.cwd());
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
    .command("trace")
    .description("Trace execution timeline from audit logs — gates, actions, decisions, reviews")
    .option("--feature <id>", "Filter by feature ID")
    .option("--format <format>", "Output format: terminal, json, html", "terminal")
    .action(async (options) => {
      await traceCommand(process.cwd(), {
        format: options.format,
        featureId: options.feature,
      });
    });

  // ── Analyze ──

  const analyzeCmd = program
    .command("analyze")
    .description("Analyze codebase across multiple dimensions — security, performance, architecture, tests, docs, deps");

  analyzeCmd
    .command("run")
    .description("Run parallel analysis across selected dimensions")
    .option("--parallel <dims>", 'Dimensions to analyze: "all", comma-separated list, or "custom"', "all")
    .option("--dimensions-file <path>", "Path to custom dimension config file (JSON/YAML)")
    .option("--json", "Output as JSON (pipe-safe)")
    .option("--max-parallel <n>", "Maximum parallel agents", parseInt)
    .option("--timeout <seconds>", "Per-agent timeout in seconds", parseInt)
    .action(async (options) => {
      await analyzeCommand(process.cwd(), {
        parallel: options.parallel,
        dimensionsFile: options.dimensionsFile,
        json: options.json,
        maxParallel: options.maxParallel,
        timeout: options.timeout,
      });
    });

  // ── Promote ──

  program
    .command("promote <featureId>")
    .description("Promote feature between environments: local → staging → prod (with environment gates)")
    .option("--to <env>", "Target environment: local, staging, prod", "staging")
    .option("--force", "Skip failed gates with warning")
    .action(async (featureId: string, options) => {
      await promoteCommand(process.cwd(), {
        to: options.to,
        force: options.force ?? false,
        featureId,
      });
    });
}
