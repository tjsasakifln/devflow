import path from "node:path";
import fs from "node:fs/promises";
import { ArtifactManager } from "../artifacts/manager.js";
import { ConfigManager } from "../config/index.js";
import { inspectProject } from "../project/inspector.js";
import { detectState } from "../engine/state-detector.js";
import { computeRecommendation } from "../engine/next-action.js";
import { generateCockpit } from "../cockpit/generator.js";
import { ensureClaudeMdSection } from "../integration/claude-code.js";
import { fileExists } from "../utils/fs.js";
import pc from "picocolors";

// Paths created during init — used for rollback on failure
interface InitPlan {
  dotDevflowDir: string;
  devArtifactsDir: string;
  devflowMdPath: string;
  claudeMdPath: string;
  settingsPath: string;
  claudeDir: string;
}

function planPaths(rootPath: string): InitPlan {
  return {
    dotDevflowDir: path.join(rootPath, ".devflow"),
    devArtifactsDir: path.join(rootPath, "_devflow"),
    devflowMdPath: path.join(rootPath, "DEVFLOW.md"),
    claudeMdPath: path.join(rootPath, "CLAUDE.md"),
    settingsPath: path.join(rootPath, ".claude", "settings.json"),
    claudeDir: path.join(rootPath, ".claude"),
  };
}

