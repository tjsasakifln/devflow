export type DevflowState =
  // Project states
  | "no-project"
  | "greenfield-idea"
  | "greenfield-specified"
  | "brownfield-unknown"
  | "brownfield-discovered"
  | "brownfield-specified"
  // Feature inception
  | "feature-empty"
  // Specification phase
  | "feature-requirements"
  | "feature-clarification-needed"
  // Design phase
  | "feature-design"
  | "feature-design-reviewed"
  // Test planning phase
  | "feature-test-plan"
  | "feature-test-plan-ready"
  // Implementation readiness
  | "feature-pre-code-audit"
  | "feature-coding-ready"
  // Coding phase
  | "feature-coding-in-progress"
  // Verification phase
  | "feature-verification"
  | "feature-ci-verified"
  // Review phase
  | "feature-review"
  | "feature-adversarial-review"
  // Completion
  | "feature-done"
  // Legacy states (kept for backward compat — deprecated)
  | "feature-planning"
  | "feature-planned"
  | "feature-todo"
  // Anomaly states
  | "drift-detected"
  | "blocked";

export type ConfidenceLevel = "high" | "medium" | "low";

export type FeatureCompletionConfidence =
  | "blocked"
  | "draft"
  | "review-required"
  | "locally-verified"
  | "ci-verified"
  | "release-candidate"
  | "complete";

export interface CIStatus {
  workflow: string;
  conclusion: "success" | "failure" | "skipped" | "cancelled" | "pending" | null;
  runId: number | null;
  htmlUrl: string | null;
  headSha: string | null;
  timestamp: string;
  branch: string;
}

export interface Evidence {
  type: string;
  key: string;
  value: string | boolean | number;
  source: string;
  confidence: ConfidenceLevel;
}

export interface StateDetectionResult {
  currentState: DevflowState;
  confidence: ConfidenceLevel;
  featureCompletionConfidence?: FeatureCompletionConfidence;
  evidence: Evidence[];
  knownFacts: string[];
  assumptions: string[];
  blockers: string[];
  previousState: DevflowState | null;
  stateTimestamp: string;
}
