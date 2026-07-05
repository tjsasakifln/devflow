import type { DevflowState, StateDetectionResult } from "../types/state.js";
import type { ProjectInspection, FeatureInfo } from "../types/project.js";
import { gatherEvidence } from "./evidence-gatherer.js";
import { scoreConfidence } from "./confidence-scorer.js";
import { safeReadFile } from "../utils/fs.js";

export async function detectState(
  inspection: ProjectInspection
): Promise<StateDetectionResult> {
  const evidence = gatherEvidence(inspection);

  // Determine state from inspection — ordered from most specific to least
  const state = await determineState(inspection);
  const confidence = scoreConfidence(evidence, state);

  const { knownFacts, assumptions } = extractKnownAndAssumptions(
    inspection,
    state
  );
  const blockers = extractBlockers(inspection, state);

  return {
    currentState: state,
    confidence,
    evidence,
    knownFacts,
    assumptions,
    blockers,
    previousState: null,
    stateTimestamp: new Date().toISOString(),
  };
}

// ORDER MATTERS: branches ordered most-specific → most-generic.
// Reordering will break state detection silently — no crash, wrong state.
// Each branch is checked in priority order; first match wins.
async function determineState(
  inspection: ProjectInspection
): Promise<DevflowState> {
  // Check for drift (dirty git + active feature)
  if (
    inspection.gitStatus === "dirty" &&
    inspection.hasDotDevflow &&
    inspection.activeFeature
  ) {
    if (
      inspection.hasDevArtifacts &&
      (inspection.activeFeature.hasRequirements ||
        inspection.activeFeature.hasRoadmap)
    ) {
      const driftMarker = await safeReadFile(
        inspection.rootPath + "/.devflow/state.json"
      );
      if (driftMarker && driftMarker.includes('"drift-detected"')) {
        return "drift-detected";
      }
    }
  }

  // Check for explicit block
  if (inspection.hasDotDevflow) {
    const stateFile = await safeReadFile(
      inspection.rootPath + "/.devflow/state.json"
    );
    if (stateFile) {
      try {
        const stateData = JSON.parse(stateFile);
        if (
          stateData.currentState === "blocked" &&
          stateData.blockers &&
          Array.isArray(stateData.blockers) &&
          stateData.blockers.length > 0
        ) {
          return "blocked";
        }
      } catch {
        // invalid state.json — fall through to detection
      }
    }
  }

  // Devflow initialized — check features and specs
  if (inspection.hasDotDevflow) {
    // Active feature exists — determine feature state
    if (inspection.activeFeature) {
      return determineFeatureState(inspection.activeFeature);
    }

    // Has Devflow but no active feature
    if (inspection.hasDevArtifacts) {
      return inspection.hasPackageJson && inspection.fileCount > 10
        ? "brownfield-specified"
        : "greenfield-specified";
    }

    return "brownfield-discovered";
  }

  // No Devflow initialized — classify project type
  const hasCode =
    inspection.hasPackageJson ||
    inspection.hasSrcDir ||
    inspection.hasGit;

  if (!hasCode) {
    return "no-project";
  }

  // Distinguish greenfield (minimal code) from brownfield (existing codebase)
  return inspection.fileCount > 10
    ? "brownfield-unknown"
    : "greenfield-idea";
}

