export interface FeatureInfo {
  id: string;
  directory: string;
  hasRequirements: boolean;
  hasClarification: boolean;
  hasQualityAudit: boolean;
  hasRoadmap: boolean;
  hasActions: boolean;
  hasInvestigation: boolean;
  hasDataDelta: boolean;
  hasQaReport: boolean;
  hasLegacyImpact: boolean;
  hasRegressionWatch: boolean;
  hasReleaseNotes: boolean;
  hasImplementationLog: boolean;
  hasTestPlan: boolean;
  requirementsDoubts: boolean;
  actionsCompletionRatio: number;
  isActive: boolean;
}

export interface ProjectInspection {
  rootPath: string;
  hasGit: boolean;
  hasRemote: boolean;
  currentBranch: string | null;
  packageManager: "npm" | "yarn" | "pnpm" | null;
  hasPackageJson: boolean;
  hasSrcDir: boolean;
  hasDotDevflow: boolean;
  hasDevArtifacts: boolean;
  hasDevflowMd: boolean;
  hasClaudeMd: boolean;
  activeFeature: FeatureInfo | null;
  features: FeatureInfo[];
  detectedFramework: string | null;
  language: string | null;
  fileCount: number;
  gitStatus: string;
  lastModifiedTimestamp: number;
}
