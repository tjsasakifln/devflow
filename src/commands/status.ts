import path from "node:path";
import { inspectProject } from "../adapters/project/inspector.js";
import { detectState } from "../kernel/state/detector.js";
import { getQualityDebt } from "../kernel/tracking/bypass-detector.js";
import pc from "picocolors";

export async function statusCommand(
  cwd: string,
  options: { json?: boolean; verbose?: boolean }
): Promise<void> {
  const rootPath = path.resolve(cwd);
  const inspection = await inspectProject(rootPath);
  const stateResult = await detectState(inspection);

  if (options.json) {
    const qualityDebt = await getQualityDebt(rootPath);
    console.log(JSON.stringify({ ...stateResult, qualityDebt }, null, 2));
    return;
  }

  // Human-readable output
  const stateColor =
    stateResult.currentState === "feature-done"
      ? pc.green
      : stateResult.currentState === "blocked" ||
          stateResult.currentState === "drift-detected"
        ? pc.red
        : stateResult.currentState.includes("coding")
          ? pc.yellow
          : pc.blue;

  console.log(pc.bold("\nDevflow Status\n"));
  console.log(
    pc.bold("State:      "),
    stateColor(stateResult.currentState)
  );
  console.log(
    pc.bold("Confidence: "),
    stateResult.confidence === "high"
      ? pc.green(stateResult.confidence)
      : stateResult.confidence === "medium"
        ? pc.yellow(stateResult.confidence)
        : pc.red(stateResult.confidence)
  );

  if (inspection.activeFeature) {
    console.log(
      pc.bold("Feature:    "),
      inspection.activeFeature.id
    );
    if (inspection.activeFeature.hasActions) {
      console.log(
        pc.bold("Progress:   "),
        `${Math.round(inspection.activeFeature.actionsCompletionRatio * 100)}%`
      );
    }
  }

  // Known facts
  if (stateResult.knownFacts.length > 0) {
    console.log(pc.bold("\nKnown:"));
    for (const fact of stateResult.knownFacts) {
      console.log(`  ${pc.dim("•")} ${fact}`);
    }
  }

  // Assumptions
  if (stateResult.assumptions.length > 0) {
    console.log(pc.bold("\nAssumptions:"));
    for (const a of stateResult.assumptions) {
      console.log(`  ${pc.yellow("⚠")} ${a}`);
    }
  }

  // Blockers
  if (stateResult.blockers.length > 0) {
    console.log(pc.bold("\nBlockers:"));
    for (const b of stateResult.blockers) {
      console.log(`  ${pc.red("🚫")} ${b}`);
    }
  }

  // Evidence (verbose only)
  if (options.verbose && stateResult.evidence.length > 0) {
    console.log(pc.bold("\nEvidence:"));
    for (const e of stateResult.evidence) {
      console.log(
        `  ${pc.dim("•")} ${e.key}: ${pc.dim(String(e.value))} (${e.confidence})`
      );
    }
  }

  // Git info
  if (inspection.hasGit) {
    console.log(
      pc.bold("\nGit:        "),
      `${inspection.currentBranch ?? "?"} (${inspection.gitStatus})`
    );
  }

  // Quality Debt (bypass tracking)
  const qualityDebt = await getQualityDebt(rootPath);
  if (qualityDebt > 0) {
    console.log(pc.bold("\nQuality Debt:"));
    console.log(
      `  ${pc.yellow(`⚠️  ${qualityDebt} feature(s) with bypassed gates`)}`
    );
    console.log(
      pc.dim("  Run `devflow doctor` for bypass pattern detection details.")
    );
  }

  // Review Mode indicator
  const { ConfigManager } = await import("../kernel/config/index.js");
  const configMgr = new ConfigManager(rootPath);
  const config = await configMgr.load();
  if (config.reviewMode === "solo-hardened") {
    console.log(pc.bold("\nReview Mode:"));
    console.log(
      `  ${pc.yellow("⚠️  Solo Mode — self-approval enabled, adversarial review required")}`
    );
  }

  // Next-step guidance
  console.log(pc.bold("\nNext Step:"));
  if (stateResult.blockers.length > 0) {
    console.log(pc.dim("  Resolve blockers above, then run `devflow next` for guidance."));
  } else if (stateResult.currentState === "no-project" || stateResult.currentState === "brownfield-unknown") {
    console.log(pc.dim("  Run `devflow install` to initialize Devflow in this project."));
  } else if (stateResult.currentState === "feature-done") {
    console.log(pc.dim("  Feature complete. Create PR and merge. Then `devflow feature new <name>` for next feature."));
  } else {
    console.log(pc.dim("  Run `devflow next` to see the recommended next action."));
  }

  console.log();
}
