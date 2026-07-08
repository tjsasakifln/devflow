// =============================================================================
// Workflow Engine — Runtime State Machine Executor
// =============================================================================
// Core engine that:
//   - Reads the YAML state machine definition (via loader)
//   - Evaluates guard conditions against project context
//   - Executes transitions with effect delegation
//   - Manages state persistence (via persistence)
//   - Supports checkpoint/resume and --dry-run
// =============================================================================

import type { DevflowState } from "../types/state.js";
import type { ProjectInspection } from "../types/project.js";
import { detectState } from "../state/detector.js";
import {
  loadWorkflowSpec,
  getStateById,
  getTransitionsFromState,
  getEffectById,
  clearCache as clearLoaderCache,
} from "./loader.js";
import {
  loadEngineState,
  saveEngineState,
  createDefaultEngineState,
  saveCheckpoint,
  loadCheckpoint,
  clearCheckpoint,
  hasCheckpoint,
} from "./persistence.js";
import {
  buildGuardContext,
  ENGINE_STATE_SCHEMA_VERSION,
} from "./types.js";
import type {
  AgentRole,
  EngineState,
  CheckpointData,
  GuardContext,
  GuardEvalResult,
  GuardHandler,
  EffectHandler,
  ValidTransition,
  TransitionResult,
  DryRunResult,
  EngineRecommendation,
  WorkflowSpec,
  HandoffArtifact,
  HandoffInput,
} from "./types.js";
import { checkDelegationAuthority } from "./authority-enforcer.js";
import { generateHandoffYaml, saveHandoffArtifact } from "./handoff.js";

// =============================================================================
// Built-in Guard Handlers
// =============================================================================
// Each guard in the YAML spec maps to a handler function. Handlers evaluate
// the guard against the GuardContext and return true (pass) or false (fail).
//
// Guards that depend on user decisions evaluate to `true` by default, since
// the runtime assumes the user would approve. Callers can override these via
// GuardContext.userDecision.

