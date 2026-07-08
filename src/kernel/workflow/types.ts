// =============================================================================
// Workflow Engine Types
// =============================================================================
// Type definitions for the Devflow Workflow Engine — state machine runtime
// that reads `.devflow/workflow-states.yaml`, executes transitions, evaluates
// guards, runs effects, and persists state with checkpoint/resume.
//
// Extended for Story 2.4:
//   - AgentRole type + AGENT_ROLES constant
//   - agent field on TransitionDef
//   - currentAgent / previousAgent on EngineState
//   - HandoffArtifact interface
// =============================================================================

import type { DevflowState, ConfidenceLevel } from "../types/state.js";
import type { FeatureInfo, ProjectInspection } from "../types/project.js";

// ---------------------------------------------------------------------------
// AGENT-RELATED TYPES (Story 2.4)
// ---------------------------------------------------------------------------

/**
 * All recognized AIOX agent roles.
 * Order follows the standard delegation pipeline:
 *   PM → SM → PO → Dev → QA → DevOps
 * Extended with specialist roles for architecture, data, analysis, and UX.
 */
export type AgentRole =
  | "pm"
  | "sm"
  | "po"
  | "dev"
  | "qa"
  | "devops"
  | "architect"
  | "analyst"
  | "data-engineer"
  | "ux-expert";

/** All valid agent roles as a read-only array. */
export const AGENT_ROLES: readonly AgentRole[] = [
  "pm",
  "sm",
  "po",
  "dev",
  "qa",
  "devops",
  "architect",
  "analyst",
  "data-engineer",
  "ux-expert",
] as const;

/** Human-readable labels for each agent role. */
export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  pm: "Morgan (PM)",
  sm: "River (SM)",
  po: "Pax (PO)",
  dev: "Dex (Builder)",
  qa: "Quinn (QA)",
  devops: "Gage (DevOps)",
  architect: "Aria (Architect)",
  analyst: "Alex (Analyst)",
  "data-engineer": "Dara (Data Engineer)",
  "ux-expert": "Uma (UX Expert)",
};

/**
 * Handoff artifact — compact context passed between agent transitions.
 * MUST be <500 tokens to satisfy the compaction protocol.
 * Structured per `.claude/rules/agent-handoff.md`.
 */
export interface HandoffArtifact {
  handoff: {
    from_agent: AgentRole;
    to_agent: AgentRole;
    story_context: {
      story_id: string;
      story_path: string;
      story_status: string;
      current_task: string;
      branch: string;
    };
    decisions: string[];
    files_modified: string[];
    blockers: string[];
    next_action: string;
  };
}

/** Fields that can be provided when generating a handoff artifact. */
export interface HandoffInput {
  fromAgent: AgentRole;
  toAgent: AgentRole;
  storyId: string;
  storyPath: string;
  storyStatus?: string;
  currentTask?: string;
  branch?: string;
  decisions?: string[];
  filesModified?: string[];
  blockers?: string[];
  nextAction: string;
}

// ---------------------------------------------------------------------------
// YAML SPEC TYPES — Mirror the structure of workflow-states.yaml
// ---------------------------------------------------------------------------

export interface WorkflowSpecMeta {
  title: string;
  description: string;
  format: string;
  source: Record<string, string>;
  totalStates: number;
}

export interface StateDef {
  id: string;
  type: string;
  category: string;
  workflow: string;
  label: string;
  description: string;
  terminal: boolean;
  deprecated?: boolean;
  meta?: {
    confidence?: string;
    detection?: string;
    detector?: string;
  };
}

export interface TransitionDef {
  id: string;
  from: string;
  to: string;
  workflow: string;
  label: string;
  guard: string | null;
  effect: string | null;
  description: string;
  /** Optional agent role tag — if set, transition triggers agent delegation. */
  agent?: AgentRole | null;
}

export interface GuardDef {
  id: string;
  description: string;
  logic: string;
}

export interface EffectDef {
  id: string;
  description: string;
  writes: string[];
  reads: string[];
  async: boolean;
}

export interface WorkflowDef {
  label: string;
  description: string;
  color: string;
  entryStates: string[];
  terminalStates: string[];
  stateCount: number;
  states: string[];
}

export interface WorkflowSpec {
  version: string;
  meta: WorkflowSpecMeta;
  states: StateDef[];
  transitions: TransitionDef[];
  guards: GuardDef[];
  effects: EffectDef[];
  workflows: Record<string, WorkflowDef>;
}

