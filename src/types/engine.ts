import type { DevflowState, ConfidenceLevel, Evidence } from "./state.js";

export interface ActionRecommendation {
  currentState: DevflowState;
  confidence: ConfidenceLevel;
  evidence: Evidence[];
  known: string[];
  assumptions: string[];
  blockers: string[];
  recommendedNextAction: {
    id: string;
    description: string;
    why: string;
    agentOrWorkflow: string;
    writes: string[];
    reads: string[];
    safetyLevel: "safe" | "caution" | "blocked";
  };
  alternatives: Array<{
    description: string;
    whenToChoose: string;
  }>;
}

export interface NextActionEntry {
  sourceState: DevflowState;
  targetStates: DevflowState[];
  primaryAction: {
    id: string;
    description: string;
    why: string;
    agentOrWorkflow: string;
    writes: string[];
    reads: string[];
  };
  alternativeActions: Array<{
    description: string;
    whenToChoose: string;
  }>;
  guardCondition?: string;
}
