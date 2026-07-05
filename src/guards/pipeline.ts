import type { FeatureInfo } from "../types/project.js";
import type { GuardCheck, GuardResult } from "../types/guards.js";

export function checkPipelineReadiness(feature: FeatureInfo): GuardResult {
  const checks: GuardCheck[] = [];

  // Check 1: Requirements exist
  checks.push({
    checkId: "has-requirements",
    description: "Feature has requirements.md",
    passed: feature.hasRequirements,
    reason: feature.hasRequirements
      ? "Found requirements.md"
      : "Missing requirements.md — run `devflow feature new` or write requirements first",
  });

  // Check 2: No doubts remain
  checks.push({
    checkId: "no-doubts",
    description: "No [DOUBT] markers in requirements",
    passed: !feature.requirementsDoubts,
    reason: feature.requirementsDoubts
      ? "Resolve [DOUBT] markers in requirements.md before proceeding. Run clarification workflow."
      : "No doubts found — requirements are clear",
  });

  // Check 3: Quality audit exists
  checks.push({
    checkId: "has-quality-audit",
    description: "Feature has quality-audit.md",
    passed: feature.hasQualityAudit,
    reason: feature.hasQualityAudit
      ? "Found quality-audit.md"
      : "Missing quality-audit.md — run quality audit to validate requirements",
  });

  // Check 4: Roadmap exists
  checks.push({
    checkId: "has-roadmap",
    description: "Feature has roadmap.md",
    passed: feature.hasRoadmap,
    reason: feature.hasRoadmap
      ? "Found roadmap.md"
      : "Missing roadmap.md — create architectural roadmap before coding",
  });

  // Check 5: Actions exist with sufficient completion
  checks.push({
    checkId: "has-actions",
    description: "Feature has actions.md with sufficient planning",
    passed: feature.hasActions,
    reason: feature.hasActions
      ? `Actions file found (${Math.round(feature.actionsCompletionRatio * 100)}% complete)`
      : "Missing actions.md — decompose roadmap into atomic actions",
  });

  // Check 6: Legacy impact documented (for brownfield)
  checks.push({
    checkId: "has-legacy-impact",
    description: "Legacy impact documented",
    passed: feature.hasLegacyImpact,
    reason: feature.hasLegacyImpact
      ? "Found legacy-impact.md"
      : "Missing legacy-impact.md — document affected existing code and regression risks",
  });

  // Check 7: Regression watch exists
  checks.push({
    checkId: "has-regression-watch",
    description: "Regression watch checklist exists",
    passed: feature.hasRegressionWatch,
    reason: feature.hasRegressionWatch
      ? "Found regression-watch.md"
      : "Missing regression-watch.md — define areas to monitor for regressions",
  });

  const failed = checks.filter((c) => !c.passed);

  return {
    canProceed: failed.length === 0,
    checks,
    refusalMessage:
      failed.length > 0 ? buildRefusalMessage(failed) : null,
    requiredActions: failed.map((c) => c.reason),
  };
}

function buildRefusalMessage(failedChecks: GuardCheck[]): string {
  const lines = [
    "## Coding Blocked — Pre-requisites Not Met",
    "",
    "Devflow requires the following before coding can begin:",
    "",
    ...failedChecks.map((c, i) => `${i + 1}. **${c.checkId}**: ${c.reason}`),
    "",
    "### Next Steps",
    "- Run `devflow next` to see the recommended next action",
    "- Run `devflow status` to see the full project state",
    "- Run `devflow doctor` if the state seems incorrect",
  ];

  return lines.join("\n");
}
