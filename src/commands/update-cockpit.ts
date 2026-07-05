import path from "node:path";
import { ArtifactManager } from "../artifacts/manager.js";
import { inspectProject } from "../project/inspector.js";
import { detectState } from "../engine/state-detector.js";
import { computeRecommendation } from "../engine/next-action.js";
import { generateCockpit } from "../cockpit/generator.js";
import { fileExists } from "../utils/fs.js";
import pc from "picocolors";

export async function updateCockpitCommand(cwd: string): Promise<void> {
  const rootPath = path.resolve(cwd);

  console.log(pc.bold("\nDevflow — Update Cockpit\n"));

  // Verify Devflow is initialized
  if (!(await fileExists(path.join(rootPath, ".devflow", "config.json")))) {
    console.log(
      pc.red("Error: Devflow is not initialized. Run `devflow init` first.")
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