export async function initCommand(cwd: string): Promise<void> {
  const rootPath = path.resolve(cwd);
  const planned = planPaths(rootPath);

  console.log(pc.bold("\nDevflow Init\n"));
  console.log(`Initializing Devflow in: ${pc.dim(rootPath)}\n`);

  // Check if already initialized
  if (await fileExists(path.join(rootPath, ".devflow", "config.json"))) {
    console.log(
      pc.yellow("⚠️  Devflow is already initialized in this directory.")
    );
    console.log("   Run " + pc.bold("devflow doctor") + " to fix any issues.\n");
    return;
  }

  // ── Pre-validation: verify all conditions before touching filesystem ──
  console.log(pc.blue("→") + " Pre-validating...");

  let inspection;
  try {
    inspection = await inspectProject(rootPath);
  } catch (err) {
    console.error(
      pc.red("✖ Failed to inspect project: ") +
        (err instanceof Error ? err.message : String(err))
    );
    console.error("  Verify the directory exists and is readable.");
    process.exit(1);
  }

  // Validate config generation (in-memory)
  const configMgr = new ConfigManager(rootPath);
  let config;
  try {
    config = configMgr.getDefaults();
    config.projectName = path.basename(rootPath);
    config.createdTimestamp = new Date().toISOString();
    JSON.stringify(config); // verify serializable
  } catch (err) {
    console.error(
      pc.red("✖ Failed to generate configuration: ") +
        (err instanceof Error ? err.message : String(err))
    );
    process.exit(1);
  }

  // Validate state detection (in-memory)
  let stateResult;
  try {
    stateResult = await detectState(inspection);
  } catch (err) {
    console.error(
      pc.red("✖ Failed to detect project state: ") +
        (err instanceof Error ? err.message : String(err))
    );
    process.exit(1);
  }

  // Validate cockpit generation (in-memory)
  try {
    const recommendation = computeRecommendation(stateResult, inspection);
    generateCockpit(stateResult, recommendation, inspection);
  } catch (err) {
    console.error(
      pc.red("✖ Failed to generate cockpit: ") +
        (err instanceof Error ? err.message : String(err))
    );
    process.exit(1);
  }

  // Validate slash command config (in-memory)
  try {
    const { generateSlashCommandConfig } = await import(
      "../integration/claude-code.js"
    );
    JSON.parse(generateSlashCommandConfig()); // verify valid JSON
  } catch (err) {
    console.error(
      pc.red("✖ Failed to generate slash command config: ") +
        (err instanceof Error ? err.message : String(err))
    );
    process.exit(1);
  }

  console.log(pc.green("  ✓") + " All pre-checks passed\n");

  // ── Execution phase with rollback ──
  const createdPaths: string[] = [];
  let claudeMdExistedBefore = false;

  try {
    // Step 1: Scaffold directories
    console.log(pc.blue("→") + " Creating directory structure...");
    const manager = new ArtifactManager(rootPath);
    await manager.scaffoldAll();
    createdPaths.push(planned.dotDevflowDir);
    createdPaths.push(planned.devArtifactsDir);

    // Step 2: Inspect project (already done in pre-validation, reuse)
    console.log(pc.blue("→") + " Inspecting project...");

    // Step 3: Initialize config
    console.log(pc.blue("→") + " Writing configuration...");
    await configMgr.save(config);

    // Step 4: Detect state and write state.json
    console.log(pc.blue("→") + " Detecting project state...");

    await manager.writeState({
      currentState: stateResult.currentState,
      previousState: null,
      confidence: stateResult.confidence,
      lastUpdated: new Date().toISOString(),
      activeFeatureId: null,
      blockers: stateResult.blockers,
    });

    // Step 5: Generate DEVFLOW.md cockpit
    console.log(pc.blue("→") + " Generating DEVFLOW.md cockpit...");
    const recommendation = computeRecommendation(stateResult, inspection);
    const cockpitContent = generateCockpit(
      stateResult,
      recommendation,
      inspection
    );
    await manager.safeWrite(
      planned.devflowMdPath,
      cockpitContent,
      "DEVFLOW.md"
    );
    createdPaths.push(planned.devflowMdPath);

    // Step 6: Integrate with CLAUDE.md
    console.log(pc.blue("→") + " Integrating with CLAUDE.md...");
    claudeMdExistedBefore = await fileExists(planned.claudeMdPath);
    await ensureClaudeMdSection(rootPath);
    if (!claudeMdExistedBefore) {
      createdPaths.push(planned.claudeMdPath);
    }

    // Step 7: Generate .claude/settings.json slash command config
    console.log(pc.blue("→") + " Configuring /devflow slash command...");
    const { ensureDir } = await import("../utils/fs.js");
    await ensureDir(planned.claudeDir);
    createdPaths.push(planned.claudeDir);

    const { generateSlashCommandConfig } = await import(
      "../integration/claude-code.js"
    );
    const settingsContent = generateSlashCommandConfig();
    await manager.safeWrite(
      planned.settingsPath,
      settingsContent,
      ".claude/settings.json"
    );
    createdPaths.push(planned.settingsPath);

    // Summary
    console.log(pc.green("\n✅ Devflow initialized successfully!\n"));
    console.log(pc.bold("Created:"));
    console.log("  .devflow/          — Internal state");
    console.log("  _devflow/          — Output artifacts");
    console.log("  DEVFLOW.md         — Project cockpit");
    console.log("  CLAUDE.md          — Devflow integration (appended)");
    console.log("  .claude/settings.json — /devflow slash command");
    console.log();
    console.log(pc.bold("Detected state: ") + pc.cyan(stateResult.currentState));
    console.log(pc.bold("Confidence:     ") + stateResult.confidence);
    console.log();

    // ── Onboarding Roadmap ──
    await showOnboardingRoadmap(inspection, stateResult);
  } catch (err) {
    // ── Rollback: remove created paths in reverse order ──
    console.error(
      pc.red("\n✖ Init failed: ") +
        (err instanceof Error ? err.message : String(err))
    );
    console.log(pc.yellow("  Rolling back changes..."));

    for (const p of createdPaths.reverse()) {
      try {
        await fs.rm(p, { recursive: true, force: true });
        console.log(pc.dim(`    Removed: ${path.relative(rootPath, p)}`));
      } catch (rollbackErr) {
        console.log(
          pc.yellow(
            `    Could not remove: ${path.relative(rootPath, p)} (manual cleanup may be needed)`
          )
        );
      }
    }

    if (claudeMdExistedBefore) {
      console.log(
        pc.dim(
          `    CLAUDE.md was appended — original content preserved (verify manually)`
        )
      );
    }

    console.log();
    process.exit(1);
  }
}

/**
 * Show a contextual onboarding roadmap after successful init.
 * Detects greenfield vs brownfield and provides stack-specific guidance.
 */
