import type { DevflowConfig } from "../types/artifacts.js";

export const DEFAULTS: DevflowConfig = {
  version: "0.1.0",
  projectName: "unknown",
  createdTimestamp: new Date().toISOString(),
  modifiedTimestamp: new Date().toISOString(),
  defaultState: "no-project",
  executionMode: "local",
  hooksEnabled: false,
  safeMode: false,
  claudeIntegration: {
    enabled: true,
    autoUpdateClaudeMd: true,
    slashCommand: true,
  },
  features: {
    numberingScheme: "sequential",
  },
  constitution: {
    enabled: true,
    blockingGates: true,
  },
  confidenceThresholds: {
    high: 0.8,
    medium: 0.5,
  },
  deterministicGates: {
    typecheck: true,
    lint: true,
    test: true,
    coverage: true,
    circularDeps: true,
    forbiddenDeps: true,
    duplication: false,
    unusedDeps: false,
    ooMetrics: false,
    acceptanceCriteria: true,
    adversarialReview: false,
  },
  ciIntegration: {
    enabled: false,
    provider: "none",
    requiredChecks: [],
    timeoutSeconds: 120,
  },
  audit: {
    enabled: true,
    autoGenerateOnComplete: true,
    auditDirectory: ".devflow/audits",
  },
  implementerApproverSeparation: {
    enabled: true,
    requireDifferentActor: true,
  },
};
