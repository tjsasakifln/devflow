/**
 * DoD Check Registry Types
 *
 * Each Definition of Done check is a self-contained module
 * declaring its id, category, mode requirements, inputs, outputs,
 * timeout, remediation template, and evidence schema.
 */

import type { EvidenceRef } from "../evidence/schema.js";

// ── Check Declaration ──

export type DoDCategory =
  | "artifact"       // artifact presence and completeness
  | "deterministic"  // tool-based verification (typecheck, lint, test)
  | "process"        // workflow compliance (actor separation, ADRs)
  | "git"            // git hygiene (branch, clean state)
  | "review"         // independent review (adversarial, gatekeep)
  | "domain"         // domain-specific quality (acceptance criteria)
  | "ci"             // continuous integration
  | "security";      // security validation

export type ExecutionMode = "local" | "experimental" | "strict" | "release";

export interface DoDCheckContext {
  featureId: string;
  featureDir: string;
  rootPath: string;
  mode: ExecutionMode;
}

export interface DoDCheckResult {
  checkId: string;
  name: string;
  category: DoDCategory;
  passed: boolean;
  detail: string;
  blocking: boolean;
  remediation: string;
  evidence: EvidenceRef[];
  durationMs: number;
}

export interface DoDCheckDecl {
  /** Unique check identifier (e.g., "01", "artifact.requirements.complete"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Check category. */
  category: DoDCategory;
  /** Modes in which this check is required. */
  requiredInModes: ExecutionMode[];
  /** Files this check reads. */
  inputs: string[];
  /** Files this check may write. */
  outputs: string[];
  /** Maximum execution time in milliseconds. */
  timeoutMs: number;
  /** Whether this check is blocking by default (gatekeep refuses if failed). */
  blockingDefault: boolean;
  /** Template for remediation guidance on failure. */
  remediationTemplate: string;
  /** Reference to the evidence schema requirement for this check. */
  evidenceSchema: string;
  /** Execute the check. */
  run: (ctx: DoDCheckContext) => Promise<DoDCheckResult>;
}