// ---------------------------------------------------------------------------
// ENGINE RUNTIME TYPES
// ---------------------------------------------------------------------------

/** Current schema version for engine state persistence. */
export const ENGINE_STATE_SCHEMA_VERSION = 2;

/** Runtime state of the workflow engine. */
export interface EngineState {
  schemaVersion: number;
  currentState: DevflowState;
  previousState: DevflowState | null;
  workflow: string;
  confidence: ConfidenceLevel;
  activeFeatureId: string | null;
  blockers: string[];
  /** Agent currently responsible (null = not delegated). */
  currentAgent: AgentRole | null;
  /** Previous agent that handed off. */
  previousAgent: AgentRole | null;
  metadata: {
    lastTransitionId: string | null;
    lastTransitionAt: string | null;
    lastCheckpointAt: string | null;
    transitionCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

/** Checkpoint data — saved separately from state to avoid corruption. */
export interface CheckpointData {
  schemaVersion: number;
  engineState: EngineState;
  checkpointContext: {
    transitionId: string;
    transitionLabel: string;
    fromState: DevflowState;
    toState: DevflowState;
    guardResults: GuardEvalResult[];
    effectsExecuted: string[];
    timestamp: string;
  };
}

/** Context for guard evaluation. */
export interface GuardContext {
  inspection: ProjectInspection;
  feature: FeatureInfo | null;
  stateFile: EngineState | null;
  userDecision: string | null;
  gitStatus: string;
  bugStatus: string | null;
  qaVerdict: string | null;
  adversarialVerdict: string | null;
  riskLevel: string | null;
  bugFound: boolean;
  bugSource: string | null;
  driftDetectedFlag: boolean;
  specsModified: boolean;
  driftResolved: boolean;
  driftReconciliationFailed: boolean;
  bugfixImplementationComplete: boolean;
  bugfixVerificationStatus: string | null;
}

/** Result of a single guard evaluation. */
export interface GuardEvalResult {
  guardId: string | null;
  passed: boolean | null; // null = could not evaluate
  reason?: string;
}

/** A validated, evaluable transition. */
export interface ValidTransition {
  transition: TransitionDef;
  guardResult: GuardEvalResult;
  effect: EffectDef | null;
  fromState: StateDef;
  toState: StateDef;
}

/** Full result of executing a transition. */
export interface TransitionResult {
  success: boolean;
  transitionId: string;
  fromState: DevflowState;
  toState: DevflowState;
  guardResults: GuardEvalResult[];
  effectsExecuted: string[];
  checkpointSaved: boolean;
  newEngineState: EngineState;
  errors: string[];
}

/** Result of a dry-run simulation. */
export interface DryRunResult {
  transitionId: string;
  fromState: DevflowState;
  toState: DevflowState;
  guardResults: GuardEvalResult[];
  effectsWouldExecute: string[];
  wouldPersist: boolean;
  wouldCheckpoint: boolean;
  warnings: string[];
}

/** Recommendation used by `devflow next`. */
export interface EngineRecommendation {
  currentState: DevflowState;
  confidence: ConfidenceLevel;
  workflow: string;
  validTransitions: ValidTransition[];
  recommendedTransition: ValidTransition | null;
  known: string[];
  blockers: string[];
}

// ---------------------------------------------------------------------------
// GUARD HANDLER TYPE
// ---------------------------------------------------------------------------

export type GuardHandler = (context: GuardContext) => boolean | Promise<boolean>;

export type EffectHandler = (context: GuardContext) => void | Promise<void>;

// ---------------------------------------------------------------------------
// HELPER: Build GuardContext from partial inputs
// ---------------------------------------------------------------------------

export function buildGuardContext(
  inspection: ProjectInspection,
  stateFile: EngineState | null,
  overrides?: Partial<GuardContext>,
): GuardContext {
  return {
    inspection,
    feature: inspection.activeFeature,
    stateFile,
    userDecision: null,
    gitStatus: inspection.gitStatus,
    bugStatus: null,
    qaVerdict: null,
    adversarialVerdict: null,
    riskLevel: null,
    bugFound: false,
    bugSource: null,
    driftDetectedFlag: false,
    specsModified: false,
    driftResolved: false,
    driftReconciliationFailed: false,
    bugfixImplementationComplete: false,
    bugfixVerificationStatus: null,
    ...overrides,
  };
}
