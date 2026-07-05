import type { DevflowConfig } from "../types/artifacts.js";

export const DEFAULTS: DevflowConfig = {
  version: "0.1.0",
  projectName: "unknown",
  createdTimestamp: new Date().toISOString(),
  modifiedTimestamp: new Date().toISOString(),
  defaultState: "no-project",
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
};
