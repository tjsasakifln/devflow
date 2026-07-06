import path from "node:path";
import { execSync } from "node:child_process";
import { ArtifactManager } from "../artifacts/manager.js";
import { inspectProject } from "../project/inspector.js";
import { fileExists, listDir } from "../utils/fs.js";
import pc from "picocolors";

export async function featureNewCommand(
  cwd: string,
  featureName: string,
  options?: { actor?: string }
): Promise<void> {
  const rootPath = path.resolve(cwd);

  // Validate name
  const slug = featureName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug || slug.length === 0) {
    console.log(
      pc.red("Error: Feature name must contain at least one alphanumeric character.")
    );
    return;
  }

  // Determine next feature ID
  const manager = new ArtifactManager(rootPath);
  const featureDir = manager.paths.featureDir;
  const existing = await listDir(featureDir);

  let nextNum = 1;
  for (const entry of existing) {
    const match = entry.match(/^(\d{3})-/);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num >= nextNum) nextNum = num + 1;
    }
  }

  const featureId = `${String(nextNum).padStart(3, "0")}-${slug}`;

  console.log(pc.bold("\nDevflow — New Feature\n"));

  // Check if feature already exists
  if (await fileExists(path.join(featureDir, featureId))) {
    console.log(
      pc.yellow(`⚠️  Feature '${featureId}' already exists.`)
    );
    return;
  }

  // Create feature directory with requirements template
  console.log(pc.blue("→") + ` Creating feature: ${pc.bold(featureId)}`);
  const featurePath = await manager.ensureFeatureDir(featureName, featureId);

  // Update active feature
  const now = new Date().toISOString();
  const actor = options?.actor || process.env.DEVFLOW_ACTOR || process.env.USER || undefined;
  await manager.writeActiveFeature({
    featureId,
    featureName,
    startedAt: now,
    updatedAt: now,
    implementerActor: actor,
  });

  // Update state
  await manager.writeState({
    currentState: "feature-empty",
    previousState: null,
    confidence: "high",
    lastUpdated: now,
    activeFeatureId: featureId,
    blockers: [],
  });

  // Regenerate cockpit
  const inspection = await inspectProject(rootPath);
  const { detectState } = await import("../engine/state-detector.js");
  const { computeRecommendation } = await import("../engine/next-action.js");
  const { generateCockpit } = await import("../cockpit/generator.js");

  const stateResult = await detectState(inspection);
  const recommendation = computeRecommendation(stateResult, inspection);
  const cockpit = generateCockpit(stateResult, recommendation, inspection);
  await manager.safeWrite(
    path.join(rootPath, "DEVFLOW.md"),
    cockpit,
    "DEVFLOW.md"
  );

  // ── Create Git feature branch ──
  let branchCreated = false;
  try {
    const currentBranch = execSync("git branch --show-current", {
      cwd: rootPath,
      encoding: "utf-8",
    }).trim();

    if (currentBranch === "main" || currentBranch === "master") {
      execSync(`git checkout -b feature/${featureId}`, {
        cwd: rootPath,
        encoding: "utf-8",
      });
      branchCreated = true;
    } else {
      console.log(
        pc.yellow(`  ⚠  Not on main/master branch. Skipping branch creation.`)
      );
    }
  } catch {
    console.log(
      pc.yellow(`  ⚠  Git branch could not be created (git may not be configured).`)
    );
  }

  console.log(pc.green("\n✅ Feature created successfully!\n"));
  console.log(pc.bold("Feature:     "), featureId);
  console.log(pc.bold("Directory:   "), featurePath);
  if (branchCreated) {
    console.log(pc.bold("Branch:      "), `feature/${featureId}`);
  }
  console.log();
  console.log(pc.bold("Created files:"));
  console.log(`  ${pc.dim("→")} _devflow/features/${featureId}/requirements.md`);
  console.log(`  ${pc.dim("→")} _devflow/features/${featureId}/interfaces/`);
  console.log();
  console.log(
    "Next: edit " +
      pc.bold(`_devflow/features/${featureId}/requirements.md`) +
      " to define the feature.\n"
  );
}
