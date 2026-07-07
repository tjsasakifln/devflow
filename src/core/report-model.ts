/**
 * Devflow Core — Unified Report Model
 *
 * Single source of truth for all audit/review report shapes.
 * Used by audit-engine, review-pr, adversarial-review, and all renderers.
 */

// ── Severity ──

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface SeverityMatrix {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

// ── Verdict ──

export type Verdict = "PASS" | "WARN" | "FAIL" | "BLOCKED";

// ── Changed File ──

export interface ChangedFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "unknown";
  language?: string;
  additions?: number;
  deletions?: number;
  package?: string; // monorepo package name
  riskLevel?: Severity;
}

// ── Risk ──

export interface Risk {
  severity: Severity;
  category: RiskCategory;
  file?: string;
  line?: number;
  description: string;
  recommendation: string;
  blocking: boolean; // true if this risk blocks the verdict at current riskTolerance
}

export type RiskCategory =
  | "missing-artifact"
  | "missing-evidence"
  | "security"
  | "architecture"
  | "testing"
  | "traceability"
  | "governance"
  | "code-quality"
  | "ci-cd"
  | "dependency";

// ── Evidence ──

export interface Evidence {
  type: EvidenceType;
  label: string;
  present: boolean;
  detail?: string;
}

export type EvidenceType =
  | "artifact"
  | "test-result"
  | "lint-result"
  | "typecheck-result"
  | "coverage"
  | "adversarial-review"
  | "gatekeep"
  | "implementation-log"
  | "ci-status";

// ── Audit Options ──

export interface AuditOptions {
  cwd: string;
  base?: string;
  staged?: boolean;
  workingTree?: boolean;
  riskTolerance?: "relaxed" | "moderate" | "strict";
  format?: "markdown" | "html" | "json";
  output?: string;
}

// ── Audit Metadata ──

export interface AuditMetadata {
  devflowVersion: string;
  timestamp: string;
  commitSha: string;
  branch: string;
  base: string;
  executionMode: string;
  workingTreeClean: boolean;
}

// ── Audit Report ──

export interface AuditReport {
  verdict: Verdict;
  executiveSummary: string;
  severityMatrix: SeverityMatrix;
  changedFiles: ChangedFile[];
  risks: Risk[];
  evidences: Evidence[];
  missingEvidences: string[];
  metadata: AuditMetadata;
  whatCouldHaveShippedBroken: string[];
  devflowGovernedBadge: string;
  featureId: string | null;
  /** Compact PR snippet for pasting into PR description */
  prSnippet: string;
}
