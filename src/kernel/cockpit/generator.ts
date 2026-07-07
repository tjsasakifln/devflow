import type { ProjectInspection } from "../types/project.js";
import type { StateDetectionResult } from "../types/state.js";
import type { ActionRecommendation } from "../types/engine.js";
import {
  renderAgentContext,
  renderStateSection,
  renderConfidenceSection,
  renderPendingArtifacts,
  renderActiveFeatureSection,
  renderEvidenceSection,
  renderKnownFactsSection,
  renderAssumptionsSection,
  renderBlockersSection,
  renderActionSection,
  renderAlternativesSection,
  renderValidationCommands,
  renderRecommendedPrompt,
  renderDontDoNow,
  renderCurrentInstruction,
  renderRemainingRisks,
  renderSafetyNotes,
} from "./sections.js";

export function generateCockpit(
  stateResult: StateDetectionResult,
  recommendation: ActionRecommendation,
  inspection: ProjectInspection
): string {
  const sections = [
    "# DEVFLOW Cockpit",
    "",

    // CRITICAL: first section AI agents read before modifying code
    renderAgentContext(inspection),

    // CRITICAL: tells agent whether it can code RIGHT NOW
    renderCurrentInstruction(stateResult, inspection),

    renderStateSection(
      stateResult.currentState,
      stateResult.confidence
    ),
    renderConfidenceSection(stateResult.confidence),
    renderActiveFeatureSection(inspection),
    renderPendingArtifacts(inspection),
    renderEvidenceSection(stateResult.evidence),
    renderKnownFactsSection(stateResult),
    renderAssumptionsSection(stateResult),
    renderBlockersSection(stateResult),

    renderActionSection(recommendation),
    renderAlternativesSection(recommendation),

    renderValidationCommands(inspection),
    renderRecommendedPrompt(stateResult, inspection),
    renderDontDoNow(stateResult, inspection),

    renderSafetyNotes(recommendation),

    // Risks: what's verified, inferred, and unknown
    renderRemainingRisks(stateResult, inspection),

    "## Notes",
    "",
    `- Run \`devflow status\` for a quick overview`,
    `- Run \`devflow next\` for guided progression`,
    `- Run \`devflow doctor\` if state seems incorrect`,
    "",
    "## Last Updated",
    "",
    new Date().toISOString(),
    "",
  ];

  return sections.join("\n");
}
