import type { Evidence, ConfidenceLevel } from "../types/state.js";
import type { ProjectInspection, FeatureInfo } from "../types/project.js";

export function gatherEvidence(inspection: ProjectInspection): Evidence[] {
  const evidence: Evidence[] = [];

  // Project-level evidence
  evidence.push({
    type: "file_presence",
    key: "has_package_json",
    value: inspection.hasPackageJson,
    source: "package.json",
    confidence: "high",
  });

  evidence.push({
    type: "file_presence",
    key: "has_src_dir",
    value: inspection.hasSrcDir,
    source: "src/",
    confidence: "high",
  });

  evidence.push({
    type: "git_status",
    key: "has_git",
    value: inspection.hasGit,
    source: ".git/",
    confidence: "high",
  });

  evidence.push({
    type: "git_status",
    key: "git_state",
    value: inspection.gitStatus,
    source: "git status",
    confidence: "high",
  });

  evidence.push({
    type: "file_presence",
    key: "has_dot_devflow",
    value: inspection.hasDotDevflow,
    source: ".devflow/config.json",
    confidence: "high",
  });

  evidence.push({
    type: "file_presence",
    key: "has_dev_artifacts",
    value: inspection.hasDevArtifacts,
    source: "_devflow/",
    confidence: "high",
  });

  // Language and framework
  if (inspection.language) {
    evidence.push({
      type: "detection",
      key: "language",
      value: inspection.language,
      source: "file-scanner",
      confidence: "high",
    });
  }

  if (inspection.detectedFramework) {
    evidence.push({
      type: "detection",
      key: "framework",
      value: inspection.detectedFramework,
      source: "file-scanner",
      confidence: "medium",
    });
  }

  // Git branch
  if (inspection.currentBranch) {
    evidence.push({
      type: "git_status",
      key: "current_branch",
      value: inspection.currentBranch,
      source: "git branch",
      confidence: "high",
    });
  }

  // Feature-level evidence
  if (inspection.activeFeature) {
    const f = inspection.activeFeature;
    evidence.push(...gatherFeatureEvidence(f));

    // Implementer/approver identity evidence
    if (f.implementerActor) {
      evidence.push({
        type: "file_content",
        key: "implementer_actor",
        value: f.implementerActor,
        source: `_devflow/features/${f.id}/implementation-log.jsonl`,
        confidence: "high",
      });
    }
    if (f.reviewerActor) {
      evidence.push({
        type: "file_content",
        key: "reviewer_actor",
        value: f.reviewerActor,
        source: `_devflow/features/${f.id}/implementation-log.jsonl`,
        confidence: "high",
      });
    }
  }

  // Feature count
  evidence.push({
    type: "count",
    key: "feature_count",
    value: inspection.features.length,
    source: "_devflow/features/",
    confidence: "high",
  });

  return evidence;
}

function gatherFeatureEvidence(f: FeatureInfo): Evidence[] {
  const evidence: Evidence[] = [];

  if (f.id) {
    evidence.push({
      type: "file_presence",
      key: "active_feature_id",
      value: f.id,
      source: "_devflow/features/" + f.id,
      confidence: "high",
    });
  }

  const fileChecks: Array<{
    key: string;
    present: boolean;
    file: string;
  }> = [
    { key: "has_requirements", present: f.hasRequirements, file: "requirements.md" },
    { key: "has_clarification", present: f.hasClarification, file: "clarification.md" },
    { key: "has_quality_audit", present: f.hasQualityAudit, file: "quality-audit.md" },
    { key: "has_roadmap", present: f.hasRoadmap, file: "roadmap.md" },
    { key: "has_actions", present: f.hasActions, file: "actions.md" },
    { key: "has_qa_report", present: f.hasQaReport, file: "qa-report.md" },
    { key: "has_legacy_impact", present: f.hasLegacyImpact, file: "legacy-impact.md" },
    { key: "has_regression_watch", present: f.hasRegressionWatch, file: "regression-watch.md" },
    { key: "has_implementation_log", present: f.hasImplementationLog, file: "implementation-log.jsonl" },
  ];

  for (const check of fileChecks) {
    evidence.push({
      type: "file_presence",
      key: check.key,
      value: check.present,
      source: "_devflow/features/" + f.id + "/" + check.file,
      confidence: "high",
    });
  }

  if (f.hasRequirements && f.requirementsDoubts) {
    evidence.push({
      type: "file_content",
      key: "requirements_doubts",
      value: true,
      source: "_devflow/features/" + f.id + "/requirements.md",
      confidence: "high",
    });
  }

  if (f.hasActions) {
    evidence.push({
      type: "computed",
      key: "actions_completion_ratio",
      value: Math.round(f.actionsCompletionRatio * 100) / 100,
      source: "_devflow/features/" + f.id + "/actions.md",
      confidence: "high",
    });
  }

  return evidence;
}

export function computeConfidence(
  evidence: Evidence[],
  state: string
): ConfidenceLevel {
  let positiveWeight = 0;
  let negativeWeight = 0;

  for (const e of evidence) {
    const weight = e.confidence === "high" ? 3 : e.confidence === "medium" ? 2 : 1;

    // Determine if this evidence supports or contradicts the expected state
    const supports = evidenceSupportsState(e, state);
    if (supports) {
      positiveWeight += weight;
    } else if (supports === false) {
      negativeWeight += weight;
    }
    // null = neutral, skip
  }

  const totalWeight = positiveWeight + negativeWeight;
  if (totalWeight === 0) return "low";

  const ratio = positiveWeight / totalWeight;

  // Check for contradictory high-confidence evidence
  const hasContradiction = evidence.some(
    (e) => e.confidence === "high" && evidenceSupportsState(e, state) === false
  );

  if (ratio >= 0.8 && !hasContradiction) return "high";
  if (ratio >= 0.5) return "medium";
  return "low";
}

function evidenceSupportsState(
  e: Evidence,
  state: string
): boolean | null {
  // Evidence that confirms or contradicts specific states
  switch (state) {
    case "no-project":
      if (e.key === "has_package_json" && e.value === true) return false;
      if (e.key === "has_src_dir" && e.value === true) return false;
      if (e.key === "has_git" && e.value === true) return false;
      if (e.key === "has_package_json" && e.value === false) return true;
      return null;

    case "feature-empty":
      if (e.key === "has_requirements" && e.value === false) return true;
      if (e.key === "has_requirements" && e.value === true) return false;
      return null;

    case "feature-clarification-needed":
      if (e.key === "requirements_doubts" && e.value === true) return true;
      if (e.key === "requirements_doubts" && e.value === false) return false;
      return null;

    case "feature-done":
      if (e.key === "has_qa_report" && e.value === true) return true;
      if (e.key === "has_qa_report" && e.value === false) return false;
      if (e.key === "actions_completion_ratio" && e.value === 1) return true;
      return null;

    case "drift-detected":
      if (e.key === "git_state" && e.value === "dirty") return true;
      return null;

    case "blocked":
      // Blocked is detected via explicit blocker markers
      return null;

    default:
      return null;
  }
}
