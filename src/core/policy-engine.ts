/**
 * Devflow Core — Policy Engine
 *
 * Centralized risk tolerance, blocking rules, and verdict computation.
 * All risk/severity/blocking decisions live here — never in CLI commands.
 */

import type { Risk, Severity, Verdict, SeverityMatrix } from "./report-model.js";

export type RiskTolerance = "relaxed" | "moderate" | "strict";

export interface PolicyConfig {
  riskTolerance: RiskTolerance;
  executionMode: "local" | "experimental" | "strict" | "release";
}

/**
 * Map severity to numeric threshold for blocking.
 * CRITICAL always blocks (threshold 0).
 * HIGH blocks at moderate+ (threshold 1).
 * MEDIUM blocks at strict (threshold 2).
 * LOW never blocks (threshold Infinity).
 */
export function severityBlocks(
  severity: Severity,
  tolerance: RiskTolerance,
): boolean {
  const toleranceThreshold: Record<RiskTolerance, number> = {
    relaxed: 0,   // only CRITICAL blocks
    moderate: 1,  // CRITICAL + HIGH block
    strict: 2,    // CRITICAL + HIGH + MEDIUM block
  };
  const severityScore: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  return severityScore[severity] <= toleranceThreshold[tolerance];
}

/**
 * Compute verdict from risk array given policy.
 */
export function computeVerdict(
  risks: Risk[],
  config: PolicyConfig,
): { verdict: Verdict; reason: string } {
  const blocking = risks.filter(
    (r) => r.blocking && severityBlocks(r.severity, config.riskTolerance),
  );
  const nonBlocking = risks.filter(
    (r) => !r.blocking || !severityBlocks(r.severity, config.riskTolerance),
  );

  if (blocking.length >= 3) {
    return {
      verdict: "BLOCKED",
      reason: `${blocking.length} blocking risks: ${blocking.map((r) => r.description).join("; ")}.`,
    };
  }

  if (blocking.length > 0) {
    return {
      verdict: "FAIL",
      reason: `${blocking.length} blocking risks: ${blocking.map((r) => r.description).join("; ")}.`,
    };
  }

  if (nonBlocking.length >= 3) {
    return {
      verdict: "WARN",
      reason: `${nonBlocking.length} risks found. Review recommended before merge.`,
    };
  }

  if (nonBlocking.length > 0) {
    return {
      verdict: "PASS",
      reason: `${nonBlocking.length} non-blocking risks identified. No action required but awareness recommended.`,
    };
  }

  return {
    verdict: "PASS",
    reason: "All gates passed. Evidence chain complete.",
  };
}

/**
 * Build severity matrix from risk array.
 */
export function buildSeverityMatrix(risks: Risk[]): SeverityMatrix {
  return {
    critical: risks.filter((r) => r.severity === "CRITICAL").length,
    high: risks.filter((r) => r.severity === "HIGH").length,
    medium: risks.filter((r) => r.severity === "MEDIUM").length,
    low: risks.filter((r) => r.severity === "LOW").length,
  };
}

/**
 * Get border severity for CI fail-on threshold.
 * Returns the minimum severity that should cause CI failure.
 */
export function failOnSeverity(
  threshold: Severity | "never",
  risks: Risk[],
): boolean {
  if (threshold === "never") return false;
  const severityScore: Record<Severity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  const thresholdScore = severityScore[threshold];
  return risks.some((r) => severityScore[r.severity] <= thresholdScore);
}

/**
 * Risk factory helpers — ensure all risks have consistent shape.
 */
export function createRisk(
  severity: Severity,
  category: Risk["category"],
  description: string,
  recommendation: string,
  tolerance: RiskTolerance,
  opts?: { file?: string; line?: number; source?: string; patternId?: string; adapter?: string },
): Risk {
  return {
    severity,
    category,
    description,
    recommendation,
    blocking: severityBlocks(severity, tolerance),
    file: opts?.file,
    line: opts?.line,
    source: opts?.source,
    patternId: opts?.patternId,
    adapter: opts?.adapter,
  };
}

