// =============================================================================
// Parallel Agent Spawner — Type Definitions
// =============================================================================
// Shared types for the parallel agent orchestration system.
// =============================================================================

// ---------------------------------------------------------------------------
// Dimension Definitions
// ---------------------------------------------------------------------------

/** A named analysis dimension with file filter patterns. */
export interface DimensionDef {
  /** Unique dimension identifier (e.g., "security", "performance"). */
  name: string;
  /** Human-readable description of what this dimension analyzes. */
  description: string;
  /** Glob patterns used to select relevant files for this dimension. */
  globPatterns: string[];
}

// ---------------------------------------------------------------------------
// Agent Context & Result
// ---------------------------------------------------------------------------

/** Context passed to each spawned agent via temp file. */
export interface AgentContext {
  /** Project root directory. */
  rootPath: string;
  /** Dimension this agent is analyzing. */
  dimension: string;
  /** File paths relevant to this dimension (pre-resolved). */
  relevantFiles: string[];
  /** Analysis timeout in milliseconds. */
  timeoutMs: number;
  /** Unique agent run ID for logging. */
  runId: string;
}

/** A single finding produced by an agent. */
export interface Finding {
  /** File path relative to project root. */
  file: string;
  /** Line number (0 if file-level). */
  line: number;
  /** Severity classification. */
  severity: "info" | "warning" | "critical";
  /** Human-readable description of the finding. */
  message: string;
  /** Source dimension. */
  dimension: string;
}

