export type DevflowState =
  | "no-project"
  | "greenfield-idea"
  | "greenfield-specified"
  | "brownfield-unknown"
  | "brownfield-discovered"
  | "brownfield-specified"
  | "feature-empty"
  | "feature-requirements"
  | "feature-clarification-needed"
  | "feature-requirements-audited"
  | "feature-planning"
  | "feature-planned"
  | "feature-todo"
  | "feature-pre-code-audit"
  | "feature-coding-ready"
  | "feature-coding-in-progress"
  | "feature-validation"
  | "feature-done"
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
