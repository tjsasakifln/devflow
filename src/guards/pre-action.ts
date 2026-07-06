import type { GuardCheck, GuardResult } from "../types/guards.js";
import type { FeatureInfo, ProjectInspection } from "../types/project.js";

function getMissingArtifacts(feature: FeatureInfo): string[] {
  const missing: string[] = [];
  if (!feature.hasRequirements) missing.push("requirements.md — define what to build");
  if (feature.hasRequirements && feature.requirementsDoubts) missing.push("Resolve [DOUBT] markers in requirements.md before coding");
  if (!feature.hasQualityAudit) missing.push("quality-audit.md — run quality audit on requirements");
  if (!feature.hasRoadmap) missing.push("roadmap.md — define architecture and design decisions");
  if (!feature.hasActions) missing.push("actions.md — decompose work into atomic tasks");
  if (!feature.hasTestPlan) missing.push("test-plan.md — define verification strategy before coding");
  if (!feature.hasLegacyImpact) missing.push("legacy-impact.md — document affected modules");
  if (!feature.hasRegressionWatch) missing.push("regression-watch.md — list areas to monitor for regressions");
  return missing;
}

function mkCheck(
  checkId: string,
  description: string,
  passed: boolean,
  reason: string,
  blocking: boolean,
  remediation: string,
): GuardCheck {
  return { checkId, description, passed, reason, blocking, gateNumber: 0, remediation };
}

export function checkPreActionGuard(
  feature: FeatureInfo,
  inspection: ProjectInspection,
  actionId: string
): GuardResult {
  const checks: GuardCheck[] = [];

  // Check: feature is in a coding-ready or later state
  // Must match state-detector's feature-coding-ready condition
  const canCode = feature.hasRequirements
    && !feature.requirementsDoubts
    && feature.hasQualityAudit
    && feature.hasRoadmap
    && feature.hasActions
    && feature.hasTestPlan
    && feature.hasLegacyImpact
    && feature.hasRegressionWatch;

  const missingArtifacts = getMissingArtifacts(feature);

  checks.push(mkCheck(
    "feature-ready",
    "Feature is in a coding-ready state",
    canCode,
    canCode
      ? "All pre-code artifacts present: requirements, roadmap, actions, test-plan, legacy-impact, regression-watch"
      : `Missing pre-code artifacts (${missingArtifacts.length}): ${missingArtifacts.join("; ")}`,
    true,
    canCode
      ? "N/A"
      : `Complete all pre-code artifacts before coding. Run \`devflow next\` for guidance. Missing: ${missingArtifacts.slice(0, 3).join(", ")}${missingArtifacts.length > 3 ? ` and ${missingArtifacts.length - 3} more` : ""}`,
  ));

  // Check: actions file has the target action
  checks.push(mkCheck(
    "action-exists",
    `Action ${actionId} exists in actions.md`,
    feature.hasActions,
    feature.hasActions
      ? `Actions file exists — action ${actionId} should be defined`
      : "No actions.md — actions must be defined before execution",
    true,
    "Create actions.md with atomic tasks before executing",
  ));

  // Check: git is clean for high-risk actions
  if (inspection.gitStatus === "dirty") {
    checks.push(mkCheck(
      "git-clean",
      "Working directory is clean",
      false,
      "Uncommitted changes exist — commit or stash before executing actions",
      true,
      "Run `git stash` or `git commit` to clean working directory",
    ));
  } else {
    checks.push(mkCheck(
      "git-clean",
      "Working directory is clean",
      true,
      "Git working directory is clean",
      true,
      "N/A",
    ));
  }

  // Check: no active drift
  checks.push(mkCheck(
    "no-drift",
    "No code-spec drift detected",
    inspection.gitStatus !== "dirty",
    inspection.gitStatus === "dirty"
      ? "Drift risk: uncommitted changes may conflict with specs"
      : "No drift detected",
    true,
    "Reconcile drift: compare code against specs and update one or the other",
  ));

  const failed = checks.filter((c) => !c.passed);
  const blockingFailed = failed.filter((c) => c.blocking).length;
  const advisoryFailed = failed.filter((c) => !c.blocking).length;

  return {
    canProceed: blockingFailed === 0,
    checks,
    refusalMessage:
      failed.length > 0
        ? `Cannot execute action ${actionId}. Pre-action checks failed:\n` +
          failed.map((c) => `- ${c.checkId}: ${c.reason}`).join("\n")
        : null,
    requiredActions: failed.map((c) => c.remediation),
    blockingFailed,
    advisoryFailed,
  };
}
