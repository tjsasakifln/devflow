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
  | "feature-requirements-reviewed"
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
  // Review phase
  | "feature-review"
  // Completion
  | "feature-done"
  // Legacy states (kept for backward compat)
  | "feature-requirements-audited"
  | "feature-planning"
  | "feature-planned"
  | "feature-todo"
  | "feature-validation"
  // Anomaly states
  | "drift-detected"
  | "blocked";

export type ConfidenceLevel = "high" | "medium" | "low";

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
  evidence: Evidence[];
  knownFacts: string[];
  assumptions: string[];
  blockers: string[];
  previousState: DevflowState | null;
  stateTimestamp: string;
}