// ORDER MATTERS: branches ordered most-specific → most-generic.
// Reordering will break feature state detection silently.
// Each branch is checked in priority order; first match wins.
export function determineFeatureState(f: FeatureInfo): DevflowState {
  // Feature done
  if (
    f.hasQaReport &&
    f.hasRegressionWatch &&
    f.hasLegacyImpact &&
    f.actionsCompletionRatio >= 1.0
  ) {
    return "feature-done";
  }

  // Feature validation
  if (
    f.actionsCompletionRatio >= 1.0 &&
    !f.hasQaReport
  ) {
    return "feature-validation";
  }

  // Feature coding in progress
  if (f.hasImplementationLog && !f.hasQaReport) {
    return "feature-coding-in-progress";
  }

  // Feature coding ready
  if (
    f.hasRequirements &&
    !f.requirementsDoubts &&
    f.hasQualityAudit &&
    f.hasRoadmap &&
    f.hasActions &&
    f.hasLegacyImpact &&
    f.hasRegressionWatch &&
    !f.hasImplementationLog
  ) {
    return "feature-coding-ready";
  }

  // Feature pre-code audit
  if (
    f.hasRequirements &&
    f.hasRoadmap &&
    f.hasActions &&
    f.hasQualityAudit
  ) {
    return "feature-pre-code-audit";
  }

  // Feature todo (actions exist but not all done)
  if (
    f.hasActions &&
    f.actionsCompletionRatio > 0 &&
    f.actionsCompletionRatio < 1.0
  ) {
    return "feature-todo";
  }

  // Feature planned (actions exist)
  if (f.hasActions && f.actionsCompletionRatio === 0) {
    return "feature-planned";
  }

  // Feature planning (roadmap exists, no actions)
  if (f.hasRoadmap && !f.hasActions) {
    return "feature-planning";
  }

  // Feature requirements audited
  if (
    f.hasRequirements &&
    f.hasQualityAudit &&
    !f.requirementsDoubts &&
    !f.hasRoadmap
  ) {
    return "feature-requirements-audited";
  }

  // Feature clarification needed
  if (f.hasRequirements && f.requirementsDoubts) {
    return "feature-clarification-needed";
  }

  // Feature requirements (requirements exist, no quality audit)
  if (f.hasRequirements && !f.hasQualityAudit) {
    return "feature-requirements";
  }

  // Feature empty
  return "feature-empty";
}

function extractKnownAndAssumptions(
  inspection: ProjectInspection,
  state: DevflowState
): { knownFacts: string[]; assumptions: string[] } {
  const knownFacts: string[] = [];
  const assumptions: string[] = [];

  // Known facts
  if (inspection.hasPackageJson)
    knownFacts.push(
      "Project has package.json (Node.js/JavaScript project)"
    );
  if (inspection.language)
    knownFacts.push(`Primary language: ${inspection.language}`);
  if (inspection.detectedFramework)
    knownFacts.push(`Framework detected: ${inspection.detectedFramework}`);
  if (inspection.hasGit)
    knownFacts.push(
      `Git repository active on branch: ${inspection.currentBranch ?? "unknown"}`
    );
  if (inspection.gitStatus === "dirty")
    knownFacts.push("Working directory has uncommitted changes");
  if (inspection.gitStatus === "clean")
    knownFacts.push("Working directory is clean");
  if (inspection.activeFeature)
    knownFacts.push(
      `Active feature: ${inspection.activeFeature.id}`
    );
  if (inspection.fileCount > 0)
    knownFacts.push(`Approximate file count: ${inspection.fileCount}`);

  // Assumptions
  switch (state) {
    case "brownfield-unknown":
      assumptions.push(
        "Project structure and stack are not yet documented"
      );
      assumptions.push(
        "No architecture or domain specifications exist"
      );
      break;
    case "feature-empty":
      assumptions.push(
        "Feature scope and requirements are not yet defined"
      );
      break;
    case "feature-requirements":
      assumptions.push(
        "Requirements are documented but not yet audited for quality"
      );
      break;
    case "feature-done":
      assumptions.push(
        "Feature is complete unless drift is detected later"
      );
      break;
    case "drift-detected":
      assumptions.push(
        "Code changes may conflict with documented specifications"
      );
      break;
  }

  return { knownFacts, assumptions };
}

function extractBlockers(
  inspection: ProjectInspection,
  state: DevflowState
): string[] {
  const blockers: string[] = [];

  switch (state) {
    case "no-project":
      blockers.push("No project structure detected — run devflow init");
      break;
    case "brownfield-unknown":
      blockers.push(
        "Project is unmapped — discovery required before safe changes"
      );
      break;
    case "feature-clarification-needed":
      blockers.push(
        "[DOUBT] markers in requirements.md block forward progress"
      );
      break;
    case "drift-detected":
      blockers.push(
        "Code-spec drift detected — reconcile before continuing"
      );
      break;
    case "blocked":
      blockers.push("Explicit block marker found in .devflow/state.json");
      break;
  }

  if (
    inspection.gitStatus === "dirty" &&
    state !== "drift-detected" &&
    state !== "blocked"
  ) {
    blockers.push(
      "Uncommitted changes exist — consider committing before major transitions"
    );
  }

  return blockers;
}
