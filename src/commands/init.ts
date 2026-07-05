import path from "node:path";
import { ArtifactManager } from "../artifacts/manager.js";
import { ConfigManager } from "../config/index.js";
import { inspectProject } from "../project/inspector.js";
import { detectState } from "../engine/state-detector.js";
import { computeRecommendation } from "../engine/next-action.js";
import { generateCockpit } from "../cockpit/generator.js";
import { ensureClaudeMdSection } from "../integration/claude-code.js";
import { fileExists } from "../utils/fs.js";
import pc from "picocolors";

export async function initCommand(cwd: string): Promise<void> {
  const rootPath = path.resolve(cwd);

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

  // Step 1: Scaffold directories
  console.log(pc.blue("→") + " Creating directory structure...");
  const manager = new ArtifactManager(rootPath);
  await manager.scaffoldAll();

  // Step 2: Inspect project
  console.log(pc.blue("→") + " Inspecting project...");
  const inspection = await inspectProject(rootPath);

  // Step 3: Initialize config
  console.log(pc.blue("→") + " Writing configuration...");
  const configMgr = new ConfigManager(rootPath);
  const config = configMgr.getDefaults();
  config.projectName = path.basename(rootPath);
  config.createdTimestamp = new Date().toISOString();
  await configMgr.save(config);

  // Step 4: Detect state and write state.json
  console.log(pc.blue("→") + " Detecting project state...");
  const stateResult = await detectState(inspection);

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
    path.join(rootPath, "DEVFLOW.md"),
    cockpitContent,
    "DEVFLOW.md"
  );

  // Step 6: Integrate with CLAUDE.md
  console.log(pc.blue("→") + " Integrating with CLAUDE.md...");
  await ensureClaudeMdSection(rootPath);

  // Step 7: Generate .claude/settings.json slash command config
  console.log(pc.blue("→") + " Configuring /devflow slash command...");
  const claudeDir = path.join(rootPath, ".claude");
  const { ensureDir } = await import("../utils/fs.js");
  await ensureDir(claudeDir);
  const { generateSlashCommandConfig } = await import(
    "../integration/claude-code.js"
  );

  const settingsPath = path.join(claudeDir, "settings.json");
  const settingsContent = generateSlashCommandConfig();
  await manager.safeWrite(settingsPath, settingsContent, ".claude/settings.json");

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
  console.log("Next: run " + pc.bold("devflow next") + " to see the recommended action.\n");
}