async function showOnboardingRoadmap(
  inspection: any,
  _stateResult: any,
): Promise<void> {
  const isBrownfield = inspection.fileCount > 10;
  const stackProfile = inspection.stackProfile;
  const language = stackProfile?.language || inspection.language || "unknown";

  console.log(pc.bold("━━━ Onboarding Roadmap ━━━\n"));

  // Detect project type
  if (isBrownfield) {
    console.log(pc.yellow("🏗️  Brownfield Project Detected"));
    console.log(pc.dim(`   ${inspection.fileCount}+ files, existing codebase\n`));
    console.log(pc.cyan("  Before asking AI to code:"));
    console.log(`    ${pc.bold("1.")} Run ${pc.bold("devflow discover")} to map existing architecture`);
    console.log(`    ${pc.bold("2.")} Review ${pc.dim("_devflow/discovery/")} reports`);
    console.log(`    ${pc.bold("3.")} Identify high-risk areas before making changes`);
    console.log(`    ${pc.bold("4.")} Run ${pc.bold("devflow feature new <name>")} for your first feature`);
    console.log();
    console.log(
      pc.yellow("  ⚠️  Don't implement anything before understanding the existing coupling patterns.")
    );
  } else {
    console.log(pc.green("🌱 Greenfield Project Detected"));
    console.log(pc.dim("   Clean start or minimal code\n"));
    console.log(pc.cyan("  Before asking AI to code:"));
    console.log(`    ${pc.bold("1.")} Document your architecture vision in ${pc.dim("_devflow/specs/")}`);
    console.log(`    ${pc.bold("2.")} Start with ${pc.bold("devflow feature new <name>")}`);
    console.log(`    ${pc.bold("3.")} Write requirements following the pedagogical template`);
    console.log(`    ${pc.bold("4.")} Always complete requirements before writing code`);
    console.log();
    console.log(
      pc.yellow("  ⚠️  Don't skip the requirements phase — AI without spec produces fragile code.")
    );
  }

  // Stack-specific advice
  console.log(pc.cyan("  Stack-specific tooling:"));
  if (language === "typescript" || language === "javascript") {
    console.log(
      `    ${pc.dim("•")} Tests: ${pc.bold(stackProfile?.testCommand || "npx vitest run")}`
    );
    console.log(
      `    ${pc.dim("•")} Typecheck: ${pc.bold(stackProfile?.typeCheckCommand || "npx tsc --noEmit")}`
    );
    console.log(
      `    ${pc.dim("•")} Lint: ${pc.bold(stackProfile?.lintCommand || "npx eslint src/")}`
    );
  } else if (language === "python") {
    console.log(
      `    ${pc.dim("•")} Tests: ${pc.bold(stackProfile?.testCommand || "python -m pytest")}`
    );
    console.log(
      `    ${pc.dim("•")} Typecheck: ${pc.bold(stackProfile?.typeCheckCommand || "python -m mypy src/")}`
    );
    console.log(
      `    ${pc.dim("•")} Lint: ${pc.bold(stackProfile?.lintCommand || "ruff check src/")}`
    );
  } else if (language === "go") {
    console.log(
      `    ${pc.dim("•")} Tests: ${pc.bold("go test ./...")}`
    );
    console.log(
      `    ${pc.dim("•")} Analysis: ${pc.bold("go vet ./...")}`
    );
    console.log(
      `    ${pc.dim("•")} Lint: ${pc.bold("golangci-lint run ./...")}`
    );
  } else if (language === "rust") {
    console.log(
      `    ${pc.dim("•")} Tests: ${pc.bold("cargo test")}`
    );
    console.log(
      `    ${pc.dim("•")} Lint: ${pc.bold("cargo clippy")}`
    );
  } else if (language === "php") {
    console.log(
      `    ${pc.dim("•")} Tests: ${pc.bold("vendor/bin/phpunit")}`
    );
    console.log(
      `    ${pc.dim("•")} Analysis: ${pc.bold("vendor/bin/phpstan analyse src/")}`
    );
  } else {
    console.log(
      `    ${pc.dim("•")} Stack not detected — Devflow will use defaults. Configure in ${pc.dim(".devflow/config.json")}`
    );
  }

  // CI detection
  if (stackProfile?.hasCI) {
    console.log(
      `    ${pc.dim("•")} CI: ${pc.green(stackProfile.ciProvider || "detected")}`
    );
  } else {
    console.log(
      `    ${pc.dim("•")} CI: ${pc.yellow("not detected — consider setting up GitHub Actions")}`
    );
  }

  console.log();
  console.log(pc.bold("First recommended command:"));
  console.log(
    `  ${pc.cyan(isBrownfield ? "devflow discover" : "devflow feature new <name>")}`
  );
  console.log();
  console.log(
    `Run ${pc.bold("devflow next")} anytime to see the recommended next action.\n`
  );
}
