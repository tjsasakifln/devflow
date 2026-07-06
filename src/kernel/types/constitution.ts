export type ConstitutionCategory =
  | "structure"
  | "architecture"
  | "quality"
  | "process"
  | "security"
  | "domain"
  | "oo-design";

export type ConstitutionSeverity = "critical" | "blocking" | "advisory";

export type ApprovalCondition = "auto" | "human-review" | "deferred";

export interface ConstitutionRule {
  id: string;
  description: string;
  category: ConstitutionCategory;
  verification: ConstitutionVerification;
  blocking: boolean; // kept for backward compat; prefer severity
  severity: ConstitutionSeverity;
  approvalCondition: ApprovalCondition;
  refusalMessage?: string;
  humanReviewRequired: boolean;
  ooQualityMetrics?: {
    maxComplexity?: number;
    maxLinesPerFunction?: number;
    maxLinesPerFile?: number;
    minCoverage?: number;
    maxCoupling?: number;
  };
}

export interface ConstitutionVerification {
  tool: string;
  command: string;
  expectedOutput: "pass" | "zero" | "threshold";
  threshold?: number;
  failMessage: string;
  approvalCondition?: ApprovalCondition;
}

export interface ConstitutionDocument {
  version: string;
  projectName: string;
  ratified: string;
  rules: ConstitutionRule[];
}

export interface ConstitutionCheckResult {
  ruleId: string;
  passed: boolean;
  evidence: string;
  severity: "pass" | "fail" | "warn" | "error";
  toolOutput?: string;
  humanReviewRequired?: boolean;
}

export interface ConstitutionReport {
  timestamp: string;
  projectRoot: string;
  results: ConstitutionCheckResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    errors: number;
    criticalFailures: number;
    humanReviewsNeeded: number;
  };
  allPassed: boolean;
}

export interface ConstitutionComplianceResult {
  compliant: boolean;
  criticalFailures: string[];
  humanReviewsNeeded: string[];
}