/** Result produced by a single agent run. */
export interface AgentResult {
  /** Dimension that was analyzed. */
  dimension: string;
  /** Findings produced by this agent. */
  findings: Finding[];
  /** Wall-clock duration of the agent process. */
  durationMs: number;
  /** Process exit code. */
  exitCode: number;
  /** Error message if the agent failed. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Spawner Configuration
// ---------------------------------------------------------------------------

/** Configuration for the parallel spawner. */
export interface SpawnerConfig {
  /** Dimension names to run. */
  dimensions: string[];
  /** Maximum number of parallel agents. */
  maxParallel: number;
  /** Per-agent timeout in milliseconds. */
  timeoutPerAgent: number;
  /** Project root directory. */
  rootPath: string;
}

// ---------------------------------------------------------------------------
// Consolidated Results
// ---------------------------------------------------------------------------

/** Final consolidated output from all agents. */
export interface ConsolidatedResult {
  /** Total number of findings across all dimensions. */
  totalFindings: number;
  /** Findings grouped by dimension. */
  byDimension: Record<string, Finding[]>;
  /** Top critical/warning findings sorted by severity. */
  topIssues: Finding[];
  /** Total wall-clock duration for the full parallel run. */
  durationMs: number;
  /** Agents that timed out. */
  timedOutAgents: string[];
  /** Agents that failed (non-zero exit, not timeout). */
  failedAgents: string[];
  /** Per-agent details. */
  agentResults: AgentResult[];
}

// ---------------------------------------------------------------------------
// Spawner Status
// ---------------------------------------------------------------------------

/** Status of an individual agent spawn. */
export interface AgentStatus {
  dimension: string;
  pid: number | null;
  state: "pending" | "running" | "completed" | "failed" | "timed-out";
  startTime: number;
  endTime: number | null;
  result: AgentResult | null;
}

/** The --parallel CLI option value. */
export type DimensionSelection =
  | { type: "default" }
  | { type: "named"; names: string[] }
  | { type: "custom"; configPath: string };

// ---------------------------------------------------------------------------
// Completeness Critic Types
// ---------------------------------------------------------------------------

/** The three categories of gaps the critic checks. */
export type CriticGapType =
  | "dimension_not_covered"
  | "source_not_read"
  | "claim_not_verified";

/** A single gap found by the completeness critic. */
export interface CriticGap {
  /** Which category this gap belongs to. */
  type: CriticGapType;
  /** Human-readable description of what is missing. */
  description: string;
  /** Specific details (e.g., dimension name, file path, claim text). */
  details: string;
  /** Severity of this gap. */
  severity: "info" | "warning" | "critical";
  /** Optional suggestion for how to address the gap. */
  suggestion?: string;
}

/** A single iteration of the critic loop. */
export interface CriticIteration {
  /** Iteration number (1-based). */
  iteration: number;
  /** Gaps found in this iteration. */
  gaps: CriticGap[];
  /** Total gap count for this iteration. */
  gapCount: number;
  /** Whether this iteration is considered dry (0 gaps). */
  isDry: boolean;
  /** Timestamp of this iteration. */
  timestamp: string;
}

/** Full report produced by the completeness critic after all iterations. */
export interface CriticReport {
  /** Total gaps found across all iterations. */
  totalGaps: number;
  /** Gaps grouped by type. */
  byType: Record<CriticGapType, CriticGap[]>;
  /** All gaps found in the final iteration. */
  gaps: CriticGap[];
  /** Per-iteration detail for the full loop. */
  iterations: CriticIteration[];
  /** Number of iterations executed before stopping. */
  totalIterations: number;
  /** Reason the loop stopped (dry | max-iterations | error). */
  stopReason: "dry" | "max-iterations" | "error";
  /** Whether the critic found any gaps at all. */
  hasGaps: boolean;
  /** Wall-clock duration for the full critique in ms. */
  durationMs: number;
}

/** Configuration for the completeness critic. */
export interface CriticConfig {
  /** Maximum iterations (default 5). */
  maxIterations: number;
  /** Consecutive dry rounds required to stop (default 2). */
  dryThreshold: number;
  /** Whether to use the ParallelSpawner for deeper analysis. */
  useSpawner: boolean;
  /** Per-agent timeout for spawned analysis (ms). */
  spawnerTimeoutMs: number;
}

// ---------------------------------------------------------------------------
// Adversarial Verify Types (Story 3.2)
// ---------------------------------------------------------------------------

/** The three adversarial verification lenses. */
export type AdversarialLens = "correctness" | "security" | "repro";

/** Verdict from a single lens verifier. */
export interface AdversarialVerdict {
  /** Which lens produced this verdict. */
  lens: AdversarialLens;
  /** Whether the verifier refuted the finding. */
  refuted: boolean;
  /** Human-readable reason for the verdict. */
  reason: string;
}

/** Overall outcome after applying threshold to all lens verdicts. */
export type VerificationOutcome = "survived" | "refuted" | "disputed";

/** Result of verifying a single finding against all lenses. */
export interface VerificationResult {
  /** The original finding that was verified. */
  finding: Finding;
  /** Verdicts from each lens verifier. */
  verdicts: AdversarialVerdict[];
  /** Overall outcome after threshold. */
  outcome: VerificationOutcome;
  /** Human-readable summary of the verification. */
  summary: string;
}

/** Configuration for the AdversarialVerifier. */
export interface VerificationConfig {
  /** Maximum parallel verification tasks. */
  maxParallel: number;
  /** Timeout per verifier in ms. */
  timeoutPerVerifier: number;
}

/** Batch result from verifying multiple findings. */
export interface AdversarialVerificationResult {
  /** Total number of findings verified. */
  totalFindings: number;
  /** Findings that survived (>=2/3 lenses did not refute). */
  survived: VerificationResult[];
  /** Findings that were refuted (<=1 lens did not refute). */
  refuted: VerificationResult[];
  /** Findings with split decisions (2-1) requiring human review. */
  disputed: VerificationResult[];
  /** All verification results in order. */
  allResults: VerificationResult[];
  /** Total wall-clock duration in ms. */
  durationMs: number;
  /** Human-readable summary. */
  summary: string;
}

/** A disputed finding entry stored for human review. */
export interface DisputedFindingEntry {
  /** The original finding data. */
  finding: Finding;
  /** The verification verdicts that led to the dispute. */
  verdicts: AdversarialVerdict[];
  /** ISO timestamp of when the dispute was recorded. */
  timestamp: string;
  /** Feature or context ID where this was disputed. */
  contextId: string;
}
