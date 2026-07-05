import type { ProjectInspection } from "../types/project.js";
import type { StateDetectionResult } from "../types/state.js";
import type { ActionRecommendation } from "../types/engine.js";
import {
  renderStateSection,
  renderConfidenceSection,
  renderEvidenceSection,
  renderActiveFeatureSection,
  renderKnownFactsSection,
  renderAssumptionsSection,
  renderBlockersSection,
  renderActionSection,
  renderAlternativesSection,
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
    renderStateSection(
      stateResult.currentState,
      stateResult.confidence
    ),
    renderConfidenceSection(stateResult.confidence),
    renderEvidenceSection(stateResult.evidence),
    renderActiveFeatureSection(inspection),
    renderKnownFactsSection(stateResult),
    renderAssumptionsSection(stateResult),
    renderBlockersSection(stateResult),
    renderActionSection(recommendation),
    renderAlternativesSection(recommendation),
    renderSafetyNotes(recommendation),
    "## Last Updated",
    "",
    new Date().toISOString(),
    "",
  ];

  return sections.join("\n");
}