const BUILTIN_GUARDS: Record<string, GuardHandler> = {
  // -- Project detection guards --
  hasMinimalCodeAndNoDevflow: (ctx) =>
    !ctx.inspection.hasDotDevflow &&
    (ctx.inspection.hasPackageJson || ctx.inspection.hasGit) &&
    ctx.inspection.fileCount <= 10,

  hasExistingCodebaseAndNoDevflow: (ctx) =>
    !ctx.inspection.hasDotDevflow && ctx.inspection.fileCount > 10,

  devflowInitialized: (ctx) => ctx.inspection.hasDotDevflow,

  devflowInitializedAndUserOptsOut: (ctx) =>
    ctx.inspection.hasDotDevflow && ctx.userDecision === "skip-specs",

  hasActiveFeature: (ctx) => ctx.inspection.activeFeature !== null,

  // -- Discovery guards --
  discoverySpecsWritten: (ctx) => ctx.inspection.hasDevArtifacts,

  userSkipsDiscoverySpecs: (ctx) =>
    ctx.userDecision === "skip-discovery-specs",

  deepDiscoveryRequested: (ctx) =>
    ctx.userDecision === "deep-discovery",

  scoutComplete: (_ctx) => false, // Requires file check — override in integration

  archaeologyComplete: (_ctx) => false,

  detectionComplete: (_ctx) => false,

  architectureComplete: (_ctx) => false,

  discoveryDocsWritten: (_ctx) => false,

  userSkipsDeepDiscovery: (ctx) =>
    ctx.userDecision === "skip-discovery",

  // -- Feature pipeline guards --
  requirementsHaveDoubts: (ctx) =>
    ctx.feature?.requirementsDoubts === true,

  requirementsApproved: (ctx) =>
    ctx.feature?.hasRequirements === true &&
    ctx.feature?.requirementsDoubts === false &&
    ctx.feature?.hasQualityAudit === true,

  doubtsResolved: (ctx) =>
    ctx.feature?.requirementsDoubts === false,

  doubtsResolvedQuickly: (ctx) =>
    ctx.feature?.requirementsDoubts === false &&
    ctx.userDecision === "skip-re-review",

  designComplete: (ctx) =>
    ctx.feature?.hasRoadmap === true,

  testPlanComplete: (ctx) =>
    ctx.feature?.hasTestPlan === true,

  testPlanApproved: (ctx) =>
    ctx.feature?.hasTestPlan === true &&
    ctx.feature?.hasImplementationLog === false,

  auditPassed: (ctx) =>
    ctx.feature?.hasQualityAudit === true &&
    ctx.feature?.hasLegacyImpact === true &&
    ctx.feature?.hasRegressionWatch === true,

  auditFailedAndNeedsRestart: (ctx) =>
    ctx.feature?.hasQualityAudit === true &&
    ctx.userDecision === "restart",

  allActionsComplete: (ctx) =>
    (ctx.feature?.actionsCompletionRatio ?? 0) >= 1.0,

  verificationPassed: (ctx) =>
    (ctx.feature?.actionsCompletionRatio ?? 0) >= 1.0 &&
    ctx.feature?.hasImplementationLog === true,

  verificationFailed: (ctx) =>
    (ctx.feature?.actionsCompletionRatio ?? 0) >= 1.0 &&
    ctx.feature?.hasImplementationLog === true &&
    ctx.userDecision === "fix-and-retry",

  ciPasses: (ctx) =>
    ctx.gitStatus === "success", // Simplified — actual CI check in integration

  // -- Drift and blocking guards --
  gitDirtyAndSpecChanged: (ctx) =>
    ctx.gitStatus === "dirty" && ctx.specsModified,

  explicitBlockerSet: (ctx) =>
    ctx.stateFile?.currentState === "blocked" &&
    (ctx.stateFile?.blockers?.length ?? 0) > 0,

  // -- QA guards --
  qaPassed: (ctx) =>
    ctx.qaVerdict === "PASS" || ctx.qaVerdict === "CONCERNS",

  qaFailed: (ctx) => ctx.qaVerdict === "FAIL",

  adversarialReviewRequired: (ctx) =>
    ctx.riskLevel === "high" || ctx.userDecision === "adversarial",

  adversarialReviewPassed: (ctx) =>
    ctx.adversarialVerdict === "PASS",

  adversarialReviewFailed: (ctx) =>
    ctx.adversarialVerdict === "FAIL",

  // -- Drift resolution guards --
  driftUnresolvable: (ctx) => ctx.driftReconciliationFailed,

  restartRequested: (ctx) => ctx.userDecision === "restart",

  driftReconciled: (ctx) => ctx.driftResolved,

  abortRequested: (ctx) => ctx.userDecision === "abort",

  blockerResolved: (ctx) =>
    (ctx.stateFile?.blockers?.length ?? 0) === 0,

  blockerResolvedAndCodeComplete: (ctx) =>
    (ctx.stateFile?.blockers?.length ?? 0) === 0 &&
    (ctx.feature?.actionsCompletionRatio ?? 0) >= 1.0,

  postCompletionDrift: (ctx) =>
    ctx.gitStatus === "dirty" && ctx.driftDetectedFlag,

  // -- Bugfix guards --
  bugConfirmed: (ctx) => ctx.bugStatus === "confirmed",

  bugWontFix: (ctx) => ctx.bugStatus === "wont-fix",

  fixImplemented: (ctx) => ctx.bugfixImplementationComplete,

  bugfixBlockerDetected: (ctx) =>
    ctx.stateFile?.currentState === "blocked",

  bugfixVerificationPassed: (ctx) =>
    ctx.bugfixVerificationStatus === "passed",

  bugfixVerificationFailed: (ctx) =>
    ctx.bugfixVerificationStatus === "failed",

  postBugfixDrift: (ctx) =>
    ctx.gitStatus === "dirty" && ctx.driftDetectedFlag,

  bugUpgradedToFeature: (ctx) =>
    ctx.bugStatus === "upgraded-to-feature",

  bugFoundDuringCoding: (ctx) =>
    ctx.bugFound === true && ctx.bugSource === "development",

  bugFoundDuringReview: (ctx) =>
    ctx.bugFound === true && ctx.bugSource === "review",

  regressionBugFound: (ctx) =>
    ctx.bugFound === true && ctx.bugSource === "production",
};

// =============================================================================
// Built-in Effect Handlers
// =============================================================================
// Effects are side-effect operations that execute on transition. For the core
// engine, these are no-ops that log intent. Integration code (commands) should
// override or extend these with real implementations.

const BUILTIN_EFFECTS: Record<string, EffectHandler> = {};

// =============================================================================
// WorkflowEngine Class
// =============================================================================

