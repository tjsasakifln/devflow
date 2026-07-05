import type { GuardCheck, GuardResult } from "../types/guards.js";
import type { FeatureInfo, ProjectInspection } from "../types/project.js";

export function checkPreActionGuard(
  feature: FeatureInfo,
  inspection: ProjectInspection,
  actionId: string
): GuardResult {
  const checks: GuardCheck[] = [];

  // Check: feature is in a coding-ready or later state
  checks.push({
    checkId: "feature-ready",
    description: "Feature is in a coding-ready state",
    passed: true, // state detection handles this
    reason: "Feature state allows coding actions",
  });

  // Check: actions file has the target action
  checks.push({
    checkId: "action-exists",
    description: `Action ${actionId} exists in actions.md`,
    passed: feature.hasActions,
    reason: feature.hasActions
      ? `Actions file exists — action ${actionId} should be defined`
      : "No actions.md — actions must be defined before execution",
  });

  // Check: git is clean for high-risk actions
  if (inspection.gitStatus === "dirty") {
    checks.push({
      checkId: "git-clean",
      description: "Working directory is clean",
      passed: false,
      reason:
        "Uncommitted changes exist — commit or stash before executing actions",
    });
  } else {
    checks.push({
      checkId: "git-clean",
      description: "Working directory is clean",
      passed: true,
      reason: "Git working directory is clean",
    });
  }

  // Check: no active drift
  checks.push({
    checkId: "no-drift",
    description: "No code-spec drift detected",
    passed: inspection.gitStatus !== "dirty",
    reason:
      inspection.gitStatus === "dirty"
        ? "Drift risk: uncommitted changes may conflict with specs"
        : "No drift detected",
  });

  const failed = checks.filter((c) => !c.passed);

  return {
    canProceed: failed.length === 0,
    checks,
    refusalMessage:
      failed.length > 0
        ? `Cannot execute action ${actionId}. Pre-action checks failed:\n` +
          failed.map((c) => `- ${c.checkId}: ${c.reason}`).join("\n")
        : null,
    requiredActions: failed.map((c) => c.reason),
  };
}
