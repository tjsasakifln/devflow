export type ExecutionMode = "local" | "experimental" | "strict" | "release";

export type TemplateId =
  | "requirements"
  | "clarification"
  | "quality-audit"
  | "roadmap"
  | "actions"
  | "qa-report"
  | "legacy-impact"
  | "regression-watch"
  | "investigation"
  | "data-delta"
  | "constitution"
  | "test-plan"
  | "engineering-review"
  | "release-audit";

export interface TemplatePayload {
  featureName: string;
  featureId: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface ArtifactPaths {
  dotDevflow: string;
  devArtifacts: string;
  stateFile: string;
  configFile: string;
  activeFeatureFile: string;
  cockpitFile: string;
  claudeMdFile: string;
  featureDir: string;
  specsDir: string;
  discoveryDir: string;
}

export interface ActiveFeatureData {
  featureId: string;
  featureName: string;
  startedAt: string;
  updatedAt: string;
  implementerActor?: string;
  reviewerActor?: string;
}

export interface StateData {
  currentState: string;
  previousState: string | null;
  confidence: string;
  lastUpdated: string;
  activeFeatureId: string | null;
  blockers: string[];
}

export interface DevflowConfig {
  version: string;
  projectName: string;
  createdTimestamp: string;
  modifiedTimestamp: string;
  defaultState: string;
  executionMode: ExecutionMode;
  hooksEnabled: boolean;
  safeMode: boolean;
  claudeIntegration: {
    enabled: boolean;
    autoUpdateClaudeMd: boolean;
    slashCommand: boolean;
  };
  features: {
    numberingScheme: "sequential" | "timestamp";
  };
  constitution: {
    enabled: boolean;
    blockingGates: boolean;
  };
  confidenceThresholds: {
    high: number;
    medium: number;
  };
  deterministicGates: {
    typecheck: boolean;
    lint: boolean;
    test: boolean;
    coverage: boolean;
    circularDeps: boolean;
    forbiddenDeps: boolean;
    duplication: boolean;
    unusedDeps: boolean;
    ooMetrics: boolean;
    acceptanceCriteria: boolean;
    adversarialReview: boolean;
  };
  ciIntegration: {
    enabled: boolean;
    provider: "github-actions" | "gitlab-ci" | "circle-ci" | "none";
    requiredChecks: string[];
    timeoutSeconds: number;
  };
  audit: {
    enabled: boolean;
    autoGenerateOnComplete: boolean;
    auditDirectory: string;
  };
  implementerApproverSeparation: {
    enabled: boolean;
    requireDifferentActor: boolean;
  };
  /** Review mode: independent requires different actor; solo-hardened allows self-approval with compensating evidence */
  reviewMode: "independent" | "solo-hardened";
  /** Risk tolerance: relaxed (solo, advisory gates), moderate (default), strict (all blocking, CI required) */
  riskTolerance: "relaxed" | "moderate" | "strict";
}

export interface LogEntry {
  timestamp: string;
  actionId: string;
  action: string;
  filesChanged: string[];
  status: "started" | "completed" | "failed" | "rolled-back";
  notes: string;
  actor?: string;
}

export interface ReviewEntry {
  timestamp: string;
  reviewer: string;
  implementer: string;
  featureId: string;
  verdict: "approved" | "rejected" | "changes-requested";
  reason: string;
  checksPerformed: string[];
  attackVectors: string[];
  evidenceRefs: string[];
}

export interface GatekeepEntry {
  timestamp: string;
  gatekeeper: string;
  implementer: string;
  featureId: string;
  decision: "approved" | "rejected" | "refused";
  reason: string;
  dodChecksPassed: number;
  dodChecksTotal: number;
  ciStatus: string;
  actorOrigin?: "cli" | "claude-code" | "ci" | "manual" | "inferred";
  commitSha?: string;
  branch?: string;
  devflowVersion?: string;
  executionMode?: ExecutionMode;
  evidenceHashes?: Record<string, string>;
}