export class WorkflowEngine {
  private rootPath: string;
  private spec: WorkflowSpec | null = null;
  private engineState: EngineState | null = null;
  private lastInspection: ProjectInspection | null = null;
  private guardHandlers: Map<string, GuardHandler>;
  private effectHandlers: Map<string, EffectHandler>;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.guardHandlers = new Map(Object.entries(BUILTIN_GUARDS));
    this.effectHandlers = new Map(Object.entries(BUILTIN_EFFECTS));
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  /**
   * Initialize the engine: load spec + detect state from inspection.
   * Call this before using the engine.
   */
  async initialize(inspection?: ProjectInspection): Promise<void> {
    this.spec = await loadWorkflowSpec(this.rootPath);

    // Store the inspection for guard evaluation context
    if (inspection) {
      this.lastInspection = inspection;
    }

    // Attempt to load persisted state
    this.engineState = await loadEngineState(this.rootPath);

    if (!this.engineState && inspection) {
      // No persisted state — detect from inspection
      const detection = await detectState(inspection);
      const workflow = this.inferWorkflow(detection.currentState);
      this.engineState = createDefaultEngineState(
        detection.currentState,
        workflow,
        inspection.activeFeature?.id ?? null,
      );
      this.engineState.confidence = detection.confidence;
      await saveEngineState(this.rootPath, this.engineState);
    }
  }

  /**
   * Register a custom guard handler (overrides built-in).
   */
  registerGuard(guardId: string, handler: GuardHandler): void {
    this.guardHandlers.set(guardId, handler);
  }

  /**
   * Register a custom effect handler.
   */
  registerEffect(effectId: string, handler: EffectHandler): void {
    this.effectHandlers.set(effectId, handler);
  }

  // -------------------------------------------------------------------------
  // State accessors
  // -------------------------------------------------------------------------

  /** Get the current engine state. */
  getState(): EngineState | null {
    return this.engineState;
  }

  /** Get the loaded spec (null if not initialized). */
  getSpec(): WorkflowSpec | null {
    return this.spec;
  }

  /** Get current state ID. */
  getCurrentState(): DevflowState | null {
    return this.engineState?.currentState ?? null;
  }

  // -------------------------------------------------------------------------
  // Transition evaluation
  // -------------------------------------------------------------------------

  /**
   * Get all valid transitions from the current state, evaluating their guards.
   * Returns transitions that pass guard checks (or whose guards can't be evaluated).
   */
  async getValidTransitions(
    context?: Partial<GuardContext>,
  ): Promise<ValidTransition[]> {
    const state = this.requireState();
    const spec = this.requireSpec();
    const stateId = state.currentState;

    const transitions = getTransitionsFromState(spec, stateId);
    const fullContext = this.buildContext(context);

    const results: ValidTransition[] = [];

    for (const t of transitions) {
      const guardResult = await this.evaluateGuard(t.guard, fullContext);
      const effect = t.effect ? getEffectById(spec, t.effect) ?? null : null;
      const fromState = getStateById(spec, stateId);
      const toState = getStateById(spec, t.to);

      results.push({
        transition: t,
        guardResult,
        effect,
        fromState: fromState!,
        toState: toState!,
      });
    }

    return results;
  }

