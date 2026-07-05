import type { ConfidenceLevel, Evidence, DevflowState } from "../types/state.js";

export function scoreConfidence(
  evidence: Evidence[],
  state: DevflowState
): ConfidenceLevel {
  let positiveWeight = 0;
  let negativeWeight = 0;

  for (const e of evidence) {
    const weight =
      e.confidence === "high" ? 3 : e.confidence === "medium" ? 2 : 1;

    const supports = evidenceSupportsState(e, state);
    if (supports === true) {
      positiveWeight += weight;
    } else if (supports === false) {
      negativeWeight += weight;
    }
    // null = neutral evidence, skip
  }

  const totalWeight = positiveWeight + negativeWeight;
  if (totalWeight === 0) return "low";

  const ratio = positiveWeight / totalWeight;

  // Penalty for contradictory high-confidence evidence
  const hasHighContradiction = evidence.some(
    (e) =>
      e.confidence === "high" &&
      evidenceSupportsState(e, state) === false
  );

  // Special: if a required file-presence evidence is negative, cap at medium
  const hasMissingRequiredFile = evidence.some(
    (e) =>
      e.type === "file_presence" &&
      e.confidence === "high" &&
      e.value === false &&
      evidenceSupportsState(e, state) === false
  );

  if (hasMissingRequiredFile) {
    return ratio >= 0.8 ? "medium" : "low";
  }

  if (ratio >= 0.8 && !hasHighContradiction) return "high";
  if (ratio >= 0.5) return "medium";
  return "low";
}

function evidenceSupportsState(
  e: Evidence,
  state: DevflowState
): boolean | null {
  switch (state) {
    case "no-project":
      if (e.key === "has_package_json") return e.value === false;
      if (e.key === "has_src_dir") return e.value === false;
      if (e.key === "has_git") return e.value === false;
      return null;

    case "greenfield-idea":
      if (e.key === "has_package_json") return e.value === true;
      if (e.key === "has_dot_devflow") return e.value === false;
      return null;

    case "greenfield-specified":
      if (e.key === "has_dev_artifacts") return e.value === true;
      if (e.key === "feature_count") return e.value === 0;
      return null;

    case "brownfield-unknown":
      // Code exists but no .devflow/
      if (e.key === "has_package_json" || e.key === "has_src_dir")
        return e.value === true;
      if (e.key === "has_dot_devflow") return e.value === false;
      return null;

    case "brownfield-discovered":
      if (e.key === "has_dot_devflow") return e.value === true;
      return null;

    case "brownfield-specified":
      if (e.key === "has_dev_artifacts") return e.value === true;
      return null;

    case "feature-empty":
      if (e.key === "has_requirements") return e.value === false;
      if (e.key === "active_feature_id") return e.value !== false;
      return null;

    case "feature-requirements":
      if (e.key === "has_requirements") return e.value === true;
      if (e.key === "requirements_doubts") return e.value === false;
      return null;

    case "feature-clarification-needed":
      if (e.key === "requirements_doubts") return e.value === true;
      return null;

    case "feature-requirements-audited":
      if (e.key === "has_quality_audit") return e.value === true;
      if (e.key === "has_roadmap") return e.value === false;
      return null;

    case "feature-planning":
      if (e.key === "has_roadmap") return e.value === true;
      if (e.key === "has_actions") return e.value === false;
      return null;

    case "feature-planned":
      if (e.key === "has_actions") return e.value === true;
      return null;

    case "feature-todo":
      if (e.key === "actions_completion_ratio")
        return (e.value as number) < 1;
      return null;

    case "feature-pre-code-audit":
      if (e.key === "has_legacy_impact") return e.value === true;
      return null;

    case "feature-coding-ready":
      // all gates passed
      if (e.key === "has_quality_audit") return e.value === true;
      if (e.key === "has_legacy_impact") return e.value === true;
      if (e.key === "has_regression_watch") return e.value === true;
      return null;

    case "feature-coding-in-progress":
      if (e.key === "has_implementation_log") return e.value === true;
      if (e.key === "has_qa_report") return e.value === false;
      return null;

    case "feature-validation":
      if (e.key === "actions_completion_ratio") return e.value === 1;
      if (e.key === "has_qa_report") return e.value === false;
      return null;

    case "feature-done":
      if (e.key === "has_qa_report") return e.value === true;
      if (e.key === "actions_completion_ratio") return e.value === 1;
      if (e.key === "has_regression_watch") return e.value === true;
      return null;

    case "drift-detected":
      if (e.key === "git_state") return e.value === "dirty";
      return null;

    case "blocked":
      // Blocked is determined by explicit blocker markers
      return null;
  }
}
