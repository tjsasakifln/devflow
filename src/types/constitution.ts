export interface ConstitutionRule {
  id: string;
  description: string;
  category: "structure" | "architecture" | "quality" | "process";
  verification: ConstitutionVerification;
  blocking: boolean;
}

export interface ConstitutionVerification {
  tool: string;
  command: string;
  expectedOutput: "pass" | "zero" | "threshold";
  threshold?: number;
  failMessage: string;
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
  };
  allPassed: boolean;
}