  /**
   * Evaluate a single guard.
   */
  async evaluateGuard(
    guardId: string | null,
    context?: Partial<GuardContext>,
  ): Promise<GuardEvalResult> {
    if (guardId === null) {
      return { guardId: null, passed: true, reason: "No guard condition" };
    }

    const fullContext = this.buildContext(context);
    const handler = this.guardHandlers.get(guardId);

    if (!handler) {
      return {
        guardId,
        passed: null,
        reason: `No handler registered for guard '${guardId}'`,
      };
    }

    try {
      const result = await handler(fullContext);
      return {
        guardId,
        passed: result,
        reason: result ? "Guard passed" : "Guard failed",
      };
    } catch (err) {
      return {
        guardId,
        passed: null,
        reason: `Guard evaluation error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Transition execution
  // -------------------------------------------------------------------------

  /**
   * Execute a transition: evaluate guards → run effects → persist state → checkpoint.
   */
  async executeTransition(
    transitionId: string,
    context?: Partial<GuardContext>,
  ): Promise<TransitionResult> {
    const spec = this.requireSpec();
    const state = this.requireState();

    // Find the transition
    const transition = spec.transitions.find((t) => t.id === transitionId);
    if (!transition) {
      return {
        success: false,
        transitionId,
        fromState: state.currentState,
        toState: state.currentState,
        guardResults: [],
        effectsExecuted: [],
        checkpointSaved: false,
        newEngineState: state,
        errors: [`Transition '${transitionId}' not found in spec`],
      };
    }

    // Validate from-state matches
    if (transition.from !== state.currentState) {
      return {
        success: false,
        transitionId,
        fromState: state.currentState,
        toState: state.currentState,
        guardResults: [],
        effectsExecuted: [],
        checkpointSaved: false,
        newEngineState: state,
        errors: [
          `Transition '${transitionId}' expects from-state '${transition.from}' but current state is '${state.currentState}'`,
        ],
      };
    }

    const fullContext = this.buildContext(context);

    // Evaluate guard
    const guardResult = await this.evaluateGuard(
      transition.guard,
      fullContext,
    );

    if (guardResult.passed === false) {
      // Guard explicitly failed — block
      return {
        success: false,
        transitionId,
        fromState: state.currentState,
        toState: state.currentState,
        guardResults: [guardResult],
        effectsExecuted: [],
        checkpointSaved: false,
        newEngineState: state,
        errors: [`Guard '${String(transition.guard)}' blocked this transition`],
      };
    }

    // -- Agent delegation check (Story 2.4) --
    // If transition has an agent tag, validate and update delegation state.
    const transitionAgent = transition.agent ?? null;
    let delegationHandoff: HandoffArtifact | null = null;

    if (transitionAgent) {
      // Validate that the transition agent is a valid AgentRole
      const role = transitionAgent as AgentRole;

      // If there's a current agent, check delegation authority
      if (state.currentAgent && state.currentAgent !== role) {
        const authResult = checkDelegationAuthority(state.currentAgent, role);
        if (!authResult.allowed) {
          return {
            success: false,
            transitionId,
            fromState: state.currentState,
            toState: state.currentState,
            guardResults: [guardResult],
            effectsExecuted: [],
            checkpointSaved: false,
            newEngineState: state,
            errors: [authResult.reason],
          };
        }
      }

      // Generate handoff artifact if agent is changing
      if (state.currentAgent !== role) {
        const handoffInput: HandoffInput = {
          fromAgent: state.currentAgent ?? role,
          toAgent: role,
          storyId: state.activeFeatureId ?? "unknown",
          storyPath: this.rootPath,
          storyStatus: state.currentState,
          currentTask: transition.label,
          branch: this.lastInspection?.currentBranch ?? "main",
          decisions: [],
          filesModified: [],
          blockers: state.blockers,
          nextAction: `Execute transition '${transition.label}' as ${role}`,
        };

        const { artifact } = generateHandoffYaml(handoffInput);
        delegationHandoff = artifact;

        // Save handoff artifact (non-fatal if fails)
        try {
          await saveHandoffArtifact(this.rootPath, artifact);
        } catch {
          // Non-fatal — continue even if handoff save fails
        }
      }
    }

    // Execute effects
    const effectsExecuted: string[] = [];
    if (transition.effect) {
      const effectDef = getEffectById(spec, transition.effect);
      if (effectDef) {
        const handler = this.effectHandlers.get(transition.effect);
        if (handler) {
          try {
            await handler(fullContext);
            effectsExecuted.push(transition.effect);
          } catch (err) {
            // Log but continue — effect failure shouldn't block state transition
            effectsExecuted.push(`${transition.effect}(error)`);
          }
        } else {
          effectsExecuted.push(`${transition.effect}(handler-not-registered)`);
        }
      }
    }

    // Update engine state (including agent delegation if applicable)
    const newState: EngineState = {
      ...state,
      previousState: state.currentState,
      currentState: transition.to as DevflowState,
      workflow: transition.workflow,
      currentAgent: transitionAgent ?? state.currentAgent,
      previousAgent: delegationHandoff
        ? delegationHandoff.handoff.from_agent
        : state.previousAgent,
      updatedAt: new Date().toISOString(),
      metadata: {
        ...state.metadata,
        lastTransitionId: transitionId,
        lastTransitionAt: new Date().toISOString(),
        transitionCount: state.metadata.transitionCount + 1,
      },
    };

    this.engineState = newState;

    // Persist state
    await saveEngineState(this.rootPath, newState);

    // Save checkpoint
    let checkpointSaved = false;
    try {
      const checkpoint: CheckpointData = {
        schemaVersion: ENGINE_STATE_SCHEMA_VERSION,
        engineState: newState,
        checkpointContext: {
          transitionId,
          transitionLabel: transition.label,
          fromState: state.currentState,
          toState: transition.to as DevflowState,
          guardResults: [guardResult],
          effectsExecuted,
          timestamp: new Date().toISOString(),
        },
      };
      await saveCheckpoint(this.rootPath, checkpoint);
      checkpointSaved = true;
    } catch {
      // Checkpoint failure is non-fatal
    }

    return {
      success: true,
      transitionId,
      fromState: state.currentState,
      toState: transition.to as DevflowState,
      guardResults: [guardResult],
      effectsExecuted,
      checkpointSaved,
      newEngineState: newState,
      errors: [],
    };
  }

  // -------------------------------------------------------------------------
  // Dry-run
  // -------------------------------------------------------------------------

  /**
   * Simulate a transition without persisting state.
   */
  async dryRunTransition(
    transitionId: string,
    context?: Partial<GuardContext>,
  ): Promise<DryRunResult> {
    const spec = this.requireSpec();
    const state = this.requireState();

    const transition = spec.transitions.find((t) => t.id === transitionId);
    if (!transition) {
      return {
        transitionId,
        fromState: state.currentState,
        toState: state.currentState,
        guardResults: [],
        effectsWouldExecute: [],
        wouldPersist: false,
        wouldCheckpoint: false,
        warnings: [`Transition '${transitionId}' not found`],
      };
    }

    if (transition.from !== state.currentState) {
      return {
        transitionId,
        fromState: state.currentState,
        toState: state.currentState,
        guardResults: [],
        effectsWouldExecute: [],
        wouldPersist: false,
        wouldCheckpoint: false,
        warnings: [
          `Transition requires from-state '${transition.from}' but current is '${state.currentState}'`,
        ],
      };
    }

    const fullContext = this.buildContext(context);
    const guardResult = await this.evaluateGuard(transition.guard, fullContext);

    const effectsWouldExecute: string[] = [];
    if (transition.effect) {
      effectsWouldExecute.push(transition.effect);
    }

    const warnings: string[] = [];
    if (guardResult.passed === false) {
      warnings.push(
        `Guard '${String(transition.guard)}' would block this transition`,
      );
    } else if (guardResult.passed === null) {
      warnings.push(
        `Guard '${String(transition.guard)}' could not be evaluated — unknown result`,
      );
    }

    return {
      transitionId,
      fromState: state.currentState,
      toState: transition.to as DevflowState,
      guardResults: [guardResult],
      effectsWouldExecute,
      wouldPersist: true,
      wouldCheckpoint: true,
      warnings,
    };
  }

  /**
   * Run dry-run for all valid transitions from current state.
   */
  async dryRunAll(context?: Partial<GuardContext>): Promise<DryRunResult[]> {
    const state = this.requireState();
    const spec = this.requireSpec();
    const transitions = getTransitionsFromState(spec, state.currentState);

    const results: DryRunResult[] = [];
    for (const t of transitions) {
      results.push(await this.dryRunTransition(t.id, context));
    }
    return results;
  }

  // -------------------------------------------------------------------------
  // Checkpoint / Resume
  // -------------------------------------------------------------------------

  /**
   * Save a manual checkpoint of the current state.
   */
  async saveCheckpoint(): Promise<void> {
    const state = this.requireState();
    const checkpoint: CheckpointData = {
      schemaVersion: ENGINE_STATE_SCHEMA_VERSION,
      engineState: state,
      checkpointContext: {
        transitionId: "manual",
        transitionLabel: "Manual checkpoint",
        fromState: state.currentState,
        toState: state.currentState,
        guardResults: [],
        effectsExecuted: [],
        timestamp: new Date().toISOString(),
      },
    };
    await saveCheckpoint(this.rootPath, checkpoint);

    this.engineState = {
      ...state,
      metadata: {
        ...state.metadata,
        lastCheckpointAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Resume from the last checkpoint. Returns true if a checkpoint was loaded.
   */
  async resumeFromCheckpoint(): Promise<boolean> {
    const checkpoint = await loadCheckpoint(this.rootPath);
    if (!checkpoint) return false;

    this.engineState = checkpoint.engineState;

    // Also persist to state file
    await saveEngineState(this.rootPath, this.engineState);

    // Clear checkpoint after successful resume
    await clearCheckpoint(this.rootPath);

    return true;
  }

  /**
   * Check if a checkpoint exists.
   */
  async hasCheckpoint(): Promise<boolean> {
    return hasCheckpoint(this.rootPath);
  }

  // -------------------------------------------------------------------------
  // Agent-aware transition execution (Story 2.4)
  // -------------------------------------------------------------------------

  /**
   * Execute an agent-tagged transition.
   * This wraps executeTransition with agent-specific orchestration:
   *   1. Validates the transition has an agent tag
   *   2. Checks delegation authority between current and new agent
   *   3. Generates and saves handoff artifact
   *   4. Executes the state transition (which tracks agent change)
   *   5. Spawns the new agent as a subprocess (optional — caller decides)
   *
   * Returns the transition result with handoff info attached.
   */
  async executeAgentTransition(
    transitionId: string,
    context?: Partial<GuardContext> & {
      agentContext?: {
        decisions?: string[];
        filesModified?: string[];
        blockers?: string[];
        branch?: string;
        spawnAgent?: boolean;
      };
    },
  ): Promise<
    TransitionResult & {
      handoffArtifact?: HandoffArtifact;
      handoffSaved?: boolean;
      handoffPath?: string;
    }
  > {
    const spec = this.requireSpec();
    const transition = spec.transitions.find((t) => t.id === transitionId);

    if (!transition) {
      const base = await this.executeTransition(transitionId, context);
      return { ...base, handoffArtifact: undefined };
    }

    // If transition has no agent tag, execute normally
    if (!transition.agent) {
      const base = await this.executeTransition(transitionId, context);
      return { ...base, handoffArtifact: undefined };
    }

    // Execute normal transition (which now handles agent tracking)
    const result = await this.executeTransition(transitionId, context);

    // Build handoff info from current state
    const state = this.engineState;
    const agentCtx = context?.agentContext;

    let handoffArtifact: HandoffArtifact | undefined;
    let handoffPath: string | undefined;

    if (state && state.currentAgent && state.previousAgent) {
      const handoffInput: HandoffInput = {
        fromAgent: state.previousAgent,
        toAgent: state.currentAgent,
        storyId: state.activeFeatureId ?? "unknown",
        storyPath: this.rootPath,
        storyStatus: state.currentState,
        currentTask: transition.label,
        branch: agentCtx?.branch ?? this.lastInspection?.currentBranch ?? "main",
        decisions: agentCtx?.decisions ?? [],
        filesModified: agentCtx?.filesModified ?? [],
        blockers: agentCtx?.blockers ?? state.blockers,
        nextAction: `Execute as ${state.currentAgent}: ${transition.description}`,
      };

      const { artifact } = generateHandoffYaml(handoffInput);
      handoffArtifact = artifact;

      try {
        handoffPath = await saveHandoffArtifact(this.rootPath, artifact);
      } catch {
        // Non-fatal
      }
    }

    return {
      ...result,
      handoffArtifact,
      handoffSaved: !!handoffPath,
      handoffPath,
    };
  }

  // -------------------------------------------------------------------------
  // Accessor for agent state
  // -------------------------------------------------------------------------

  /** Get the current agent role (null if none). */
  getCurrentAgent(): AgentRole | null {
    return this.engineState?.currentAgent ?? null;
  }

  /** Get the previous agent role (null if none). */
  getPreviousAgent(): AgentRole | null {
    return this.engineState?.previousAgent ?? null;
  }

  /** Check if an agent is active. */
  hasActiveAgent(): boolean {
    return this.engineState?.currentAgent !== null;
  }

  // -------------------------------------------------------------------------
  // Recommendation for devflow next
  // -------------------------------------------------------------------------

  /**
   * Get the recommended next action, used by the `devflow next` command.
   * Synchronous variant for backward compat — uses last known state.
   */
  getRecommendationSync(): EngineRecommendation {
    const state = this.requireState();
    const spec = this.requireSpec();
    const stateId = state.currentState;

    const stateDef = getStateById(spec, stateId);
    const transitions = getTransitionsFromState(spec, stateId);

    const validTransitions: ValidTransition[] = transitions.map((t) => {
      const fromState = getStateById(spec, stateId);
      const toState = getStateById(spec, t.to);
      return {
        transition: t,
        guardResult: { guardId: t.guard, passed: null, reason: "Not evaluated (sync)" },
        effect: t.effect ? getEffectById(spec, t.effect) ?? null : null,
        fromState: fromState!,
        toState: toState!,
      };
    });

    // Primary recommendation: first non-guarded transition, or first transition overall
    const recommended =
      validTransitions.find((t) => t.transition.guard === null) ??
      validTransitions[0] ??
      null;

    return {
      currentState: state.currentState,
      confidence: state.confidence,
      workflow: state.workflow,
      validTransitions,
      recommendedTransition: recommended,
      known: this.extractKnownFacts(stateId, stateDef),
      blockers: state.blockers,
    };
  }

  /**
   * Get the recommended next action with guard evaluation.
   * Async — evaluates guards to find truly valid transitions.
   */
  async getRecommendation(
    context?: Partial<GuardContext>,
  ): Promise<EngineRecommendation> {
    const validTransitions = await this.getValidTransitions(context);
    const state = this.requireState();
    const spec = this.requireSpec();
    const stateId = state.currentState;
    const stateDef = getStateById(spec, stateId);

    // Prefer transitions with passing guards, then unknown, then no guard
    const recommended =
      validTransitions.find(
        (t) =>
          t.guardResult.passed === true ||
          (t.guardResult.passed === null && t.transition.guard === null),
      ) ??
      validTransitions.find((t) => t.guardResult.passed === true) ??
      validTransitions.find((t) => t.guardResult.passed === null) ??
      validTransitions[0] ??
      null;

    return {
      currentState: state.currentState,
      confidence: state.confidence,
      workflow: state.workflow,
      validTransitions,
      recommendedTransition: recommended,
      known: this.extractKnownFacts(stateId, stateDef),
      blockers: state.blockers,
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private requireState(): EngineState {
    if (!this.engineState) {
      throw new Error(
        "Engine not initialized. Call initialize() with project inspection first.",
      );
    }
    return this.engineState;
  }

  private requireSpec(): WorkflowSpec {
    if (!this.spec) {
      throw new Error(
        "Engine not initialized. Call initialize() first.",
      );
    }
    return this.spec;
  }

  private buildContext(
    overrides?: Partial<GuardContext>,
  ): GuardContext {
    // Use stored inspection if available, otherwise create a minimal one.
    // This ensures activeFeature and other inspection data are available
    // for guard evaluation without requiring callers to pass context every time.
    const baseInspection: ProjectInspection = this.lastInspection ?? {
      rootPath: this.rootPath,
      hasGit: false,
      hasRemote: false,
      currentBranch: null,
      packageManager: null,
      hasPackageJson: false,
      hasSrcDir: false,
      hasDotDevflow: false,
      hasDevArtifacts: false,
      hasDevflowMd: false,
      hasClaudeMd: false,
      activeFeature: null,
      features: [],
      detectedFramework: null,
      language: null,
      fileCount: 0,
      gitStatus: "clean",
      lastModifiedTimestamp: 0,
    };
    return buildGuardContext(baseInspection, this.engineState, overrides);
  }

  private inferWorkflow(stateId: string): string {
    if (!this.spec) return "greenfield";
    const stateDef = getStateById(this.spec, stateId);
    return stateDef?.workflow ?? "greenfield";
  }

  private extractKnownFacts(
    stateId: string,
    stateDef?: import("./types.js").StateDef,
  ): string[] {
    const facts: string[] = [];
    facts.push(`Current state: ${stateId}`);
    if (stateDef) {
      facts.push(`State type: ${stateDef.type} (${stateDef.category})`);
      facts.push(`Workflow: ${stateDef.workflow}`);
      if (stateDef.terminal) facts.push(`Terminal state: ${stateDef.label}`);
    }
    return facts;
  }
}

// -------------------------------------------------------------------------
// Factory function
// -------------------------------------------------------------------------

/**
 * Create a new WorkflowEngine instance for the given project root.
 */
export function createEngine(rootPath: string): WorkflowEngine {
  return new WorkflowEngine(rootPath);
}

/**
 * Convenience: initialize + detect + return recommendation (one-shot for devflow next).
 */
export async function getEngineRecommendation(
  rootPath: string,
  inspection: ProjectInspection,
  context?: Partial<GuardContext>,
): Promise<EngineRecommendation> {
  const engine = createEngine(rootPath);
  await engine.initialize(inspection);
  return engine.getRecommendation(context);
}

/**
 * Clear the engine's loader cache (for testing / hot-reload).
 */
export function clearEngineCache(): void {
  clearLoaderCache();
}
