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
  | "test-plan";

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
  };
}

export interface LogEntry {
  timestamp: string;
  actionId: string;
  action: string;
  filesChanged: string[];
  status: "started" | "completed" | "failed" | "rolled-back";
  notes: string;
}
