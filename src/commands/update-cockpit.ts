import path from "node:path";
import { ArtifactManager } from "../kernel/artifacts/manager.js";
import { inspectProject } from "../adapters/project/inspector.js";
import { detectState } from "../kernel/state/detector.js";
import { computeRecommendation } from "../kernel/actions/recommender.js";
import { generateCockpit } from "../kernel/cockpit/generator.js";
import { fileExists } from "../kernel/utils/fs.js";
import pc from "picocolors";

export async function updateCockpitCommand(cwd: string): Promise<void> {
  const rootPath = path.resolve(cwd);

  console.log(pc.bold("\nDevflow — Update Cockpit\n"));

  // Verify Devflow is initialized
  if (!(await fileExists(path.join(rootPath, ".devflow", "config.json")))) {
    console.log(
      pc.red("Error: Devflow is not initialized. Run `devflow install` first.")
    );
    return;
  }

  const inspection = await inspectProject(rootPath);
  const stateResult = await detectState(inspection);
  const recommendation = computeRecommendation(stateResult, inspection);
  const cockpitContent = generateCockpit(
    stateResult,
    recommendation,
    inspection
  );

  const manager = new ArtifactManager(rootPath);
  const cockpitPath = path.join(rootPath, "DEVFLOW.md");
  const written = await manager.safeWrite(
    cockpitPath,
    cockpitContent,
    "DEVFLOW.md"
  );

  if (written) {
    console.log(
      pc.green("✅ DEVFLOW.md updated successfully!")
    );
    console.log(pc.dim(`   State: ${stateResult.currentState}`));
  } else {
    console.log(
      pc.dim("DEVFLOW.md is up to date — no changes needed.")
    );
  }

  console.log();
}
