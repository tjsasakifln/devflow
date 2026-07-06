/**
 * Feature Graph State
 *
 * Typed state object that flows through the LangGraph pipeline.
 * Each node reads and mutates this state.
 */

import type { EvidenceRef } from "../../kernel/evidence/schema.js";

export interface FeatureGraphState {
  // ── Identity ──
  featureId: string;
  rootPath: string;
  mode: "local" | "experimental" | "strict" | "release";

  // ── Loaded Artifacts ──
  requirements?: string;
  roadmap?: string;
  testPlan?: string;
  actionsMd?: string;
  implementationLog?: string;

  // ── Project Snapshot ──
  projectSnapshotHash?: string;
  indexVersion?: string;

  // ── Retrieved Context ──
  retrievedContext?: {
    files: string[];
    symbols: string[];
    contracts: string[];
    risks: string[];
    similarPastFeatures: string[];
    relatedTests: string[];
    affectedModules: string[];
    confidence: number;
  };

  // ── Node Outputs ──
  requirementsAudit?: {
    score: number;
    blockingFindings: string[];
    advisoryFindings: string[];
    rewriteProposal?: string;
  };

  designReview?: {
    score: number;
    couplingRisks: string[];
    cohesionIssues: string[];
    constitutionViolations: string[];
  };

  testPlanReview?: {
    score: number;
    uncoveredRequirements: string[];
    missingEdgeCases: string[];
    weakAssertions: string[];
  };

  preCodeAudit?: {
    ready: boolean;
    blockers: string[];
    warnings: string[];
  };

  implementationGuidance?: {
    suggestedActions: string[];
    orderRationale: string;
    keyRisks: string[];
  };

  semanticDrift?: {
    detected: boolean;
    drifts: Array<{
      requirement: string;
      actualCode: string;
      severity: "low" | "medium" | "high";
    }>;
  };

  adversarialReview?: {
    verdict: "pass" | "fail" | "inconclusive";
    findings: string[];
    attackVectorsRun: number;
  };

  gatekeepRecommendation?: {
    recommendation: "approve" | "reject" | "needs-work";
    confidence: number;
    rationale: string;
    evidence: EvidenceRef[];
  };

  // ── Meta ──
  currentStep?: string;
  errors: string[];
  requiredHumanInterrupts: string[];
}

export function createInitialState(
  featureId: string,
  rootPath: string,
  mode: "local" | "experimental" | "strict" | "release",
): FeatureGraphState {
  return {
    featureId,
    rootPath,
    mode,
    errors: [],
    requiredHumanInterrupts: [],
  };
}
