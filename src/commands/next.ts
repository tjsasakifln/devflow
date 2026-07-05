import path from "node:path";
import { inspectProject } from "../project/inspector.js";
import { detectState } from "../engine/state-detector.js";
import { computeRecommendation } from "../engine/next-action.js";
import pc from "picocolors";

export async function nextCommand(
  cwd: string,
  options: { json?: boolean }
): Promise<void> {
  const rootPath = path.resolve(cwd);
  const inspection = await inspectProject(rootPath);
  const stateResult = await detectState(inspection);
  const recommendation = computeRecommendation(stateResult, inspection);

  if (options.json) {
    console.log(JSON.stringify(recommendation, null, 2));
    return;
  }

  const action = recommendation.recommendedNextAction;
  const safetyIcon =
    action.safetyLevel === "safe"
      ? pc.green("🟢 safe")
      : action.safetyLevel === "caution"
        ? pc.yellow("🟡 caution")
        : pc.red("🔴 blocked");

  console.log(pc.bold("\nDevflow — Next Best Action\n"));

  console.log(pc.bold("Current state: "), pc.cyan(recommendation.currentState));
  console.log(pc.bold("Confidence:    "), recommendation.confidence);

  console.log(pc.bold("\n━━━ Recommended Action ━━━\n"));
  console.log(pc.bold(action.description));
  console.log();
  console.log(pc.dim(action.why));
  console.log();

  console.log(pc.bold("Safety:    "), safetyIcon);
  console.log(pc.bold("Workflow:  "), pc.dim(action.agentOrWorkflow));

  if (action.reads.length > 0) {
    console.log(pc.bold("Reads:     "));
    for (const r of action.reads) {
      console.log(`  ${pc.dim("→")} ${r}`);
    }
  }

  if (action.writes.length > 0) {
    console.log(pc.bold("Writes:    "));
    for (const w of action.writes) {
      console.log(`  ${pc.dim("→")} ${w}`);
    }
  }

  if (recommendation.blockers.length > 0) {
    console.log(pc.bold("\n⚠️  Blockers:"));
    for (const b of recommendation.blockers) {
      console.log(`  ${pc.red("🚫")} ${b}`);
    }
  }

  if (recommendation.alternatives.length > 0) {
    console.log(pc.bold("\nAlternatives:"));
    for (let i = 0; i < recommendation.alternatives.length; i++) {
      const alt = recommendation.alternatives[i]!;
      console.log(`  ${i + 1}. ${alt.description}`);
      console.log(`     ${pc.dim(alt.whenToChoose)}`);
    }
  }

  console.log();
}
