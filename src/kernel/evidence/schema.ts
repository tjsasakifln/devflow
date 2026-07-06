/**
 * Devflow Evidence Schema
 *
 * Every decision in Devflow must be traceable to evidence:
 * what was checked, in which file, at which hash, supporting or
 * contradicting which claim.
 *
 * These types form the backbone of auditable governance.
 * No AI agent may produce these — only the kernel may record them.
 */

// ── Core Evidence Primitives ──

/** Algorithm used to hash evidence content. */
export type HashAlgorithm = "sha256" | "sha512";

/** A content hash with its algorithm. */
export interface EvidenceHash {
  algorithm: HashAlgorithm;
  value: string; // hex-encoded
}

/** What kind of evidence this is. */
export type EvidenceType =
  | "file-presence" // a file exists at a path
  | "file-content" // specific content in a file
  | "command-output" // stdout/stderr from a verification command
  | "git-history" // git log, diff, or blame
  | "ci-status" // CI pipeline result
  | "human-attestation" // explicit human confirmation
  | "tool-output" // structured output from a deterministic tool
  | "test-result" // test runner output
  | "review-verdict"; // explicit review decision

/** A reference to a single piece of evidence. */
export interface EvidenceRef {
  /** Unique identifier for this evidence item. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** What kind of evidence. */
  type: EvidenceType;
  /** Where the evidence comes from. */
  source: EvidenceSource;
  /** Content hash at time of collection. */
  hash: EvidenceHash;
  /** ISO 8601 timestamp of collection. */
  timestamp: string;
  /** Confidence in this evidence (0–1). */
  confidence: number;
}

/** Describes where evidence was collected from. */
export interface EvidenceSource {
  /** File path (relative to project root) or URL. */
  target: string;
  /** Line range or section, if applicable. */
  location?: string;
  /** Specific field or key within the target. */
  field?: string;
  /** Surrounding context (up to 200 chars). */
  context?: string;
}

// ── Claims ──

/** A claim about an artifact (requirements, roadmap, etc.). */
export interface ArtifactClaim {
  /** Which artifact this claim is about. */
  artifact: string; // e.g., "requirements.md", "roadmap.md"
  /** The claim being made. */
  claim: string;
  /** Evidence supporting this claim. */
  supporting: EvidenceRef[];
  /** Evidence contradicting this claim. */
  contradicting: EvidenceRef[];
  /** Whether the claim is verified (supporting outweighs contradicting). */
  verified: boolean;
}

/** A claim about code (file, function, line). */
export interface CodeClaim {
  /** File path relative to project root. */
  file: string;
  /** Function or class name. */
  function?: string;
  /** Line number. */
  line?: number;
  /** The claim being made. */
  claim: string;
  /** Evidence supporting this claim. */
  supporting: EvidenceRef[];
  /** Evidence contradicting this claim. */
  contradicting: EvidenceRef[];
  /** Whether the claim is verified. */
  verified: boolean;
}

// ── Traceability ──

/** Traces a requirement through design, implementation, and verification. */
export interface RequirementTrace {
  /** Requirement ID (e.g., "RF-001"). */
  requirementId: string;
  /** The requirement text. */
  requirementText: string;
  /** Test case(s) that verify this requirement. */
  testCaseIds: string[];
  /** Code references implementing this requirement. */
  codeRefs: CodeRef[];
  /** Current trace status. */
  status: "untraced" | "partial" | "fully-traced";
  /** Evidence of traceability. */
  evidence: EvidenceRef[];
}

/** A reference to a specific location in code. */
export interface CodeRef {
  file: string;
  function?: string;
  line?: number;
  /** Why this code is linked to the requirement. */
  rationale: string;
}

// ── Verification ──

/** A claim that something has been verified. */
export interface VerificationClaim {
  /** What is being verified. */
  what: string;
  /** How it was verified (command, tool, process). */
  how: string;
  /** The result of verification. */
  result: "pass" | "fail" | "inconclusive";
  /** Evidence supporting this verification. */
  evidence: EvidenceRef[];
  /** ISO 8601 timestamp. */
  timestamp: string;
}

// ── Contradictions ──

/** A detected contradiction between two claims. */
export interface Contradiction {
  /** First claim. */
  claimA: EvidenceRef;
  /** Second claim that contradicts the first. */
  claimB: EvidenceRef;
  /** How the contradiction was resolved, if at all. */
  resolver?: string;
  /** Whether the contradiction has been resolved. */
  resolved: boolean;
  /** Resolution notes. */
  resolutionNotes?: string;
}

// ── Evidence Chain ──

/** A chain of evidence references collected for a decision. */
export interface EvidenceChain {
  /** Unique identifier for this chain. */
  id: string;
  /** The decision this evidence supports or refutes. */
  decision: string;
  /** All evidence references in this chain. */
  refs: EvidenceRef[];
  /** Claims derived from this evidence. */
  claims: (ArtifactClaim | CodeClaim)[];
  /** Traces from requirements to code. */
  traces: RequirementTrace[];
  /** Verification claims. */
  verifications: VerificationClaim[];
  /** Detected contradictions. */
  contradictions: Contradiction[];
  /** ISO 8601 timestamp of chain assembly. */
  assembledAt: string;
}
