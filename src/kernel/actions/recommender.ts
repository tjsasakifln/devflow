import type { ActionRecommendation } from "../types/engine.js";
import type { StateDetectionResult } from "../types/state.js";
import type { ProjectInspection } from "../types/project.js";
import { ACTION_MAP } from "../state/transitions.js";

/**
 * Compute the next action recommendation from a state detection result.
 * This is the legacy/sync path — for enhanced recommendations with guard
 * evaluation and full workflow spec, use the WorkflowEngine instead.
 */
export function computeRecommendation(
  stateResult: StateDetectionResult,
  _inspection: ProjectInspection
): ActionRecommendation {
  const entry = ACTION_MAP[stateResult.currentState];

  if (!entry) {
    // Fallback for any unmapped state
    return {
      currentState: stateResult.currentState,
      confidence: "low",
      evidence: stateResult.evidence,
      known: stateResult.knownFacts,
      assumptions: stateResult.assumptions,
      blockers: stateResult.blockers,
      recommendedNextAction: {
        id: "unknown-state",
        description:
          "State detection could not map this state to a known action. Run `devflow doctor` for diagnosis.",
        why: "The current project state does not match any known Devflow state. This may indicate a corrupted state file or an unsupported project structure.",
        agentOrWorkflow: "orchestrator",
        writes: [],
        reads: [],
        safetyLevel: "caution",
      },
      alternatives: [
        {
          description: "Run devflow doctor to diagnose and fix state",
          whenToChoose: "State detection seems incorrect",
        },
        {
          description: "Manually set the state in .devflow/state.json",
          whenToChoose: "You know the correct state and need to override",
        },
      ],
    };
  }

  const hasBlockers = stateResult.blockers.length > 0;

  return {
    currentState: stateResult.currentState,
    confidence: stateResult.confidence,
    evidence: stateResult.evidence,
    known: stateResult.knownFacts,
    assumptions: stateResult.assumptions,
    blockers: stateResult.blockers,
    recommendedNextAction: {
      ...entry.primaryAction,
      safetyLevel: hasBlockers
        ? "blocked"
        : stateResult.confidence === "high"
          ? "safe"
          : "caution",
    },
    alternatives: entry.alternativeActions.map((a) => ({
      description: a.description,
      whenToChoose: a.whenToChoose,
    })),
  };
}
